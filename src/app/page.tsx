import Link from "next/link";
import { auth, signOut } from "@/auth";
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-4 py-12">
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
          <p className="font-mono text-lg tabular-nums text-ink">${summary.totalCollected.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Total spent</p>
          <p className="font-mono text-lg tabular-nums text-ink">${summary.totalSpent.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Balance in hand</p>
          <p className="font-mono text-lg tabular-nums text-ink">${summary.balance.toFixed(2)}</p>
        </div>
      </section>

      <section className="flex flex-wrap justify-center gap-6 rounded-md border border-line bg-surface p-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Your shares</p>
          <p className="font-mono text-lg tabular-nums text-ink">{personal.currentShareCount}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Your total paid</p>
          <p className="font-mono text-lg tabular-nums text-ink">${personal.totalPaid.toFixed(2)}</p>
        </div>
      </section>

      <nav className="flex flex-col items-center gap-2 text-sm">
        <Link
          href={`/ledger/${user.id}`}
          className="text-accent underline underline-offset-4 transition-colors hover:text-accent-strong hover:no-underline"
        >
          My ledger
        </Link>
        <Link
          href="/ledger"
          className="text-accent underline underline-offset-4 transition-colors hover:text-accent-strong hover:no-underline"
        >
          Ledger grid
        </Link>
        <Link
          href="/expenses"
          className="text-accent underline underline-offset-4 transition-colors hover:text-accent-strong hover:no-underline"
        >
          Expenses
        </Link>
        <Link
          href="/activity"
          className="text-accent underline underline-offset-4 transition-colors hover:text-accent-strong hover:no-underline"
        >
          Activity feed
        </Link>
      </nav>

      {user.role === "ADMIN" && (
        <nav className="flex flex-col items-center gap-2 text-sm">
          <Link
            href="/members"
            className="text-accent underline underline-offset-4 transition-colors hover:text-accent-strong hover:no-underline"
          >
            Manage members
          </Link>
          <Link
            href="/deposits"
            className="text-accent underline underline-offset-4 transition-colors hover:text-accent-strong hover:no-underline"
          >
            Manage deposits
          </Link>
          <Link
            href="/topups"
            className="text-accent underline underline-offset-4 transition-colors hover:text-accent-strong hover:no-underline"
          >
            Manage annual top-ups
          </Link>
        </nav>
      )}

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/sign-in" });
        }}
      >
        <button
          type="submit"
          className="rounded-md border border-line px-4 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
