import crypto from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { createSessionCookie } from "./auth-helpers";

// See `members-access.spec.ts` for the rationale on loading `.env` explicitly
// and seeding with raw `pg` rather than `@/lib/prisma` (Playwright's CJS spec
// loader can't import the generated Prisma client, which uses `import.meta.url`).
loadEnv({ path: ".env", quiet: true });

const PREFIX = "e2e-dashboard-test-";
const MEMBER_EMAIL = `${PREFIX}member@example.com`;
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const PAID_NAME = `${PREFIX}Paid`;
const PAID_EMAIL = `${PREFIX}paid@example.com`;
const UNPAID_NAME = `${PREFIX}Unpaid`;
const UNPAID_EMAIL = `${PREFIX}unpaid@example.com`;

test.describe("/ (dashboard/home) — shared", () => {
  test.describe.configure({ mode: "serial" });

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let memberId: string;

  test.beforeAll(async () => {
    await client.connect();
    memberId = crypto.randomUUID();
    await client.query(
      `INSERT INTO members (id, name, email, role, "joinDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'MEMBER', now(), now(), now())`,
      [memberId, `${PREFIX}Member`, MEMBER_EMAIL],
    );
    await client.query(
      `INSERT INTO monthly_deposits (id, "memberId", month, year, amount, "paidDate", "createdById", "createdAt")
       VALUES ($1, $2, 6, 2026, 3000, '2026-06-05', $2, now())`,
      [crypto.randomUUID(), memberId],
    );
    await client.query(
      `INSERT INTO member_shares (id, "memberId", "shareCount", "effectiveFrom", "createdAt")
       VALUES ($1, $2, 2, '2025-01-01', now())`,
      [crypto.randomUUID(), memberId],
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

  test("shows group summary, personal snapshot, and a working 'My Passbook' link", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(MEMBER_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page.getByText("Total collected")).toBeVisible();
    await expect(page.getByText("Total spent")).toBeVisible();
    await expect(page.getByText("Balance in hand")).toBeVisible();

    const sharesStat = page.locator("div", { hasText: "Your shares" }).last();
    await expect(sharesStat).toContainText("2");
    const paidStat = page.locator("div", { hasText: "Your total paid" }).last();
    await expect(paidStat).toContainText("Tk 3,000.00");

    await page.getByRole("link", { name: "My Passbook" }).click();
    await expect(page).toHaveURL(`/ledger/${memberId}`);
  });

  // Regression test: an earlier version fired getDashboardSummary,
  // getMemberLedger, and getUnpaidMembers together in one Promise.all —
  // each already fans out into several of its own concurrent queries, and
  // for an ADMIN session (the only role that triggers getUnpaidMembers)
  // that briefly opened enough connections to exhaust the local dev
  // Postgres engine's small pool, 500-ing the page. This test is the only
  // one in the suite that loads "/" as an ADMIN, so it's the one that
  // actually exercises that code path.
  test("an ADMIN session sees who hasn't paid for the current month", async ({ page, context }) => {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();

    await client.query(
      `INSERT INTO members (id, name, email, role, "joinDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ADMIN', now(), now(), now()),
              ($4, $5, $6, 'MEMBER', now(), now(), now()),
              ($7, $8, $9, 'MEMBER', now(), now(), now())`,
      [
        crypto.randomUUID(), `${PREFIX}Admin`, ADMIN_EMAIL,
        crypto.randomUUID(), PAID_NAME, PAID_EMAIL,
        crypto.randomUUID(), UNPAID_NAME, UNPAID_EMAIL,
      ],
    );
    const { rows } = await client.query(`SELECT id FROM members WHERE email = $1`, [PAID_EMAIL]);
    await client.query(
      `INSERT INTO monthly_deposits (id, "memberId", month, year, amount, "paidDate", "createdById", "createdAt")
       VALUES ($1, $2, $3, $4, 3000, now(), $2, now())`,
      [crypto.randomUUID(), rows[0].id, month, year],
    );

    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    const unpaidSection = page.getByText(/haven't paid/i);
    await expect(unpaidSection).toContainText(UNPAID_NAME);
    await expect(unpaidSection).not.toContainText(PAID_NAME);
  });
});
