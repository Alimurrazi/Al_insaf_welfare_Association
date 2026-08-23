# Testing

Per `CLAUDE.md`: integration tests run against a real Postgres database, never mocked, because almost all of this app's correctness is data-integrity logic (share-history-over-time math, deposit/top-up totals, activity log completeness) that mocks won't catch.

## One Postgres container, two databases

`docker-compose.yml` runs a single Postgres 17 container (`al-insaf-postgres`) with two databases, isolated from each other:

| Database | Used by |
|---|---|
| `al_insaf_dev` | `npm run dev` — `.env` |
| `al_insaf_test` | `npm test` / `npm run test:watch` — `.env.test` |

Unlike the `prisma dev` local engine this project used earlier (which shared storage per-instance regardless of database name — a real gotcha, since it meant one dev/test instance pair per project), a real Postgres server isolates databases correctly, so one container safely serves both. `al_insaf_test` is created automatically on first container start via `docker/init-test-db.sql`.

Start it with:

```bash
docker compose up -d postgres
```

(Docker Desktop must be running first.) This also runs automatically before `npm run dev`, `npm test`, and `npm run test:watch` via the `predev`/`pretest` scripts in `package.json` — you don't normally need to run it by hand.

### Applying schema changes to the test database

`npx prisma migrate deploy` (run against `.env`'s `DATABASE_URL`) only migrates `al_insaf_dev`. After any migration, also apply it to the test database:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/al_insaf_test?sslmode=disable" npx prisma migrate deploy
```

(or export `DATABASE_URL` from `.env.test` in your shell first).

## Running tests

- `npm test` — Vitest, single run, against `.env.test`'s database (`al_insaf_test`).
- `npm run test:watch` — Vitest watch mode.
- `npm run test:e2e` — Playwright. Starts `npm run dev` automatically if it isn't already running (reuses an existing one otherwise) and runs against `.env`'s dev database (`al_insaf_dev`), not the test one — e2e tests exercise the real dev environment end-to-end rather than data integrity, so they don't need the isolated test database.

Vitest's config excludes `e2e/` (Playwright's directory) from its own test discovery — the two runners would otherwise both try to pick up `e2e/*.spec.ts`.
