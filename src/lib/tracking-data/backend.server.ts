// Server-only real-GPS tracking (follow-up to Phase H). Two responsibilities:
//   1. Let a delivery partner push their live GPS position (partner_locations).
//   2. Let a customer read the real order status + their assigned partner's
//      latest position, to drive src/lib/tracking.tsx's TrackSession instead
//      of the fake useDeliverySimulation clock.
//
// Same "no real Supabase session in the browser" constraint as Phase H (see
// plan/tasks/decisions.md) applies here too: partner_locations' own RLS
// policy (partner_locations_owner_all) can never actually be satisfied by
// the browser, so both directions go through server functions on the
// service-role key, exactly like every other write/read in this app.

import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import { toUiStatus } from "@/lib/orders/backend.server";

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Tracking backend not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

export type TrackStatus = "placed" | "ready" | "picked_up" | "in_transit" | "delivered";

export function toTrackStatus(dbStatus: string): TrackStatus {
  switch (dbStatus) {
    case "preparing":
    case "ready_for_pickup":
    case "partner_assigned":
      return "ready";
    case "picked_up":
      return "picked_up";
    case "out_for_delivery":
      return "in_transit";
    case "delivered":
    case "closed":
      return "delivered";
    default:
      // created/payment_failed/paid/cod_confirmed/shop_accepted and the
      // terminal failure states (cancelled/refunded/shop_rejected) — this
      // fake-tracker UI has never had a distinct "cancelled" visual, so
      // those fall back to "placed" rather than introducing a 6th step here.
      return "placed";
  }
}

export type OrderTracking = {
  status: TrackStatus;
  rider: { lat: number; lng: number; recordedAt: number } | null;
};

/**
 * `callerId` must be the session-derived `context.uid`, never a client-supplied
 * value — throws if the order doesn't belong to the caller, same "don't leak
 * whether it exists" posture as orders/backend.server.ts's getOrder (see
 * plan/tasks/decisions.md, Phase 3 of the authorization-hardening plan).
 */
export async function getOrderTracking(orderId: string, callerId: string): Promise<OrderTracking> {
  const { data: order, error } = await admin()
    .from("orders")
    .select("status, customer_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`getOrderTracking failed: ${error.message}`);
  if (!order || order.customer_id !== callerId) return { status: "placed", rider: null };

  const { data: assignment } = await admin()
    .from("assignments")
    .select("partner_id")
    .eq("order_id", orderId)
    .eq("status", "accepted")
    .maybeSingle();

  let rider: OrderTracking["rider"] = null;
  if (assignment?.partner_id) {
    const { data: loc } = await admin()
      .from("partner_locations")
      .select("lat, lng, recorded_at")
      .eq("partner_id", assignment.partner_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (loc) {
      rider = {
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        recordedAt: new Date(loc.recorded_at).getTime(),
      };
    }
  }

  return { status: toTrackStatus(order.status), rider };
}

/**
 * `callerId` must be the session-derived `context.uid`, never a client-supplied
 * value — the real `delivery_partners.id` is looked up from it here, rather
 * than trusting a client-supplied `partnerId` (which would let any caller
 * push fake GPS positions for any other partner). See plan/tasks/decisions.md,
 * Phase 3 of the authorization-hardening plan.
 */
export async function pushPartnerLocation(input: {
  callerId: string;
  lat: number;
  lng: number;
}): Promise<void> {
  const { data: partner, error: partnerErr } = await admin()
    .from("delivery_partners")
    .select("id")
    .eq("user_id", input.callerId)
    .maybeSingle();
  if (partnerErr) throw new Error(`pushPartnerLocation failed: ${partnerErr.message}`);
  if (!partner) throw new Error("No delivery partner profile for this account.");

  const { error } = await admin()
    .from("partner_locations")
    .insert({ partner_id: partner.id, lat: input.lat, lng: input.lng });
  if (error) throw new Error(`pushPartnerLocation failed: ${error.message}`);
}

// ─── Real Realtime relay (Phase 1 of live order tracking) ──────────────────
// Backs src/routes/api.live.order.$orderId.ts. See that file's header
// comment for why this exists server-side (the browser never holds a
// JS-readable Supabase JWT, so a direct browser-side postgres_changes
// subscription would authenticate as `anon` and receive nothing).
//
// SECURITY: the service-role client here bypasses RLS entirely, exactly
// like every query above in this file. The postgres_changes `filter`
// strings passed to .channel().on(...) below are a noise-reduction measure
// only, NOT a security boundary — the actual boundary is the one-time
// ownership check the caller (the route handler) performs via
// getOrderTracking BEFORE calling openOrderLiveSubscriptions. This function
// trusts orderId completely and performs no ownership check of its own.

export type LiveOrderCallbacks = {
  onOrderStatus: (data: { trackStatus: TrackStatus; uiStatus: string }) => void;
  onRiderLocation: (data: { lat: number; lng: number; recordedAt: number }) => void;
};

/**
 * Opens the Realtime subscriptions backing one order's live feed: order
 * status, the assignments row (to know which partner, if any, is currently
 * accepted), and — retargeted dynamically as the accepted partner changes —
 * that partner's GPS pings. partner_locations has no order_id column, only
 * partner_id, so which channel to watch can change mid-connection; that
 * retargeting is handled internally.
 */
export function openOrderLiveSubscriptions(
  orderId: string,
  callbacks: LiveOrderCallbacks,
): { close: () => void } {
  let closed = false;
  let orderChannel: RealtimeChannel | null = null;
  let assignmentChannel: RealtimeChannel | null = null;
  let partnerLocChannel: RealtimeChannel | null = null;
  let currentPartnerId: string | null = null;

  const retargetPartnerChannel = (partnerId: string | null) => {
    if (closed || partnerId === currentPartnerId) return;
    if (partnerLocChannel) {
      admin().removeChannel(partnerLocChannel);
      partnerLocChannel = null;
    }
    currentPartnerId = partnerId;
    if (!partnerId) return;
    partnerLocChannel = admin()
      .channel(`live-order-${orderId}-partner-${partnerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "partner_locations",
          filter: `partner_id=eq.${partnerId}`,
        },
        (payload) => {
          const row = payload.new as { lat: number; lng: number; recorded_at: string };
          callbacks.onRiderLocation({
            lat: Number(row.lat),
            lng: Number(row.lng),
            recordedAt: new Date(row.recorded_at).getTime(),
          });
        },
      )
      .subscribe();
  };

  const checkAcceptedPartner = async () => {
    const { data } = await admin()
      .from("assignments")
      .select("partner_id")
      .eq("order_id", orderId)
      .eq("status", "accepted")
      .maybeSingle();
    if (!closed) retargetPartnerChannel(data?.partner_id ?? null);
  };

  orderChannel = admin()
    .channel(`live-order-${orderId}-status`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
      (payload) => {
        const row = payload.new as { status: string };
        callbacks.onOrderStatus({
          trackStatus: toTrackStatus(row.status),
          uiStatus: toUiStatus(row.status),
        });
      },
    )
    .subscribe();

  assignmentChannel = admin()
    .channel(`live-order-${orderId}-assignments`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "assignments", filter: `order_id=eq.${orderId}` },
      () => {
        void checkAcceptedPartner();
      },
    )
    .subscribe();

  void checkAcceptedPartner();

  return {
    close: () => {
      if (closed) return;
      closed = true;
      orderChannel?.unsubscribe();
      assignmentChannel?.unsubscribe();
      partnerLocChannel?.unsubscribe();
    },
  };
}
