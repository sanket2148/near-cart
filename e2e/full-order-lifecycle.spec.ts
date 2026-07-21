import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, adminClient, type TestUser } from "./auth-helper";

// The full three-role happy path: customer places a real order → seller
// accepts it and assigns a real delivery partner → partner accepts, picks
// up, and delivers → customer sees it as Delivered. Each role gets its own
// browser context (its own cookie jar) since all three are logged in at
// once, exactly like three separate people/devices in real life.
test.setTimeout(90_000);

async function dismissLocationModal(page: Page) {
  await page
    .getByText("Maybe later — just let me browse")
    .click({ timeout: 5000 })
    .catch(() => {});
}

test("customer order → seller accept+assign → partner accept+deliver → customer sees Delivered", async ({
  browser,
  baseURL,
}) => {
  const base = baseURL!;
  const admin = adminClient();
  const customer = await createTestUser("test-e2e-lifecycle-customer");
  const sellerAuth = await admin.auth.admin.createUser({
    email: `test-e2e-lifecycle-seller-${Date.now()}@example.com`,
    password: "Test1234!",
    email_confirm: true,
  });
  const partnerAuth = await admin.auth.admin.createUser({
    email: `test-e2e-lifecycle-partner-${Date.now()}@example.com`,
    password: "Test1234!",
    email_confirm: true,
  });
  const sellerUser: TestUser = { id: sellerAuth.data.user.id, email: sellerAuth.data.user.email! };
  const partnerUser: TestUser = {
    id: partnerAuth.data.user.id,
    email: partnerAuth.data.user.email!,
  };
  // A unique full_name so the "Assign a delivery partner" dropdown option is
  // unambiguous even if a stray leftover test partner exists from a prior run.
  const partnerDisplayName = `E2E Test Partner ${Date.now()}`;
  await admin.from("users").upsert([
    { id: sellerUser.id, email: sellerUser.email },
    { id: partnerUser.id, email: partnerUser.email, full_name: partnerDisplayName },
  ]);

  let shopId: string | undefined;
  let productId: string | undefined;
  let partnerId: string | undefined;
  let orderId: string | undefined;
  const contexts: BrowserContext[] = [];

  try {
    // ─── Seed a real approved shop + product + available partner ───────────
    const { data: cat } = await admin.from("categories").select("id").limit(1).maybeSingle();
    const { data: shop, error: shopErr } = await admin
      .from("shops")
      .insert({
        owner_id: sellerUser.id,
        name: "E2E Lifecycle Test Shop",
        category_id: cat?.id,
        status: "active",
        lat: 12.9716,
        lng: 77.5946,
        address_line: "Test Area",
        city: "Bengaluru",
        pincode: "560001",
        delivery_fee_amount: 2000,
        free_delivery_above_amount: 50000,
      })
      .select("id")
      .single();
    if (shopErr) throw new Error(shopErr.message);
    shopId = shop.id;

    await admin
      .from("shop_verifications")
      .insert({ shop_id: shopId, business_type: "grocery", overall_status: "approved" });

    const { data: product, error: productErr } = await admin
      .from("products")
      .insert({
        shop_id: shopId,
        name: "E2E Lifecycle Test Product",
        emoji: "🧪",
        price_amount: 10000,
        unit: "1 pack",
        menu_section: "Staples",
        in_stock: true,
        stock_qty: 50,
      })
      .select("id")
      .single();
    if (productErr) throw new Error(productErr.message);
    productId = product.id;

    const { data: partner, error: partnerErr } = await admin
      .from("delivery_partners")
      .insert({ user_id: partnerUser.id, vehicle_type: "bike", status: "active", is_online: true })
      .select("id")
      .single();
    if (partnerErr) throw new Error(partnerErr.message);
    partnerId = partner.id;

    // ─── Customer: browse the real shop, add the real product, checkout COD ─
    const customerCtx = await browser.newContext();
    contexts.push(customerCtx);
    await loginAs(customerCtx, customer, base);
    const customerPage = await customerCtx.newPage();

    await customerPage.goto(`/shop/${shopId}`);
    await dismissLocationModal(customerPage);
    await customerPage.getByRole("button", { name: "ADD", exact: true }).first().click();
    await expect
      .poll(async () => {
        const raw = await customerPage.evaluate(() => localStorage.getItem("nearcart-cart"));
        return raw ? (JSON.parse(raw).lines?.length ?? 0) : 0;
      })
      .toBeGreaterThan(0);

    await customerPage.goto("/checkout");
    await dismissLocationModal(customerPage);
    await customerPage.getByRole("button", { name: "Cash on Delivery" }).click();
    await customerPage.getByRole("button", { name: "Place Order" }).click();
    await customerPage.waitForURL(/\/order\//, { timeout: 15000 });
    orderId = customerPage.url().split("/order/")[1];
    expect(orderId).toBeTruthy();

    // ─── Seller: accept the real order, assign the real partner, advance ────
    const sellerCtx = await browser.newContext();
    contexts.push(sellerCtx);
    await loginAs(sellerCtx, sellerUser, base);
    // The verification wizard's overall status is localStorage-only (a
    // documented simplification — see plan/tasks/decisions.md) so the DB's
    // shop_verifications.overall_status='approved' alone doesn't unlock
    // /seller/orders in a fresh browser with no localStorage. Seed the real
    // ShopVerification shape the app itself reads (loadVerification() deep-
    // merges with createEmptyVerification, so a minimal object is enough).
    await sellerCtx.addInitScript((id) => {
      localStorage.setItem(
        `nearcart-verification-${id}`,
        JSON.stringify({ shopId: id, overallStatus: "approved" }),
      );
    }, shopId);
    const sellerPage = await sellerCtx.newPage();

    await sellerPage.goto("/seller/orders");
    await dismissLocationModal(sellerPage);
    const orderCard = sellerPage.locator("li", { hasText: "E2E Lifecycle Test Product" }).first();
    await expect(orderCard).toBeVisible({ timeout: 10000 });
    await orderCard.getByRole("button", { name: "Accept" }).click();

    // Order moved out of the "New" tab — switch to "Active" to keep seeing it.
    // Can't locate by the product name here — OrderCard's collapsed header
    // only shows customerName/id/total, not line items (those render inside
    // the `open &&` block) — unlike JobCard below, whose shop name IS always
    // visible in its header. Safe to grab the only card since the "Active
    // (1)" tab count confirms exactly one order is here.
    await sellerPage.getByRole("button", { name: /^Active/ }).click();
    const activeCard = sellerPage.locator("li").first();
    await activeCard.locator("button").first().click(); // expand — the toggle is the header <button>, not the <li> itself
    await activeCard.getByRole("combobox").click();
    await sellerPage.getByRole("option", { name: new RegExp(partnerDisplayName) }).click();
    // Once assigned, the Select is replaced by a read-only "{name} · {vehicle} · rating" line.
    await expect(activeCard.getByText(partnerDisplayName)).toBeVisible();

    await activeCard.getByRole("button", { name: /Mark as Preparing/i }).click();
    await activeCard.getByRole("button", { name: /Mark as Ready to dispatch/i }).click();

    // ─── Partner: accept the real job, pick up, deliver ─────────────────────
    const partnerCtx = await browser.newContext();
    contexts.push(partnerCtx);
    await loginAs(partnerCtx, partnerUser, base);
    const partnerPage = await partnerCtx.newPage();

    await partnerPage.goto("/partner/deliveries");
    await dismissLocationModal(partnerPage);
    const jobCard = partnerPage.locator("li", { hasText: "E2E Lifecycle Test Shop" }).first();
    await expect(jobCard).toBeVisible({ timeout: 10000 });
    await jobCard.getByRole("button", { name: "Accept" }).click();

    await partnerPage.getByRole("button", { name: /^Active/ }).click();
    const activeJob = partnerPage.locator("li", { hasText: "E2E Lifecycle Test Shop" }).first();
    await activeJob.locator("button").first().click(); // expand — same toggle-vs-li distinction as the seller card
    await activeJob.getByRole("button", { name: "Picked up order" }).click();
    await activeJob.getByRole("button", { name: "Delivered to customer" }).click();

    // ─── Customer: real order now shows Delivered ───────────────────────────
    await customerPage.goto(`/order/${orderId}`);
    await dismissLocationModal(customerPage);
    await expect(customerPage.getByText("Delivered", { exact: true }).first()).toBeVisible({
      timeout: 10000,
    });

    const { data: finalOrder } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    expect(finalOrder?.status).toBe("delivered");
  } finally {
    for (const c of contexts) await c.close();
    if (orderId) {
      await admin.from("assignments").delete().eq("order_id", orderId);
      await admin.from("order_events").delete().eq("order_id", orderId);
      await admin.from("order_items").delete().eq("order_id", orderId);
      await admin.from("orders").delete().eq("id", orderId);
    }
    if (productId) await admin.from("products").delete().eq("id", productId);
    if (partnerId) await admin.from("delivery_partners").delete().eq("id", partnerId);
    if (shopId) {
      await admin.from("shop_verifications").delete().eq("shop_id", shopId);
      await admin.from("shops").delete().eq("id", shopId);
    }
    await deleteTestUser(customer.id);
    await admin.auth.admin.deleteUser(sellerUser.id).catch(() => {});
    await admin.auth.admin.deleteUser(partnerUser.id).catch(() => {});
  }
});
