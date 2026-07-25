import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, adminClient } from "./auth-helper";

// Guards the 2026-07-25 barcode-driven product onboarding feature (see
// plan/tasks/decisions.md): scanning/entering a barcode in ProductDialog
// (seller.products.tsx) looks it up against the real Open Food Facts API
// (barcode/backend.server.ts) to prefill name/unit/category, and re-using a
// barcode already in this shop's own catalog nudges toward editing that
// product instead of creating a duplicate (migration 0015's unique index).
// The camera-decode step itself isn't exercisable through a real browser
// camera in Playwright, so this drives BarcodeScanner's manual-entry
// fallback — real network calls to Open Food Facts, real DB writes, real
// UI, just without an actual physical camera.
test.setTimeout(60_000);

// A real, currently-indexed Open Food Facts barcode (Nestlé Maggi Noodles
// Masala, India) — confirmed live against the actual API before writing
// this test, not fabricated.
const REAL_BARCODE = "8901058000306";
const REAL_PRODUCT_NAME = "Maggi noodles masala";

async function seedOwnedShop(admin: ReturnType<typeof adminClient>, ownerId: string, name: string) {
  const { data: cat } = await admin
    .from("categories")
    .select("id")
    .eq("slug", "grocery")
    .maybeSingle();
  const { data: shop, error } = await admin
    .from("shops")
    .insert({
      name,
      owner_id: ownerId,
      category_id: cat?.id,
      address_line: "Test Area",
      city: "Bengaluru",
      pincode: "560001",
      lat: 12.9352,
      lng: 77.6245,
      status: "active",
      is_open: true,
      claimed: true,
      claimed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await admin.from("shop_verifications").insert({ shop_id: shop.id, business_type: "grocery" });
  return shop.id as string;
}

async function seedVerificationLocalStorage(
  context: import("@playwright/test").BrowserContext,
  shopId: string,
) {
  await context.addInitScript((id) => {
    localStorage.setItem(
      `nearcart-verification-${id}`,
      JSON.stringify({ shopId: id, overallStatus: "approved" }),
    );
  }, shopId);
}

test("a real barcode lookup prefills product details, and re-entering the same barcode nudges toward the existing product", async ({
  page,
  context,
  baseURL,
}) => {
  const admin = adminClient();
  const user = await createTestUser("test-e2e-barcode-product");
  let shopId: string | undefined;

  try {
    shopId = await seedOwnedShop(admin, user.id, `E2E Barcode Shop ${Date.now()}`);
    await seedVerificationLocalStorage(context, shopId);
    await loginAs(context, user, baseURL!);

    // Land on /seller first and navigate in client-side, rather than a cold
    // page.goto straight to the child route — matches the proven pattern in
    // claim-shop.spec.ts/create-shop-location.spec.ts.
    await page.goto("/seller");
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("link", { name: "Products", exact: true }).click();

    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Add product" })).toBeVisible();

    await page.getByRole("button", { name: "Scan barcode" }).click();
    await expect(page.getByText("Scan a barcode")).toBeVisible();
    await page.getByPlaceholder("Or type the barcode").fill(REAL_BARCODE);
    await page.getByRole("button", { name: "Use", exact: true }).click();

    // Real lookup result prefilled the name field — confirms the live
    // Open Food Facts round-trip actually happened, not a stub.
    await expect(page.getByLabel("Name")).toHaveValue(REAL_PRODUCT_NAME, { timeout: 10000 });
    await expect(page.getByText(`Barcode: ${REAL_BARCODE}`)).toBeVisible();

    await page.getByLabel("Price (₹)").fill("15");
    await page.getByRole("button", { name: "Add product", exact: true }).click();
    await expect(page.getByText(REAL_PRODUCT_NAME)).toBeVisible({ timeout: 10000 });

    // Re-scanning the exact same barcode for a *second* new product should
    // recognize it's already in this shop's catalog and jump to editing the
    // existing row instead of silently allowing a duplicate.
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: "Scan barcode" }).click();
    await page.getByPlaceholder("Or type the barcode").fill(REAL_BARCODE);
    await page.getByRole("button", { name: "Use", exact: true }).click();

    await expect(page.getByText("Edit product")).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel("Name")).toHaveValue(REAL_PRODUCT_NAME);

    const { data: products } = await admin
      .from("products")
      .select("id, name, barcode")
      .eq("shop_id", shopId);
    expect(products, "no silent duplicate row for the same barcode").toHaveLength(1);
    expect(products?.[0].barcode).toBe(REAL_BARCODE);
  } finally {
    if (shopId) {
      await admin.from("products").delete().eq("shop_id", shopId);
      await admin.from("shop_verifications").delete().eq("shop_id", shopId);
      await admin.from("shops").delete().eq("id", shopId);
    }
    await deleteTestUser(user.id);
  }
});

test("the same barcode can exist in two different shops' catalogs without conflict", async () => {
  const admin = adminClient();
  const userA = await createTestUser("test-e2e-barcode-shop-a");
  const userB = await createTestUser("test-e2e-barcode-shop-b");
  let shopIdA: string | undefined;
  let shopIdB: string | undefined;

  try {
    shopIdA = await seedOwnedShop(admin, userA.id, `E2E Barcode Shop A ${Date.now()}`);
    shopIdB = await seedOwnedShop(admin, userB.id, `E2E Barcode Shop B ${Date.now()}`);

    const insertFor = (shopId: string) =>
      admin.from("products").insert({
        shop_id: shopId,
        name: REAL_PRODUCT_NAME,
        emoji: "📦",
        price_amount: 1500,
        unit: "560 gm",
        menu_section: "Instant noodles",
        in_stock: true,
        barcode: REAL_BARCODE,
      });

    const { error: errA } = await insertFor(shopIdA);
    const { error: errB } = await insertFor(shopIdB);
    expect(errA).toBeNull();
    expect(errB).toBeNull();
  } finally {
    if (shopIdA) {
      await admin.from("products").delete().eq("shop_id", shopIdA);
      await admin.from("shop_verifications").delete().eq("shop_id", shopIdA);
      await admin.from("shops").delete().eq("id", shopIdA);
    }
    if (shopIdB) {
      await admin.from("products").delete().eq("shop_id", shopIdB);
      await admin.from("shop_verifications").delete().eq("shop_id", shopIdB);
      await admin.from("shops").delete().eq("id", shopIdB);
    }
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  }
});
