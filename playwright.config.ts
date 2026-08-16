import { defineConfig } from "@playwright/test";

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
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
});
