import Link from "next/link";
import { auth, signOut } from "@/auth";
import { RoleBadge } from "@/components/role-badge";

export default async function Home() {
  const session = await auth();
  const user = session!.user;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-xl font-bold text-ink">
          Al-Insaf Welfare Association
        </h1>
        <p className="text-sm text-ink-soft">
          Signed in as {user.name ?? user.email} <RoleBadge role={user.role} />
        </p>
      </div>

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
          <Link
            href="/expenses"
            className="text-accent underline underline-offset-4 transition-colors hover:text-accent-strong hover:no-underline"
          >
            Manage expenses
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
