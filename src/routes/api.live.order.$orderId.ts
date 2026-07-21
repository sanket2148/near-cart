// Server-side relay for real order-status/tracking updates (Phase 1 of real
// Supabase Realtime — see plan/tasks/decisions.md). The browser never holds
// a JS-readable Supabase JWT (auth-session/cookies.server.ts's
// __Host-nc-at/__Host-nc-rt cookies are HttpOnly by design), so a direct
// browser-side postgres_changes subscription would authenticate as `anon`
// and receive nothing — RLS on orders/order_events/partner_locations only
// grants select to `authenticated`. This route holds the subscription
// server-side (service-role key, same trust boundary every other
// backend.server.ts already uses) and streams only this order's events,
// after checking the caller actually owns it, to the browser over SSE.
//
// Requires supabase/migrations/0010_realtime_publication.sql to have been
// run — without it, this connects fine but no events will ever fire.
//
// Auth is replicated inline rather than reusing authMiddleware, because
// authMiddleware (src/lib/auth-session/middleware.ts) is a
// createMiddleware({type:"function"}) object — it only composes into
// createServerFn(...).middleware([...]) chains, not into a raw
// server.handlers route like this one. Business logic (the Supabase client,
// the Realtime subscriptions) deliberately lives in
// src/lib/tracking-data/backend.server.ts, imported dynamically below —
// never top-level, matching src/routes/api.webhooks.razorpay.ts's same
// convention (a top-level import reachable from the client entry that
// chains into @tanstack/react-start/server breaks the client bundle; see
// cookies.server.ts's header comment for the real incident this guards
// against).

import { createFileRoute } from "@tanstack/react-router";

const HEARTBEAT_MS = 30_000;
// Comfortably inside Supabase's default 1hr access-token expiry. The
// browser's native EventSource auto-reconnects when the server closes the
// stream, and each reconnect re-runs the cookie-auth-with-refresh flow
// below — that reconnect cycle is the entire token-refresh strategy here,
// deliberately with zero client-side refresh logic.
const RECYCLE_MS = 8 * 60 * 1000;

async function resolveUid(): Promise<string | null> {
  const cookies = await import("@/lib/auth-session/cookies.server");
  const be = await import("@/lib/auth-session/backend.server");

  const accessToken = cookies.readAccessTokenCookie();
  let user = accessToken ? await be.getUserForToken(accessToken) : null;

  if (!user) {
    const refreshToken = cookies.readRefreshTokenCookie();
    if (refreshToken) {
      const session = await be.refreshSession(refreshToken);
      if (session) {
        cookies.persistRefreshedSession(session);
        user = await be.getUserForToken(session.access_token);
      }
    }
  }

  return user?.id ?? null;
}

export const Route = createFileRoute("/api/live/order/$orderId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const uid = await resolveUid();
        if (!uid) return new Response(null, { status: 401 });

        const { orderId } = params;
        const tracking = await import("@/lib/tracking-data/backend.server");

        // getOrderTracking is the ownership check: it returns a harmless
        // {status:"placed", rider:null} placeholder for both "doesn't
        // exist" and "not yours" (same not-found-vs-forbidden posture as
        // getOrder), so this route never learns which case it is — nor
        // does it need to. openOrderLiveSubscriptions below trusts orderId
        // completely and has no ownership check of its own; this call is
        // the only gate.
        const initial = await tracking.getOrderTracking(orderId, uid);

        const encoder = new TextEncoder();
        let closed = false;

        const streamBody = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (event: string, data: unknown) => {
              if (closed) return;
              try {
                controller.enqueue(
                  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
                );
              } catch {
                // controller already torn down elsewhere; cleanup() below handles the rest
              }
            };

            const subs = tracking.openOrderLiveSubscriptions(orderId, {
              onOrderStatus: (data) => send("order_status", { orderId, ...data }),
              onRiderLocation: (data) => send("rider_location", { orderId, ...data }),
            });

            let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
            let recycleTimer: ReturnType<typeof setTimeout> | null = null;

            const cleanup = () => {
              if (closed) return;
              closed = true;
              if (heartbeatTimer) clearInterval(heartbeatTimer);
              if (recycleTimer) clearTimeout(recycleTimer);
              subs.close();
              try {
                controller.close();
              } catch {
                // already closed
              }
            };

            request.signal.addEventListener("abort", cleanup);

            // Initial snapshot so the client has data as soon as
            // readyState flips to OPEN, without waiting for a DB change.
            // Only trackStatus is available here (getOrderTracking's own
            // shape) — the fuller uiStatus patch only accompanies real
            // order UPDATE events below; the client's own initial getOrder
            // fetch (a separate, already-existing query) covers the rest.
            send("order_status", { orderId, trackStatus: initial.status });
            if (initial.rider) send("rider_location", { orderId, ...initial.rider });

            heartbeatTimer = setInterval(() => send("heartbeat", {}), HEARTBEAT_MS);
            recycleTimer = setTimeout(cleanup, RECYCLE_MS);
          },
          cancel() {
            closed = true;
          },
        });

        return new Response(streamBody, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
