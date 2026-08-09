import { expect, test } from "@playwright/test";

test("unauthenticated visitor is redirected to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(
    page.getByRole("button", { name: /sign in with google/i }),
  ).toBeVisible();
});
