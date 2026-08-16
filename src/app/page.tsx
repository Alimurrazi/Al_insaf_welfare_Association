import { auth, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();
  const user = session!.user;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-semibold">Al-Insaf Welfare Association</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as {user.name ?? user.email}{" "}
          <span className="rounded bg-black/[.06] px-1.5 py-0.5 text-xs font-medium dark:bg-white/[.08]">
            {user.role}
          </span>
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/sign-in" });
        }}
      >
        <button
          type="submit"
          className="rounded border border-black/[.08] px-4 py-2 text-sm transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.08]"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
