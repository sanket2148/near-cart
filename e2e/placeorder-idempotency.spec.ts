import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, adminClient, type TestUser } from "./auth-helper";

// Guards the 2026-07-22 idempotency_key fix (see plan/tasks/decisions.md):
// orders.idempotency_key existed since Phase C but nothing populated it —
// only the client's disabled={placing} button state stopped a duplicate
// "Place Order," so a page refresh mid-request or a second tab created two
// full real orders. placeOrder now short-circuits (returns the existing
// order) when called twice with the same client-generated key, and the
// insert itself is guarded by the column's real unique constraint for a
// genuine concurrent race.
//
// Reproduces the exact real-world scenario through real button clicks only
// (no hand-crafted RPC replay — TanStack Start's internal `_serverFn` wire
// format needs framework-internal signals a manually built fetch() can't
// reproduce, confirmed by trying that first and getting a 500). Instead: let
// the first "Place Order" click's real request actually reach and succeed
// on the server, but abort it on the way back so the browser never sees the
// response — exactly what a dropped connection or a closed tab right after
// success looks like from the client's side. The cart and the sessionStorage
// idempotency key are only cleared in the success handler, so both are
// still there for a real second click, which is what actually proves the fix.
test.setTimeout(60_000);

function decodeServerFnExport(url: string): string | null {
  try {
    const b64 = url.split("/_serverFn/")[1]?.split("?")[0];
    if (!b64) return null;
    const decoded = JSON.parse(Buffer.from(decodeURIComponent(b64), "base64").toString());
    return decoded.export ?? null;
  } catch {
    return null;
  }
}

test("placing the same order twice (replayed real request) creates only one order", async ({
  browser,
  baseURL,
}) => {
  const base = baseURL!;
  const admin = adminClient();
  const customer = await createTestUser("test-e2e-idempotency-customer");
  const sellerAuth = await admin.auth.admin.createUser({
    email: `test-e2e-idempotency-seller-${Date.now()}@example.com`,
    password: "Test1234!",
    email_confirm: true,
  });
  const sellerUser: TestUser = { id: sellerAuth.data.user!.id, email: sellerAuth.data.user!.email! };
  let shopId: string | undefined;
  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];

  try {
    const { data: cat } = await admin.from("categories").select("id").limit(1).maybeSingle();
    const { data: shop, error: shopErr } = await admin
      .from("shops")
      .insert({
        owner_id: sellerUser.id,
        name: "E2E Idempotency Test Shop",
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

    // placeOrder now requires claimed + a real approved verification (see
    // plan/tasks/decisions.md) — without this row, the real "Place Order"
    // click below would be rejected with "This shop isn't accepting
    // orders yet." instead of exercising the idempotency guard.
    const { error: verificationErr } = await admin
      .from("shop_verifications")
      .insert({ shop_id: shopId, business_type: "grocery", overall_status: "approved" });
    if (verificationErr) throw new Error(verificationErr.message);

    const { error: productErr } = await admin.from("products").insert({
      shop_id: shopId,
      name: "E2E Idempotency Test Product",
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
    await loginAs(ctx, customer, base);
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

    // Let the FIRST "Place Order" click's real request actually reach and
    // succeed on the server (a real order gets created for real) — but
    // abort it on the way back so the browser never sees the response. This
    // is exactly what "the connection dropped right after success" or "the
    // tab was closed before the redirect" looks like from the client's
    // side: same sessionStorage idempotency key, same still-populated cart
    // (clear() never runs, since that's in the success path), button
    // re-enabled after the resulting error toast.
    let interceptedOnce = false;
    await page.route("**/_serverFn/**", async (route) => {
      if (interceptedOnce || decodeServerFnExport(route.request().url()) !== "placeOrder_createServerFn_handler") {
        await route.continue();
        return;
      }
      interceptedOnce = true;
      await route.fetch(); // really sends it — the order gets created for real
      await route.abort("failed"); // ...but the browser never finds out
    });

    await page.getByRole("button", { name: "Place Order" }).click();
    // The aborted fetch rejects with a real network Error (e.g. "Failed to
    // fetch"), not a predictable app-level message, so assert on the
    // observable client-side outcome instead of exact toast text: still on
    // /checkout (never redirected) and the button re-enabled, not stuck
    // "Placing…".
    await expect(page.getByRole("button", { name: "Place Order" })).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain("/checkout");

    const { data: afterFirstAttempt } = await admin
      .from("orders")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("shop_id", shopId);
    expect(
      afterFirstAttempt ?? [],
      "the intercepted request should still have created a real order server-side",
    ).toHaveLength(1);
    const firstOrderId = afterFirstAttempt![0].id as string;

    // Second click — same page, same session, same persisted idempotency
    // key (never cleared, since the first attempt's client-side success
    // handler never ran) — goes through unintercepted this time.
    await page.getByRole("button", { name: "Place Order" }).click();
    await page.waitForURL(/\/order\//, { timeout: 15000 });
    const secondOrderId = page.url().split("/order/")[1];
    expect(secondOrderId, "the retry should return the SAME order, not create a new one").toBe(
      firstOrderId,
    );

    const { data: finalOrders } = await admin
      .from("orders")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("shop_id", shopId);
    expect(finalOrders ?? [], "exactly one order should exist, not two").toHaveLength(1);
  } finally {
    if (shopId) {
      await admin.from("shop_verifications").delete().eq("shop_id", shopId);
      const { data: orders } = await admin
        .from("orders")
        .select("id, address_id")
        .eq("shop_id", shopId);
      for (const o of orders ?? []) {
        await admin.from("order_items").delete().eq("order_id", o.id);
        await admin.from("order_events").delete().eq("order_id", o.id);
      }
      await admin.from("orders").delete().eq("shop_id", shopId);
      for (const o of orders ?? []) {
        if (o.address_id) await admin.from("addresses").delete().eq("id", o.address_id);
      }
      await admin.from("products").delete().eq("shop_id", shopId);
      await admin.from("shops").delete().eq("id", shopId);
    }
    for (const c of contexts) await c.close().catch(() => {});
    await admin.auth.admin.deleteUser(sellerUser.id).catch(() => {});
    await deleteTestUser(customer.id);
  }
});
