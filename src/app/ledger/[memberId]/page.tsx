import { notFound } from "next/navigation";
import Link from "next/link";
import { getMemberLedger } from "@/lib/member-ledger";
import { MemberNotFoundError } from "@/lib/members";

function formatDate(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

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
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/ledger" className="text-sm text-accent underline underline-offset-4 hover:text-accent-strong">
          ← Back to ledger grid
        </Link>
        <h1 className="font-display text-xl font-bold text-ink">{ledger.member.name}</h1>
        <p className="text-sm text-ink-soft">{ledger.member.email}</p>
      </div>

      <section className="flex flex-wrap gap-6 rounded-md border border-line bg-surface p-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Current shares</p>
          <p className="font-mono text-lg tabular-nums text-ink">{ledger.currentShareCount}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Total paid</p>
          <p className="font-mono text-lg tabular-nums text-ink">Tk {ledger.totalPaid.toFixed(2)}</p>
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
              className="rounded-md border border-line bg-surface p-3 font-mono text-sm tabular-nums text-ink"
            >
              {share.shareCount} shares effective from {formatDate(share.effectiveFrom)}
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
              className="rounded-md border border-line bg-surface p-3 font-mono text-sm tabular-nums text-ink"
            >
              {deposit.month}/{deposit.year} — Tk {Number(deposit.amount).toFixed(2)} — paid{" "}
              {formatDate(deposit.paidDate)}
              {deposit.note ? ` — ${deposit.note}` : ""}
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
              className="rounded-md border border-line bg-surface p-3 font-mono text-sm tabular-nums text-ink"
            >
              {topup.year} OTP #{topup.otpNumber} — Tk {Number(topup.amount).toFixed(2)} — paid{" "}
              {formatDate(topup.paidDate)}
              {topup.note ? ` — ${topup.note}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
