// Server-only order logic (Phase C of the backend build-out). Replaces
// src/lib/orders.ts's localStorage store with real orders/order_items rows.
// Mirrors the two-file split already proven by catalog/ and verification/.
//
// Payment gateway integration is Phase F, not built yet — "upi"/"card"/
// "netbanking" are treated as immediately successful (matching how the old
// localStorage flow had no real payment step either; this doesn't newly fake
// anything, it's the same simplification carried forward honestly).
//
// No address-book UI exists yet either — placeOrder creates a fresh address
// row per order from the checkout form's free-text address + the user's
// current location, rather than requiring a full address CRUD UI upfront.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { insertNotification } from "@/lib/notifications/backend.server";

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Orders backend not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

// ─── Shapes the client already renders (matches the old src/lib/orders.ts `Order`) ─

export type OrderLine = {
  productId: string;
  name: string;
  emoji: string;
  price: number;
  unit: string;
  quantity: number;
};

export type UiOrderStatus =
  "placed" | "accepted" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

export type CustomerOrder = {
  id: string;
  shopId: string;
  shopName: string;
  shopEmoji: string;
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  handling: number;
  total: number;
  paymentMethod: string;
  address: string;
  etaMinutes: number;
  placedAt: number;
  status: UiOrderStatus;
  /**
   * Present only when placeOrder() started a real Razorpay payment (Phase F —
   * only happens when RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are configured;
   * absent today). The client must open the Checkout widget and call
   * verifyPayment() — the order is NOT paid yet when this is set.
   */
  payment?: {
    required: true;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId: string;
  };
  fulfillmentType: "delivery" | "pickup";
  /** Shop→customer handoff code — only set for `fulfillmentType: "pickup"`. */
  pickupCode?: string;
};

const HANDLING_AMOUNT = 900; // paise — matches the flat ₹9 handling charge already shown in checkout.tsx

export function toUiStatus(dbStatus: string): UiOrderStatus {
  switch (dbStatus) {
    case "shop_accepted":
      return "accepted";
    case "preparing":
    case "ready_for_pickup":
    case "partner_assigned":
      return "preparing";
    case "picked_up":
    case "out_for_delivery":
      return "out_for_delivery";
    case "delivered":
    case "closed":
      return "delivered";
    case "cancelled":
    case "refunded":
    case "shop_rejected":
    case "payment_failed":
      return "cancelled";
    default:
      return "placed";
  }
}

export type OrderItemInput = { productId: string; quantity: number };

type PricedLine = {
  productId: string;
  name: string;
  emoji: string;
  unit: string;
  priceAmount: number;
  quantity: number;
};

type ShopRow = {
  id: string;
  name: string;
  emoji: string | null;
  city: string;
  pincode: string;
  delivery_fee_amount: number;
  free_delivery_above_amount: number;
  eta_minutes: number;
  owner_id: string;
  claimed: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shop_verifications: any;
};

async function getShopRow(shopId: string): Promise<ShopRow> {
  const { data, error } = await admin()
    .from("shops")
    .select(
      "id, name, emoji, city, pincode, delivery_fee_amount, free_delivery_above_amount, eta_minutes, owner_id, claimed, shop_verifications(overall_status)",
    )
    .eq("id", shopId)
    .single();
  if (error || !data) throw new Error(`Shop not found: ${shopId}`);
  return data;
}

/**
 * Real gate alongside the browse-listing one in catalog/backend.server.ts —
 * without this, a customer with a direct link to a claimed-but-unverified
 * shop that already has products could still place a real order, making
 * the browse filter purely cosmetic. See plan/tasks/decisions.md.
 */
function isShopAcceptingOrders(shop: ShopRow): boolean {
  const verification = Array.isArray(shop.shop_verifications)
    ? shop.shop_verifications[0]
    : shop.shop_verifications;
  return shop.claimed && verification?.overall_status === "approved";
}

async function priceItems(
  shopId: string,
  items: OrderItemInput[],
): Promise<{ lines: PricedLine[]; itemsAmount: number }> {
  if (items.length === 0) throw new Error("Cannot price an empty order");
  const { data: products, error } = await admin()
    .from("products")
    .select("id, name, emoji, unit, price_amount, shop_id, in_stock, stock_qty")
    .in(
      "id",
      items.map((i) => i.productId),
    );
  if (error) throw new Error(`priceItems failed: ${error.message}`);

  const lines: PricedLine[] = items.map((item) => {
    const p = (products ?? []).find((row) => row.id === item.productId);
    if (!p || p.shop_id !== shopId) {
      throw new Error(`Product ${item.productId} does not belong to shop ${shopId}`);
    }
    if (item.quantity < 1) throw new Error(`Invalid quantity for product ${item.productId}`);
    // A friendly, specific pre-check — not the authoritative one. It can be
    // stale by the time placeOrder's atomic RPC (decrement_stock_for_sale,
    // migration 0018) actually runs a moment later; that's what genuinely
    // enforces this under concurrency. This just turns "some item is out of
    // stock" into "Amul Milk 500ml is out of stock" instead of a generic
    // failure, at both quote time and final placement.
    if (!p.in_stock) {
      throw new Error(`${p.name} is out of stock.`);
    }
    if (p.stock_qty != null && p.stock_qty < item.quantity) {
      throw new Error(`${p.name} only has ${p.stock_qty} left in stock.`);
    }
    return {
      productId: p.id,
      name: p.name,
      emoji: p.emoji ?? "📦",
      unit: p.unit ?? "",
      priceAmount: p.price_amount,
      quantity: item.quantity,
    };
  });

  const itemsAmount = lines.reduce((sum, l) => sum + l.priceAmount * l.quantity, 0);
  return { lines, itemsAmount };
}

// ─── Coupons (2026-07-19) — real server-side validation, never trust a
// client-supplied discount amount. `coupons` (0008_coupons.sql) is public
// read-only data (grants select to anon/authenticated, no owner to scope
// by), so this mirrors offers/backend.server.ts's service-role convention
// rather than needing an ownership check. See plan/tasks/decisions.md.
//
// Unlike every other `_amount` column in this schema (items_amount,
// delivery_amount, price_amount, total_amount — all paise), `coupons`.
// `min_order_amount`/`discount_value` are stored in whole RUPEES — confirmed
// via offers.tsx's `formatINR(c.discountValue)` with no /100, established
// when 0008_coupons.sql/seed-coupons.mjs were built 2026-07-18. `itemsAmount`
// here is paise (from priceItems), so it must be converted before comparing
// against or computing from the coupon's rupee-denominated fields.

export type CouponResult = { discountAmount: number; couponError?: string };

async function applyCoupon(code: string | undefined, itemsAmount: number): Promise<CouponResult> {
  if (!code) return { discountAmount: 0 };
  const { data: coupon, error } = await admin()
    .from("coupons")
    .select("discount_type, discount_value, min_order_amount, active, expires_at")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(`applyCoupon failed: ${error.message}`);
  if (!coupon || !coupon.active) return { discountAmount: 0, couponError: "Invalid coupon code." };
  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
    return { discountAmount: 0, couponError: "This coupon has expired." };
  }
  const itemsAmountRupees = itemsAmount / 100;
  if (itemsAmountRupees < coupon.min_order_amount) {
    return {
      discountAmount: 0,
      couponError: `Add ₹${coupon.min_order_amount} more to use this coupon.`,
    };
  }
  const discountRupees =
    coupon.discount_type === "percent"
      ? (itemsAmountRupees * coupon.discount_value) / 100
      : coupon.discount_value;
  const discountAmount = Math.round(Math.min(discountRupees, itemsAmountRupees) * 100);
  return { discountAmount };
}

export type OrderQuote = {
  itemsAmount: number;
  deliveryAmount: number;
  handlingAmount: number;
  discountAmount: number;
  couponError?: string;
  totalAmount: number;
  etaMinutes: number;
};

export async function quoteOrder(input: {
  shopId: string;
  items: OrderItemInput[];
  couponCode?: string;
  fulfillmentType?: "delivery" | "pickup";
}): Promise<OrderQuote> {
  const shop = await getShopRow(input.shopId);
  const { itemsAmount } = await priceItems(input.shopId, input.items);
  const deliveryAmount =
    input.fulfillmentType === "pickup"
      ? 0
      : itemsAmount >= shop.free_delivery_above_amount
        ? 0
        : shop.delivery_fee_amount;
  const { discountAmount, couponError } = await applyCoupon(input.couponCode, itemsAmount);
  return {
    itemsAmount,
    deliveryAmount,
    handlingAmount: HANDLING_AMOUNT,
    discountAmount,
    couponError,
    totalAmount: Math.max(0, itemsAmount + deliveryAmount + HANDLING_AMOUNT - discountAmount),
    etaMinutes: shop.eta_minutes,
  };
}

export type PlaceOrderInput = {
  /** Must be the session-derived `context.uid`, never a client-supplied value. */
  customerId: string;
  shopId: string;
  items: OrderItemInput[];
  paymentMethod: "upi" | "card" | "netbanking" | "cod";
  fulfillmentType: "delivery" | "pickup";
  /** Required when `fulfillmentType` is `"delivery"` — validated below, not just by the caller's form. */
  addressText?: string;
  lat?: number;
  lng?: number;
  /** Only a code is accepted — the discount amount is always recomputed here, never trusted from the client. */
  couponCode?: string;
  /**
   * Client-generated once per checkout attempt (checkout.tsx persists it in
   * sessionStorage and reuses it across retries of the SAME attempt) — never
   * a fresh value per retry. See the idempotency check below.
   */
  idempotencyKey: string;
};

/**
 * `orders.idempotency_key` is a real unique column that existed since Phase C
 * but nothing ever populated it — the only defense against a duplicate
 * "Place Order" was the client's `disabled={placing}` button state, so a
 * page refresh mid-request or a second tab created two full real orders (see
 * plan/tasks/decisions.md 2026-07-22).
 *
 * If an order already exists under this exact key, this call is a retry of
 * an attempt that already succeeded (or is concurrently succeeding) —
 * returns that order instead of creating a second one. The `.eq("customer_id", ...)`
 * scoping isn't just belt-and-suspenders: it stops a caller from fetching
 * someone else's order by guessing/reusing their idempotency key.
 */
async function findOrderByIdempotencyKey(
  customerId: string,
  idempotencyKey: string,
): Promise<CustomerOrder | null> {
  const { data, error } = await admin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("customer_id", customerId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw new Error(`placeOrder idempotency check failed: ${error.message}`);
  return data ? mapOrderRow(data) : null;
}

export async function placeOrder(input: PlaceOrderInput): Promise<CustomerOrder> {
  const existing = await findOrderByIdempotencyKey(input.customerId, input.idempotencyKey);
  if (existing) return existing;

  const shop = await getShopRow(input.shopId);
  // A single Supabase Auth user can hold both a `shops` row (as owner) and
  // place orders as a `customer_id` — nothing else in this app separates a
  // "seller account" from a "customer account." Without this, a seller can
  // self-order, walk it through to "Delivered" via their own seller/partner
  // actions, and leave themselves a real review that recomputes the shop's
  // rating_avg — the exact trust signal real customers use to pick a shop.
  // See plan/tasks/decisions.md 2026-07-22.
  if (shop.owner_id === input.customerId) {
    throw new Error("You can't place an order at your own shop.");
  }
  if (!isShopAcceptingOrders(shop)) {
    throw new Error("This shop isn't accepting orders yet.");
  }
  if (input.fulfillmentType === "delivery" && !input.addressText?.trim()) {
    // The server function is the real trust boundary, not the checkout
    // form — even though today's only caller always sends this for
    // delivery orders, that shouldn't be assumed unenforced here.
    throw new Error("A delivery address is required.");
  }
  const { lines, itemsAmount } = await priceItems(input.shopId, input.items);
  const deliveryAmount =
    input.fulfillmentType === "pickup"
      ? 0
      : itemsAmount >= shop.free_delivery_above_amount
        ? 0
        : shop.delivery_fee_amount;
  const { discountAmount, couponError } = await applyCoupon(input.couponCode, itemsAmount);
  if (input.couponCode && couponError) throw new Error(couponError);
  const totalAmount = Math.max(0, itemsAmount + deliveryAmount + HANDLING_AMOUNT - discountAmount);

  let addressId: string | null = null;
  if (input.fulfillmentType === "delivery") {
    const { data: address, error: addrErr } = await admin()
      .from("addresses")
      .insert({
        user_id: input.customerId,
        label: "Delivery",
        line1: input.addressText,
        city: shop.city,
        pincode: shop.pincode,
        lat: input.lat,
        lng: input.lng,
      })
      .select("id")
      .single();
    if (addrErr) throw new Error(`placeOrder address failed: ${addrErr.message}`);
    addressId = address.id;
  }

  // Phase F: COD is always confirmed on the spot. For everything else, use
  // a real Razorpay payment if one is configured (RAZORPAY_KEY_ID/
  // RAZORPAY_KEY_SECRET) — the order starts unpaid ('created') and only
  // becomes 'paid' once verifyPayment() (or the webhook) confirms the
  // gateway signature. If no gateway is configured yet (true today), fall
  // back to the original Phase C simplification: treat it as immediately
  // paid, so the existing demo flow keeps working with zero regression.
  const paymentsBe = await import("@/lib/payments/backend.server");
  const gatewayConfigured = input.paymentMethod !== "cod" && paymentsBe.isConfigured();
  const status =
    input.paymentMethod === "cod" ? "cod_confirmed" : gatewayConfigured ? "created" : "paid";

  // Real, race-safe stock check + decrement (decrement_stock_for_sale,
  // migration 0018) — the one real enforcement point closing the
  // "in_stock/stock_qty never checked" gap (priceItems's check above is
  // just a friendly pre-check, not authoritative). Must run before the
  // `orders` insert below: unlike place_order_mobile (a single plpgsql
  // function call, one implicit transaction), each of these `admin()`
  // calls is its own independent request — if the order were inserted
  // first and this failed after, there'd be a real order row to manually
  // clean up. order_id is null here for the same structural reason.
  const items = input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity }));
  const { error: stockErr } = await admin().rpc("decrement_stock_for_sale", {
    p_shop_id: input.shopId,
    p_items: items,
    p_reason: "online_order",
    p_order_id: null,
  });
  if (stockErr) throw new Error(stockErr.message);

  // 4-digit handoff codes. For a delivery order: shop→partner at pickup,
  // partner→customer at delivery (Phase E) — generated up front so they
  // exist regardless of when a partner ends up assigned. For a pickup order,
  // `pickup_otp` is dual-purposed as the shop→customer handoff code instead
  // (no partner is ever involved, so `delivery_otp` just goes unused) — see
  // migration 0017_pickup_orders.sql.
  const pickupOtp = String(Math.floor(1000 + Math.random() * 9000));
  const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));

  const { data: order, error: orderErr } = await admin()
    .from("orders")
    .insert({
      customer_id: input.customerId,
      shop_id: input.shopId,
      address_id: addressId,
      status,
      payment_method: input.paymentMethod,
      fulfillment_type: input.fulfillmentType,
      items_amount: itemsAmount,
      delivery_amount: deliveryAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      promo_code: discountAmount > 0 ? input.couponCode?.trim().toUpperCase() : null,
      pickup_otp: pickupOtp,
      delivery_otp: deliveryOtp,
      idempotency_key: input.idempotencyKey,
    })
    .select("*")
    .single();
  if (orderErr) {
    // A genuine concurrent retry of the SAME key (e.g. a double-click that
    // both fired, or a refresh that raced the original request) can lose
    // this exact insert to the other request — Postgres rejects it as a
    // real unique-constraint violation rather than silently duplicating.
    // Treat that specific case as a successful retry, not a failure.
    if (orderErr.code === "23505") {
      const winner = await findOrderByIdempotencyKey(input.customerId, input.idempotencyKey);
      if (winner) return winner;
    }
    throw new Error(`placeOrder failed: ${orderErr.message}`);
  }

  const { error: itemsErr } = await admin()
    .from("order_items")
    .insert(
      lines.map((l) => ({
        order_id: order.id,
        product_id: l.productId,
        name_snapshot: l.name,
        price_amount: l.priceAmount,
        quantity: l.quantity,
      })),
    );
  if (itemsErr) throw new Error(`placeOrder items failed: ${itemsErr.message}`);

  await admin()
    .from("order_events")
    .insert({ order_id: order.id, to_status: status, note: "Order placed" });

  let payment: CustomerOrder["payment"];
  if (gatewayConfigured && input.paymentMethod !== "cod") {
    const rzp = await paymentsBe.createRazorpayOrder(order.id, input.paymentMethod);
    payment = { required: true, ...rzp };
  }

  return {
    id: order.id,
    shopId: shop.id,
    shopName: shop.name,
    shopEmoji: shop.emoji ?? "🏪",
    lines: lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      emoji: l.emoji,
      price: l.priceAmount / 100,
      unit: l.unit,
      quantity: l.quantity,
    })),
    subtotal: itemsAmount / 100,
    deliveryFee: deliveryAmount / 100,
    handling: HANDLING_AMOUNT / 100,
    total: totalAmount / 100,
    paymentMethod: input.paymentMethod,
    address: input.fulfillmentType === "pickup" ? "" : (input.addressText ?? ""),
    etaMinutes: shop.eta_minutes,
    placedAt: new Date(order.placed_at).getTime(),
    status: toUiStatus(order.status),
    payment,
    fulfillmentType: input.fulfillmentType,
    pickupCode: input.fulfillmentType === "pickup" ? pickupOtp : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrderRow(row: any): CustomerOrder {
  const shop = row.shops;
  const items = (row.order_items ?? []) as {
    product_id: string;
    name_snapshot: string;
    price_amount: number;
    quantity: number;
    products?: { emoji?: string; unit?: string };
  }[];
  return {
    id: row.id,
    shopId: row.shop_id,
    shopName: shop?.name ?? "Shop",
    shopEmoji: shop?.emoji ?? "🏪",
    lines: items.map((l) => ({
      productId: l.product_id,
      name: l.name_snapshot,
      emoji: l.products?.emoji ?? "📦",
      price: l.price_amount / 100,
      unit: l.products?.unit ?? "",
      quantity: l.quantity,
    })),
    subtotal: row.items_amount / 100,
    deliveryFee: row.delivery_amount / 100,
    handling: HANDLING_AMOUNT / 100,
    total: row.total_amount / 100,
    paymentMethod: row.payment_method,
    address: row.addresses?.line1 ?? "",
    etaMinutes: shop?.eta_minutes ?? 30,
    placedAt: new Date(row.placed_at).getTime(),
    status: toUiStatus(row.status),
    fulfillmentType: row.fulfillment_type === "pickup" ? "pickup" : "delivery",
    pickupCode: row.fulfillment_type === "pickup" ? (row.pickup_otp ?? undefined) : undefined,
  };
}

const ORDER_SELECT =
  "*, shops(name, emoji, eta_minutes), addresses(line1), order_items(product_id, name_snapshot, price_amount, quantity, products(emoji, unit))";

export async function listOrders(customerId: string): Promise<CustomerOrder[]> {
  const { data, error } = await admin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("customer_id", customerId)
    .order("placed_at", { ascending: false });
  if (error) throw new Error(`listOrders failed: ${error.message}`);
  return (data ?? []).map(mapOrderRow);
}

/**
 * `callerId` must be the session-derived `context.uid`, never a client-supplied
 * value — returns null (not an error) for an order that exists but belongs to
 * someone else, so a caller can't distinguish "not found" from "not yours"
 * (see plan/tasks/decisions.md, Phase 3 of the authorization-hardening plan).
 */
export async function getOrder(orderId: string, callerId: string): Promise<CustomerOrder | null> {
  const { data, error } = await admin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`getOrder failed: ${error.message}`);
  if (!data || data.customer_id !== callerId) return null;
  return mapOrderRow(data);
}

// Customer-initiated cancellation — distinct from admin-data's cancelOrder
// (which force-cancels anything up to partner_assigned). Deliberately
// stricter: once the shop has started actually preparing the order, letting
// the customer unilaterally cancel would waste real food/goods already being
// prepared, so it's cut off one stage earlier than admin's version.
const CUSTOMER_CANCELLABLE_STATUSES = new Set([
  "created",
  "paid",
  "cod_confirmed",
  "shop_accepted",
]);

export async function cancelOrder(orderId: string, callerId: string): Promise<void> {
  const { data: order, error } = await admin()
    .from("orders")
    .select("customer_id, status, shop_id, shops(owner_id, name)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`cancelOrder failed: ${error.message}`);
  if (!order || order.customer_id !== callerId) {
    throw new Error("This order isn't yours.");
  }
  if (!CUSTOMER_CANCELLABLE_STATUSES.has(order.status)) {
    throw new Error(
      "This order can no longer be cancelled — the shop has already started preparing it.",
    );
  }

  const { error: updErr } = await admin()
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId);
  if (updErr) throw new Error(`cancelOrder failed: ${updErr.message}`);
  await admin().from("order_events").insert({
    order_id: orderId,
    from_status: order.status,
    to_status: "cancelled",
    note: "Cancelled by customer",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shop = order.shops as any;
  if (shop?.owner_id) {
    await insertNotification(
      shop.owner_id,
      "order_status",
      "Order cancelled",
      `A customer cancelled their order at ${shop.name ?? "your shop"}.`,
      { orderId, status: "cancelled" },
    );
  }
}
