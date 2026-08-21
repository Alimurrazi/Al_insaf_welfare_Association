import {
  describeActivityEntry,
  getShareEntryMemberIds,
  listActivity,
  summarizeActivityEntry,
} from "@/lib/activity";
import { listMembers } from "@/lib/members";
import { rowAmountClasses, rowMutedClasses } from "@/components/styles";
import { formatRelativeTime } from "@/lib/format";

// summarizeActivityEntry returns plain "key: value" (CREATE) or
// "key: old → new" (UPDATE) strings — parsed back apart here purely for
// display so the old value can recede and the new value can stand out,
// without changing that function's tested string-based return shape.
function ChangeLine({ line }: { line: string }) {
  const separatorIndex = line.indexOf(": ");
  const key = line.slice(0, separatorIndex);
  const rest = line.slice(separatorIndex + 2);
  const arrowIndex = rest.indexOf(" → ");
  if (arrowIndex === -1) {
    return (
      <>
        <span className={rowMutedClasses}>{key}:</span> <span className={rowAmountClasses}>{rest}</span>
      </>
    );
  }
  const oldVal = rest.slice(0, arrowIndex);
  const newVal = rest.slice(arrowIndex + 3);
  return (
    <>
      <span className={rowMutedClasses}>{key}:</span> <span className={rowMutedClasses}>{oldVal}</span>{" "}
      <span className={rowMutedClasses}>→</span> <span className={rowAmountClasses}>{newVal}</span>
    </>
  );
}

export default async function ActivityPage() {
  const now = new Date();
  const [entries, members] = await Promise.all([listActivity(), listMembers()]);

  const shareEntryIds = entries.filter((entry) => entry.entityType === "MemberShare").map((entry) => entry.id);
  const shareEntryMemberIds = await getShareEntryMemberIds(shareEntryIds);
  const membersById = new Map(members.map((member) => [member.id, { name: member.name }]));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <h1 className="font-display text-xl font-bold text-ink">Activity Feed</h1>

      <ul className="flex flex-col gap-2">
        {entries.length === 0 && <li className="text-sm text-ink-soft">No activity recorded yet.</li>}
        {entries.map((entry) => {
          const sentence = describeActivityEntry(entry, { membersById, shareEntryMemberIds });
          const changes = summarizeActivityEntry(entry);
          return (
            <li key={entry.id} className="rounded-md border border-line bg-surface p-4 text-sm text-ink">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span>{sentence}</span>
                <span className="font-mono text-xs tabular-nums text-ink-soft">
                  {formatRelativeTime(entry.createdAt, now)}
                </span>
              </div>
              {changes.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-ink-soft">
                    Details
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
                    {changes.map((line, i) => (
                      <li key={i}>
                        <ChangeLine line={line} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
