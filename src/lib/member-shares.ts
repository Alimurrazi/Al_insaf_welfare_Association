import { prisma } from "./prisma";
import { MemberNotFoundError } from "./members";
import { formatDate } from "./format";

export interface MemberShareInput {
  shareCount: number;
  effectiveFrom: Date | string;
}

// member_shares is append-only: past months must always calculate against the
// share count effective at the time, so there is no update/delete here —
// only creation of new rows and reading history.
export function validateMemberShareInput(input: Record<string, unknown>): string | null {
  const { shareCount, effectiveFrom } = input;

  if (typeof shareCount !== "number" || !Number.isInteger(shareCount) || shareCount < 1) {
    return "shareCount is required and must be a positive integer";
  }

  if (
    effectiveFrom === undefined ||
    effectiveFrom === null ||
    Number.isNaN(new Date(effectiveFrom as string | Date).getTime())
  ) {
    return "effectiveFrom is required and must be a valid date";
  }

  return null;
}

export async function addMemberShare(actorId: string, memberId: string, input: MemberShareInput) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({ where: { id: memberId } });
    if (!member) {
      throw new MemberNotFoundError(memberId);
    }

    const effectiveFrom = new Date(input.effectiveFrom);
    const share = await tx.memberShare.create({
      data: { memberId, shareCount: input.shareCount, effectiveFrom },
    });

    await tx.activityLog.create({
      data: {
        actorId,
        action: "CREATE",
        entityType: "MemberShare",
        entityId: share.id,
        newValue: { shareCount: share.shareCount, effectiveFrom: share.effectiveFrom },
      },
    });

    return share;
  });
}

export async function listMemberShares(memberId: string) {
  return prisma.memberShare.findMany({
    where: { memberId },
    orderBy: { effectiveFrom: "desc" },
  });
}

// One query for every member's history rather than one query per member —
// the members page needs all of them at once, and firing N concurrent
// queries at the local `prisma dev` engine exhausts its connection pool
// under load (see TESTING.md).
export async function listSharesForMembers(memberIds: string[]) {
  const byMember = new Map<string, Awaited<ReturnType<typeof listMemberShares>>>();
  if (memberIds.length === 0) {
    return byMember;
  }

  const shares = await prisma.memberShare.findMany({
    where: { memberId: { in: memberIds } },
    orderBy: { effectiveFrom: "desc" },
  });

  for (const share of shares) {
    const existing = byMember.get(share.memberId);
    if (existing) {
      existing.push(share);
    } else {
      byMember.set(share.memberId, [share]);
    }
  }

  return byMember;
}

// Turns a most-recent-first share history (see `listMemberShares`) into
// human-readable sentences for each transition — no free-text reason is
// stored anywhere (see UI-IMPROVEMENTS.md "Deferred"), so this is a generic
// diff, same idea as `describeActivityEntry`'s MemberShare case, just
// surfaced inline on the Members page instead of only in the activity feed.
export function summarizeShareChanges(
  shareHistory: { shareCount: number; effectiveFrom: Date }[],
): string[] {
  const ascending = [...shareHistory].sort(
    (a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime(),
  );

  const lines: string[] = [];
  for (let i = 0; i < ascending.length; i++) {
    const entry = ascending[i];
    const previous = ascending[i - 1];
    const date = formatDate(entry.effectiveFrom);

    if (!previous) {
      lines.push(`Registered with ${entry.shareCount} ${entry.shareCount === 1 ? "share" : "shares"}, effective ${date}`);
    } else {
      lines.push(`Shares changed from ${previous.shareCount} to ${entry.shareCount}, effective ${date}`);
    }
  }

  return lines.reverse();
}

export interface ShareChangeEntry {
  memberId: string;
  memberName: string;
  fromCount: number;
  toCount: number;
  effectiveFrom: Date;
}

// Cross-member feed for the Members page's "Share Allocation History"
// sidebar — same chronological pairing as `summarizeShareChanges` (fromCount
// 0 for a member's earliest row), but returning structured entries merged
// across every member and sorted most-recent-first, since the sidebar shows
// one combined feed rather than one member's history at a time.
export function getRecentShareChanges(
  membersWithShares: { id: string; name: string; shares: { shareCount: number; effectiveFrom: Date }[] }[],
  limit: number,
): ShareChangeEntry[] {
  const entries: ShareChangeEntry[] = [];

  for (const member of membersWithShares) {
    const ascending = [...member.shares].sort(
      (a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime(),
    );

    for (let i = 0; i < ascending.length; i++) {
      const entry = ascending[i];
      const previous = ascending[i - 1];
      entries.push({
        memberId: member.id,
        memberName: member.name,
        fromCount: previous?.shareCount ?? 0,
        toCount: entry.shareCount,
        effectiveFrom: entry.effectiveFrom,
      });
    }
  }

  entries.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return entries.slice(0, limit);
}

// Past months must always calculate against the share count effective at
// that time (CLAUDE.md), so "current standing" is never just the newest
// row — it's the latest row whose effectiveFrom hasn't passed asOfDate yet.
export function getShareCountAsOf(
  shares: { shareCount: number; effectiveFrom: Date }[],
  asOfDate: Date,
): number {
  let latest: { shareCount: number; effectiveFrom: Date } | null = null;
  for (const share of shares) {
    if (share.effectiveFrom > asOfDate) continue;
    if (!latest || share.effectiveFrom > latest.effectiveFrom) {
      latest = share;
    }
  }
  return latest?.shareCount ?? 0;
}
