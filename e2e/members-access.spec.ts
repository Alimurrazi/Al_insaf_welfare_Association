import crypto from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { createSessionCookie } from "./auth-helpers";

// Playwright (per playwright.config.ts / TESTING.md) runs against the real
// dev server and dev database (`.env`'s DATABASE_URL), not the isolated
// `.env.test` one Vitest uses. Load `.env` explicitly since Playwright does
// not do this automatically the way vitest.config.mts does for `.env.test`.
loadEnv({ path: ".env", quiet: true });

// Seeded with `pg` directly rather than `@/lib/prisma`: Playwright's test
// loader runs spec files as CommonJS (no "type": "module" in package.json),
// but the generated Prisma client (src/generated/prisma/client.ts) uses
// `import.meta.url`, which is invalid in a CJS module and crashes the whole
// file at load time. Raw `pg` avoids that mismatch entirely — same
// workaround used for the one-off `add-member` seeding script earlier.
const PREFIX = "e2e-members-test-";
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const MEMBER_EMAIL = `${PREFIX}member@example.com`;

test.describe("/members access boundary", () => {
  // `fullyParallel: true` (playwright.config.ts) otherwise splits these two
  // tests across separate workers, so `beforeAll` below would run twice —
  // once per worker — and collide on the unique member email.
  test.describe.configure({ mode: "serial" });

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  test.beforeAll(async () => {
    await client.connect();
    await client.query(
      `INSERT INTO members (id, name, email, role, "joinDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ADMIN', now(), now(), now()),
              ($4, $5, $6, 'MEMBER', now(), now(), now())`,
      [crypto.randomUUID(), `${PREFIX}Admin`, ADMIN_EMAIL, crypto.randomUUID(), `${PREFIX}Member`, MEMBER_EMAIL],
    );
  });

  test.afterAll(async () => {
    await client.query(
      `DELETE FROM activity_log WHERE "actorId" IN (SELECT id FROM members WHERE email LIKE $1)`,
      [`${PREFIX}%`],
    );
    await client.query(`DELETE FROM members WHERE email LIKE $1`, [`${PREFIX}%`]);
    await client.end();
  });

  test("an ADMIN session sees the manage-members heading and can open the add-member form", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/members");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible();

    await page.getByRole("button", { name: "+ Add member" }).click();
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/role/i)).toBeVisible();
  });

  test("a MEMBER session is rejected with a 404, not just visually hidden", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(MEMBER_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/members");

    expect(response?.status()).toBe(404);
    await expect(page.getByText(/this page could not be found/i)).toBeVisible();
  });
});
