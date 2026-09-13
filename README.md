# Al-Insaf Welfare Association

A web app replacing a paper logbook for a 15-member group tracking shared
land-purchase deposits, annual top-ups, and expenses. Every monthly deposit,
top-up, and expense is its own independently dated, independently amounted
row — balances are always derived by summing rows, never stored as a running
total. See `CLAUDE.md` for the full domain rules and `Al-Insaf-Welfare-Association-Report.docx`
for the original proposal.

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Database**: PostgreSQL, via Docker Compose locally
- **ORM**: Prisma 7 (`@prisma/adapter-pg` driver adapter)
- **Auth**: NextAuth (Google provider only), gated by an admin-maintained
  allow-list — see `AUTH.md`
- **Styling**: Tailwind CSS 4, the "Insaf Ledger" design system documented in
  `CLAUDE.md`
- **Testing**: Vitest (unit/integration, against a real Postgres database) +
  Playwright (e2e) — see `TESTING.md`

## Getting started

### 1. Start Postgres

A `docker-compose.yml` in the repo root runs Postgres in a container with two
databases: `al_insaf_dev` (app data) and `al_insaf_test` (test data, isolated
from dev). Docker Desktop must be running first.

```bash
docker compose up -d postgres
```

This also runs automatically before `npm run dev`, `npm test`, and
`npm run test:watch` (see `predev`/`pretest` in `package.json`), so in normal
use you don't need to run it by hand — just make sure Docker Desktop itself
is running.

### 2. Configure environment variables

Copy the variables into `.env` (see `.env` for the current template):

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/al_insaf_dev?sslmode=disable"
AUTH_SECRET=          # random string, e.g. node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
AUTH_GOOGLE_ID=       # Google Cloud Console > APIs & Services > Credentials > OAuth client ID (Web application)
AUTH_GOOGLE_SECRET=
```

Authorized redirect URI to register in Google Cloud Console:
`http://localhost:3000/api/auth/callback/google`. See `AUTH.md` for how the
auth flow and allow-list gate work.

### 3. Apply migrations and seed an admin

```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts "your.email@example.com" "Your Name"
```

The seed script upserts one `ADMIN` member by email — sign-in is
allow-list-gated, so without this step no Google account can sign in yet.
Re-running it with the same email is safe (it updates the name, not the
role, so a later role change through the app isn't clobbered).

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to
`/sign-in`. Sign in with the Google account matching the email you seeded.

## Scripts

| Command                               | Purpose                                                    |
| ------------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                       | Start Postgres (if needed) + the Next.js dev server        |
| `npm run build` / `npm run start` | Production build / start                                   |
| `npm run lint`                      | ESLint                                                     |
| `npm test`                          | Vitest, single run, against the`al_insaf_test` database  |
| `npm run test:watch`                | Vitest watch mode                                          |
| `npm run test:e2e`                  | Playwright e2e tests, against the`al_insaf_dev` database |

## Project structure

```
src/
  app/                  Route segments (App Router) — one folder per screen:
                         dashboard (page.tsx), deposits/, topups/, expenses/,
                         members/, ledger/ (Logbook + My Passbook), activity/,
                         sign-in/, error.tsx (App Router error boundary)
  auth.ts, auth.config.ts, middleware.ts   NextAuth setup — see AUTH.md
  components/           Shared UI: top nav, modal, role badge, shared
                         Tailwind class constants (styles.ts)
  lib/                  Domain logic — one module per entity (deposits.ts,
                         topups.ts, expenses.ts, members.ts, member-shares.ts,
                         activity.ts, ledger.ts, member-ledger.ts,
                         dashboard.ts, payment-status.ts) plus format.ts for
                         shared display formatting. Every *.ts here has a
                         matching *.test.ts.
  generated/prisma/     Generated Prisma Client (not committed logic)
prisma/
  schema.prisma         Six models: Member, MemberShare, MonthlyDeposit,
                         AnnualTopup, Expense, ActivityLog
  migrations/           Prisma migrations
  seed.ts               Bootstraps the first admin member (see above)
e2e/                    Playwright specs
docker-compose.yml      Local Postgres (al_insaf_dev + al_insaf_test)
```

## Documentation map

- `CLAUDE.md` — domain rules, data model, and the "Insaf Ledger" design
  system tokens/conventions that every screen follows.
- `AUTH.md` — how the Google-only, allow-list-gated auth flow works, plus a
  TypeScript gotcha worth knowing before touching `auth.ts`.
- `TESTING.md` — why tests run against a real Postgres database instead of
  mocks, and the local dev/test database setup.
- `UI-IMPROVEMENTS.md` — the UI redesign plan (based on the team's Figma
  file) and what's shipped vs. deferred pending schema changes.
