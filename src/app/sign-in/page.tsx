import { signIn } from "@/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="font-display text-xl font-bold text-ink">
        Al-Insaf Welfare Association
      </h1>
      {error === "AccessDenied" && (
        <p className="max-w-sm rounded-md border border-danger/30 bg-danger-soft px-4 py-2 text-center text-sm text-danger">
          This Google account is not on the member allow-list. Ask an admin
          to add your email before signing in.
        </p>
      )}
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
