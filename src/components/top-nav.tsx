import { auth, signOut } from "@/auth";
import { RoleBadge } from "./role-badge";
import { TopNavLinks } from "./top-nav-links";
import { secondaryButtonClasses } from "./styles";

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
        <TopNavLinks userId={user.id} role={user.role} />

        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2 text-ink-soft">
            {user.name ?? user.email} <RoleBadge role={user.role} />
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/sign-in" });
            }}
          >
            <button type="submit" className={secondaryButtonClasses}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
