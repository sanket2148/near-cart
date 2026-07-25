import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, adminClient, type TestUser } from "./auth-helper";

// Guards a real state-machine gap found by reading
// src/lib/seller-data/backend.server.ts's advanceOrder(): it used to derive
// `next` from `flow.indexOf(currentStatus) + 1`, and `flow` doesn't contain
// "rejected" (shop_rejected/cancelled/refunded/payment_failed all map to
// it) — indexOf returned -1 for those, so `next` became `flow[0]` ==
// "accepted" instead of null. A seller whose order-detail view was stale
// (hadn't refetched since a customer cancellation) could click the
// already-rendered "Mark as Preparing" button and silently resurrect a
// cancelled order back to shop_accepted. This is a real multi-actor race
// (seller tab open + customer cancels concurrently), not a single-session UI
// bug — the client's own nextStatus() correctly hides the button on a fresh
// render, so this only bit a page that was already open before the
// cancellation. Fixed 2026-07-22 with an explicit terminal-state check plus
// a conditional (optimistic-concurrency) update in setOrderStatus.
test.setTimeout(60_000);
// Was a documented-bug test (test.fail()) until 2026-07-22's advanceOrder fix
// (see plan/tasks/decisions.md) — setOrderStatus's conditional update now
// rejects this resurrection attempt outright, so this is a real regression
// test again: it stays green as long as the guard holds.

test("a stale seller order view cannot resurrect a customer-cancelled order via advanceOrder", async ({
  browser,
  baseURL,
}) => {
  const base = baseURL!;
  const admin = adminClient();
  const customer = await createTestUser("test-e2e-race-customer");
  const sellerAuth = await admin.auth.admin.createUser({
    email: `test-e2e-race-seller-${Date.now()}@example.com`,
    password: "Test1234!",
    email_confirm: true,
  });
  const sellerUser: TestUser = { id: sellerAuth.data.user.id, email: sellerAuth.data.user.email! };
  await admin.from("users").upsert([{ id: sellerUser.id, email: sellerUser.email }]);

  let shopId: string | undefined;
  let orderId: string | undefined;
  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];

  try {
    const { data: cat } = await admin.from("categories").select("id").limit(1).maybeSingle();
    const { data: shop, error: shopErr } = await admin
      .from("shops")
      .insert({
        owner_id: sellerUser.id,
        name: "E2E Race Test Shop",
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

    const { data: address, error: addrErr } = await admin
      .from("addresses")
      .insert({
        user_id: customer.id,
        label: "Delivery",
        line1: "Test Address",
        city: "Bengaluru",
        pincode: "560001",
        lat: 12.9716,
        lng: 77.5946,
      })
      .select("id")
      .single();
    if (addrErr) throw new Error(addrErr.message);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        customer_id: customer.id,
        shop_id: shopId,
        address_id: address.id,
        status: "cod_confirmed",
        payment_method: "cod",
        items_amount: 10000,
        delivery_amount: 2000,
        discount_amount: 0,
        total_amount: 12900,
        pickup_otp: "1234",
        delivery_otp: "5678",
      })
      .select("id")
      .single();
    if (orderErr) throw new Error(orderErr.message);
    orderId = order.id;

    // ─── Seller: accept the order, get to the "Mark as Preparing" view ──────
    const sellerCtx = await browser.newContext();
    contexts.push(sellerCtx);
    await loginAs(sellerCtx, sellerUser, base);
    await sellerCtx.addInitScript((id) => {
      localStorage.setItem(
        `nearcart-verification-${id}`,
        JSON.stringify({ shopId: id, overallStatus: "approved" }),
      );
    }, shopId);
    const sellerPage = await sellerCtx.newPage();

    await sellerPage.goto("/seller/orders");
    await sellerPage
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});
    await expect(sellerPage.getByRole("button", { name: /^New/ })).toBeVisible();
    const newCard = sellerPage.locator("li").first();
    await expect(newCard).toBeVisible({ timeout: 10000 });
    await newCard.getByRole("button", { name: "Accept" }).click();

    await sellerPage.getByRole("button", { name: /^Active/ }).click();
    const activeCard = sellerPage.locator("li").first();
    await activeCard.locator("button").first().click(); // expand
    const advanceButton = activeCard.getByRole("button", { name: /Mark as Preparing/i });
    await expect(advanceButton).toBeVisible();

    // Freeze the seller's view from here on, simulating a tab that hasn't
    // refetched yet (this app polls shop-orders every 6s —
    // src/lib/seller.tsx's refetchInterval — so in practice this is a real,
    // if narrow, window: any click that lands between refetches races a
    // concurrent cancellation). Stalling the poll deterministically proves
    // the underlying advanceOrder gap instead of depending on wall-clock luck.
    await sellerPage.route("**/_serverFn/**", async (route) => {
      const url = route.request().url();
      try {
        const b64 = url.split("/_serverFn/")[1].split("?")[0];
        const decoded = JSON.parse(Buffer.from(decodeURIComponent(b64), "base64").toString());
        if (decoded.export === "getShopOrders_createServerFn_handler") return; // never resolves
      } catch {
        /* fall through to continue() below */
      }
      await route.continue();
    });

    // ─── Customer (separate real session): cancels the same order for real ──
    const customerCtx = await browser.newContext();
    contexts.push(customerCtx);
    await loginAs(customerCtx, customer, base);
    const customerPage = await customerCtx.newPage();
    await customerPage.goto(`/order/${orderId}`);
    await customerPage
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});
    await customerPage.getByRole("button", { name: "Cancel order" }).click();
    await expect(customerPage.getByText("Order cancelled.")).toBeVisible();
    await expect
      .poll(async () => {
        const { data } = await admin.from("orders").select("status").eq("id", orderId).single();
        return data?.status;
      })
      .toBe("cancelled");

    // ─── Seller's page never refetched — click the still-rendered button ────
    await advanceButton.click();
    await sellerPage.waitForTimeout(1000); // let the fire-and-forget mutation land

    // If the bug is present, the order is resurrected to shop_accepted. If
    // it's been fixed, this update should be rejected (order stays cancelled).
    const { data: finalOrder } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    const { data: events } = await admin
      .from("order_events")
      .select("to_status, note")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    console.log("FINAL ORDER STATUS:", finalOrder?.status);
    console.log("ORDER EVENTS:", JSON.stringify(events));

    expect(finalOrder?.status, "cancelled order should never be resurrected by advanceOrder").toBe(
      "cancelled",
    );
  } finally {
    if (orderId) {
      await admin.from("order_events").delete().eq("order_id", orderId);
      await admin.from("orders").delete().eq("id", orderId);
    }
    if (shopId) {
      await admin.from("shop_verifications").delete().eq("shop_id", shopId);
      await admin.from("shops").delete().eq("id", shopId);
    }
    for (const ctx of contexts) await ctx.close().catch(() => {});
    await admin.auth.admin.deleteUser(sellerUser.id).catch(() => {});
    await deleteTestUser(customer.id);
  }
});
