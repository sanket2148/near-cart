import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, adminClient } from "./auth-helper";

// Guards the 2026-07-22 OSM-import + claim-flow feature (see
// plan/tasks/decisions.md): shops can now exist unclaimed (source='osm',
// claimed=false, owner_id=null) and a merchant can claim one through the
// real /seller onboarding UI instead of only ever creating a brand-new shop.
test.setTimeout(60_000);

async function seedUnclaimedShop(admin: ReturnType<typeof adminClient>, name: string) {
  const { data: cat } = await admin
    .from("categories")
    .select("id")
    .eq("slug", "grocery")
    .maybeSingle();
  const { data: shop, error } = await admin
    .from("shops")
    .insert({
      name,
      category_id: cat?.id,
      address_line: "Test Area",
      city: "Bengaluru",
      pincode: "560001",
      lat: 12.9716,
      lng: 77.5946,
      status: "active",
      is_open: false,
      claimed: false,
      owner_id: null,
      source: "osm",
      external_id: `osm:node/e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return shop.id as string;
}

test("a merchant can find and claim a real unclaimed shop through the actual UI", async ({
  page,
  context,
  baseURL,
}) => {
  const admin = adminClient();
  const user = await createTestUser("test-e2e-claim-merchant");
  const shopName = `E2E Claimable Shop ${Date.now()}`;
  let shopId: string | undefined;

  try {
    shopId = await seedUnclaimedShop(admin, shopName);

    await loginAs(context, user, baseURL!);
    await page.goto("/seller");
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});

    await expect(page.getByText("Is your shop already listed on NearCart?")).toBeVisible();
    await page.getByRole("button", { name: "Find and claim my shop" }).click();

    await page.getByPlaceholder("Search by shop name").fill(shopName);
    const resultButton = page.getByRole("button", { name: new RegExp(shopName) });
    await expect(resultButton).toBeVisible({ timeout: 10000 });
    await resultButton.click();

    await expect(page.getByText("What kind of business is this?")).toBeVisible();
    await page.getByRole("button", { name: /Grocery/ }).click();
    await page.getByRole("button", { name: "Claim this shop" }).click();

    // Successful claim routes into the same post-shop flow createShop's path
    // uses — the real seller dashboard shell (bottom nav), not just "away
    // from the confirm screen" (that alone is true the instant the request
    // is *sent*, success or failure, so it isn't a real signal on its own).
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible({
      timeout: 15000,
    });

    const { data: shop } = await admin
      .from("shops")
      .select("owner_id, claimed, claimed_at")
      .eq("id", shopId)
      .single();
    expect(shop?.owner_id).toBe(user.id);
    expect(shop?.claimed).toBe(true);
    expect(shop?.claimed_at).toBeTruthy();

    const { data: verification } = await admin
      .from("shop_verifications")
      .select("business_type")
      .eq("shop_id", shopId)
      .maybeSingle();
    expect(verification?.business_type).toBe("grocery");
  } finally {
    if (shopId) {
      await admin.from("shop_verifications").delete().eq("shop_id", shopId);
      await admin.from("shops").delete().eq("id", shopId);
    }
    await deleteTestUser(user.id);
  }
});

test("two merchants racing to claim the same shop — only one wins", async ({
  browser,
  baseURL,
}) => {
  const admin = adminClient();
  const userA = await createTestUser("test-e2e-claim-race-a");
  const userB = await createTestUser("test-e2e-claim-race-b");
  const shopName = `E2E Race Claimable Shop ${Date.now()}`;
  let shopId: string | undefined;
  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];

  try {
    shopId = await seedUnclaimedShop(admin, shopName);

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    contexts.push(ctxA, ctxB);
    await loginAs(ctxA, userA, baseURL!);
    await loginAs(ctxB, userB, baseURL!);
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    async function navigateToConfirm(page: typeof pageA) {
      await page.goto("/seller");
      await page
        .getByText("Maybe later — just let me browse")
        .click({ timeout: 5000 })
        .catch(() => {});
      await page.getByRole("button", { name: "Find and claim my shop" }).click();
      await page.getByPlaceholder("Search by shop name").fill(shopName);
      const resultButton = page.getByRole("button", { name: new RegExp(shopName) });
      await expect(resultButton).toBeVisible({ timeout: 10000 });
      await resultButton.click();
      await expect(page.getByText("What kind of business is this?")).toBeVisible();
      await page.getByRole("button", { name: /Grocery/ }).click();
    }

    await Promise.all([navigateToConfirm(pageA), navigateToConfirm(pageB)]);
    await Promise.all([
      pageA.getByRole("button", { name: "Claim this shop" }).click(),
      pageB.getByRole("button", { name: "Claim this shop" }).click(),
    ]);
    await pageA.waitForTimeout(1500);
    await pageB.waitForTimeout(500);

    const { data: shop } = await admin
      .from("shops")
      .select("owner_id, claimed")
      .eq("id", shopId)
      .single();
    expect(shop?.claimed).toBe(true);
    expect([userA.id, userB.id]).toContain(shop?.owner_id);

    const { data: verifications } = await admin
      .from("shop_verifications")
      .select("id")
      .eq("shop_id", shopId);
    expect(verifications ?? [], "exactly one shop_verifications row, not two").toHaveLength(1);
  } finally {
    for (const c of contexts) await c.close().catch(() => {});
    if (shopId) {
      await admin.from("shop_verifications").delete().eq("shop_id", shopId);
      await admin.from("shops").delete().eq("id", shopId);
    }
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  }
});
