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

- [ ] Prisma schema — define the 6 entities (members, member_shares, monthly_deposits, annual_topups, expenses, activity_log)
- [ ] Decide dev database — local Postgres (`npx prisma dev`), Docker, or a cloud dev DB (Neon/Vercel Postgres)
- [ ] Run first migration, generate Prisma Client
- [ ] Auth setup — NextAuth + Google provider, signIn callback checked against `members` allow-list
- [ ] Test scaffolding — Vitest wired to test DB, Playwright config, one smoke test of each
- [ ] Hooks — lint/type-check on edit, block destructive shell commands, run tests before commit

## Feature build (screen by screen, test-first)

- [ ] Manage members (admin-only)
- [ ] Add/edit deposit entry
- [ ] Add/edit annual top-up entry
- [ ] Add/edit expense entry
- [ ] Ledger grid (shared)
- [ ] Individual member ledger (shared)
- [ ] Expenses page (shared)
- [ ] Activity feed (shared)
- [ ] Dashboard/home (shared)

## Later

- [ ] Deploy to Vercel
