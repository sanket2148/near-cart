// Server-only admin operations. Phase G (verification queue only) shipped
// first — this file grew a full admin dashboard's worth of functions later
// (shops/partners/orders management + stats), once the corresponding pages
// actually existed. See plan/tasks/decisions.md for the scoping decisions
// behind each (order overrides = cancel only, no refund infra exists yet;
// partner actions = suspend/reactivate, no approval-gate-at-signup change).
//
// The verification WIZARD's deep detail (documents, KYC, bank, GPS) is still
// localStorage-only (src/lib/verification.ts) — this module only queries the
// real summary fields on shop_verifications (business_type, overall_status,
// flagged, flag_reasons), which is what Phase D's syncVerificationSummary()
// actually writes. admin.verification.tsx falls back to a "not available on
// this device" message for shops whose deep detail isn't in local storage.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BUSINESS_TYPE_CONFIG, type BusinessType } from "@/lib/verification";
import { insertNotification } from "@/lib/notifications/backend.server";

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Admin backend not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

export type AdminShopReview = {
  shopId: string;
  name: string;
  businessType: BusinessType | null;
  createdAt: number;
  overallStatus: string;
  riskLevel: "low" | "medium" | "high";
  flags: string[];
};

function riskTierFor(businessType: BusinessType | null): "low" | "medium" | "high" {
  return businessType ? BUSINESS_TYPE_CONFIG[businessType].riskTier : "low";
}

export async function listShopsForReview(): Promise<AdminShopReview[]> {
  const { data, error } = await admin()
    .from("shops")
    .select(
      "id, name, created_at, shop_verifications(business_type, overall_status, flagged, flag_reasons)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listShopsForReview failed: ${error.message}`);

  return (
    (data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((row: any) => {
        const v = Array.isArray(row.shop_verifications)
          ? row.shop_verifications[0]
          : row.shop_verifications;
        return v?.overall_status === "pending_review";
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => {
        const v = Array.isArray(row.shop_verifications)
          ? row.shop_verifications[0]
          : row.shop_verifications;
        const businessType = (v?.business_type as BusinessType | null) ?? null;
        return {
          shopId: row.id,
          name: row.name,
          businessType,
          createdAt: new Date(row.created_at).getTime(),
          overallStatus: v?.overall_status ?? "incomplete",
          riskLevel: riskTierFor(businessType),
          flags: (v?.flag_reasons as string[] | null) ?? [],
        };
      })
  );
}

export type ShopDuplicateCandidate = {
  id: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  claimed: boolean;
  distanceM: number;
  nameScore: number;
};

/**
 * Real duplicate-listing hint for the verification review screen — reuses
 * find_shop_matches (migration 0014, pg_trgm + PostGIS), the same function
 * CreateShopStep.tsx already calls for the merchant-side check
 * (findPossibleShopMatches). Unlike that caller, this one does NOT filter to
 * unclaimed rows: a claimed, already-live shop at the same spot with a
 * similar name is the more actionable signal here — two real merchants
 * somehow both listing the same physical shop — not just an OSM import the
 * merchant could claim instead.
 */
export async function findDuplicateCandidatesForShop(
  shopId: string,
): Promise<ShopDuplicateCandidate[]> {
  const { data: shop, error: shopErr } = await admin()
    .from("shops")
    .select("name, lat, lng")
    .eq("id", shopId)
    .maybeSingle();
  if (shopErr) throw new Error(`findDuplicateCandidatesForShop failed: ${shopErr.message}`);
  if (!shop || shop.lat == null || shop.lng == null) return [];

  const { data, error } = await admin().rpc("find_shop_matches", {
    p_name: shop.name,
    p_lat: shop.lat,
    p_lng: shop.lng,
  });
  if (error) throw new Error(`findDuplicateCandidatesForShop failed: ${error.message}`);

  return (
    (data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((row: any) => row.id !== shopId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => ({
        id: row.id,
        name: row.name,
        addressLine: row.address_line,
        city: row.city,
        claimed: row.claimed,
        distanceM: row.distance_m,
        nameScore: row.name_score,
      }))
  );
}

async function notifyShopOwner(shopId: string, title: string, body: string): Promise<void> {
  const { data: shop } = await admin()
    .from("shops")
    .select("owner_id, name")
    .eq("id", shopId)
    .maybeSingle();
  if (shop?.owner_id) {
    await insertNotification(shop.owner_id, "verification_status", title, body, { shopId });
  }
}

export async function approveShop(shopId: string): Promise<void> {
  const { error } = await admin()
    .from("shop_verifications")
    .update({ overall_status: "approved" })
    .eq("shop_id", shopId);
  if (error) throw new Error(`approveShop failed: ${error.message}`);
  await notifyShopOwner(
    shopId,
    "Shop verified",
    "Your shop passed verification and is now live for customers.",
  );
}

export async function rejectShop(shopId: string): Promise<void> {
  const { error } = await admin()
    .from("shop_verifications")
    .update({ overall_status: "incomplete" })
    .eq("shop_id", shopId);
  if (error) throw new Error(`rejectShop failed: ${error.message}`);
  await notifyShopOwner(
    shopId,
    "Verification needs attention",
    "Your shop's verification was sent back — please review and resubmit your details.",
  );
}

// ─── Shops (full roster, not just the pending-review queue) ────────────────

export type AdminShop = {
  id: string;
  name: string;
  ownerName: string;
  ownerPhone: string;
  businessType: BusinessType | null;
  overallStatus: string;
  isOpen: boolean;
  city: string;
  createdAt: number;
};

const ADMIN_SHOP_SELECT =
  "id, name, is_open, city, created_at, users(full_name, phone), shop_verifications(business_type, overall_status)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAdminShopRow(row: any): AdminShop {
  const v = Array.isArray(row.shop_verifications)
    ? row.shop_verifications[0]
    : row.shop_verifications;
  const owner = row.users;
  return {
    id: row.id,
    name: row.name,
    ownerName: owner?.full_name || owner?.phone || "Unknown",
    ownerPhone: owner?.phone ?? "",
    businessType: (v?.business_type as BusinessType | null) ?? null,
    overallStatus: v?.overall_status ?? "incomplete",
    isOpen: Boolean(row.is_open),
    city: row.city ?? "",
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function listAllShops(): Promise<AdminShop[]> {
  const { data, error } = await admin()
    .from("shops")
    .select(ADMIN_SHOP_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`listAllShops failed: ${error.message}`);
  return (data ?? []).map(mapAdminShopRow);
}

export async function suspendShop(shopId: string): Promise<void> {
  const { error } = await admin()
    .from("shop_verifications")
    .update({ overall_status: "suspended" })
    .eq("shop_id", shopId);
  if (error) throw new Error(`suspendShop failed: ${error.message}`);
  await notifyShopOwner(
    shopId,
    "Shop suspended",
    "Your shop has been suspended by NearCart. Contact support for details.",
  );
}

export async function reactivateShop(shopId: string): Promise<void> {
  const { error } = await admin()
    .from("shop_verifications")
    .update({ overall_status: "approved" })
    .eq("shop_id", shopId);
  if (error) throw new Error(`reactivateShop failed: ${error.message}`);
  await notifyShopOwner(
    shopId,
    "Shop reactivated",
    "Your shop is active again and visible to customers.",
  );
}

// ─── Delivery partners (full roster) ────────────────────────────────────────

export type AdminPartner = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: string;
  online: boolean;
  ratingAvg: number;
  createdAt: number;
};

const ADMIN_PARTNER_SELECT =
  "id, vehicle_type, status, is_online, rating_avg, created_at, users(full_name, phone)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAdminPartnerRow(row: any): AdminPartner {
  return {
    id: row.id,
    name: row.users?.full_name || row.users?.phone || "Partner",
    phone: row.users?.phone ?? "",
    vehicle: row.vehicle_type ?? "",
    status: row.status,
    online: Boolean(row.is_online),
    ratingAvg: Number(row.rating_avg ?? 0),
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function listAllPartners(): Promise<AdminPartner[]> {
  const { data, error } = await admin()
    .from("delivery_partners")
    .select(ADMIN_PARTNER_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`listAllPartners failed: ${error.message}`);
  return (data ?? []).map(mapAdminPartnerRow);
}

async function notifyPartner(partnerId: string, title: string, body: string): Promise<void> {
  const { data: partner } = await admin()
    .from("delivery_partners")
    .select("user_id")
    .eq("id", partnerId)
    .maybeSingle();
  if (partner?.user_id) {
    await insertNotification(partner.user_id, "account_status", title, body, { partnerId });
  }
}

export async function suspendPartner(partnerId: string): Promise<void> {
  const { error } = await admin()
    .from("delivery_partners")
    .update({ status: "suspended", is_online: false })
    .eq("id", partnerId);
  if (error) throw new Error(`suspendPartner failed: ${error.message}`);
  await notifyPartner(
    partnerId,
    "Account suspended",
    "Your delivery partner account has been suspended. Contact support for details.",
  );
}

export async function reactivatePartner(partnerId: string): Promise<void> {
  const { error } = await admin()
    .from("delivery_partners")
    .update({ status: "active" })
    .eq("id", partnerId);
  if (error) throw new Error(`reactivatePartner failed: ${error.message}`);
  await notifyPartner(
    partnerId,
    "Account reactivated",
    "Your delivery partner account is active again.",
  );
}

// ─── Orders (platform-wide view + force-cancel) ─────────────────────────────
//
// No refund/payout-reversal logic — Phase F payments is scaffolded, not
// live, so there's no real money movement to reverse yet. cancelOrder() is
// deliberately just a status override + audit trail entry, not a financial
// operation.

export type AdminOrder = {
  id: string;
  shopName: string;
  customerName: string;
  status: string;
  totalAmount: number;
  placedAt: number;
};

const ADMIN_ORDER_SELECT =
  "id, status, total_amount, placed_at, shops(name), users(full_name, phone)";

const CANCELLABLE_STATUSES = new Set([
  "created",
  "paid",
  "cod_confirmed",
  "shop_accepted",
  "preparing",
  "ready_for_pickup",
  "partner_assigned",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAdminOrderRow(row: any): AdminOrder {
  return {
    id: row.id,
    shopName: row.shops?.name ?? "Shop",
    customerName: row.users?.full_name || row.users?.phone || "Customer",
    status: row.status,
    totalAmount: (row.total_amount ?? 0) / 100,
    placedAt: new Date(row.placed_at).getTime(),
  };
}

export async function listAllOrders(status?: string): Promise<AdminOrder[]> {
  let query = admin()
    .from("orders")
    .select(ADMIN_ORDER_SELECT)
    .order("placed_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(`listAllOrders failed: ${error.message}`);
  return (data ?? []).map(mapAdminOrderRow);
}

export async function cancelOrder(orderId: string): Promise<void> {
  const { data: order, error: findErr } = await admin()
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();
  if (findErr) throw new Error(`cancelOrder lookup failed: ${findErr.message}`);
  if (!CANCELLABLE_STATUSES.has(order.status)) {
    throw new Error(`Cannot cancel an order in status '${order.status}'.`);
  }

  const { error } = await admin().from("orders").update({ status: "cancelled" }).eq("id", orderId);
  if (error) throw new Error(`cancelOrder failed: ${error.message}`);
  await admin()
    .from("order_events")
    .insert({ order_id: orderId, to_status: "cancelled", note: "Cancelled by admin" });
}

// ─── Platform stats (simple live aggregates, no time-series storage) ───────

export type AdminStats = {
  shopsByStatus: Record<string, number>;
  partnersByStatus: Record<string, number>;
  ordersByStatus: Record<string, number>;
  /** Sum of total_amount (INR) for orders NOT in created/payment_failed/cancelled/shop_rejected — "confirmed" gross order value, not net-of-refunds revenue. */
  revenueToday: number;
  revenueWeek: number;
  verificationApprovalRate: number | null;
};

function countBy(
  rows: { status?: string; overallStatus?: string }[],
  key: "status" | "overallStatus",
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const k = (row[key] as string) ?? "unknown";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export async function getAdminStats(): Promise<AdminStats> {
  const [{ data: shopVerifications }, { data: partners }, { data: orders }] = await Promise.all([
    admin().from("shop_verifications").select("overall_status"),
    admin().from("delivery_partners").select("status"),
    admin()
      .from("orders")
      .select("status, total_amount, placed_at")
      .order("placed_at", { ascending: false })
      .limit(2000),
  ]);

  const shopsByStatus = countBy(
    (shopVerifications ?? []).map((r) => ({ overallStatus: r.overall_status })),
    "overallStatus",
  );
  const partnersByStatus = countBy(partners ?? [], "status");
  const ordersByStatus = countBy(orders ?? [], "status");

  const NON_REVENUE_STATUSES = new Set(["created", "payment_failed", "cancelled", "shop_rejected"]);
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  let revenueToday = 0;
  let revenueWeek = 0;
  for (const o of orders ?? []) {
    if (NON_REVENUE_STATUSES.has(o.status)) continue;
    const age = now - new Date(o.placed_at).getTime();
    const amount = (o.total_amount ?? 0) / 100;
    if (age < 7 * DAY) revenueWeek += amount;
    if (age < DAY) revenueToday += amount;
  }

  const totalReviewed = Object.values(shopsByStatus).reduce((a, b) => a + b, 0);
  const verificationApprovalRate =
    totalReviewed > 0 ? (shopsByStatus.approved ?? 0) / totalReviewed : null;

  return {
    shopsByStatus,
    partnersByStatus,
    ordersByStatus,
    revenueToday: Number(revenueToday.toFixed(2)),
    revenueWeek: Number(revenueWeek.toFixed(2)),
    verificationApprovalRate,
  };
}
