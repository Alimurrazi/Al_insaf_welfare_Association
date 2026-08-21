import crypto from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { createSessionCookie } from "./auth-helpers";

// See `members-access.spec.ts` for the rationale on loading `.env` explicitly
// and seeding with raw `pg` rather than `@/lib/prisma` (Playwright's CJS spec
// loader can't import the generated Prisma client, which uses `import.meta.url`).
loadEnv({ path: ".env", quiet: true });

const PREFIX = "e2e-shares-test-";
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const TARGET_NAME = `${PREFIX}Target`;
const TARGET_EMAIL = `${PREFIX}target@example.com`;

test.describe("member shares (manage members screen)", () => {
  test.describe.configure({ mode: "serial" });

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let targetId: string;

  test.beforeAll(async () => {
    await client.connect();
    const adminId = crypto.randomUUID();
    targetId = crypto.randomUUID();
    await client.query(
      `INSERT INTO members (id, name, email, role, "joinDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ADMIN', now(), now(), now()),
              ($4, $5, $6, 'MEMBER', now(), now(), now())`,
      [adminId, `${PREFIX}Admin`, ADMIN_EMAIL, targetId, TARGET_NAME, TARGET_EMAIL],
    );
    await client.query(
      `INSERT INTO member_shares (id, "memberId", "shareCount", "effectiveFrom", "createdAt")
       VALUES ($1, $2, 4, '2025-01-01', now())`,
      [crypto.randomUUID(), targetId],
    );
  });

  test.afterAll(async () => {
    await client.query(
      `DELETE FROM activity_log WHERE "actorId" IN (SELECT id FROM members WHERE email LIKE $1)`,
      [`${PREFIX}%`],
    );
    await client.query(
      `DELETE FROM member_shares WHERE "memberId" IN (SELECT id FROM members WHERE email LIKE $1)`,
      [`${PREFIX}%`],
    );
    await client.query(`DELETE FROM members WHERE email LIKE $1`, [`${PREFIX}%`]);
    await client.end();
  });

  test("an admin can view share history and record a new share-count row", async ({ page, context }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    await page.goto("/members");

    const row = page.locator("li", { hasText: TARGET_EMAIL }).first();
    await expect(row.getByText(/^4 shares$/)).toBeVisible();

    await row.getByRole("button", { name: "Shares" }).click();
    await expect(row.getByText(/4 shares from 1 Jan 2025/)).toBeVisible();

    await row.getByLabel("Share count").fill("7");
    await row.getByLabel("Effective from").fill("2026-06-01");
    await row.getByRole("button", { name: "Record change" }).click();

    const updatedRow = page.locator("li", { hasText: TARGET_EMAIL }).first();
    await expect(updatedRow.getByText(/^7 shares$/)).toBeVisible();
    await expect(updatedRow.getByText(/7 shares from 1 Jun 2026/)).toBeVisible();
  });
});
