import { signIn } from "@/auth";
import { GoogleIcon } from "@/components/google-icon";

// Deliberately not primaryButtonClasses (bg-accent) — Google's brand
// guidelines call for a neutral white/bordered button rather than a
// recolored one, and this button is a third-party identity action, not an
// in-app primary action.
const googleButtonClasses =
  "flex items-center gap-3 rounded-md border border-line bg-white px-6 py-3 text-base font-semibold text-ink transition-colors hover:bg-paper";

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
      <p className="max-w-sm text-center text-sm text-ink-soft">
        Member portal for tracking deposits and the land fund — only
        registered members can sign in.
      </p>
      {error === "AccessDenied" && (
        <p className="max-w-sm rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-center text-sm text-danger">
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
        <button type="submit" className={googleButtonClasses}>
          <GoogleIcon />
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
