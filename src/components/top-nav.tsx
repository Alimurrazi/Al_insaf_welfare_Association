import Link from "next/link";
import { auth, signOut } from "@/auth";
import { RoleBadge } from "./role-badge";

const linkClasses = "text-ink transition-colors hover:text-accent";

// Rendered from the root layout so every authenticated screen — not just
// the home page — has a way back to the other screens, rather than only
// the browser back button. Returns null when there's no session (e.g. the
// sign-in page, which the root layout also wraps).
export async function TopNav() {
  const session = await auth();
  if (!session) return null;

  const user = session.user;

  return (
    <header className="border-b border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/" className="font-display font-semibold text-ink hover:text-accent">
            Al-Insaf
          </Link>
          <Link href={`/ledger/${user.id}`} className={linkClasses}>
            My ledger
          </Link>
          <Link href="/ledger" className={linkClasses}>
            Ledger grid
          </Link>
          <Link href="/expenses" className={linkClasses}>
            Expenses
          </Link>
          <Link href="/activity" className={linkClasses}>
            Activity feed
          </Link>
          {user.role === "ADMIN" && (
            <>
              <Link href="/members" className={linkClasses}>
                Manage members
              </Link>
              <Link href="/deposits" className={linkClasses}>
                Manage deposits
              </Link>
              <Link href="/topups" className={linkClasses}>
                Manage annual top-ups
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-2 text-ink-soft">
            {user.name ?? user.email} <RoleBadge role={user.role} />
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/sign-in" });
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-line px-3 py-1 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
