import { listActivity, summarizeActivityEntry } from "@/lib/activity";
import { rowAmountClasses, rowMutedClasses, rowPrimaryClasses } from "@/components/styles";

function formatTimestamp(date: Date) {
  return new Date(date).toISOString().slice(0, 16).replace("T", " ");
}

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
  const entries = await listActivity();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <h1 className="font-display text-xl font-bold text-ink">Activity Feed</h1>

      <ul className="flex flex-col gap-2">
        {entries.length === 0 && <li className="text-sm text-ink-soft">No activity recorded yet.</li>}
        {entries.map((entry) => {
          const changes = summarizeActivityEntry(entry);
          return (
            <li key={entry.id} className="rounded-md border border-line bg-surface p-4 text-sm text-ink">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs tabular-nums text-ink-soft">
                  {formatTimestamp(entry.createdAt)}
                </span>
                <span className={rowPrimaryClasses}>{entry.actor.name}</span>
                <span className="font-mono text-xs uppercase tracking-wide text-ink-soft">
                  {entry.action}
                </span>
                <span className="font-mono text-xs text-ink-soft">{entry.entityType}</span>
              </div>
              {changes.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
                  {changes.map((line, i) => (
                    <li key={i}>
                      <ChangeLine line={line} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
