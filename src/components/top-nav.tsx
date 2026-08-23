import Link from "next/link";
import { Landmark, LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import { RoleBadge } from "./role-badge";
import { TopNavLinks } from "./top-nav-links";

// Rendered from the root layout so every authenticated screen — not just
// the home page — has a way back to the other screens, rather than only
// the browser back button. Returns null when there's no session (e.g. the
// sign-in page, which the root layout also wraps).
export async function TopNav() {
  const session = await auth();
  if (!session) return null;

  const user = session.user;
  const displayName = user.name ?? user.email ?? "";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="flex h-[72px] items-stretch justify-between gap-4 border-b border-line bg-surface px-4 sm:px-10">
      <Link href="/" className="flex shrink-0 items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-white">
          <Landmark className="size-5" />
        </span>
        <span className="flex flex-col leading-none">
          <span className="font-display text-base font-bold text-accent">Al-Insaf</span>
          <span className="text-xs uppercase tracking-wide text-ink-soft">Welfare Association</span>
        </span>
      </Link>

      <TopNavLinks userId={user.id} role={user.role} />

      <div className="flex shrink-0 items-center gap-4">
        <div className="hidden h-6 w-px bg-line sm:block" />
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
          >
            {initial}
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-medium text-ink">{displayName}</span>
            <RoleBadge role={user.role} />
          </span>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        >
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="flex items-center rounded-md p-1.5 text-ink-soft transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <LogOut className="size-[18px]" />
          </button>
        </form>
      </div>
    </header>
  );
}
