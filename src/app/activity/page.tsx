import {
  describeActivityEntry,
  getShareEntryMemberIds,
  listActivity,
  summarizeActivityEntry,
} from "@/lib/activity";
import { listMembers } from "@/lib/members";
import { cardClasses, pageContainerClasses, rowAmountClasses, rowMutedClasses } from "@/components/styles";
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
    <main className={pageContainerClasses}>
      <div>
        <h1 className="font-display text-xl font-bold text-ink">Activity Feed</h1>
        <p className="text-sm text-ink-soft">Chronological record of every admin change to the ledger.</p>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        {entries.length === 0 && <p className="text-center text-sm text-ink-soft">No activity recorded yet.</p>}
        {entries.map((entry) => {
          const sentence = describeActivityEntry(entry, { membersById, shareEntryMemberIds });
          const changes = summarizeActivityEntry(entry);
          return (
            <article key={entry.id} className={`flex flex-col gap-4 ${cardClasses}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-accent" />
                  <p className="text-sm text-ink">{sentence}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-ink-soft">
                  {formatRelativeTime(entry.createdAt, now)}
                </span>
              </div>
              {changes.length > 0 && (
                <details className="rounded-lg bg-accent-soft p-4">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-accent">
                    Raw change log
                  </summary>
                  <ul className="mt-3 flex flex-col gap-1.5 font-mono text-xs">
                    {changes.map((line, i) => (
                      <li key={i}>
                        <ChangeLine line={line} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
