import crypto from "node:crypto";
import { Client } from "pg";
import { expect, test } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { createSessionCookie } from "./auth-helpers";

// See `members-access.spec.ts` for the rationale on loading `.env` explicitly
// and seeding with raw `pg` rather than `@/lib/prisma` (Playwright's CJS spec
// loader can't import the generated Prisma client, which uses `import.meta.url`).
loadEnv({ path: ".env", quiet: true });

const PREFIX = "e2e-signin-test-";
const MEMBER_EMAIL = `${PREFIX}member@example.com`;

test.describe("/sign-in", () => {
  test.describe.configure({ mode: "serial" });

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  test.beforeAll(async () => {
    await client.connect();
    await client.query(
      `INSERT INTO members (id, name, email, role, "joinDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'MEMBER', now(), now(), now())`,
      [crypto.randomUUID(), `${PREFIX}Member`, MEMBER_EMAIL],
    );
  });

  test.afterAll(async () => {
    await client.query(`DELETE FROM members WHERE email LIKE $1`, [`${PREFIX}%`]);
    await client.end();
  });

  test("a signed-out visitor sees the Google sign-in card", async ({ page }) => {
    const response = await page.goto("/sign-in");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
  });

  // Regression test: the root layout renders TopNav on every page, including
  // /sign-in, and TopNav shows the logged-in header as soon as a session
  // cookie exists — independently of what the page body renders. Without
  // this redirect, landing back on /sign-in?callbackUrl=... with a session
  // already set (e.g. after the OAuth redirect chain bounces here) left the
  // topbar looking signed-in while the sign-in card stayed visible
  // underneath, with no indication login had actually succeeded.
  test("an already-authenticated session visiting /sign-in is redirected to the dashboard", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(MEMBER_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    await page.goto("/sign-in");

    await expect(page).toHaveURL("http://localhost:3000/");
    await expect(page.getByRole("button", { name: /sign in with google/i })).not.toBeVisible();
  });

  test("an already-authenticated session visiting /sign-in with a relative callbackUrl is redirected there", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(MEMBER_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    await page.goto("/sign-in?callbackUrl=%2Factivity");

    await expect(page).toHaveURL("http://localhost:3000/activity");
  });

  test("an already-authenticated session visiting /sign-in with an absolute/external callbackUrl falls back to the dashboard", async ({
    page,
    context,
  }) => {
    const cookie = await createSessionCookie(MEMBER_EMAIL);
    await context.addCookies([{ ...cookie, url: "http://localhost:3000" }]);

    // Mirrors the exact shape NextAuth appended in the reported bug
    // (`callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F`) — an absolute URL,
    // which the redirect must not follow verbatim (open-redirect guard),
    // falling back to "/" instead.
    await page.goto("/sign-in?callbackUrl=http%3A%2F%2Flocalhost%3A3000%2F");

    await expect(page).toHaveURL("http://localhost:3000/");
  });
});
