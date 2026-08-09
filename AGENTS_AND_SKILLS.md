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

## Why a "skill" is necessary at all (not just what it is)

For a developer meeting this concept for the first time: a skill is a packaged reference doc that an AI assistant loads only when the current task needs it — like having a specialist on call instead of one generalist expected to know every tool's latest quirks from memory.

- **Without skills**: the assistant answers from general training knowledge, which can be outdated for fast-moving tools (breaking changes shipped last month, a CLI flag that changed meaning).
- **With skills**: for a narrow, well-defined task — "run a Prisma migration," "write a Prisma query" — the assistant pulls in that tool's actual current instructions before acting, the same way a developer would open the official docs instead of relying on memory.
- **Why not load everything all the time**: if every session loaded docs for every tool "just in case," context would bloat for no benefit. Skills stay scoped — they only trigger when the task matches what they cover.

### The mechanism, concretely (using `.claude/skills/prisma-cli/SKILL.md`)

1. **Every skill starts with a trigger description that's always visible.** Line 3 of that file: *"Triggers on 'prisma init', 'prisma generate', 'prisma migrate', 'prisma db', 'prisma complete', 'prisma studio', 'prisma mcp'."* That one line is cheap to keep loaded at all times — it's a name tag, not the full instructions.
2. **A matching request loads the full file.** Ask to "run the first migration" and the word "migrate" matches the trigger, so the assistant pulls in the entire `SKILL.md` (all ~266 lines) before doing anything.
3. **The file overrides guesswork with version-specific facts.** Without it, the assistant might type `prisma migrate dev` assuming the old behavior. The file instead states things specific to Prisma 7.9.1 that wouldn't otherwise be known:
   - Lines 190–197 ("AI Safety Checkpoint"): Prisma now actively blocks destructive commands (`migrate reset`, `db push --force-reset`) when it detects an AI agent, and requires explicit user consent first, not inferred consent.
   - Lines 203–219 ("New Configuration File"): config now lives in `prisma.config.ts`, not just `.env` — editing the wrong file for `DATABASE_URL` would otherwise be an easy mistake.
   - Lines 236–261 ("Rule Files"): points to deeper per-command reference files (e.g. `references/migrate-dev.md`) to open if the summary isn't enough.
4. **The assistant then follows the file instead of pattern-matching from memory.** Trigger phrase fires → file content enters context → the command run (and any safety checkpoint) comes from the file, not from possibly-stale general knowledge.

That's the full loop: keyword match → load doc → follow doc, repeated per skill, per relevant request.

## `skills-lock.json`

A manifest the Prisma CLI uses to track which skills are installed, where they came from (`prisma/skills` on GitHub), and a content hash of each — so `prisma` commands can detect drift or offer updates. It's kept in sync with whatever actually lives under `.claude/skills/`; if a skill folder is added/removed by hand, update this file to match (or re-run `npx prisma init` skill installation).

## Should these be committed?

Yes. They cost nothing to run, and committing them means every developer's (and every AI assistant's) session in this repo gets the same tool context, rather than each person regenerating a slightly different set locally.
