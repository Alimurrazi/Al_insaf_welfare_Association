// Shared between page.tsx (server) and member-row.tsx (client) — kept in its
// own module with no server-only imports so importing it doesn't drag
// next/cache, @/auth, or @/lib/members into the client bundle.
export const inputClasses =
  "rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:border-accent";
export const primaryButtonClasses =
  "rounded-md bg-accent px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-accent-strong";
export const secondaryButtonClasses =
  "rounded-md border border-line px-3 py-1 text-sm text-ink transition-colors hover:border-accent hover:text-accent";
