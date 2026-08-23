import { defineConfig } from "@playwright/test";

// Defaults to 3000; overridable via E2E_PORT for a machine where something
// else already owns 3000 (e.g. an unrelated dev server), so the suite
// doesn't silently run against the wrong app.
const port = Number(process.env.E2E_PORT) || 3000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // The local `prisma dev` engine (see TESTING.md) is fragile under
  // concurrent connections: multiple spec files hitting it at once has been
  // observed to both transiently break the session-lookup DB call (an
  // admin-only page 404s because a request briefly resolves as
  // unauthenticated) and corrupt a raw `pg` client's protocol state
  // ("bind message supplies N parameters, but prepared statement requires
  // 0"). Running serially avoids both at the cost of e2e suite speed.
  workers: 1,
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: {
    baseURL: `http://localhost:${port}`,
  },
});
