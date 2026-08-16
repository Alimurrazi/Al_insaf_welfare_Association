import { prisma } from "./prisma";

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
