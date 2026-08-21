import crypto from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { createSessionCookie } from "./auth-helpers";

// See `members-access.spec.ts` for the rationale on loading `.env` explicitly
// and seeding with raw `pg` rather than `@/lib/prisma` (Playwright's CJS spec
// loader can't import the generated Prisma client, which uses `import.meta.url`).
loadEnv({ path: ".env", quiet: true });

const PREFIX = "e2e-activity-test-";
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const MEMBER_EMAIL = `${PREFIX}member@example.com`;

test.describe("/activity — shared, read-only for both roles", () => {
  test.describe.configure({ mode: "serial" });

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let adminId: string;

  test.beforeAll(async () => {
    await client.connect();
    adminId = crypto.randomUUID();
    await client.query(
      `INSERT INTO members (id, name, email, role, "joinDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ADMIN', now(), now(), now()),
              ($4, $5, $6, 'MEMBER', now(), now(), now())`,
      [adminId, `${PREFIX}Admin`, ADMIN_EMAIL, crypto.randomUUID(), `${PREFIX}Member`, MEMBER_EMAIL],
    );
    await client.query(
      `INSERT INTO activity_log (id, "actorId", action, "entityType", "entityId", "newValue", "createdAt")
       VALUES ($1, $2, 'CREATE', 'Expense', 'seeded-entity', $3, now())`,
      [crypto.randomUUID(), adminId, JSON.stringify({ category: "Land survey", amount: 500 })],
    );
  });

  test.afterAll(async () => {
    await client.query(`DELETE FROM activity_log WHERE "actorId" = $1`, [adminId]);
    await client.query(`DELETE FROM members WHERE email LIKE $1`, [`${PREFIX}%`]);
    await client.end();
  });

  test("an ADMIN session can view the activity feed", async ({ page, context }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/activity");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /activity feed/i })).toBeVisible();
    const row = page.locator("li", { hasText: `${PREFIX}Admin` }).first();
    await expect(row).toContainText(`${PREFIX}Admin added an expense of Tk 500.00 — Land survey`);

    // The raw field-by-field diff lives inside a collapsed <details> — open
    // it before asserting on its contents.
    await row.getByText("Details").click();
    await expect(row).toContainText("category: Land survey");
  });

  test("a MEMBER session can also view the activity feed (read-only, not gated to admins)", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(MEMBER_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/activity");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /activity feed/i })).toBeVisible();
  });

  test("an unauthenticated visitor is redirected to sign-in", async ({ page }) => {
    const response = await page.goto("/activity");
    expect(response?.url()).toContain("/sign-in");
  });
});
