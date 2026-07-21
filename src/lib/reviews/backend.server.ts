// Real reviews — the `reviews` table has existed since Phase A with correct
// RLS (customer inserts their own, everyone reads) but nothing ever wrote to
// it; shop/partner rating_avg were static seed values, not derived from
// anything real, until supabase/migrations/0009_review_rating_triggers.sql.
// Service-role client, not the request-scoped pattern used by
// addresses/notifications/wishlist: deriving shop_id/partner_id for a review
// needs a join through `assignments`, which has no customer-read RLS policy
// at all (only partner-own and shop-owner policies exist) — the same
// "complex join RLS can't cleanly express" reasoning documented for
// orders/tracking-data in the auth-hardening plan.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Reviews backend not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

export type ReviewableOrder = {
  shopId: string;
  shopName: string;
  partnerId: string | null;
};

/** `callerId` must be the session-derived context.uid — returns null (not an error) if the order isn't the caller's own or isn't delivered yet, so a caller can't probe order existence/status. */
export async function getReviewableOrder(
  orderId: string,
  callerId: string,
): Promise<ReviewableOrder | null> {
  const { data: order, error } = await admin()
    .from("orders")
    .select("id, customer_id, shop_id, status, shops(name)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`getReviewableOrder failed: ${error.message}`);
  if (!order || order.customer_id !== callerId || order.status !== "delivered") return null;

  const { data: assignment } = await admin()
    .from("assignments")
    .select("partner_id")
    .eq("order_id", orderId)
    .eq("status", "completed")
    .maybeSingle();

  const shop = Array.isArray(order.shops) ? order.shops[0] : order.shops;
  return {
    shopId: order.shop_id,
    shopName: shop?.name ?? "Shop",
    partnerId: assignment?.partner_id ?? null,
  };
}

export type MyReview = { shopRating: number; partnerRating: number | null; comment: string | null };

export async function getMyReviewForOrder(
  orderId: string,
  callerId: string,
): Promise<MyReview | null> {
  const { data, error } = await admin()
    .from("reviews")
    .select("shop_rating, partner_rating, comment")
    .eq("order_id", orderId)
    .eq("customer_id", callerId)
    .maybeSingle();
  if (error) throw new Error(`getMyReviewForOrder failed: ${error.message}`);
  if (!data) return null;
  return {
    shopRating: data.shop_rating,
    partnerRating: data.partner_rating,
    comment: data.comment,
  };
}

export type SubmitReviewInput = {
  orderId: string;
  callerId: string;
  shopRating: number;
  partnerRating?: number;
  comment?: string;
};

export async function submitReview(input: SubmitReviewInput): Promise<void> {
  const reviewable = await getReviewableOrder(input.orderId, input.callerId);
  if (!reviewable)
    throw new Error("This order can't be reviewed — it may not be delivered yet, or isn't yours.");

  const { error } = await admin()
    .from("reviews")
    .insert({
      order_id: input.orderId,
      customer_id: input.callerId,
      shop_id: reviewable.shopId,
      partner_id: reviewable.partnerId,
      shop_rating: input.shopRating,
      partner_rating: reviewable.partnerId ? (input.partnerRating ?? null) : null,
      comment: input.comment?.trim() || null,
    });
  if (error) {
    if (error.message.includes("duplicate key"))
      throw new Error("You've already reviewed this order.");
    throw new Error(`submitReview failed: ${error.message}`);
  }
}

export type ShopReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

/** Public data — no identity needed. Reviewer identity is deliberately never exposed (reviews.customer_id isn't selected here). */
export async function listShopReviews(shopId: string): Promise<ShopReview[]> {
  const { data, error } = await admin()
    .from("reviews")
    .select("id, shop_rating, comment, created_at")
    .eq("shop_id", shopId)
    .not("shop_rating", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`listShopReviews failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    rating: row.shop_rating,
    comment: row.comment,
    createdAt: row.created_at,
  }));
}
