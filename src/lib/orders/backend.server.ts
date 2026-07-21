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
};

async function getShopRow(shopId: string): Promise<ShopRow> {
  const { data, error } = await admin()
    .from("shops")
    .select(
      "id, name, emoji, city, pincode, delivery_fee_amount, free_delivery_above_amount, eta_minutes",
    )
    .eq("id", shopId)
    .single();
  if (error || !data) throw new Error(`Shop not found: ${shopId}`);
  return data;
}

async function priceItems(
  shopId: string,
  items: OrderItemInput[],
): Promise<{ lines: PricedLine[]; itemsAmount: number }> {
  if (items.length === 0) throw new Error("Cannot price an empty order");
  const { data: products, error } = await admin()
    .from("products")
    .select("id, name, emoji, unit, price_amount, shop_id")
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
}): Promise<OrderQuote> {
  const shop = await getShopRow(input.shopId);
  const { itemsAmount } = await priceItems(input.shopId, input.items);
  const deliveryAmount =
    itemsAmount >= shop.free_delivery_above_amount ? 0 : shop.delivery_fee_amount;
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
  addressText: string;
  lat: number;
  lng: number;
  /** Only a code is accepted — the discount amount is always recomputed here, never trusted from the client. */
  couponCode?: string;
};

export async function placeOrder(input: PlaceOrderInput): Promise<CustomerOrder> {
  const shop = await getShopRow(input.shopId);
  const { lines, itemsAmount } = await priceItems(input.shopId, input.items);
  const deliveryAmount =
    itemsAmount >= shop.free_delivery_above_amount ? 0 : shop.delivery_fee_amount;
  const { discountAmount, couponError } = await applyCoupon(input.couponCode, itemsAmount);
  if (input.couponCode && couponError) throw new Error(couponError);
  const totalAmount = Math.max(0, itemsAmount + deliveryAmount + HANDLING_AMOUNT - discountAmount);

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

  // 4-digit handoff codes: shop→partner at pickup, partner→customer at delivery
  // (Phase E). Generated up front so they exist regardless of when a partner
  // ends up assigned.
  const pickupOtp = String(Math.floor(1000 + Math.random() * 9000));
  const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));

  const { data: order, error: orderErr } = await admin()
    .from("orders")
    .insert({
      customer_id: input.customerId,
      shop_id: input.shopId,
      address_id: address.id,
      status,
      payment_method: input.paymentMethod,
      items_amount: itemsAmount,
      delivery_amount: deliveryAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      promo_code: discountAmount > 0 ? input.couponCode?.trim().toUpperCase() : null,
      pickup_otp: pickupOtp,
      delivery_otp: deliveryOtp,
    })
    .select("*")
    .single();
  if (orderErr) throw new Error(`placeOrder failed: ${orderErr.message}`);

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
    address: input.addressText,
    etaMinutes: shop.eta_minutes,
    placedAt: new Date(order.placed_at).getTime(),
    status: toUiStatus(order.status),
    payment,
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
