# Al-Insaf Welfare Association — Digital Deposit & Land Fund Management System

Web app replacing a paper logbook for a 15-member group tracking land-purchase deposits, annual top-ups, and expenses. Full proposal: `Al-Insaf-Welfare-Association-Report.docx`.

## Stack

- Framework: Next.js (App Router)
- Language: TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Auth: NextAuth, Google provider only, gated by an admin-maintained allow-list (email not on the list → no access, regardless of valid Google login)
- Styling: Tailwind CSS
- Package manager: npm
- Deployment: Vercel

## Core domain rules

- Every monthly deposit, annual top-up, and expense is its own **independently dated, independently amounted row** — never a running balance. Balances are always derived by summing rows.
- Share count changes are **new `member_shares` rows**, never overwrites — past months must always calculate against the share count that was effective at that time.
- Every add/edit by an admin writes an `activity_log` entry (actor, action, entity, old value, new value). This log is visible to all users and must never be bypassed by a code path that writes directly to a table without also logging.
- Expenses are group-level, not tied to a member.
- Two roles only: `Admin` (full read/write) and `Member` (read-only). Multiple admins allowed. No per-feature permission granularity in this release.

## Data model (Prisma)

Six entities — see the report §5 for full field lists:
- `members` — id, name, email, join_date, role
- `member_shares` — id, member_id, share_count, effective_from
- `monthly_deposits` — id, member_id, month, year, amount, paid_date, note, created_by
- `annual_topups` — id, member_id, year, otp_number, amount, paid_date, note, created_by
- `expenses` — id, date, category, amount, note, created_by
- `activity_log` — id, actor_id, action, entity_type, entity_id, old_value, new_value, created_at

## UI conventions — Insaf Ledger design system

Approved design system (see the "Insaf Ledger" artifact for the full reference/rationale). All screens must use these tokens instead of ad-hoc Tailwind values — this keeps the app looking like one system instead of drifting screen to screen.

**Fonts** (self-hosted via `next/font/local`, defined in `src/fonts.ts`, wired into Tailwind's `--font-sans`/`--font-display`/`--font-mono` in `globals.css`):
- `font-display` (Fraunces, 600/700 + italic 500) — headings only, used sparingly.
- `font-sans` (Public Sans, 400/600/700) — body copy, forms, UI text. This is the default body font.
- `font-mono` (IBM Plex Mono, 400/500) — amounts, dates, badges, section eyebrows/labels; use `tabular-nums` wherever digits line up in columns.

**Colors** (CSS custom properties in `globals.css`, light values in `:root`, dark values under `@media (prefers-color-scheme: dark)`; exposed as Tailwind utilities via `@theme inline` — `bg-accent`, `text-ink-soft`, etc.):
- `paper` / `surface` — page background / card & input background.
- `ink` / `ink-soft` — primary / secondary text.
- `line` — hairline borders.
- `accent` / `accent-strong` / `accent-soft` — the one accent (deep emerald). Links, primary buttons, focus rings, row hover. `-strong` for hover/active, `-soft` for tinted backgrounds (e.g. the MEMBER badge).
- `gold` / `gold-soft` — semantic, ADMIN badge only. Never a second accent.
- `danger` / `danger-soft` — semantic, errors only (e.g. the sign-in "AccessDenied" message, 400/409 API error states).

**Type scale**: Tailwind's default `text-xs`/`text-sm`/`text-base` are unchanged (they already matched); `text-lg`/`text-xl`/`text-2xl` are overridden in `globals.css` to 1.25rem/1.75rem/2.5rem to give the display face more presence.

**Currency**: Amounts are in Bangladeshi Taka. Render as `Tk {amount.toFixed(2)}` (e.g. `Tk 3000.00`) — never `$`.

**Spacing**: Tailwind's default numeric scale (`p-4`, `gap-6`, etc.) maps directly — no custom spacing tokens needed.

**Components**:
- Buttons: primary = `bg-accent text-white hover:bg-accent-strong` (solid, for the one primary action per form); secondary = `border border-line hover:border-accent hover:text-accent` (for Cancel/Edit and anything not the primary action).
- Inputs: `border-line bg-surface`, `focus-visible:outline-accent`.
- Badges: pill-shaped, `font-mono text-xs`, `bg-gold-soft text-gold` (ADMIN) or `bg-accent-soft text-accent` (MEMBER) — see `src/components/role-badge.tsx`.
- Radius: Tailwind's `rounded-md` (0.375rem) everywhere — no custom radius token.

## Testing — test-first, always

- Write the test before the implementation, as a **separate pass from the implementation code** (e.g. a distinct subagent/session) so tests aren't shaped to match code that already exists. Confirm a new test fails for the right reason before implementing against it.
- Unit/integration tests: Vitest, run against a real Postgres test database (not mocked) — this app's correctness is almost entirely data-integrity logic (share-history-over-time math, deposit/top-up totals, activity log completeness), which mocks won't catch.
- E2E tests: Playwright.
- Always test the error path, not just the happy path.
- Every new endpoint or screen must include a test asserting the Admin-vs-Member access boundary (a Member request must be rejected/read-only even if it guesses the right URL or payload).

## Out of scope for this release

Receipt/photo upload, automated payment reminders, granular per-feature permissions beyond Admin/Member.
