import { prisma } from "./prisma";
import { formatCurrency, formatDate, formatMonthYear } from "./format";

export async function listActivity() {
  return prisma.activityLog.findMany({
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// Renders a human-readable diff for the activity feed: every field on
// CREATE, only the fields that actually changed on UPDATE — comparing via
// JSON.stringify since old/newValue are opaque JSON blobs that may nest
// (dates come back as ISO strings once round-tripped through the JSON column).
export function summarizeActivityEntry(entry: {
  action: string;
  oldValue: unknown;
  newValue: unknown;
}): string[] {
  const oldRecord = (entry.oldValue as Record<string, unknown> | null) ?? {};
  const newRecord = (entry.newValue as Record<string, unknown> | null) ?? {};

  const format = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

  if (entry.action === "CREATE") {
    return Object.entries(newRecord).map(([key, value]) => `${key}: ${format(value)}`);
  }

  const lines: string[] = [];
  for (const [key, newVal] of Object.entries(newRecord)) {
    const oldVal = oldRecord[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      lines.push(`${key}: ${format(oldVal)} → ${format(newVal)}`);
    }
  }
  return lines;
}

// MemberShare activity entries don't carry a memberId in their own newValue
// (see addMemberShare) — resolving "whose shares" for the feed means looking
// up the still-existing MemberShare row (shares are append-only, so it's
// never deleted) via the activity log entry's entityId.
export async function getShareEntryMemberIds(entityIds: string[]): Promise<Map<string, string>> {
  if (entityIds.length === 0) return new Map();

  const shares = await prisma.memberShare.findMany({
    where: { id: { in: entityIds } },
    select: { id: true, memberId: true },
  });

  return new Map(shares.map((share) => [share.id, share.memberId]));
}

export interface ActivityMemberContext {
  membersById: Map<string, { name: string }>;
  // MemberShare entries don't carry a memberId in their own newValue (see
  // addMemberShare) — the only way back to "whose shares" is the
  // MemberShare row itself, keyed by the activity log entry's entityId.
  shareEntryMemberIds: Map<string, string>;
}

// Turns a raw activity_log row into a one-line human sentence for the
// activity feed — the raw field-by-field diff from summarizeActivityEntry
// stays available underneath (mainly useful for edits) but on its own reads
// like a database dump, not something a non-technical member can parse at a
// glance.
export function describeActivityEntry(
  entry: {
    action: string;
    entityType: string;
    entityId: string;
    oldValue: unknown;
    newValue: unknown;
    actor: { name: string };
  },
  context: ActivityMemberContext,
): string {
  const actor = entry.actor.name;
  const record = (entry.newValue as Record<string, unknown> | null) ?? {};

  const memberName = (memberId: unknown) =>
    context.membersById.get(String(memberId))?.name ?? "a member";

  switch (entry.entityType) {
    case "Member": {
      if (entry.action === "CREATE") {
        return `${actor} added a new member — ${record.name} (${record.role})`;
      }
      return `${actor} updated member ${record.name}`;
    }

    case "MemberShare": {
      const forMember = memberName(context.shareEntryMemberIds.get(entry.entityId));
      return `${actor} recorded ${record.shareCount} shares for ${forMember}, effective ${formatDate(
        record.effectiveFrom as string,
      )}`;
    }

    case "MonthlyDeposit": {
      const forMember = memberName(record.memberId);
      const period = formatMonthYear(Number(record.month), Number(record.year));
      const amount = formatCurrency(Number(record.amount));
      return entry.action === "CREATE"
        ? `${actor} added a deposit of ${amount} for ${forMember} (${period})`
        : `${actor} updated a deposit for ${forMember} (${period})`;
    }

    case "AnnualTopup": {
      const forMember = memberName(record.memberId);
      const amount = formatCurrency(Number(record.amount));
      return entry.action === "CREATE"
        ? `${actor} added a top-up of ${amount} for ${forMember} (${record.year}, installment ${record.otpNumber})`
        : `${actor} updated a top-up for ${forMember} (${record.year})`;
    }

    case "Expense": {
      const amount = formatCurrency(Number(record.amount));
      return entry.action === "CREATE"
        ? `${actor} added an expense of ${amount} — ${record.category}`
        : `${actor} updated an expense — ${record.category}`;
    }

    default:
      return `${actor} ${entry.action.toLowerCase()}d ${entry.entityType}`;
  }
}
