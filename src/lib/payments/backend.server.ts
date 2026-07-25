// Server-only payment gateway integration (Phase F). SCAFFOLDED, NOT LIVE —
// there is no Razorpay account/keys yet (see plan/tasks/decisions.md). Every
// function here degrades safely when RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are
// unset: isConfigured() returns false, and the caller (orders/backend.server.ts's
// placeOrder) keeps using the pre-existing Phase C simplification — non-COD
// orders are instantly "paid" — instead of silently marking anything paid
// without a real gateway confirmation.
//
// Flow once real keys exist (no further code changes needed, just .env):
//   1. placeOrder() creates the order as 'created' (unpaid) + a Razorpay
//      order via createRazorpayOrder(), returns both to the client.
//   2. Client opens Razorpay's Checkout.js widget (src/lib/payments/checkout-widget.ts).
//   3. On success, the client calls verifyPayment() with the gateway's
//      response — this is the ONLY place that flips an order to 'paid', and
//      only after verifying the HMAC signature server-side. Never trust the
//      client's word that a payment succeeded.
//   4. src/routes/api.webhooks.razorpay.ts is the source-of-truth backstop:
//      Razorpay retries webhooks even if the client never calls back (closed
//      tab, dropped connection right after a successful payment).
//
// UNVERIFIED: none of the Razorpay REST API calls below have been exercised
// against a real account — there are no test keys to test against yet. The
// HMAC verification logic (verifySignature) IS independently verified — see
// decisions.md — since it only depends on Node's crypto module, not the live
// gateway, and Razorpay's signature scheme (HMAC-SHA256 of "order_id|payment_id"
// for the client callback, HMAC-SHA256 of the raw webhook body for webhooks)
// is documented and hasn't changed in years.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { insertNotification } from "@/lib/notifications/backend.server";

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Payments backend not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.");
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

const RAZORPAY_API = "https://api.razorpay.com/v1";

function credentials(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function isConfigured(): boolean {
  return credentials() !== null;
}

export type RazorpayOrder = { razorpayOrderId: string; amount: number; currency: string; keyId: string };

/** Creates a Razorpay order for an existing NearCart order and records a `payments` row (status 'created'). */
export async function createRazorpayOrder(
  orderId: string,
  method: "upi" | "card" | "netbanking",
): Promise<RazorpayOrder> {
  const creds = credentials();
  if (!creds) throw new Error("Payment gateway not configured (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET missing).");

  const { data: order, error } = await admin().from("orders").select("id, total_amount").eq("id", orderId).single();
  if (error || !order) throw new Error(`createRazorpayOrder: order not found (${orderId})`);

  const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
  const res = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount: order.total_amount, currency: "INR", receipt: orderId }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay order creation failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const rzp = (await res.json()) as { id: string; amount: number; currency: string };

  const { error: payErr } = await admin()
    .from("payments")
    .insert({ order_id: orderId, method, amount: order.total_amount, status: "created", gateway_ref: rzp.id });
  if (payErr) throw new Error(`createRazorpayOrder: payments insert failed: ${payErr.message}`);

  return { razorpayOrderId: rzp.id, amount: rzp.amount, currency: rzp.currency, keyId: creds.keyId };
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * The write-through `payment_failed` never had (see plan/tasks/decisions.md
 * 2026-07-22): `toUiStatus`/`toSellerStatus` (orders/backend.server.ts,
 * seller-data/backend.server.ts) and admin's revenue filters already treat
 * `payment_failed` as a real, reachable order status, but nothing ever wrote
 * it — a failed payment left the order stuck at `created` forever, invisible
 * to customer/seller/admin as "failed" rather than just "not yet paid."
 *
 * Conditioned on the order still being `created` — the only status an order
 * sits in while awaiting payment verification (orders/backend.server.ts's
 * placeOrder). This is what stops a late/out-of-order webhook (Razorpay
 * explicitly does not guarantee delivery order) from clobbering an order
 * that a different, successful verification already flipped to `paid` in
 * the meantime — if the row's no longer `created`, this is a no-op.
 */
async function markOrderPaymentFailed(
  orderId: string,
  customerId: string | null | undefined,
  note: string,
): Promise<void> {
  const { data: updated, error } = await admin()
    .from("orders")
    .update({ status: "payment_failed" })
    .eq("id", orderId)
    .eq("status", "created")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`markOrderPaymentFailed: order update failed: ${error.message}`);
  if (!updated) return; // already resolved (paid, or already marked failed) since we last checked

  await admin()
    .from("order_events")
    .insert({ order_id: orderId, to_status: "payment_failed", note });

  if (customerId) {
    await insertNotification(
      customerId,
      "order_status",
      "Payment failed",
      "We couldn't confirm your payment. No amount was charged — please try placing the order again.",
      { orderId, status: "payment_failed" },
    );
  }
}

export type VerifyPaymentInput = {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  /** Must be the session-derived `context.uid`, never a client-supplied value. */
  callerId: string;
};

/**
 * Verifies the Checkout.js success callback and flips the order to 'paid'.
 * The Razorpay HMAC signature (below) is the real fraud boundary — it can't
 * be forged without the gateway's own key secret — but the ownership check
 * is still worth having as defense in depth (see plan/tasks/decisions.md,
 * Phase 3 of the authorization-hardening plan).
 */
export async function verifyPayment(input: VerifyPaymentInput): Promise<void> {
  const creds = credentials();
  if (!creds) throw new Error("Payment gateway not configured.");

  const { data: order, error: ownerErr } = await admin()
    .from("orders")
    .select("customer_id")
    .eq("id", input.orderId)
    .maybeSingle();
  if (ownerErr) throw new Error(`verifyPayment: order lookup failed: ${ownerErr.message}`);
  if (!order || order.customer_id !== input.callerId) throw new Error("Order not found.");

  const ok = verifySignature(
    `${input.razorpayOrderId}|${input.razorpayPaymentId}`,
    input.razorpaySignature,
    creds.keySecret,
  );

  const { error: payErr } = await admin()
    .from("payments")
    .update({ status: ok ? "captured" : "failed", gateway_signature: input.razorpaySignature })
    .eq("order_id", input.orderId)
    .eq("gateway_ref", input.razorpayOrderId);
  if (payErr) throw new Error(`verifyPayment: payments update failed: ${payErr.message}`);

  if (!ok) {
    await markOrderPaymentFailed(
      input.orderId,
      order.customer_id,
      "Payment signature verification failed",
    );
    throw new Error("Payment signature verification failed.");
  }

  const { error: orderErr } = await admin().from("orders").update({ status: "paid" }).eq("id", input.orderId);
  if (orderErr) throw new Error(`verifyPayment: order update failed: ${orderErr.message}`);
  await admin()
    .from("order_events")
    .insert({ order_id: input.orderId, to_status: "paid", note: "Payment verified (Razorpay)" });
}

/** Verifies an inbound Razorpay webhook's signature (source-of-truth backstop — see src/routes/api.webhooks.razorpay.ts). */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  return verifySignature(rawBody, signature, secret);
}

type RazorpayWebhookPayload = {
  event: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
};

/**
 * Idempotent — Razorpay retries webhooks on any non-2xx response, and this
 * short-circuits if the payment row is already in the target status.
 */
export async function handleWebhookEvent(payload: RazorpayWebhookPayload): Promise<void> {
  const payment = payload.payload?.payment?.entity;
  if (!payment?.order_id || !payment.id) return;

  const { data: row } = await admin()
    .from("payments")
    .select("order_id, status, orders(customer_id)")
    .eq("gateway_ref", payment.order_id)
    .maybeSingle();
  if (!row) return; // unknown gateway order — ignore rather than throw (webhook must still 200)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerId = (row.orders as any)?.customer_id as string | undefined;

  if (payload.event === "payment.captured") {
    if (row.status === "captured") return;
    await admin()
      .from("payments")
      .update({ status: "captured", idempotency_key: payment.id })
      .eq("gateway_ref", payment.order_id);
    await admin().from("orders").update({ status: "paid" }).eq("id", row.order_id);
    await admin()
      .from("order_events")
      .insert({ order_id: row.order_id, to_status: "paid", note: "Payment captured (Razorpay webhook)" });
  } else if (payload.event === "payment.failed") {
    if (row.status === "failed") return;
    await admin().from("payments").update({ status: "failed" }).eq("gateway_ref", payment.order_id);
    await markOrderPaymentFailed(row.order_id, customerId, "Payment failed (Razorpay webhook)");
  }
}
