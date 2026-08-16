import Link from "next/link";
import { getLedgerGrid, type LedgerEntry } from "@/lib/ledger";
import { inputClasses, primaryButtonClasses } from "@/components/styles";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatCell(entries: LedgerEntry[]) {
  if (entries.length === 0) return "—";
  return entries
    .map((entry) => `Tk ${entry.amount.toFixed(2)} (${new Date(entry.paidDate).toISOString().slice(0, 10)})`)
    .join(", ");
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const currentYear = new Date().getFullYear();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : currentYear;
  const yearOptions = Array.from({ length: 12 }, (_, i) => currentYear + 1 - i);

  const grid = await getLedgerGrid(year);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12">
      <h1 className="font-display text-xl font-bold text-ink">Ledger Grid</h1>

      <form action="/ledger" method="GET" className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Year
          <select name="year" defaultValue={year} className={inputClasses}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={primaryButtonClasses}>
          View
        </button>
      </form>

      <div className="overflow-x-auto rounded-md border border-line">
        <table className="min-w-full border-collapse text-sm text-ink">
          <thead>
            <tr className="bg-surface">
              <th className="sticky left-0 border-b border-line bg-surface p-2 text-left font-mono text-xs uppercase tracking-wide text-ink-soft">
                Member
              </th>
              {MONTH_LABELS.map((label) => (
                <th
                  key={label}
                  className="border-b border-line p-2 text-left font-mono text-xs uppercase tracking-wide text-ink-soft"
                >
                  {label}
                </th>
              ))}
              <th className="border-b border-line p-2 text-left font-mono text-xs uppercase tracking-wide text-ink-soft">
                OTP-1
              </th>
              <th className="border-b border-line p-2 text-left font-mono text-xs uppercase tracking-wide text-ink-soft">
                OTP-2
              </th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row.memberId} className="border-b border-line last:border-0">
                <td className="sticky left-0 whitespace-nowrap bg-surface p-2 font-medium">
                  <Link
                    href={`/ledger/${row.memberId}`}
                    className="text-accent underline underline-offset-4 hover:text-accent-strong hover:no-underline"
                  >
                    {row.memberName}
                  </Link>
                </td>
                {row.months.map((entries, i) => (
                  <td key={i} className="whitespace-nowrap p-2 font-mono text-xs tabular-nums">
                    {formatCell(entries)}
                  </td>
                ))}
                <td className="whitespace-nowrap p-2 font-mono text-xs tabular-nums">
                  {formatCell(row.otp1)}
                </td>
                <td className="whitespace-nowrap p-2 font-mono text-xs tabular-nums">
                  {formatCell(row.otp2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
