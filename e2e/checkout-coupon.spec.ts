import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, adminClient } from "./auth-helper";

test("real coupon code reduces the checkout total through the actual UI", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await createTestUser("test-e2e-coupon");
  const admin = adminClient();

  try {
    const { data: coupon } = await admin
      .from("coupons")
      .select("code")
      .eq("code", "FREESHIP")
      .maybeSingle();
    test.skip(!coupon, "FREESHIP seed coupon not present — run supabase/seed-coupons.mjs first.");

    const { data: product } = await admin
      .from("products")
      .select("id, shop_id, name, in_stock, shops(status)")
      .eq("in_stock", true)
      .limit(50);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usable = (product ?? []).find((p: any) => p.shops?.status === "active");
    test.skip(!usable, "No active shop with an in-stock product to add to cart.");

    await loginAs(context, user, baseURL!);
    await page.goto(`/shop/${usable.shop_id}`);
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});

    const addButtons = page.getByRole("button", { name: "ADD", exact: true });
    await expect(addButtons.first()).toBeVisible({ timeout: 15000 });
    await addButtons.first().click();
    await expect
      .poll(
        async () => {
          const raw = await page.evaluate(() => localStorage.getItem("nearcart-cart"));
          return raw ? (JSON.parse(raw).lines?.length ?? 0) : 0;
        },
        { timeout: 5000 },
      )
      .toBeGreaterThan(0);
    await page.goto("/checkout");
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});

    await page.getByPlaceholder("Enter coupon code").fill("FREESHIP");
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page.getByText("FREESHIP", { exact: true })).toBeVisible();
    await expect(page.getByText(/off applied/i)).toBeVisible();
    await expect(page.getByText("Total payable · ₹30 saved")).toBeVisible();
  } finally {
    await deleteTestUser(user.id);
  }
});
