# Testing

Per `CLAUDE.md`: integration tests run against a real Postgres database, never mocked, because almost all of this app's correctness is data-integrity logic (share-history-over-time math, deposit/top-up totals, activity log completeness) that mocks won't catch.

## Two separate local Postgres instances

| Instance name | Port | Used by |
|---|---|---|
| `al-insaf` | 51214 | `npm run dev` — `.env` |
| `al-insaf-test` | 51218 | `npm test` — `.env.test` |

Both were started with `npx prisma dev --name <name> --detach` and keep running in the background until stopped (`npx prisma dev stop <name>`) or the machine restarts.

### Why two full instances instead of two databases on one instance

The first attempt used one `prisma dev` instance with two database names (`template1` for dev, `al_insaf_test` for tests). That didn't work: this local dev engine doesn't isolate multiple database names on the same instance the way real Postgres does — `al_insaf_test` came up already containing every dev table, and even dropping and recreating it from Postgres's blank `template0` still came back with the same tables. Whatever storage this engine uses, it's shared per-instance regardless of database name, not per-database.

The fix was a second, fully separate `prisma dev` instance (own process, own port, own storage) dedicated to tests. That instance was confirmed to start genuinely empty before applying migrations to it.

**Takeaway**: on this local dev engine, isolation is per-instance, not per-database-name. Never reuse one `prisma dev` instance for both dev and test data.

### Applying schema changes to the test instance

`prisma migrate dev` (used against `.env`'s dev database) does not touch the test database. After any migration, also run:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:51218/template1?sslmode=disable" npx prisma migrate deploy
```

(or export `DATABASE_URL` from `.env.test` in your shell first).

## Running tests

- `npm test` — Vitest, single run, against `.env.test`'s database.
- `npm run test:watch` — Vitest watch mode.
- `npm run test:e2e` — Playwright. Starts `npm run dev` automatically if it isn't already running (reuses an existing one otherwise) and runs against `.env`'s dev database, not the test one — e2e tests exercise the real dev environment end-to-end rather than data integrity, so they don't need the isolated test database.

Vitest's config excludes `e2e/` (Playwright's directory) from its own test discovery — the two runners would otherwise both try to pick up `e2e/*.spec.ts`.
