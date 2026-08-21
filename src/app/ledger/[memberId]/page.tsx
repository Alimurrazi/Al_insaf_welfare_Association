import { notFound } from "next/navigation";
import Link from "next/link";
import { getMemberLedger } from "@/lib/member-ledger";
import { MemberNotFoundError } from "@/lib/members";
import { rowAmountClasses, rowMutedClasses, rowNoteClasses, rowPrimaryClasses } from "@/components/styles";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/format";

export default async function MemberLedgerPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;

  let ledger;
  try {
    ledger = await getMemberLedger(memberId, new Date());
  } catch (error) {
    if (error instanceof MemberNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/ledger" className="text-sm text-accent underline underline-offset-4 hover:text-accent-strong">
          ← Back to Logbook
        </Link>
        <h1 className="font-display text-xl font-bold text-ink">{ledger.member.name}</h1>
        <p className="text-sm text-ink-soft">{ledger.member.email}</p>
      </div>

      <section className="flex flex-wrap gap-8 rounded-md border border-line bg-surface p-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Current shares</p>
          <p className="font-mono text-lg tabular-nums text-ink">{ledger.currentShareCount}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Total paid</p>
          <p className="font-mono text-lg tabular-nums text-ink">{formatCurrency(ledger.totalPaid)}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Share history</p>
        <ul className="flex flex-col gap-2">
          {ledger.shareHistory.length === 0 && (
            <li className="text-sm text-ink-soft">No share history recorded.</li>
          )}
          {ledger.shareHistory.map((share) => (
            <li
              key={share.id}
              className="flex flex-wrap items-center gap-x-2 rounded-md border border-line bg-surface p-4 font-mono text-sm tabular-nums"
            >
              <span className={rowPrimaryClasses}>{share.shareCount} shares</span>
              <span className={rowMutedClasses}>effective from {formatDate(share.effectiveFrom)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Monthly deposits</p>
        <ul className="flex flex-col gap-2">
          {ledger.deposits.length === 0 && (
            <li className="text-sm text-ink-soft">No deposits recorded.</li>
          )}
          {ledger.deposits.map((deposit) => (
            <li
              key={deposit.id}
              className="flex flex-wrap items-center gap-x-2 rounded-md border border-line bg-surface p-4 font-mono text-sm tabular-nums"
            >
              <span className={rowMutedClasses}>
                {formatMonthYear(deposit.month, deposit.year)} —
              </span>
              <span className={rowAmountClasses}>{formatCurrency(Number(deposit.amount))}</span>
              <span className={rowMutedClasses}>— paid {formatDate(deposit.paidDate)}</span>
              {deposit.note && <span className={rowNoteClasses}>— {deposit.note}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Annual top-ups</p>
        <ul className="flex flex-col gap-2">
          {ledger.topups.length === 0 && (
            <li className="text-sm text-ink-soft">No top-ups recorded.</li>
          )}
          {ledger.topups.map((topup) => (
            <li
              key={topup.id}
              className="flex flex-wrap items-center gap-x-2 rounded-md border border-line bg-surface p-4 font-mono text-sm tabular-nums"
            >
              <span className={rowMutedClasses}>
                {topup.year} OTP #{topup.otpNumber} —
              </span>
              <span className={rowAmountClasses}>{formatCurrency(Number(topup.amount))}</span>
              <span className={rowMutedClasses}>— paid {formatDate(topup.paidDate)}</span>
              {topup.note && <span className={rowNoteClasses}>— {topup.note}</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
