import { auth } from "@/auth";
import { RoleBadge } from "@/components/role-badge";
import { getDashboardSummary } from "@/lib/dashboard";
import { getMemberLedger } from "@/lib/member-ledger";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { getPaidMonths, getUnpaidMembers } from "@/lib/payment-status";

export default async function Home() {
  const session = await auth();
  const user = session!.user;
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();

  // Sequential, not Promise.all — each of these three calls already fans out
  // into 2-4 of its own concurrent queries internally (getDashboardSummary,
  // getMemberLedger, getUnpaidMembers), so running all three together could
  // briefly open ~9 connections for a single admin page load. The local dev
  // Postgres engine (`prisma dev`) has a small connection pool and drops
  // connections under that burst (P1017 ConnectionClosed); a real Postgres
  // instance has room to spare, but there's no benefit to the extra
  // concurrency here — this is a single dashboard load, not a hot path.
  const summary = await getDashboardSummary();
  const personal = await getMemberLedger(user.id, now);
  const unpaidMembers = user.role === "ADMIN" ? await getUnpaidMembers(currentMonth, currentYear) : null;

  const paidMonthsThisYear = getPaidMonths(personal.deposits, currentYear);
  const hasPaidCurrentMonth = paidMonthsThisYear.has(currentMonth);
  const currentMonthLabel = formatMonthYear(currentMonth, currentYear);

  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-xl font-bold text-ink">
          Al-Insaf Welfare Association
        </h1>
        <p className="text-sm text-ink-soft">
          Signed in as {user.name ?? user.email} <RoleBadge role={user.role} />
        </p>
      </div>

      <section className="flex flex-wrap justify-center gap-8 rounded-md border border-line bg-surface p-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Total collected</p>
          <p className="font-mono text-lg tabular-nums text-ink">{formatCurrency(summary.totalCollected)}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Total spent</p>
          <p className="font-mono text-lg tabular-nums text-ink">{formatCurrency(summary.totalSpent)}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Balance in hand</p>
          <p className="font-mono text-lg tabular-nums text-ink">{formatCurrency(summary.balance)}</p>
        </div>
      </section>

      {/* Answers the #1 question a member has — "have I paid this month?" —
          rather than making them cross-reference the passbook/Logbook to
          find out. Unpaid is a neutral tint, not danger-red: `danger` in
          this design system means errors, and painting a shared status in
          error-red is unnecessarily alarming for a routine, common state. */}
      <section
        className={`w-full max-w-md rounded-md border border-line p-4 text-center text-sm ${
          hasPaidCurrentMonth ? "bg-accent-soft text-accent" : "bg-paper text-ink-soft"
        }`}
      >
        {hasPaidCurrentMonth ? (
          <span>✓ Paid for {currentMonthLabel}</span>
        ) : (
          <span>{currentMonthLabel} not yet paid</span>
        )}
      </section>

      {user.role === "ADMIN" && unpaidMembers && (
        <section className="w-full max-w-md rounded-md border border-line bg-surface p-4 text-center text-sm text-ink-soft">
          {unpaidMembers.length === 0 ? (
            <span>All members have paid for {currentMonthLabel}.</span>
          ) : (
            <span>
              {unpaidMembers.length} {unpaidMembers.length === 1 ? "member hasn't" : "members haven't"} paid for{" "}
              {currentMonthLabel} yet: {unpaidMembers.map((member) => member.name).join(", ")}
            </span>
          )}
        </section>
      )}

      <section className="flex flex-wrap justify-center gap-8 rounded-md border border-line bg-surface p-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Your shares</p>
          <p className="font-mono text-lg tabular-nums text-ink">{personal.currentShareCount}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Your total paid</p>
          <p className="font-mono text-lg tabular-nums text-ink">{formatCurrency(personal.totalPaid)}</p>
        </div>
      </section>
    </main>
  );
}
