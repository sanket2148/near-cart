import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs } from "./auth-helper";

test("cookie-injected session shows an authenticated page, not the login form", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await createTestUser("test-smoke");
  try {
    await loginAs(context, user, baseURL!);
    await page.goto("/notifications");
    const skipLocation = page.getByText("Maybe later — just let me browse");
    await skipLocation.click({ timeout: 5000 }).catch(() => {});
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText(/log in to see updates/i)).toHaveCount(0);
  } finally {
    await deleteTestUser(user.id);
  }
});
