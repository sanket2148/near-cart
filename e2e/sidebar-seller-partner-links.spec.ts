import { test, expect } from "@playwright/test";

// Guards the 2026-07-25 sidebar addition (see plan/tasks/decisions.md):
// "Add Your Shop" and "Become a Delivery Partner" links, so a customer
// browsing the app can find seller/partner onboarding without knowing the
// /seller or /partner URLs exist. Visible regardless of login state — the
// links themselves aren't gated, only what's behind /seller and /partner is.
test("the sidebar links to real seller and partner onboarding routes", async ({ page }) => {
  await page.goto("/");

  const sellerLink = page.getByRole("link", { name: "Add Your Shop" });
  const partnerLink = page.getByRole("link", { name: "Become a Delivery Partner" });
  await expect(sellerLink).toBeVisible();
  await expect(partnerLink).toBeVisible();
  await expect(sellerLink).toHaveAttribute("href", "/seller");
  await expect(partnerLink).toHaveAttribute("href", "/partner");

  await sellerLink.click();
  await expect(page).toHaveURL(/\/seller$/);
  // Real /seller route rendered (its own login/onboarding gate), not a 404.
  await expect(page.getByText(/Seller login|Is your shop already listed/)).toBeVisible({
    timeout: 10000,
  });
});
