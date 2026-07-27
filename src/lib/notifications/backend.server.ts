// Write-side of the notifications table — `notifications` only grants
// select/update to `authenticated` (see 0001_initial_schema.sql), so every
// insert needs the service-role client, unlike api.functions.ts's own
// read/mark-read functions which run entirely on context.scopedClient.
//
// Other backend.server.ts modules (seller-data, partner-data, admin-data)
// import insertNotification directly — this is a shared cross-cutting
// utility (same category as src/lib/geo.ts's haversineKm), not an
// ownership-check helper, so it's exempt from the "each backend.server.ts
// is self-contained" convention that applies to per-module auth helpers.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LOW_STOCK_THRESHOLD } from "@/lib/data";

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Notifications backend not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

export async function insertNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin()
    .from("notifications")
    .insert({ user_id: userId, type, title, body: body ?? null, data: data ?? null });
  // Notifications are a side-effect, not the primary operation (order status
  // change, verification decision) — a failure here must never roll back or
  // fail the caller's real mutation, just log it.
  if (error) console.error(`insertNotification failed (${type}):`, error.message);
}

/** Shape of decrement_stock_for_sale's (migration 0018) RETURNS TABLE — shared by both its callers below. */
export type StockDecrementResult = {
  product_id: string;
  old_stock_qty: number | null;
  new_stock_qty: number | null;
};

/**
 * Fires a real "running low" notification to a shop's owner for every
 * tracked product whose decrement just crossed LOW_STOCK_THRESHOLD (old
 * quantity above it, new quantity at or below it) — a genuine crossing, not
 * "still low," so a string of small sales doesn't re-notify on every one.
 * Shared by placeOrder (orders/backend.server.ts) and recordCounterSale
 * (seller-data/backend.server.ts), the two callers of
 * decrement_stock_for_sale, so what "low" means can't drift between them.
 * Same "never throw, just log" contract as insertNotification — this is a
 * side effect of a sale, never something that should fail the sale itself.
 */
export async function notifyLowStockCrossings(
  shopId: string,
  results: StockDecrementResult[],
): Promise<void> {
  try {
    const crossed = results.filter(
      (r) =>
        r.old_stock_qty != null &&
        r.new_stock_qty != null &&
        r.old_stock_qty > LOW_STOCK_THRESHOLD &&
        r.new_stock_qty <= LOW_STOCK_THRESHOLD,
    );
    if (crossed.length === 0) return;

    const { data: shop, error: shopErr } = await admin()
      .from("shops")
      .select("owner_id")
      .eq("id", shopId)
      .maybeSingle();
    if (shopErr || !shop?.owner_id) return;

    const { data: products, error: productsErr } = await admin()
      .from("products")
      .select("id, name")
      .in(
        "id",
        crossed.map((c) => c.product_id),
      );
    if (productsErr) return;

    for (const c of crossed) {
      const name = products?.find((p) => p.id === c.product_id)?.name ?? "A product";
      await insertNotification(
        shop.owner_id,
        "low_stock",
        "Running low",
        `${name} is down to ${c.new_stock_qty} in stock.`,
        { shopId, productId: c.product_id, stockQty: c.new_stock_qty },
      );
    }
  } catch (err) {
    console.error(
      "notifyLowStockCrossings failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
