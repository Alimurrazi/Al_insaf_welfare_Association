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

  // Scoped by the row's own wrapper classes (`border-t border-line`, shared
  // by every member row — see member-row.tsx) filtered down to the one
  // containing this member's email. Unlike the name/role/shares cells, this
  // wrapper also contains the Manage panel once it's open, so one locator
  // covers both the collapsed row and its expanded form.
  function memberRow(page: import("@playwright/test").Page) {
    return page.locator("div.border-t.border-line", { hasText: TARGET_EMAIL });
  }

  test("an admin can view current shares and record a new share-count row from the Manage panel", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    await page.goto("/members");

    // Just the count, not the "(N.N%)" share-of-total suffix — that
    // percentage is computed across every member in the DB (see
    // getContributionSharePercent/getShareCountAsOf), so it isn't
    // deterministic when this suite runs against a real dev database that
    // may already have other members holding shares.
    const row = memberRow(page);
    await expect(row.getByText(/^4 Shares/)).toBeVisible();

    // The two previously-separate "History" and "Edit" icons were merged
    // into one "Manage" button opening a single panel (this session's
    // change) — Personal Info and Shares now live in one form.
    await row.getByRole("button", { name: `Manage ${TARGET_NAME}` }).click();
    await expect(row.getByText(/Registered with 4 shares, effective 1 Jan 2025/)).toBeVisible();

    await row.getByLabel("Share count").fill("7");
    await row.getByLabel("Effective from").fill("2026-06-01");
    await row.getByRole("button", { name: "Save" }).click();

    await expect(row.getByText(/^7 Shares/)).toBeVisible();
    await expect(row.getByText(/Shares changed from 4 to 7, effective 1 Jun 2026/)).toBeVisible();
  });

  test("saving the panel with Share count left blank edits info without adding a share row", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    await page.goto("/members");

    const row = memberRow(page);
    await row.getByRole("button", { name: `Manage ${TARGET_NAME}` }).click();
    await row.getByLabel("Name").fill(`${TARGET_NAME} Jr.`);
    // Share count intentionally left blank.
    await row.getByRole("button", { name: "Save" }).click();

    const renamedRow = page.locator("div.border-t.border-line", { hasText: TARGET_EMAIL });
    await expect(renamedRow.getByText(`${TARGET_NAME} Jr.`)).toBeVisible();
    // Still 7 (from the previous test) — no new share row was recorded.
    await expect(renamedRow.getByText(/^7 Shares/)).toBeVisible();
  });
});
