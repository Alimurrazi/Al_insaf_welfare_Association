import { listActivity, summarizeActivityEntry } from "@/lib/activity";

function formatTimestamp(date: Date) {
  return new Date(date).toISOString().slice(0, 16).replace("T", " ");
}

export default async function ActivityPage() {
  const entries = await listActivity();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-xl font-bold text-ink">Activity Feed</h1>

      <ul className="flex flex-col gap-2">
        {entries.length === 0 && <li className="text-sm text-ink-soft">No activity recorded yet.</li>}
        {entries.map((entry) => {
          const changes = summarizeActivityEntry(entry);
          return (
            <li key={entry.id} className="rounded-md border border-line bg-surface p-3 text-sm text-ink">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs tabular-nums text-ink-soft">
                  {formatTimestamp(entry.createdAt)}
                </span>
                <span className="font-semibold">{entry.actor.name}</span>
                <span className="font-mono text-xs uppercase tracking-wide text-ink-soft">
                  {entry.action}
                </span>
                <span className="font-mono text-xs text-ink-soft">{entry.entityType}</span>
              </div>
              {changes.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 font-mono text-xs text-ink-soft">
                  {changes.map((line, i) => (
                    <li key={i}>{line}</li>
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
