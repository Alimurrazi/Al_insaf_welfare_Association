import Link from "next/link";
import { Calendar, CheckCircle2, Info, Receipt, Wallet } from "lucide-react";
import { auth } from "@/auth";
import { cardClasses, pageContainerClasses, rowActionButtonClasses, statTileClasses, statTileIconClasses } from "@/components/styles";
import { getContributionSharePercent, getDashboardSummary } from "@/lib/dashboard";
import { getMemberLedger } from "@/lib/member-ledger";
import { listMembers } from "@/lib/members";
import { formatCurrency, formatDate } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/month-names";
import { getNextPaymentDue, getPaidMonths, getUnpaidMembers } from "@/lib/payment-status";

export default async function Home() {
  const session = await auth();
  const user = session!.user;
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  const isAdmin = user.role === "ADMIN";

  // Sequential, not Promise.all — each of these calls already fans out into
  // 2-4 of its own concurrent queries internally (getDashboardSummary,
  // getMemberLedger, getUnpaidMembers), so running them all together could
  // briefly open close to a dozen connections for a single page load. A real
  // Postgres instance (see TESTING.md) has room to spare, but there's no
  // benefit to the extra concurrency here — this is a single dashboard load,
  // not a hot path.
  const summary = await getDashboardSummary();
  const personal = await getMemberLedger(user.id, now);
  const unpaidMembers = isAdmin ? await getUnpaidMembers(currentMonth, currentYear) : null;
  const allMembers = isAdmin ? await listMembers() : null;

  const paidMonthsThisYear = getPaidMonths(personal.deposits, currentYear);
  const hasPaidCurrentMonth = paidMonthsThisYear.has(currentMonth);
  const currentMonthLabel = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;
  const nextPaymentDue = getNextPaymentDue(now);
  const contributionPercent = getContributionSharePercent(personal.totalPaid, summary.totalCollected);

  return (
    <main className={pageContainerClasses}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-ink-soft">Overview of the Al-Insaf land fund</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink">
          <Calendar className="size-4 text-ink-soft" />
          {currentMonthLabel}
        </div>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className={statTileClasses}>
          <span className={`${statTileIconClasses} bg-accent-soft text-accent`}>
            <Wallet className="size-6" />
          </span>
          <div>
            <p className="text-sm text-ink-soft">Total Collected</p>
            <p className="font-mono text-lg font-bold tabular-nums text-ink">{formatCurrency(summary.totalCollected)}</p>
          </div>
        </div>
        <div className={statTileClasses}>
          <span className={`${statTileIconClasses} bg-paper text-ink-soft`}>
            <Receipt className="size-6" />
          </span>
          <div>
            <p className="text-sm text-ink-soft">Total Spent</p>
            <p className="font-mono text-lg font-bold tabular-nums text-ink">{formatCurrency(summary.totalSpent)}</p>
          </div>
        </div>
        <div className={statTileClasses}>
          <span className={`${statTileIconClasses} bg-paper text-ink-soft`}>
            <Wallet className="size-6" />
          </span>
          <div>
            <p className="text-sm text-ink-soft">Remaining Balance</p>
            <p className="font-mono text-lg font-bold tabular-nums text-ink">{formatCurrency(summary.balance)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <section className={`flex w-full flex-col gap-4 lg:w-[400px] lg:shrink-0 ${cardClasses}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">My Passbook Snapshot</h2>
            {/* Answers the #1 question a member has — "have I paid this
                month?". Unpaid is a neutral tint, not danger-red: `danger`
                means errors, and painting a member's status in error-red in
                a shared view is unnecessarily alarming for a routine,
                common state. */}
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                hasPaidCurrentMonth ? "bg-accent-soft text-accent" : "bg-paper text-ink-soft"
              }`}
            >
              {hasPaidCurrentMonth && <CheckCircle2 className="size-3.5" />}
              {hasPaidCurrentMonth ? "Paid this Month" : "Not yet paid"}
            </span>
          </div>
          <div className="h-px w-full bg-line" />
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">Assigned Shares</span>
              <span className="font-semibold text-ink">{personal.currentShareCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">Total Paid</span>
              <span className="font-semibold text-accent">{formatCurrency(personal.totalPaid)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">Next Payment Due</span>
              <span className="font-medium text-ink-soft">{formatDate(nextPaymentDue)}</span>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-accent-soft p-3 text-xs text-accent">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>Your contributions account for {contributionPercent}% of everything the group has collected so far.</p>
          </div>
        </section>

        {isAdmin && unpaidMembers && allMembers && (
          <section className={`flex w-full flex-1 flex-col gap-5 ${cardClasses}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-ink">Unpaid Members</h2>
                  {unpaidMembers.length > 0 && (
                    <span className="rounded-md bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                      {unpaidMembers.length} of {allMembers.length} Unpaid
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-soft">{currentMonthLabel} Deposit Cycle</p>
              </div>
            </div>
            {unpaidMembers.length === 0 ? (
              <p className="text-sm text-ink-soft">All members have paid for {currentMonthLabel}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="bg-paper text-xs font-semibold text-ink-soft">
                      <th className="rounded-l-md px-4 py-2.5 font-semibold">Member Name</th>
                      <th className="px-4 py-2.5 font-semibold">Shares Held</th>
                      <th className="rounded-r-md px-4 py-2.5 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidMembers.map((member) => (
                      <tr key={member.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-semibold text-ink">{member.name}</td>
                        <td className="px-4 py-3 text-ink-soft">
                          {member.shareCount} {member.shareCount === 1 ? "Share" : "Shares"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/deposits?memberId=${member.id}`} className={rowActionButtonClasses}>
                            Log Payment
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
