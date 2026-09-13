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
// Small in-row action button — e.g. "Log Payment" on a table row — smaller
// than the standard buttons above, which are sized for a form's one primary
// action rather than a repeated per-row action.
export const rowActionButtonClasses =
  "rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-strong";

// Page/card measurements adopted from the "al-insaf" Figma file (see
// UI-IMPROVEMENTS.md §10) rather than the ad hoc px-6/py-12 every page used
// before: 40px side margins + top padding, 32px between major sections, 28px
// card padding, 24px gutter between grid tiles, 16px between rows inside a
// card. max-w-7xl (not full-bleed like the Figma frames, which are all fixed
// at 1440px) keeps rows readable on very wide monitors instead of stretching
// a table edge-to-edge.
export const pageContainerClasses = "mx-auto flex w-full max-w-7xl flex-col gap-8 px-10 py-10";
export const cardClasses = "rounded-2xl border border-line bg-surface p-7";
export const statTileClasses =
  "flex flex-1 items-center gap-5 rounded-2xl border border-line bg-surface p-6";
export const statTileIconClasses = "flex size-12 shrink-0 items-center justify-center rounded-xl";

// Table column-grid templates, shared between each page.tsx's header row
// (a Server Component) and its *-row.tsx client component's data rows —
// MUST live in a non-"use client" module: a plain string exported from a
// "use client" file becomes a server-side stub when imported into a Server
// Component, and coercing that stub to a string (as `${CONST} ...` does)
// serializes the stub function's source instead of the class list.
export const DEPOSITS_ROW_GRID_CLASSES =
  "grid grid-cols-[minmax(160px,1.5fr)_110px_110px_130px_minmax(120px,1fr)_70px] items-center gap-4";
export const TOPUPS_ROW_GRID_CLASSES =
  "grid grid-cols-[minmax(200px,1.7fr)_90px_160px_130px_minmax(120px,1fr)_70px] items-center gap-4";
export const EXPENSES_ROW_GRID_CLASSES =
  "grid grid-cols-[130px_minmax(220px,2fr)_160px_130px_150px_70px] items-center gap-4";
// No Status column (unlike the Figma table): the schema has no
// active/inactive concept, so an always-"Active" badge would just be
// decorative, not real data.
// Access Level's column is `auto`-sized (not a fixed px track like the
// others) so it hugs the RoleBadge's own inline-flex width instead of
// reserving fixed whitespace around it — that space goes to the Action
// column instead, which is otherwise the tightest fit (icon button flush
// against the row's own right padding).
export const MEMBERS_ROW_GRID_CLASSES =
  "grid grid-cols-[minmax(160px,1.4fr)_minmax(180px,1.6fr)_auto_150px_90px] items-center gap-4";
