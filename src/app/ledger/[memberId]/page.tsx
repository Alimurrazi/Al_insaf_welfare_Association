import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMemberLedger } from "@/lib/member-ledger";
import { listMembers, MemberNotFoundError } from "@/lib/members";
import { getShareCountAsOf, listSharesForMembers, summarizeShareChanges } from "@/lib/member-shares";
import { RoleBadge } from "@/components/role-badge";
import { cardClasses, pageContainerClasses } from "@/components/styles";
import { formatCurrency, formatDate } from "@/lib/format";

const TRANSACTION_TYPE_LABEL = { DEPOSIT: "Deposit", TOPUP: "Top-up" } as const;

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

  // Group-wide share total, for "X Shares (Y%)" — same calculation as the
  // Members page, just for one member's summary card here.
  const now = new Date();
  const allMembers = await listMembers();
  const allShares = await listSharesForMembers(allMembers.map((m) => m.id));
  const totalShares = allMembers.reduce(
    (sum, m) => sum + getShareCountAsOf(allShares.get(m.id) ?? [], now),
    0,
  );
  const sharePercent = totalShares > 0 ? (ledger.currentShareCount / totalShares) * 100 : 0;

  return (
    <main className={pageContainerClasses}>
      <div>
        <Link
          href="/ledger"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-strong hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to Logbook
        </Link>
        <h1 className="font-display text-xl font-bold text-ink">My Contribution Passbook</h1>
        <p className="text-sm text-ink-soft">Read-only statement of deposits and top-ups.</p>
      </div>

      <section className={`flex flex-wrap items-center gap-10 ${cardClasses}`}>
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
            {ledger.member.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="text-lg font-bold text-ink">{ledger.member.name}</p>
            <p className="text-sm text-ink-soft">{ledger.member.email}</p>
          </div>
        </div>
        <div className="h-12 w-px bg-line" />
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Access Level</p>
            <RoleBadge role={ledger.member.role} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Shares Allocated</p>
            <p className="font-mono text-base font-bold tabular-nums text-accent">
              {ledger.currentShareCount} {ledger.currentShareCount === 1 ? "Share" : "Shares"} ({sharePercent.toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Total Contributed</p>
            <p className="font-mono text-base font-bold tabular-nums text-accent">
              {formatCurrency(ledger.totalPaid)}
            </p>
          </div>
        </div>
      </section>

      <section className={`flex flex-col gap-0 overflow-hidden ${cardClasses} p-0`}>
        <div className="grid grid-cols-[140px_120px_minmax(200px,1fr)_140px_150px] items-center gap-4 bg-paper px-6 py-3 text-xs font-semibold text-ink-soft">
          <span>Date</span>
          <span>Type</span>
          <span>Description</span>
          <span>Amount</span>
          <span className="text-right">Ledger Balance</span>
        </div>
        {ledger.transactions.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">No deposits or top-ups recorded yet.</p>
        ) : (
          ledger.transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="grid grid-cols-[140px_120px_minmax(200px,1fr)_140px_150px] items-center gap-4 border-t border-line px-6 py-3.5 text-sm"
            >
              <span className="text-ink-soft">{formatDate(transaction.date)}</span>
              <span className="w-fit rounded-md bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                {TRANSACTION_TYPE_LABEL[transaction.type]}
              </span>
              <span className="truncate font-semibold text-ink">
                {transaction.label}
                {transaction.note && <span className="italic text-ink-soft"> — {transaction.note}</span>}
              </span>
              <span className="font-mono font-semibold tabular-nums text-accent">
                {formatCurrency(transaction.amount)}
              </span>
              <span className="text-right font-mono font-bold tabular-nums text-ink">
                {formatCurrency(transaction.balance)}
              </span>
            </div>
          ))
        )}
      </section>

      <section className={`flex flex-col gap-3 ${cardClasses}`}>
        <h2 className="text-base font-bold text-ink">Share History</h2>
        {ledger.shareHistory.length === 0 ? (
          <p className="text-sm text-ink-soft">No share history recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
            {summarizeShareChanges(ledger.shareHistory).map((summary, i) => (
              <li key={i}>{summary}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
