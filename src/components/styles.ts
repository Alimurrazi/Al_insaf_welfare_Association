// Shared across every admin screen's page.tsx (server) and *-row.tsx (client)
// components — kept in its own module with no server-only imports so
// importing it doesn't drag next/cache, @/auth, or lib modules into the
// client bundle.
//
// Padding is generous (buttons ~48px tall, inputs ~46px) rather than
// Tailwind-default-compact: most users of this app aren't technical, so
// comfortable tap targets matter more than density.
export const inputClasses =
  "w-full rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:border-accent";
// Forms lay out as a two-column grid on anything wider than a phone (one
// column on narrow screens) rather than either the cramped horizontal
// layout non-technical users tend to misread, or a single narrow stacked
// column that leaves the wide page mostly empty. Field order in markup
// reads naturally left-to-right, top-to-bottom.
export const formClasses = "grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2";
export const fieldLabelClasses = "flex flex-col gap-2 text-sm font-medium text-ink";
// Optional helper text under a field's label — for fields whose purpose
// isn't obvious at a glance (e.g. "month/year this counts toward" vs. "the
// date it was actually paid", which look interchangeable but aren't).
export const fieldHintClasses = "block text-xs font-normal text-ink-soft";
// Apply to whatever wraps the submit button(s) so they span both columns
// instead of sitting in just one half of the grid.
export const formActionsClasses = "sm:col-span-2";
// Row-summary color pattern, reused everywhere a list row reads like
// "Name — period — Tk amount — paid date — note" (deposits, top-ups,
// expenses, members, passbook history): the identifying name/category and
// the amount both stand out in ink (bold), and everything else (dates,
// periods, notes) recedes to ink-soft — instead of one flat line of
// same-weight, same-color text that's hard to scan. Amounts deliberately do
// NOT use the accent color: accent means "interactive" everywhere else in
// this app (links, nav, buttons), and coloring static amounts the same way
// invites users to tap them.
export const rowPrimaryClasses = "font-semibold text-ink";
export const rowAmountClasses = "font-semibold text-ink";
export const rowMutedClasses = "text-ink-soft";
export const rowNoteClasses = "italic text-ink-soft";

export const primaryButtonClasses =
  "rounded-md bg-accent px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-accent-strong";
export const secondaryButtonClasses =
  "rounded-md border border-line px-6 py-3 text-base font-medium text-ink transition-colors hover:border-accent hover:text-accent";
