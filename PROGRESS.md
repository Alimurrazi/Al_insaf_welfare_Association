# Progress — Al-Insaf Digital Deposit & Land Fund System

Tracks the build roadmap step by step. Check items off as they're completed; keep this file up to date instead of relying on chat history.

## Setup

- [x] Explore existing docs (`flow-mapping.txt`, project report) and settle on tool recommendations
- [x] Lock stack decisions: Next.js, Prisma, PostgreSQL, NextAuth, npm, Vercel, Tailwind, Vitest + Playwright
- [x] Write `CLAUDE.md` (stack, domain rules, data model outline, test-first policy)
- [x] Scaffold Next.js app (TS, Tailwind, App Router, ESLint, `src/`)
- [x] Install Prisma, NextAuth, Vitest, Playwright
- [x] `prisma init`, clean up auto-installed skills/agent files, document in `AGENTS_AND_SKILLS.md`

## Before any feature code

- [x] Prisma schema — define the 6 entities (members, member_shares, monthly_deposits, annual_topups, expenses, activity_log)
- [x] Decide dev database — using `npx prisma dev` (local Postgres, requires Node 22+)
- [x] Run first migration, generate Prisma Client
- [x] Auth setup — NextAuth + Google provider, signIn callback checked against `members` allow-list
- [x] Test scaffolding — Vitest wired to test DB, Playwright config, one smoke test of each
- [x] Hooks — lint/type-check on edit, block destructive shell commands, run tests before commit

## Design system

- [x] Design-system artifact (colors, type scale, spacing, button/input/card/table variants) — "Insaf Ledger", built as a Claude artifact per `flow-mapping.txt` step 2; approved
- [x] Retrofit existing screens (sign-in, home, manage members) to the approved design system — fonts self-hosted via `next/font/local` (`src/fonts.ts`), tokens in `globals.css`, shared `RoleBadge` component
- [x] Lock approved tokens/component rules into `CLAUDE.md` ("UI conventions" section)

## Feature build (screen by screen, test-first)

- [x] Manage members (admin-only) — profile only (name/email/role); no removal/deactivation, schema has no status field for it
- [x] Manage member shares (admin-only) — record a new share-count row (with effective-from date) for a member; left over from the members screen, kept separate since member_shares is an append-only history table with its own effective-dating logic
- [x] Add/edit deposit entry
- [x] Add/edit annual top-up entry
- [x] Add/edit expense entry
- [x] Ledger grid (shared) — members x months (Jan-Dec) + OTP-1/OTP-2, year selector; cells are arrays since the schema allows more than one deposit/topup per member/period
- [ ] Individual member ledger (shared)
- [ ] Expenses page (shared)
- [ ] Activity feed (shared)
- [ ] Dashboard/home (shared)

## Later

- [ ] Deploy to Vercel
