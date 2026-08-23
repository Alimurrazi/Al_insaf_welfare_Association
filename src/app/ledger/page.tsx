import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { auth } from "@/auth";
import { getLedgerGrid, type LedgerEntry } from "@/lib/ledger";
import { getShareCountAsOf, listSharesForMembers } from "@/lib/member-shares";
import {
  cardClasses,
  inputClasses,
  pageContainerClasses,
  primaryButtonClasses,
  rowAmountClasses,
  rowMutedClasses,
} from "@/components/styles";
import { formatCurrency, formatDate } from "@/lib/format";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Tick view (per UI-IMPROVEMENTS.md item 5): most cells only need a
// paid/unpaid glance, not a dollar figure — this is the screen phones handle
// worst (1400px of sideways-scrolling amounts), so a plain ✓ shrinks it
// drastically. More than one deposit landing in the same month (a real
// possibility per the schema — see getLedgerGrid's comment) still shows each
// amount below the tick rather than silently collapsing them.
function MonthCell({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return <span aria-label="Not paid" className="block text-center text-ink-soft">–</span>;
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        aria-label="Paid"
        className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-accent"
      >
        <Check className="size-3.5" />
      </span>
      {entries.length > 1 && (
        <span className="font-mono text-[10px] text-ink-soft">×{entries.length}</span>
      )}
    </div>
  );
}

function TopupCell({ entries }: { entries: LedgerEntry[] }) {
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

function sumEntries(...groups: LedgerEntry[][]): number {
  return groups.flat().reduce((sum, entry) => sum + entry.amount, 0);
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  const now = new Date();
  const currentYear = now.getFullYear();
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : currentYear;
  const yearOptions = Array.from({ length: 12 }, (_, i) => currentYear + 1 - i);
  const currentMonthIndex = year === currentYear ? now.getMonth() : -1;

  const grid = await getLedgerGrid(year);
  const shareHistories = await listSharesForMembers(grid.map((row) => row.memberId));

  return (
    <main className={pageContainerClasses}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Registry Logbook</h1>
          <p className="text-sm text-ink-soft">Read-only matrix of every member&apos;s monthly deposit completion.</p>
        </div>
        <form action="/ledger" method="GET" className="flex items-center gap-2">
          <div className="relative">
            <select name="year" defaultValue={year} className={`${inputClasses} appearance-none py-2 pr-9`}>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Year: {y}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-soft" />
          </div>
          <button type="submit" className={primaryButtonClasses}>
            View
          </button>
        </form>
      </div>

      <div className={`flex flex-wrap items-center gap-6 ${cardClasses} py-4`}>
        <div className="flex items-center gap-2 text-sm">
          <span className="flex size-4 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Check className="size-2.5" />
          </span>
          <span className="text-ink-soft">Paid</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="size-4 rounded-full border border-line" />
          <span className="text-ink-soft">Not yet paid</span>
        </div>
        <p className="ml-auto text-xs text-ink-soft">← Scroll sideways to see every month →</p>
      </div>

      <div className={`overflow-x-auto ${cardClasses} p-0`}>
        {/* table-fixed + colgroup: the Member column gets a fixed width, and
            the remaining columns share whatever width is left equally — so
            on a wide screen every column actually stretches to use the
            space, instead of every column staying content-sized. */}
        <table className="w-full min-w-[1200px] table-fixed border-collapse text-sm text-ink">
          <colgroup>
            <col className="w-56" />
            {MONTH_LABELS.map((label) => (
              <col key={label} />
            ))}
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-32" />
          </colgroup>
          <thead>
            <tr className="bg-paper">
              <th className="sticky left-0 z-10 bg-paper p-3 text-left text-xs font-semibold text-ink-soft">
                Member Name
              </th>
              {MONTH_LABELS.map((label, i) => (
                <th
                  key={label}
                  className={`p-3 text-center text-xs font-semibold ${
                    i === currentMonthIndex ? "bg-accent-soft text-accent" : "text-ink-soft"
                  }`}
                >
                  {label}
                </th>
              ))}
              <th className="p-3 text-left text-xs font-semibold text-ink-soft">Top-up 1</th>
              <th className="p-3 text-left text-xs font-semibold text-ink-soft">Top-up 2</th>
              <th className="p-3 text-left text-xs font-semibold text-ink-soft">Total Paid</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => {
              const isOwnRow = row.memberId === session?.user.id;
              const shareCount = getShareCountAsOf(shareHistories.get(row.memberId) ?? [], now);
              const total = sumEntries(...row.months, row.otp1, row.otp2);
              return (
                <tr key={row.memberId} className={`border-t border-line ${isOwnRow ? "bg-accent-soft/40" : ""}`}>
                  <td className="sticky left-0 z-10 truncate bg-[inherit] p-3">
                    <Link
                      href={`/ledger/${row.memberId}`}
                      className="font-semibold text-ink hover:text-accent hover:underline"
                    >
                      {row.memberName}
                    </Link>
                    <p className="text-xs text-ink-soft">
                      {shareCount} {shareCount === 1 ? "Share" : "Shares"}
                    </p>
                  </td>
                  {row.months.map((entries, i) => (
                    <td key={i} className={`p-3 ${i === currentMonthIndex ? "bg-accent-soft/20" : ""}`}>
                      <MonthCell entries={entries} />
                    </td>
                  ))}
                  <td className="p-3 font-mono text-xs tabular-nums">
                    <TopupCell entries={row.otp1} />
                  </td>
                  <td className="p-3 font-mono text-xs tabular-nums">
                    <TopupCell entries={row.otp2} />
                  </td>
                  <td className="p-3 font-mono text-sm font-semibold tabular-nums text-accent">
                    {formatCurrency(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
