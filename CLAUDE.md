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

## Testing — test-first, always

- Write the test before the implementation, as a **separate pass from the implementation code** (e.g. a distinct subagent/session) so tests aren't shaped to match code that already exists. Confirm a new test fails for the right reason before implementing against it.
- Unit/integration tests: Vitest, run against a real Postgres test database (not mocked) — this app's correctness is almost entirely data-integrity logic (share-history-over-time math, deposit/top-up totals, activity log completeness), which mocks won't catch.
- E2E tests: Playwright.
- Always test the error path, not just the happy path.
- Every new endpoint or screen must include a test asserting the Admin-vs-Member access boundary (a Member request must be rejected/read-only even if it guesses the right URL or payload).

## Out of scope for this release

Receipt/photo upload, automated payment reminders, granular per-feature permissions beyond Admin/Member.
