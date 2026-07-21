// Real orders, direct to Supabase with a real supabase.auth session.
// Reading orders is a plain RLS-scoped select (orders_customer_read: RLS
// already grants authenticated users read access to their own orders).
// Placing one is NOT a direct insert — see
// supabase/migrations/0005_place_order_mobile_rpc.sql for why (RLS only
// grants SELECT on orders/order_items to authenticated; a SECURITY DEFINER
// RPC does the real re-pricing + insert instead, mirroring the web app's
// orders/backend.server.ts placeOrder logic in SQL).
import { supabase } from "./supabase";

export type OrderLine = { name: string; emoji: string; price: number; unit: string; quantity: number };
export type UiOrderStatus = "placed" | "accepted" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

export type MobileOrder = {
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
};

// Not stored per-row — a flat platform fee, matching orders/backend.server.ts's HANDLING_AMOUNT.
const HANDLING_AMOUNT = 900;

function toUiStatus(dbStatus: string): UiOrderStatus {
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

const ORDER_SELECT =
  "*, shops(name, emoji, eta_minutes), addresses(line1), order_items(name_snapshot, price_amount, quantity, products(emoji, unit))";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrderRow(row: any): MobileOrder {
  const shop = row.shops;
  const items = (row.order_items ?? []) as {
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

export async function getMyOrders(): Promise<MobileOrder[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.from("orders").select(ORDER_SELECT).eq("customer_id", user.id).order("placed_at", { ascending: false });
  if (error) throw new Error(`getMyOrders failed: ${error.message}`);
  return (data ?? []).map(mapOrderRow);
}

export type PlaceOrderInput = {
  shopId: string;
  items: { productId: string; quantity: number }[];
  paymentMethod: "upi" | "card" | "netbanking" | "cod";
  addressText: string;
  lat: number;
  lng: number;
};

export async function placeOrder(input: PlaceOrderInput): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc("place_order_mobile", {
    p_shop_id: input.shopId,
    p_items: input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_payment_method: input.paymentMethod,
    p_address_text: input.addressText,
    p_lat: input.lat,
    p_lng: input.lng,
  });
  if (error) throw new Error(`placeOrder failed: ${error.message}`);
  return { id: (data as { id: string }).id };
}
