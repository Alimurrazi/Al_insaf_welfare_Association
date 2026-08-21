import crypto from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { createSessionCookie } from "./auth-helpers";

// See `members-access.spec.ts` for the rationale on loading `.env` explicitly
// and seeding with raw `pg` rather than `@/lib/prisma` (Playwright's CJS spec
// loader can't import the generated Prisma client, which uses `import.meta.url`).
loadEnv({ path: ".env", quiet: true });

const PREFIX = "e2e-deposits-test-";
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const MEMBER_EMAIL = `${PREFIX}member@example.com`;
const TARGET_NAME = `${PREFIX}Target`;
const TARGET_EMAIL = `${PREFIX}target@example.com`;

test.describe("/deposits access boundary and flow", () => {
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
      `DELETE FROM monthly_deposits WHERE "memberId" IN (SELECT id FROM members WHERE email LIKE $1)`,
      [`${PREFIX}%`],
    );
    await client.query(`DELETE FROM members WHERE email LIKE $1`, [`${PREFIX}%`]);
    await client.end();
  });

  test("an ADMIN session sees the manage-deposits heading and can open the add-deposit form", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/deposits");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /deposits/i })).toBeVisible();

    // The add form lives inside a modal, closed by default — open it before
    // asserting its fields are present.
    await page.getByRole("button", { name: "+ Add deposit" }).click();
    await expect(page.getByLabel(/member/i).first()).toBeVisible();
    await expect(page.getByLabel(/amount/i).first()).toBeVisible();
  });

  test("a MEMBER session is rejected with a 404, not just visually hidden", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(MEMBER_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/deposits");

    expect(response?.status()).toBe(404);
    await expect(page.getByText(/this page could not be found/i)).toBeVisible();
  });

  test("an admin can add a deposit — paid date auto-fills month/year, and then edit it", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    await page.goto("/deposits");

    await page.getByRole("button", { name: "+ Add deposit" }).click();
    const addForm = page.locator("dialog form");
    await addForm.getByLabel("Member").selectOption({ label: TARGET_NAME });
    // Deliberately NOT touching Month/Year — entering the paid date alone
    // should populate them (June/2026) as an editable default.
    await addForm.getByLabel("Paid date").fill("2026-06-05");
    await addForm.getByLabel("Amount").fill("150");
    await addForm.getByLabel("Note").fill("June deposit");
    await addForm.getByRole("button", { name: "Add deposit" }).click();
    // The modal deliberately stays open after a successful save (so a
    // second month can be added from the same paid date) — close it before
    // asserting on the row underneath.
    await expect(addForm.getByText(/deposit saved/i)).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    // Scoped by TARGET_NAME only (not also "Jun 2026") — once the row flips
    // into its edit form, the month/year become <select>/<input> values
    // rather than text content, so a text-based filter would stop matching
    // mid-test.
    const row = page.locator("li", { hasText: TARGET_NAME });
    await expect(row).toContainText("Jun 2026");
    await expect(row).toContainText("150.00");
    await expect(row).toContainText("June deposit");

    await row.getByRole("button", { name: "Edit" }).click();
    await row.getByLabel("Amount").fill("175");
    await row.getByLabel("Note").fill("June deposit (corrected)");
    await row.getByRole("button", { name: "Save" }).click();

    await expect(row).toContainText("175.00");
    await expect(row).toContainText("June deposit (corrected)");
  });

  test("an admin can record two months' deposits from one paid date by only changing Month", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    await page.goto("/deposits");

    await page.getByRole("button", { name: "+ Add deposit" }).click();
    const addForm = page.locator("dialog form");
    await addForm.getByLabel("Member").selectOption({ label: TARGET_NAME });
    await addForm.getByLabel("Paid date").fill("2026-08-16");
    await addForm.getByLabel("Amount").fill("3000");
    await expect(addForm.getByLabel("Month")).toHaveValue("8");
    await addForm.getByRole("button", { name: "Add deposit" }).click();
    await expect(addForm.getByText(/deposit saved/i)).toBeVisible();

    // Same paid date, but the admin only changes Month for the second entry
    // — the modal stays open after the first save specifically so this
    // works without re-opening it or re-selecting the member/date.
    await addForm.getByLabel("Month").selectOption({ label: "September" });
    await addForm.getByRole("button", { name: "Add deposit" }).click();
    await expect(addForm.getByText(/deposit saved/i)).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    // Filtered on "— Aug 2026 —" (with the surrounding dashes from the
    // month/year span), not just "Aug 2026" — both rows share the same
    // "paid 16 Aug 2026" text, so a bare "Aug 2026" filter would match both.
    const augustRow = page.locator("li", { hasText: TARGET_NAME }).filter({ hasText: "— Aug 2026 —" });
    await expect(augustRow).toContainText("3,000.00");

    const septemberRow = page.locator("li", { hasText: TARGET_NAME }).filter({ hasText: "— Sep 2026 —" });
    await expect(septemberRow).toContainText("3,000.00");
    await expect(septemberRow).toContainText("paid 16 Aug 2026");
  });
});
