import { Landmark } from "lucide-react";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { GoogleIcon } from "@/components/google-icon";

// Deliberately not primaryButtonClasses (bg-accent) — Google's brand
// guidelines call for a neutral white/bordered button rather than a
// recolored one, and this button is a third-party identity action, not an
// in-app primary action.
const googleButtonClasses =
  "flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-white px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-paper";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  // The root layout renders TopNav on every page, including this one, and
  // TopNav shows the logged-in header as soon as a session cookie exists —
  // so without this check, a session that's already valid (e.g. the OAuth
  // redirect bounced back here) leaves the topbar looking signed-in while
  // this card still shows the "Sign in with Google" prompt underneath it.
  const session = await auth();
  if (session) redirect(callbackUrl?.startsWith("/") ? callbackUrl : "/");

  return (
    // The two soft blurred circles echo the Figma sign-in frame's background
    // blobs — recreated as plain CSS (blur + tinted tokens) instead of the
    // Figma file's exported SVGs, so they scale with the viewport and
    // inherit dark mode via the existing color tokens.
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -left-32 -top-32 size-[420px] rounded-full bg-accent-soft opacity-60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 size-[380px] rounded-full bg-gold-soft opacity-50 blur-3xl" />

      <div className="relative flex w-full max-w-[460px] flex-col gap-8 rounded-3xl border border-line bg-surface p-10 shadow-lg">
        <div className="flex flex-col items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-white">
            <Landmark className="size-7" />
          </span>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="font-display text-lg font-bold text-ink">Al-Insaf Welfare Association</h1>
            <p className="text-sm text-ink-soft">Transparent community land-fund portal</p>
          </div>
        </div>

        <div className="h-px w-full bg-line" />

        <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent-soft p-4">
          <p className="text-sm font-semibold text-accent">Group Land Purchase Fund</p>
          <p className="text-xs leading-relaxed text-ink-soft">
            A shared registry for the group&apos;s monthly deposits, annual top-ups, and expenses toward
            purchasing land together.
          </p>
        </div>

        {error === "AccessDenied" && (
          <p className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-center text-sm text-danger">
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

        <p className="text-center text-xs text-ink-soft">
          Need portal access? Ask an admin to add your email to the member list.
        </p>
      </div>
    </main>
  );
}
