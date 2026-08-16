import { auth } from "@/auth";
import { RoleBadge } from "@/components/role-badge";
import { getDashboardSummary } from "@/lib/dashboard";
import { getMemberLedger } from "@/lib/member-ledger";

export default async function Home() {
  const session = await auth();
  const user = session!.user;

  const [summary, personal] = await Promise.all([
    getDashboardSummary(),
    getMemberLedger(user.id, new Date()),
  ]);

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

      <section className="flex flex-wrap justify-center gap-6 rounded-md border border-line bg-surface p-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Total collected</p>
          <p className="font-mono text-lg tabular-nums text-ink">Tk {summary.totalCollected.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Total spent</p>
          <p className="font-mono text-lg tabular-nums text-ink">Tk {summary.totalSpent.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Balance in hand</p>
          <p className="font-mono text-lg tabular-nums text-ink">Tk {summary.balance.toFixed(2)}</p>
        </div>
      </section>

      <section className="flex flex-wrap justify-center gap-6 rounded-md border border-line bg-surface p-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Your shares</p>
          <p className="font-mono text-lg tabular-nums text-ink">{personal.currentShareCount}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Your total paid</p>
          <p className="font-mono text-lg tabular-nums text-ink">Tk {personal.totalPaid.toFixed(2)}</p>
        </div>
      </section>
    </main>
  );
}
