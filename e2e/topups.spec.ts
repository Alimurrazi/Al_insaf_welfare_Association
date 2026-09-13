import crypto from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { createSessionCookie } from "./auth-helpers";

// See `members-access.spec.ts` for the rationale on loading `.env` explicitly
// and seeding with raw `pg` rather than `@/lib/prisma` (Playwright's CJS spec
// loader can't import the generated Prisma client, which uses `import.meta.url`).
loadEnv({ path: ".env", quiet: true });

const PREFIX = "e2e-topups-test-";
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const MEMBER_EMAIL = `${PREFIX}member@example.com`;
const TARGET_NAME = `${PREFIX}Target`;
const TARGET_EMAIL = `${PREFIX}target@example.com`;

test.describe("/topups access boundary and flow", () => {
  test.describe.configure({ mode: "serial" });

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let adminId: string;
  let targetId: string;

  test.beforeAll(async () => {
    await client.connect();
    adminId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    targetId = crypto.randomUUID();
    await client.query(
      `INSERT INTO members (id, name, email, role, "joinDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ADMIN', now(), now(), now()),
              ($4, $5, $6, 'MEMBER', now(), now(), now()),
              ($7, $8, $9, 'MEMBER', now(), now(), now())`,
      [
        adminId, `${PREFIX}Admin`, ADMIN_EMAIL,
        memberId, `${PREFIX}Member`, MEMBER_EMAIL,
        targetId, TARGET_NAME, TARGET_EMAIL,
      ],
    );
  });

  test.afterAll(async () => {
    await client.query(
      `DELETE FROM activity_log WHERE "actorId" IN (SELECT id FROM members WHERE email LIKE $1)`,
      [`${PREFIX}%`],
    );
    await client.query(
      `DELETE FROM annual_topups WHERE "memberId" IN (SELECT id FROM members WHERE email LIKE $1)`,
      [`${PREFIX}%`],
    );
    await client.query(`DELETE FROM members WHERE email LIKE $1`, [`${PREFIX}%`]);
    await client.end();
  });

  test("an ADMIN session sees the manage-topups heading and can open the add-topup form", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/topups");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /top-ups/i })).toBeVisible();

    await page.getByRole("button", { name: "+ Add top-up" }).click();
    await expect(page.getByLabel(/member/i).first()).toBeVisible();
    await expect(page.getByLabel(/amount/i).first()).toBeVisible();
  });

  test("a MEMBER session is rejected with a 404, not just visually hidden", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(MEMBER_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/topups");

    expect(response?.status()).toBe(404);
    await expect(page.getByText(/this page could not be found/i)).toBeVisible();
  });

  test("an admin can add a top-up and then edit it", async ({ page, context }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    await page.goto("/topups");

    await page.getByRole("button", { name: "+ Add top-up" }).click();
    const addForm = page.locator("dialog form");
    await addForm.getByLabel("Member").selectOption({ label: TARGET_NAME });
    await addForm.getByLabel("Year").fill("2026");
    await addForm.getByLabel("OTP number").fill("1");
    await addForm.getByLabel("Amount").fill("5000");
    await addForm.getByLabel("Paid date").fill("2026-06-05");
    await addForm.getByLabel("Note").fill("First OTP");
    await addForm.getByRole("button", { name: "Add top-up" }).click();
    // The modal auto-closes on a successful save — the toast is the only
    // save confirmation now, so there's no Close button left to click.
    await expect(page.getByRole("status").filter({ hasText: /top-up saved/i })).toBeVisible();
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    // Scoped by TARGET_NAME only — once the row flips into its edit form,
    // year/OTP number become <input> values rather than text content. Uses
    // the row's own wrapper classes (see DepositRow/MemberRow), not <li> —
    // TopupRow doesn't render a list item.
    const row = page.locator("div.border-t.border-line", { hasText: TARGET_NAME });
    await expect(row).toContainText("5,000.00");
    await expect(row).toContainText("First OTP");

    await row.getByRole("button", { name: "Edit" }).click();
    await row.getByLabel("Amount").fill("5500");
    await row.getByLabel("Note").fill("First OTP (corrected)");
    await row.getByRole("button", { name: "Save" }).click();

    await expect(row).toContainText("5,500.00");
    await expect(row).toContainText("First OTP (corrected)");
  });
});
