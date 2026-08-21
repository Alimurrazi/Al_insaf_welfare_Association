import Link from "next/link";
import { getLedgerGrid, type LedgerEntry } from "@/lib/ledger";
import {
  fieldLabelClasses,
  inputClasses,
  primaryButtonClasses,
  rowAmountClasses,
  rowMutedClasses,
} from "@/components/styles";
import { formatCurrency, formatDate } from "@/lib/format";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function Cell({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) return <span className={rowMutedClasses}>—</span>;
  return (
    <div className="flex flex-col gap-1">
      {entries.map((entry) => (
        <div key={entry.id}>
          <span className={rowAmountClasses}>{formatCurrency(entry.amount)}</span>{" "}
          <span className={rowMutedClasses}>({formatDate(entry.paidDate)})</span>
        </div>
      ))}
    </div>
  );
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
    <main className="flex flex-col gap-6 px-6 py-12">
      <h1 className="font-display text-xl font-bold text-ink">Logbook</h1>

      <form action="/ledger" method="GET" className="flex flex-wrap items-end gap-3">
        <label className={fieldLabelClasses}>
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

      <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">
        ← Scroll sideways to see every month →
      </p>

      <div className="overflow-x-auto rounded-md border border-line">
        {/* table-fixed + colgroup: the Member column gets a fixed width, and
            the 14 remaining columns (months + Top-up 1/2) share whatever width
            is left equally — so on a wide screen every column actually
            stretches to use the space, instead of every column staying
            content-sized (all "—") and leaving the rest of the page blank. */}
        <table className="w-full min-w-[1400px] table-fixed border-collapse text-sm text-ink">
          <colgroup>
            <col className="w-48" />
            {MONTH_LABELS.map((label) => (
              <col key={label} />
            ))}
            <col />
            <col />
          </colgroup>
          <thead>
            <tr className="bg-surface">
              <th className="sticky left-0 z-10 border-b border-line bg-surface p-3 text-left font-mono text-xs uppercase tracking-wide text-ink-soft">
                Member
              </th>
              {MONTH_LABELS.map((label) => (
                <th
                  key={label}
                  className="border-b border-line p-3 text-left font-mono text-xs uppercase tracking-wide text-ink-soft"
                >
                  {label}
                </th>
              ))}
              <th className="border-b border-line p-3 text-left font-mono text-xs uppercase tracking-wide text-ink-soft">
                Top-up 1
              </th>
              <th className="border-b border-line p-3 text-left font-mono text-xs uppercase tracking-wide text-ink-soft">
                Top-up 2
              </th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rowIndex) => (
              <tr
                key={row.memberId}
                className={`border-b border-line last:border-0 ${rowIndex % 2 === 1 ? "bg-paper" : "bg-surface"}`}
              >
                <td className="sticky left-0 z-10 truncate bg-[inherit] p-3 font-medium">
                  <Link
                    href={`/ledger/${row.memberId}`}
                    className="text-accent underline underline-offset-4 hover:text-accent-strong hover:no-underline"
                  >
                    {row.memberName}
                  </Link>
                </td>
                {row.months.map((entries, i) => (
                  <td key={i} className="p-3 font-mono text-xs tabular-nums">
                    <Cell entries={entries} />
                  </td>
                ))}
                <td className="p-3 font-mono text-xs tabular-nums">
                  <Cell entries={row.otp1} />
                </td>
                <td className="p-3 font-mono text-xs tabular-nums">
                  <Cell entries={row.otp2} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
