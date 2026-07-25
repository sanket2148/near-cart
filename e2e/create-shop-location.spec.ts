import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, adminClient } from "./auth-helper";

// Guards the 2026-07-24 fix (see plan/tasks/decisions.md): createShop used to
// hardcode the exact same lat/lng for every new merchant-created shop,
// silently breaking the real PostGIS proximity search (nearby_shops,
// migration 0012) once it started relying on real coordinates. The merchant
// now pins a real GPS location via CreateShopStep before they can submit.
test.setTimeout(60_000);

// A real point a few km from Bengaluru's demo center (12.9352, 77.6245) —
// far enough that a test asserting "not the old hardcoded constant" can't
// pass by coincidence.
const REAL_LAT = 12.9784;
const REAL_LNG = 77.6408;

test("a new shop is created with the merchant's real pinned GPS location, not a hardcoded constant", async ({
  page,
  context,
  baseURL,
}) => {
  const admin = adminClient();
  const user = await createTestUser("test-e2e-create-shop-geo");
  const shopName = `E2E Geo Shop ${Date.now()}`;
  let shopId: string | undefined;

  try {
    await context.grantPermissions(["geolocation"], { origin: baseURL });
    await context.setGeolocation({ latitude: REAL_LAT, longitude: REAL_LNG });

    await loginAs(context, user, baseURL!);
    await page.goto("/seller");
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});

    await expect(page.getByText("Is your shop already listed on NearCart?")).toBeVisible();
    await page.getByRole("button", { name: "Create a new shop" }).click();

    await expect(page.getByText("Set up your shop")).toBeVisible();
    await page.getByLabel("Shop name").fill(shopName);
    await page.getByRole("button", { name: /Grocery/ }).click();
    await page.getByLabel("Area").fill("Test Geo Area");

    const submit = page.getByRole("button", { name: "Create shop", exact: true });
    await expect(submit).toBeDisabled();

    await page.getByRole("button", { name: "Pin my shop's location" }).click();
    await expect(page.getByText(/Drag the pin/)).toBeVisible({ timeout: 10000 });

    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible({
      timeout: 15000,
    });

    const { data: shop } = await admin
      .from("shops")
      .select("id, lat, lng")
      .eq("owner_id", user.id)
      .single();
    shopId = shop?.id;

    expect(shop?.lat).toBeCloseTo(REAL_LAT, 2);
    expect(shop?.lng).toBeCloseTo(REAL_LNG, 2);
    // The old bug: every shop landed at this exact hardcoded point.
    expect(shop?.lat).not.toBeCloseTo(12.9352, 2);
    expect(shop?.lng).not.toBeCloseTo(77.6245, 2);
  } finally {
    if (shopId) {
      await admin.from("shop_verifications").delete().eq("shop_id", shopId);
      await admin.from("shops").delete().eq("id", shopId);
    }
    await deleteTestUser(user.id);
  }
});
