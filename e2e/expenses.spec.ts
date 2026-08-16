import crypto from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { createSessionCookie } from "./auth-helpers";

// See `members-access.spec.ts` for the rationale on loading `.env` explicitly
// and seeding with raw `pg` rather than `@/lib/prisma` (Playwright's CJS spec
// loader can't import the generated Prisma client, which uses `import.meta.url`).
loadEnv({ path: ".env", quiet: true });

const PREFIX = "e2e-expenses-test-";
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const MEMBER_EMAIL = `${PREFIX}member@example.com`;

test.describe("/expenses access boundary and flow", () => {
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
    await client.query(
      `DELETE FROM expenses WHERE "createdById" IN (SELECT id FROM members WHERE email LIKE $1)`,
      [`${PREFIX}%`],
    );
    await client.query(`DELETE FROM members WHERE email LIKE $1`, [`${PREFIX}%`]);
    await client.end();
  });

  test("an ADMIN session sees the manage-expenses heading and form", async ({ page, context }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/expenses");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /expenses/i })).toBeVisible();
    await expect(page.getByLabel(/category/i)).toBeVisible();
    await expect(page.getByLabel(/amount/i)).toBeVisible();
  });

  test("a MEMBER session is rejected with a 404, not just visually hidden", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(MEMBER_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    const response = await page.goto("/expenses");

    expect(response?.status()).toBe(404);
    await expect(page.getByText(/this page could not be found/i)).toBeVisible();
  });

  test("an admin can add an expense and then edit it", async ({ page, context }) => {
    const cookie = await createSessionCookie(ADMIN_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    await page.goto("/expenses");

    const addForm = page.locator("form", { hasText: "Add expense" });
    await addForm.getByLabel("Date").fill("2026-06-05");
    await addForm.getByLabel("Category").fill("Land survey");
    await addForm.getByLabel("Amount").fill("500");
    await addForm.getByLabel("Note").fill("Surveyor fee");
    await addForm.getByRole("button", { name: "Add expense" }).click();

    // Scoped positionally rather than by text: unlike deposits/topups, an
    // expense row has no <select> (whose option text stays in the DOM even
    // as a form control), so once the row flips into its edit form none of
    // its fields remain as plain text content to filter on. Only one
    // expense exists at this point, so the first (only) row is unambiguous.
    const row = page.locator("main ul li").first();
    await expect(row).toContainText("500.00");
    await expect(row).toContainText("Surveyor fee");

    await row.getByRole("button", { name: "Edit" }).click();
    await row.getByLabel("Amount").fill("550");
    await row.getByLabel("Note").fill("Surveyor fee (corrected)");
    await row.getByRole("button", { name: "Save" }).click();

    await expect(row).toContainText("550.00");
    await expect(row).toContainText("Surveyor fee (corrected)");
  });
});
