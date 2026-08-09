import { signIn } from "@/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-semibold">Al-Insaf Welfare Association</h1>
      {error === "AccessDenied" && (
        <p className="max-w-sm text-center text-sm text-red-600">
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
          className="rounded bg-black px-4 py-2 text-white"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
