import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs } from "./auth-helper";

// Guards a real bug (see plan/tasks/decisions.md 2026-07-24): SidebarDrawer's
// profile section was hardcoded to "Sanket Kumar" / "sanket@nearcart.com"
// and always showed a "Log Out" button, regardless of whether anyone was
// actually logged in — contradicting pages like checkout.tsx that correctly
// check real auth state. The sidebar must now reflect the real session.
test.setTimeout(30_000);

test("sidebar shows a real logged-out state, not a fake 'logged in' one", async ({ page }) => {
  await page.goto("/");
  await page
    .getByText("Maybe later — just let me browse")
    .click({ timeout: 5000 })
    .catch(() => {});

  await expect(page.getByText("Not logged in")).toBeVisible();
  await expect(page.getByText("Sanket Kumar")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Log Out" })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Log In" })).toBeVisible();
});

test("sidebar shows the real logged-in user and a real working logout", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await createTestUser("test-e2e-sidebar-auth");

  try {
    await loginAs(context, user, baseURL!);
    await page.goto("/");
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});

    await expect(page.getByText(user.email)).toBeVisible();
    await expect(page.getByText("Not logged in")).not.toBeVisible();
    const logoutButton = page.getByRole("button", { name: "Log Out" });
    await expect(logoutButton).toBeVisible();

    await logoutButton.click();
    await page.waitForURL("/", { timeout: 10000 });
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});
    // Real logout, not just localStorage.clear() — the session cookie is
    // actually gone, so the sidebar (and everything else) sees a real
    // logged-out state, not a stale one.
    await expect(page.getByText("Not logged in")).toBeVisible();
  } finally {
    await deleteTestUser(user.id);
  }
});
