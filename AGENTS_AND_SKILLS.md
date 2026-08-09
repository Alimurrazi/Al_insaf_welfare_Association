# Why these files exist: `AGENTS.md`, `.claude/skills/`, `skills-lock.json`

None of these were hand-written for this project — they were generated automatically by tooling (`create-next-app`, `npx prisma init`) and are kept because they help AI coding assistants (Claude Code, etc.) work correctly in this repo. This file explains what each one is so nobody deletes them by accident, or wonders why they're here.

## `AGENTS.md`

Auto-written by `next dev` (see `node_modules/next/dist/server/lib/generate-agent-files.js`). It's a standing note for any AI assistant working in this repo: this Next.js version may differ from what the assistant was trained on, so it should check `node_modules/next/dist/docs/` before writing framework-specific code, instead of relying on possibly-stale training data.

- It gets re-created by `next dev` if deleted — removing it from a diff just re-adds it as an uncommitted change.
- Safe to commit as-is; don't hand-edit it.

## `.claude/skills/`

Auto-installed by `npx prisma init` (Prisma 7 ships Claude Code skills alongside the schema generator). A "skill" is a packaged set of instructions Claude Code loads only when relevant, instead of every Prisma doc being crammed into every session.

We kept only the three relevant to this project's stack (PostgreSQL + Prisma Client, no MongoDB, no Prisma Compute deploy):

| Skill | Covers |
|---|---|
| `prisma-cli` | `prisma init/generate/migrate/db/studio` commands |
| `prisma-client-api` | Writing queries — `findMany`, `create`, filters, `$transaction`, etc. |
| `prisma-database-setup` | Configuring/connecting to PostgreSQL |

Prisma's installer originally also added `prisma-compute`, `prisma-driver-adapter-implementation`, `prisma-mongodb-upgrade`, `prisma-postgres`, `prisma-postgres-setup`, and `prisma-upgrade-v7` — all irrelevant here (MongoDB migration, Compute hosting, driver-adapter internals, hosted Prisma Postgres provisioning), so they were deleted.

Prisma's installer also originally duplicated this same skill content into `.windsurf/skills/` (for the Windsurf IDE, which this project doesn't use) and `.agents/skills/` (a generic cross-tool convention), with `.claude/skills/` and `.windsurf/skills/` as symlinks pointing at the real files in `.agents/skills/`. Since we only use Claude Code, that was collapsed down to one real copy living directly under `.claude/skills/`, and `.agents/` / `.windsurf/` were removed. (Symlinks are also awkward with git on Windows, so plain files are the safer choice here regardless.)

## `skills-lock.json`

A manifest the Prisma CLI uses to track which skills are installed, where they came from (`prisma/skills` on GitHub), and a content hash of each — so `prisma` commands can detect drift or offer updates. It's kept in sync with whatever actually lives under `.claude/skills/`; if a skill folder is added/removed by hand, update this file to match (or re-run `npx prisma init` skill installation).

## Should these be committed?

Yes. They cost nothing to run, and committing them means every developer's (and every AI assistant's) session in this repo gets the same tool context, rather than each person regenerating a slightly different set locally.
