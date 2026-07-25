import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, adminClient, type TestUser } from "./auth-helper";

// Guards a real gap found 2026-07-22 (see plan/tasks/decisions.md): this app
// uses one unified login, so nothing previously stopped the same Supabase
// Auth user who owns a shop from also placing an order there as a customer.
// The concrete abuse path is reviews: a seller could self-order, walk it to
// "Delivered" via their own seller actions, then leave themselves a real
// review that recomputes rating_avg — the exact trust signal real customers
// use. Two independent guards: orders/backend.server.ts's placeOrder (the
// primary defense — no self-order should ever exist) and
// reviews/backend.server.ts's getReviewableOrder (defense in depth — even a
// self-order that somehow exists can't be reviewed by its own owner).
test.setTimeout(60_000);

test("a shop owner cannot place a real order at their own shop", async ({ browser, baseURL }) => {
  const base = baseURL!;
  const admin = adminClient();
  const ownerAuth = await admin.auth.admin.createUser({
    email: `test-e2e-selforder-owner-${Date.now()}@example.com`,
    password: "Test1234!",
    email_confirm: true,
  });
  const owner: TestUser = { id: ownerAuth.data.user!.id, email: ownerAuth.data.user!.email! };
  await admin.from("users").upsert({ id: owner.id, email: owner.email });

  let shopId: string | undefined;
  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];

  try {
    const { data: cat } = await admin.from("categories").select("id").limit(1).maybeSingle();
    const { data: shop, error: shopErr } = await admin
      .from("shops")
      .insert({
        owner_id: owner.id,
        name: "E2E Self-Order Test Shop",
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

    const { error: productErr } = await admin.from("products").insert({
      shop_id: shopId,
      name: "E2E Self-Order Test Product",
      emoji: "🧪",
      price_amount: 10000,
      unit: "1 pack",
      menu_section: "Staples",
      in_stock: true,
      stock_qty: 50,
    });
    if (productErr) throw new Error(productErr.message);

    const ctx = await browser.newContext();
    contexts.push(ctx);
    await loginAs(ctx, owner, base);
    const page = await ctx.newPage();

    await page.goto(`/shop/${shopId}`);
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});
    await page.getByRole("button", { name: "ADD", exact: true }).first().click();
    await expect
      .poll(async () => {
        const raw = await page.evaluate(() => localStorage.getItem("nearcart-cart"));
        return raw ? (JSON.parse(raw).lines?.length ?? 0) : 0;
      })
      .toBeGreaterThan(0);

    await page.goto("/checkout");
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});
    await page.getByRole("button", { name: "Cash on Delivery" }).click();
    await page.getByRole("button", { name: "Place Order" }).click();

    await expect(page.getByText("You can't place an order at your own shop.")).toBeVisible();
    await page.waitForTimeout(1000);
    expect(page.url()).not.toMatch(/\/order\//);

    const { data: orders } = await admin
      .from("orders")
      .select("id")
      .eq("customer_id", owner.id)
      .eq("shop_id", shopId);
    expect(orders ?? [], "no order should have been created").toHaveLength(0);
  } finally {
    if (shopId) {
      await admin.from("products").delete().eq("shop_id", shopId);
      await admin.from("shops").delete().eq("id", shopId);
    }
    for (const c of contexts) await c.close().catch(() => {});
    await deleteTestUser(owner.id);
  }
});

test("a shop owner's own order (seeded directly, bypassing placeOrder) cannot be reviewed by them", async ({
  browser,
  baseURL,
}) => {
  const base = baseURL!;
  const admin = adminClient();
  const ownerAuth = await admin.auth.admin.createUser({
    email: `test-e2e-selfreview-owner-${Date.now()}@example.com`,
    password: "Test1234!",
    email_confirm: true,
  });
  const owner: TestUser = { id: ownerAuth.data.user!.id, email: ownerAuth.data.user!.email! };
  await admin.from("users").upsert({ id: owner.id, email: owner.email });

  let shopId: string | undefined;
  let orderId: string | undefined;
  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];

  try {
    const { data: cat } = await admin.from("categories").select("id").limit(1).maybeSingle();
    const { data: shop, error: shopErr } = await admin
      .from("shops")
      .insert({
        owner_id: owner.id,
        name: "E2E Self-Review Test Shop",
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
    shopId = shop.id;

    const { data: address, error: addrErr } = await admin
      .from("addresses")
      .insert({
        user_id: owner.id,
        label: "Delivery",
        line1: "Test Address",
        city: "Bengaluru",
        pincode: "560001",
        lat: 12.97,
        lng: 77.59,
      })
      .select("id")
      .single();
    if (addrErr) throw new Error(addrErr.message);

    // Seeded directly via admin — bypassing placeOrder's new guard entirely —
    // to prove the reviews-side defense in depth holds even if a self-order
    // exists for some other reason.
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        customer_id: owner.id,
        shop_id: shopId,
        address_id: address.id,
        status: "delivered",
        payment_method: "cod",
        items_amount: 10000,
        delivery_amount: 0,
        discount_amount: 0,
        total_amount: 10000,
        pickup_otp: "1234",
        delivery_otp: "5678",
      })
      .select("id")
      .single();
    if (orderErr) throw new Error(orderErr.message);
    orderId = order.id;

    const ctx = await browser.newContext();
    contexts.push(ctx);
    await loginAs(ctx, owner, base);
    const page = await ctx.newPage();

    await page.goto(`/order/${orderId}`);
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});
    await expect(page.getByText("Order summary")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Rate your order")).not.toBeVisible();
  } finally {
    if (orderId) {
      await admin.from("orders").delete().eq("id", orderId);
    }
    if (shopId) {
      await admin.from("shops").delete().eq("id", shopId);
    }
    for (const c of contexts) await c.close().catch(() => {});
    await deleteTestUser(owner.id);
  }
});
