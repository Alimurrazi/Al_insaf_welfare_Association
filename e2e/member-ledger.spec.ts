import crypto from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { createSessionCookie } from "./auth-helpers";

// See `members-access.spec.ts` for the rationale on loading `.env` explicitly
// and seeding with raw `pg` rather than `@/lib/prisma` (Playwright's CJS spec
// loader can't import the generated Prisma client, which uses `import.meta.url`).
loadEnv({ path: ".env", quiet: true });

const PREFIX = "e2e-member-ledger-test-";
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const MEMBER_EMAIL = `${PREFIX}member@example.com`;
const TARGET_NAME = `${PREFIX}Target`;
const TARGET_EMAIL = `${PREFIX}target@example.com`;

test.describe("/ledger/[memberId] — shared, read-only for both roles", () => {
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
    await client.query(
      `INSERT INTO member_shares (id, "memberId", "shareCount", "effectiveFrom", "createdAt")
       VALUES ($1, $2, 2, '2025-01-01', now())`,
      [crypto.randomUUID(), targetId],
    );
  });

  test.afterAll(async () => {
    await client.query(
      `DELETE FROM monthly_deposits WHERE "memberId" IN (SELECT id FROM members WHERE email LIKE $1)`,
      [`${PREFIX}%`],
    );
    await client.query(
      `DELETE FROM member_shares WHERE "memberId" IN (SELECT id FROM members WHERE email LIKE $1)`,
      [`${PREFIX}%`],
    );
    await client.query(`DELETE FROM members WHERE email LIKE $1`, [`${PREFIX}%`]);
    await client.end();
  });

  test("an ADMIN session can view a member's individual ledger", async ({ page, context }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto(`/ledger/${targetId}`);

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: TARGET_NAME })).toBeVisible();
    const currentSharesStat = page.locator("div", { hasText: "Current shares" }).last();
    await expect(currentSharesStat).toContainText("2");
    await expect(page.getByText("Tk 3,000.00").first()).toBeVisible();
  });

  test("a MEMBER session can also view a member's individual ledger (read-only, not gated to admins)", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(MEMBER_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto(`/ledger/${targetId}`);

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: TARGET_NAME })).toBeVisible();
  });

  test("an unknown member id renders a 404", async ({ page, context }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/ledger/does-not-exist-id");

    expect(response?.status()).toBe(404);
  });

  test("clicking a member's name on the Logbook links to their individual ledger", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    await page.goto("/ledger?year=2026");
    await page.getByRole("link", { name: TARGET_NAME }).click();

    await expect(page).toHaveURL(`/ledger/${targetId}`);
    await expect(page.getByRole("heading", { name: TARGET_NAME })).toBeVisible();
  });
});
