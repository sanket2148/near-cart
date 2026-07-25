// Server-only delivery-partner operations (Phase E of the backend build-out).
// Replaces src/lib/partner.tsx's localStorage persistence with real
// delivery_partners/assignments rows, mirroring seller-data/'s pattern.
//
// Simplification carried over honestly, not newly faked: no pricing/
// incentive engine exists yet, so payout is a flat distance-based formula
// (₹25 + ₹8/km), not real dispatch economics. No tip mechanism exists at
// checkout yet either, so tips are always absent.
//
// Job flow is 3 stages (accepted → picked_up → delivered), not the mock's 4
// (accepted → at_shop → picked_up → delivered) — the real order_status enum
// has no "arrived at shop, not yet collected" state distinct from
// partner_assigned, so that intermediate stage was dropped rather than faked.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { haversineKm } from "@/lib/geo";
import { insertNotification } from "@/lib/notifications/backend.server";

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Partner backend not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

// ─── Ownership checks (Phase 5 of the authorization-hardening plan, 2026-07-19) ─
// Every function below used to trust a client-supplied partnerId/assignmentId
// with zero verification — any authenticated caller could read another
// partner's jobs/PII, toggle another partner online/offline, hijack another
// partner's assignment, or steal delivery-earnings credit for a job they
// never did. `callerId` must always be the session-derived context.uid,
// never a client-supplied value. See plan/tasks/decisions.md.

class OwnershipError extends Error {}

/** Resolves the caller's own delivery_partners.id from their session — never accept a partnerId as a parameter instead. */
async function getOwnPartnerId(callerId: string): Promise<string> {
  const { data, error } = await admin()
    .from("delivery_partners")
    .select("id")
    .eq("user_id", callerId)
    .maybeSingle();
  if (error) throw new Error(`Partner lookup failed: ${error.message}`);
  if (!data) throw new OwnershipError("No delivery partner profile for this account.");
  return data.id;
}

async function assertAssignmentOwner(assignmentId: string, callerId: string): Promise<string> {
  const ownPartnerId = await getOwnPartnerId(callerId);
  const { data, error } = await admin()
    .from("assignments")
    .select("partner_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw new Error(`Ownership check failed: ${error.message}`);
  if (!data || data.partner_id !== ownPartnerId) throw new OwnershipError("This job isn't yours.");
  return ownPartnerId;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export type RiderProfile = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  area: string;
  rating: number;
  online: boolean;
  joinedAt: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfileRow(row: any): RiderProfile {
  return {
    id: row.id,
    name: row.users?.full_name || row.users?.phone || "Partner",
    phone: row.users?.phone ?? "",
    vehicle: row.vehicle_type ?? "",
    area: (row.preferred_zones as { area?: string } | null)?.area ?? "",
    rating: Number(row.rating_avg ?? 5),
    online: Boolean(row.is_online),
    joinedAt: new Date(row.created_at).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    }),
  };
}

const PROFILE_SELECT = "*, users(full_name, phone)";

export async function getMyProfile(userId: string): Promise<RiderProfile | null> {
  const { data, error } = await admin()
    .from("delivery_partners")
    .select(PROFILE_SELECT)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`getMyProfile failed: ${error.message}`);
  return data ? mapProfileRow(data) : null;
}

export type NewPartnerInput = { name: string; vehicle: string; area: string };

export async function createProfile(userId: string, input: NewPartnerInput): Promise<RiderProfile> {
  await admin().from("users").update({ full_name: input.name }).eq("id", userId);
  const { error } = await admin()
    .from("delivery_partners")
    .insert({
      user_id: userId,
      vehicle_type: input.vehicle,
      status: "active",
      is_online: false,
      preferred_zones: { area: input.area },
    });
  if (error) throw new Error(`createProfile failed: ${error.message}`);
  const created = await getMyProfile(userId);
  if (!created) throw new Error("createProfile: profile vanished immediately after creation");
  return created;
}

export async function toggleOnline(callerId: string): Promise<void> {
  const partnerId = await getOwnPartnerId(callerId);
  const { data, error } = await admin()
    .from("delivery_partners")
    .select("is_online")
    .eq("id", partnerId)
    .single();
  if (error) throw new Error(`toggleOnline lookup failed: ${error.message}`);
  const { error: updateErr } = await admin()
    .from("delivery_partners")
    .update({ is_online: !data.is_online })
    .eq("id", partnerId);
  if (updateErr) throw new Error(`toggleOnline failed: ${updateErr.message}`);
}

// ─── Jobs (assignments ↔ orders) ─────────────────────────────────────────────

export type JobStatus = "new" | "accepted" | "picked_up" | "delivered" | "declined";

export type DeliveryJob = {
  id: string;
  orderId: string;
  shopName: string;
  shopEmoji: string;
  shopAddress: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  itemCount: number;
  orderValue: number;
  paymentMethod: "UPI" | "COD";
  distanceKm: number;
  payout: number;
  tip?: number;
  assignedAt: number;
  completedAt?: number;
  status: JobStatus;
};

function toJobStatus(assignmentStatus: string, orderStatus: string): JobStatus {
  if (assignmentStatus === "declined" || assignmentStatus === "expired") return "declined";
  if (assignmentStatus === "offered") return "new";
  if (orderStatus === "delivered" || orderStatus === "closed") return "delivered";
  if (orderStatus === "picked_up" || orderStatus === "out_for_delivery") return "picked_up";
  return "accepted";
}

function payoutFor(distanceKm: number): number {
  return Math.round(25 + distanceKm * 8);
}

const JOB_SELECT =
  "id, status, offered_at, responded_at, earnings_amount, orders(id, status, total_amount, payment_method, delivered_at, shops(name, emoji, lat, lng, address_line), addresses(line1, lat, lng), users(full_name, phone), order_items(quantity))";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapJobRow(row: any): DeliveryJob {
  const order = row.orders;
  const shop = order?.shops;
  const drop = order?.addresses;
  const distanceKm =
    shop?.lat != null && drop?.lat != null
      ? Number(
          haversineKm({ lat: shop.lat, lng: shop.lng }, { lat: drop.lat, lng: drop.lng }).toFixed(
            1,
          ),
        )
      : 0;
  const itemCount = (order?.order_items ?? []).reduce(
    (sum: number, i: { quantity: number }) => sum + i.quantity,
    0,
  );

  return {
    id: row.id,
    orderId: order?.id ?? "",
    shopName: shop?.name ?? "Shop",
    shopEmoji: shop?.emoji ?? "🏪",
    shopAddress: shop?.address_line ?? "",
    customerName: order?.users?.full_name || order?.users?.phone || "Customer",
    customerAddress: drop?.line1 ?? "",
    customerPhone: order?.users?.phone ?? "",
    itemCount,
    orderValue: (order?.total_amount ?? 0) / 100,
    paymentMethod: order?.payment_method === "cod" ? "COD" : "UPI",
    distanceKm,
    payout: row.earnings_amount != null ? row.earnings_amount / 100 : payoutFor(distanceKm),
    assignedAt: new Date(row.offered_at).getTime(),
    completedAt: order?.delivered_at ? new Date(order.delivered_at).getTime() : undefined,
    status: toJobStatus(row.status, order?.status ?? ""),
  };
}

export async function getMyJobs(callerId: string): Promise<DeliveryJob[]> {
  const partnerId = await getOwnPartnerId(callerId);
  const { data, error } = await admin()
    .from("assignments")
    .select(JOB_SELECT)
    .eq("partner_id", partnerId)
    .order("offered_at", { ascending: false });
  if (error) throw new Error(`getMyJobs failed: ${error.message}`);
  return (data ?? []).map(mapJobRow);
}

// Order statuses at which a partner is legitimately still waiting to be
// assigned (see seller.orders.tsx's `needsPartner` — offering only happens
// while an order is "preparing" or "ready_for_pickup"). Anything else means
// this order has already moved past the point of accepting an assignment.
const PRE_ASSIGNMENT_ORDER_STATUSES = ["preparing", "ready_for_pickup"];

/**
 * Two different partners can each hold their own "offered" assignment row
 * for the same order (a seller re-offering before the first is resolved, or
 * a retry) — nothing about assertAssignmentOwner or a plain update stops
 * both from independently calling acceptJob and both succeeding, since
 * they're different rows. This is a real, previously-unguarded race (see
 * plan/tasks/decisions.md 2026-07-22) — fixed with two conditional updates:
 * first claim THIS assignment (only if it's still "offered" — guards a
 * double-click/retry on the same row), then claim the ORDER itself (only if
 * it hasn't already been claimed by a rival assignment). Whichever call's
 * order-claim lands first wins; the loser's assignment is reverted to
 * "expired" (a real, already-defined `assignment_status` value, previously
 * unused in code) rather than left dangling as "accepted" on a job the
 * order no longer reflects.
 */
export async function acceptJob(assignmentId: string, callerId: string): Promise<void> {
  await assertAssignmentOwner(assignmentId, callerId);
  const { data: assignment, error: findErr } = await admin()
    .from("assignments")
    .select("order_id, orders(status)")
    .eq("id", assignmentId)
    .single();
  if (findErr) throw new Error(`acceptJob lookup failed: ${findErr.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderStatus = (assignment.orders as any)?.status;
  if (!PRE_ASSIGNMENT_ORDER_STATUSES.includes(orderStatus)) {
    throw new Error("This order is no longer waiting for a delivery partner.");
  }

  const { data: claimedAssignment, error: claimErr } = await admin()
    .from("assignments")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("status", "offered")
    .select("id")
    .maybeSingle();
  if (claimErr) throw new Error(`acceptJob failed: ${claimErr.message}`);
  if (!claimedAssignment) {
    throw new Error("This delivery request is no longer available.");
  }

  const { data: claimedOrder, error: orderErr } = await admin()
    .from("orders")
    .update({ status: "partner_assigned" })
    .eq("id", assignment.order_id)
    .in("status", PRE_ASSIGNMENT_ORDER_STATUSES)
    .select("id")
    .maybeSingle();
  if (orderErr) throw new Error(`acceptJob failed: ${orderErr.message}`);
  if (!claimedOrder) {
    // Lost the race to another partner's assignment — release this one
    // instead of leaving it stuck "accepted" on an order assigned elsewhere.
    await admin().from("assignments").update({ status: "expired" }).eq("id", assignmentId);
    throw new Error("This delivery was already accepted by another partner.");
  }

  await admin().from("order_events").insert({
    order_id: assignment.order_id,
    to_status: "partner_assigned",
    note: "Partner accepted",
  });
}

export async function declineJob(assignmentId: string, callerId: string): Promise<void> {
  await assertAssignmentOwner(assignmentId, callerId);
  const { error } = await admin()
    .from("assignments")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (error) throw new Error(`declineJob failed: ${error.message}`);
}

/**
 * pickup: order → picked_up. delivery: order → delivered, assignment →
 * completed with earnings. `currentStatus` is no longer a parameter — it
 * used to be client-supplied, which let a caller claim any status and skip
 * straight to "delivered" (crediting themselves the earnings_amount for a
 * job they never actually did, on top of skipping the flow). Now derived
 * from the assignment's + order's real DB status via the same toJobStatus()
 * helper the job list already uses. See plan/tasks/decisions.md, Phase 5.
 */
export async function advanceJob(assignmentId: string, callerId: string): Promise<void> {
  await assertAssignmentOwner(assignmentId, callerId);
  const { data: assignment, error: findErr } = await admin()
    .from("assignments")
    .select(
      "order_id, status, orders(customer_id, status, shops(name, lat, lng), addresses(lat, lng))",
    )
    .eq("id", assignmentId)
    .single();
  if (findErr) throw new Error(`advanceJob lookup failed: ${findErr.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentStatus = toJobStatus(assignment.status, (assignment.orders as any)?.status ?? "");

  if (currentStatus === "accepted") {
    await admin().from("orders").update({ status: "picked_up" }).eq("id", assignment.order_id);
    await admin().from("order_events").insert({
      order_id: assignment.order_id,
      to_status: "picked_up",
      note: "Picked up from shop",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = assignment.orders as any;
    if (order?.customer_id) {
      await insertNotification(
        order.customer_id,
        "order_status",
        "Out for delivery",
        `Your order from ${order.shops?.name ?? "the shop"} is on its way.`,
        { orderId: assignment.order_id, status: "picked_up" },
      );
    }
    return;
  }

  if (currentStatus === "picked_up") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const order = assignment.orders as any;
    const shop = order?.shops;
    const drop = order?.addresses;
    const distanceKm =
      shop?.lat != null && drop?.lat != null
        ? haversineKm({ lat: shop.lat, lng: shop.lng }, { lat: drop.lat, lng: drop.lng })
        : 0;
    const earnings = payoutFor(distanceKm) * 100;

    await admin()
      .from("orders")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", assignment.order_id);
    await admin().from("order_events").insert({
      order_id: assignment.order_id,
      to_status: "delivered",
      note: "Delivered to customer",
    });
    await admin()
      .from("assignments")
      .update({ status: "completed", earnings_amount: Math.round(earnings) })
      .eq("id", assignmentId);

    if (order?.customer_id) {
      await insertNotification(
        order.customer_id,
        "order_status",
        "Order delivered",
        `Your order from ${order.shops?.name ?? "the shop"} has been delivered. Enjoy!`,
        { orderId: assignment.order_id, status: "delivered" },
      );
    }
  }
}
