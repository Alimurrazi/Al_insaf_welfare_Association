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

  // Scoped by the row's own wrapper classes (`border-t border-line`, shared
  // by every deposit row and its inline edit form — see deposit-row.tsx),
  // filtered to the text that identifies one specific row. `div` (not the
  // stale `li` this suite used before the Figma-redesign reformat, which no
  // longer matches anything in the current markup).
  function depositRow(page: import("@playwright/test").Page, ...text: string[]) {
    let locator = page.locator("div.border-t.border-line", { hasText: TARGET_NAME });
    for (const t of text) locator = locator.filter({ hasText: t });
    return locator;
  }

  test("an admin can add a deposit with an explicit month/year, and then edit it", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    await page.goto("/deposits");

    await page.getByRole("button", { name: "+ Add deposit" }).click();
    const addForm = page.locator("dialog form");
    await addForm.getByLabel("Member").selectOption({ label: TARGET_NAME });
    // Month/Year no longer auto-fill from Paid date (see the standalone
    // independence test below) — both are set explicitly here.
    await addForm.getByRole("combobox", { name: /month/i }).selectOption({ label: "June" });
    await addForm.getByRole("spinbutton", { name: /year/i }).fill("2026");
    await addForm.getByLabel("Paid date").fill("2026-06-05");
    await addForm.getByLabel("Amount").fill("150");
    await addForm.getByLabel("Note").fill("June deposit");
    await addForm.getByRole("button", { name: "Add deposit" }).click();
    // The modal deliberately stays open after a successful save (so a
    // second month can be added from the same paid date) — close it before
    // asserting on the row underneath.
    await expect(addForm.getByText(/deposit saved/i)).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    const row = depositRow(page, "Jun 2026");
    await expect(row).toContainText("150.00");
    await expect(row).toContainText("June deposit");

    // Switch locators once editing starts: the row's own "Jun 2026" text
    // disappears once Month/Year become <select>/<input> values instead of
    // text content, so re-using `row` (filtered on that text) here would
    // stop matching mid-interaction. Scoped to the row currently showing a
    // "Save" button (not just any page-level getByLabel) because the
    // closed Add Deposit dialog stays mounted in the DOM and shares the
    // same field labels, which would otherwise make those lookups ambiguous.
    await row.getByRole("button", { name: `Edit deposit for ${TARGET_NAME}` }).click();
    const editForm = page
      .locator("div.border-t.border-line")
      .filter({ has: page.getByRole("button", { name: "Save" }) });
    await editForm.getByLabel("Amount").fill("175");
    await editForm.getByLabel("Note").fill("June deposit (corrected)");
    await editForm.getByRole("button", { name: "Save" }).click();

    const editedRow = depositRow(page, "Jun 2026");
    await expect(editedRow).toContainText("175.00");
    await expect(editedRow).toContainText("June deposit (corrected)");
  });

  test("changing Paid date does not overwrite an already-chosen Month/Year", async ({ page, context }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    await page.goto("/deposits");

    await page.getByRole("button", { name: "+ Add deposit" }).click();
    const addForm = page.locator("dialog form");
    await addForm.getByLabel("Member").selectOption({ label: TARGET_NAME });
    // The reported bug: picking a January-2025 period, then paying in July
    // 2026 (a very late/backfilled payment) must not silently move the
    // deposit to July/2026.
    await addForm.getByRole("combobox", { name: /month/i }).selectOption({ label: "January" });
    await addForm.getByRole("spinbutton", { name: /year/i }).fill("2025");
    await addForm.getByLabel("Paid date").fill("2026-07-10");
    await expect(addForm.getByRole("combobox", { name: /month/i })).toHaveValue("1");
    await expect(addForm.getByRole("spinbutton", { name: /year/i })).toHaveValue("2025");

    await addForm.getByLabel("Amount").fill("500");
    await addForm.getByRole("button", { name: "Add deposit" }).click();
    await expect(addForm.getByText(/deposit saved/i)).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    const row = depositRow(page, "Jan 2025");
    await expect(row).toContainText("500.00");
    await expect(row).toContainText("10 Jul 2026");
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
    await addForm.getByRole("combobox", { name: /month/i }).selectOption({ label: "August" });
    await addForm.getByRole("spinbutton", { name: /year/i }).fill("2026");
    await addForm.getByLabel("Paid date").fill("2026-08-16");
    await addForm.getByLabel("Amount").fill("3000");
    await addForm.getByRole("button", { name: "Add deposit" }).click();
    await expect(addForm.getByText(/deposit saved/i)).toBeVisible();

    // Same paid date, but the admin only changes Month for the second entry
    // — the modal stays open after the first save specifically so this
    // works without re-opening it or re-selecting the member/date. Month/Year
    // being independent of Paid date is exactly what makes this safe: only
    // Month changes here, and Paid date/Amount are left untouched.
    await addForm.getByRole("combobox", { name: /month/i }).selectOption({ label: "September" });
    await addForm.getByRole("button", { name: "Add deposit" }).click();
    await expect(addForm.getByText(/deposit saved/i)).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    // "Aug 2026" alone isn't unique: the September row's Paid Date column
    // also reads "16 Aug 2026" (same paid date, deliberately, for both
    // entries) — excluding "Sep 2026" rules that row back out.
    const augustRow = depositRow(page, "Aug 2026").filter({ hasNotText: "Sep 2026" });
    await expect(augustRow).toContainText("3,000.00");

    const septemberRow = depositRow(page, "Sep 2026");
    await expect(septemberRow).toContainText("3,000.00");
    await expect(septemberRow).toContainText("16 Aug 2026");
  });
});
