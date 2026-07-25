import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import { createTestUser, deleteTestUser, adminClient, type TestUser } from "./auth-helper";

// Guards the 2026-07-22 payment_failed write-through fix (see
// plan/tasks/decisions.md): payments/backend.server.ts's handleWebhookEvent
// now actually writes orders.status = 'payment_failed' (plus an order_event
// and a customer notification) on a failed-payment webhook, instead of only
// touching the `payments` table and leaving the order stuck at `created`
// forever. The write is conditioned on the order still being `created`, so a
// late/out-of-order webhook (Razorpay does not guarantee delivery order)
// can't clobber an order a different, successful path already marked `paid`.
//
// This app has no real Razorpay account yet (see payments/backend.server.ts's
// header) — `RAZORPAY_WEBHOOK_SECRET` isn't part of the normal dev setup, so
// both tests below skip themselves when it's unset rather than failing the
// baseline `npm run e2e` run. To actually exercise them: start the dev server
// with the var set (`RAZORPAY_WEBHOOK_SECRET=x npm run dev`) then run
// `RAZORPAY_WEBHOOK_SECRET=x npx playwright test payment-failed-webhook`.
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const SKIP_REASON = "RAZORPAY_WEBHOOK_SECRET not set on the dev server — see file header.";

function sign(body: string): string {
  return createHmac("sha256", WEBHOOK_SECRET ?? "").update(body).digest("hex");
}

async function seedShop(admin: ReturnType<typeof adminClient>, ownerId: string, name: string) {
  const { data: cat } = await admin.from("categories").select("id").limit(1).maybeSingle();
  const { data: shop, error } = await admin
    .from("shops")
    .insert({
      owner_id: ownerId,
      name,
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
  if (error) throw new Error(error.message);
  return shop.id as string;
}

async function seedOrder(
  admin: ReturnType<typeof adminClient>,
  customerId: string,
  shopId: string,
  status: string,
): Promise<string> {
  const { data: address, error: addrErr } = await admin
    .from("addresses")
    .insert({
      user_id: customerId,
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

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      customer_id: customerId,
      shop_id: shopId,
      address_id: address.id,
      status,
      payment_method: "upi",
      items_amount: 10000,
      delivery_amount: 2000,
      discount_amount: 0,
      total_amount: 12900,
      pickup_otp: "1234",
      delivery_otp: "5678",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return order.id as string;
}

test("a failed-payment webhook marks the order payment_failed and notifies the customer", async ({
  request,
  baseURL,
}) => {
  test.skip(!WEBHOOK_SECRET, SKIP_REASON);
  const admin = adminClient();
  const customer = await createTestUser("test-e2e-payfail-customer");
  const sellerAuth = await admin.auth.admin.createUser({
    email: `test-e2e-payfail-seller-${Date.now()}@example.com`,
    password: "Test1234!",
    email_confirm: true,
  });
  const sellerUser: TestUser = { id: sellerAuth.data.user!.id, email: sellerAuth.data.user!.email! };
  const shopId = await seedShop(admin, sellerUser.id, "E2E Payfail Test Shop");
  const gatewayOrderId = `order_test_${Date.now()}`;
  let orderId: string | undefined;

  try {
    orderId = await seedOrder(admin, customer.id, shopId, "created");
    await admin
      .from("payments")
      .insert({ order_id: orderId, method: "upi", amount: 12900, status: "created", gateway_ref: gatewayOrderId });

    const body = JSON.stringify({
      event: "payment.failed",
      payload: { payment: { entity: { id: `pay_test_${Date.now()}`, order_id: gatewayOrderId } } },
    });
    const res = await request.post(`${baseURL}/api/webhooks/razorpay`, {
      headers: { "content-type": "application/json", "x-razorpay-signature": sign(body) },
      data: body,
    });
    expect(res.status()).toBe(200);

    const { data: order } = await admin.from("orders").select("status").eq("id", orderId).single();
    expect(order?.status).toBe("payment_failed");

    const { data: events } = await admin
      .from("order_events")
      .select("to_status")
      .eq("order_id", orderId);
    expect(events?.some((e) => e.to_status === "payment_failed")).toBe(true);

    const { data: notifs } = await admin
      .from("notifications")
      .select("title")
      .eq("user_id", customer.id)
      .eq("type", "order_status");
    expect(notifs?.some((n) => n.title === "Payment failed")).toBe(true);
  } finally {
    if (orderId) {
      await admin.from("notifications").delete().eq("user_id", customer.id);
      await admin.from("payments").delete().eq("order_id", orderId);
      await admin.from("order_events").delete().eq("order_id", orderId);
      await admin.from("orders").delete().eq("id", orderId);
    }
    await admin.from("shops").delete().eq("id", shopId);
    await admin.auth.admin.deleteUser(sellerUser.id).catch(() => {});
    await deleteTestUser(customer.id);
  }
});

test("a failed-payment webhook does not clobber an order a different path already marked paid", async ({
  request,
  baseURL,
}) => {
  test.skip(!WEBHOOK_SECRET, SKIP_REASON);
  const admin = adminClient();
  const customer = await createTestUser("test-e2e-payfail-noop-customer");
  const sellerAuth = await admin.auth.admin.createUser({
    email: `test-e2e-payfail-noop-seller-${Date.now()}@example.com`,
    password: "Test1234!",
    email_confirm: true,
  });
  const sellerUser: TestUser = { id: sellerAuth.data.user!.id, email: sellerAuth.data.user!.email! };
  const shopId = await seedShop(admin, sellerUser.id, "E2E Payfail Noop Test Shop");
  const gatewayOrderId = `order_test_${Date.now()}`;
  let orderId: string | undefined;

  try {
    // Already paid via a different path (e.g. verifyPayment's client
    // callback beat this out-of-order webhook to it) — a late
    // payment.failed must not regress this back to failed.
    orderId = await seedOrder(admin, customer.id, shopId, "paid");
    await admin
      .from("payments")
      .insert({ order_id: orderId, method: "upi", amount: 12900, status: "captured", gateway_ref: gatewayOrderId });

    const body = JSON.stringify({
      event: "payment.failed",
      payload: { payment: { entity: { id: `pay_test_${Date.now()}`, order_id: gatewayOrderId } } },
    });
    const res = await request.post(`${baseURL}/api/webhooks/razorpay`, {
      headers: { "content-type": "application/json", "x-razorpay-signature": sign(body) },
      data: body,
    });
    expect(res.status()).toBe(200);

    const { data: order } = await admin.from("orders").select("status").eq("id", orderId).single();
    expect(order?.status, "a late/out-of-order failure webhook must not regress a paid order").toBe(
      "paid",
    );
  } finally {
    if (orderId) {
      await admin.from("payments").delete().eq("order_id", orderId);
      await admin.from("order_events").delete().eq("order_id", orderId);
      await admin.from("orders").delete().eq("id", orderId);
    }
    await admin.from("shops").delete().eq("id", shopId);
    await admin.auth.admin.deleteUser(sellerUser.id).catch(() => {});
    await deleteTestUser(customer.id);
  }
});
