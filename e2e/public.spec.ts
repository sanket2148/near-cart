import { test, expect } from "@playwright/test";
import { adminClient } from "./auth-helper";

test("home page renders real shops with an hours-aware open/closed label", async ({ page }) => {
  await page.goto("/");
  await page
    .getByText("Maybe later — just let me browse")
    .click({ timeout: 5000 })
    .catch(() => {});
  // Shop Hours (2026-07-19): every shop card shows either "Open"/"Closed" or a
  // real computed label like "Open · closes 9:00 PM" / "Opens tomorrow at ...".
  await expect(page.getByText(/open|closed/i).first()).toBeVisible({ timeout: 10000 });
});

test("a shop with real configured hours shows a real computed label, not just Open/Closed", async ({
  page,
}) => {
  // Self-contained rather than depending on seed data having a shop with
  // shop_hours rows already (it doesn't by default — this test used to skip
  // for that reason). Seeds a real throwaway shop open 00:00-23:59 every day
  // so the label is deterministically "Open · closes 11:59 PM" regardless of
  // when this test runs, then cleans up.
  const admin = adminClient();
  const { data: sellerUser } = await admin.auth.admin.createUser({
    email: `test-e2e-hours-${Date.now()}@example.com`,
    password: "Test1234!",
    email_confirm: true,
  });
  const { data: cat } = await admin.from("categories").select("id").limit(1).maybeSingle();
  const { data: shop, error: shopErr } = await admin
    .from("shops")
    .insert({
      owner_id: sellerUser.user.id,
      name: "E2E Hours Test Shop",
      category_id: cat?.id,
      status: "active",
      lat: 12.9716,
      lng: 77.5946,
      address_line: "Test Area",
      city: "Bengaluru",
      pincode: "560001",
    })
    .select("id")
    .single();
  if (shopErr) throw new Error(shopErr.message);

  try {
    const { error: hoursErr } = await admin.from("shop_hours").insert(
      Array.from({ length: 7 }, (_, day) => ({
        shop_id: shop.id,
        day_of_week: day,
        open_time: "00:00:00",
        close_time: "23:59:00",
      })),
    );
    if (hoursErr) throw new Error(hoursErr.message);

    await page.goto(`/shop/${shop.id}`);
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});
    await expect(page.getByText("Open · closes 11:59 PM")).toBeVisible();
  } finally {
    await admin.from("shop_hours").delete().eq("shop_id", shop.id);
    await admin.from("shops").delete().eq("id", shop.id);
    await admin.auth.admin.deleteUser(sellerUser.user.id).catch(() => {});
  }
});

test("/api-docs loads and serves the expanded OpenAPI spec", async ({ page, request, baseURL }) => {
  await page.goto("/api-docs");
  await expect(page).toHaveTitle(/api|docs|swagger/i);

  const res = await request.get(`${baseURL}/api-docs/openapi.json`);
  expect(res.ok()).toBeTruthy();
  const doc = await res.json();
  expect(Object.keys(doc.paths).length).toBeGreaterThanOrEqual(76);
  expect(doc.paths["/rpc/orders/cancelOrder"]).toBeTruthy();
  expect(doc.paths["/rpc/shop-hours/setShopHours"]).toBeTruthy();
});
