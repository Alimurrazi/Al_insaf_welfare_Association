import crypto from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { createSessionCookie } from "./auth-helpers";

// See `members-access.spec.ts` for the rationale on loading `.env` explicitly
// and seeding with raw `pg` rather than `@/lib/prisma` (Playwright's CJS spec
// loader can't import the generated Prisma client, which uses `import.meta.url`).
loadEnv({ path: ".env", quiet: true });

const PREFIX = "e2e-ledger-test-";
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const MEMBER_EMAIL = `${PREFIX}member@example.com`;
const TARGET_NAME = `${PREFIX}Target`;
const TARGET_EMAIL = `${PREFIX}target@example.com`;

test.describe("/ledger — shared, read-only for both roles", () => {
  test.describe.configure({ mode: "serial" });

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let targetId: string;

  test.beforeAll(async () => {
    await client.connect();
    targetId = crypto.randomUUID();
    await client.query(
      `INSERT INTO members (id, name, email, role, "joinDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ADMIN', now(), now(), now()),
              ($4, $5, $6, 'MEMBER', now(), now(), now()),
              ($7, $8, $9, 'MEMBER', now(), now(), now())`,
      [
        crypto.randomUUID(), `${PREFIX}Admin`, ADMIN_EMAIL,
        crypto.randomUUID(), `${PREFIX}Member`, MEMBER_EMAIL,
        targetId, TARGET_NAME, TARGET_EMAIL,
      ],
    );
    await client.query(
      `INSERT INTO monthly_deposits (id, "memberId", month, year, amount, "paidDate", "createdById", "createdAt")
       VALUES ($1, $2, 6, 2026, 3000, '2026-06-05', $2, now())`,
      [crypto.randomUUID(), targetId],
    );
  });

  test.afterAll(async () => {
    await client.query(
      `DELETE FROM monthly_deposits WHERE "memberId" IN (SELECT id FROM members WHERE email LIKE $1)`,
      [`${PREFIX}%`],
    );
    await client.query(`DELETE FROM members WHERE email LIKE $1`, [`${PREFIX}%`]);
    await client.end();
  });

  test("an ADMIN session can view the ledger grid", async ({ page, context }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/ledger?year=2026");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /logbook/i })).toBeVisible();
    const row = page.locator("tr", { hasText: TARGET_NAME });
    await expect(row).toContainText("3000.00");
  });

  test("a MEMBER session can also view the ledger grid (read-only, not gated to admins)", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(MEMBER_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/ledger?year=2026");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /logbook/i })).toBeVisible();
    const row = page.locator("tr", { hasText: TARGET_NAME });
    await expect(row).toContainText("3000.00");
  });

  test("an unauthenticated visitor is redirected to sign-in", async ({ page }) => {
    const response = await page.goto("/ledger");
    expect(response?.url()).toContain("/sign-in");
  });
});
