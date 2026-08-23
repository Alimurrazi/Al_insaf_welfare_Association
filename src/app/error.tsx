"use client";

import { useEffect } from "react";
import { primaryButtonClasses } from "@/components/styles";

// App Router error boundary: catches errors thrown while rendering any page
// under this segment (e.g. a stale session pointing at a member no longer in
// the database) and shows a plain-language message instead of a raw stack
// trace, which reads as "broken" to non-technical members.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="font-display text-xl font-bold text-ink">
        Al-Insaf Welfare Association
      </h1>
      <div className="flex max-w-sm flex-col items-center gap-2 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-center text-sm text-danger">
        <p className="font-semibold">Something went wrong.</p>
        <p>
          Please try again, or sign out and back in if the problem continues.
        </p>
      </div>
      <button type="button" onClick={reset} className={primaryButtonClasses}>
        Try again
      </button>
    </main>
  );
}
