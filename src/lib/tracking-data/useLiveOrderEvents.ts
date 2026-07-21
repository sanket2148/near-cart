// Client side of src/routes/api.live.order.$orderId.ts. Wraps a native
// EventSource, patching the exact same TanStack Query cache entries the
// existing polling queries in order.$orderId.tsx already populate
// (["order", orderId, user?.id] and ["order-tracking", orderId]) — nothing
// downstream (LiveTrackView, the useTracking() sync effect) needs to change.
//
// Deliberately does not replace polling — see order.$orderId.tsx, where
// `live` returned here gates refetchInterval instead of removing it. This
// is new infrastructure with no prior precedent in this codebase (first use
// of Realtime anywhere in the app), so a caller degrading straight back to
// the proven 5-6s polling on repeated SSE failure is the graceful-fallback
// design, not an afterthought.

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CustomerOrder } from "@/lib/orders/backend.server";
import type { OrderTracking } from "@/lib/tracking-data/backend.server";

type OrderStatusEvent = {
  orderId: string;
  trackStatus: OrderTracking["status"];
  uiStatus?: CustomerOrder["status"];
};

type RiderLocationEvent = {
  orderId: string;
  lat: number;
  lng: number;
  recordedAt: number;
};

const MAX_CONSECUTIVE_ERRORS = 3;

export function useLiveOrderEvents(
  orderId: string | undefined,
  enabled: boolean,
  userId: string | undefined,
) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const errorCountRef = useRef(0);

  useEffect(() => {
    if (!enabled || !orderId) {
      setLive(false);
      return;
    }

    const es = new EventSource(`/api/live/order/${orderId}`);
    errorCountRef.current = 0;

    es.addEventListener("open", () => {
      errorCountRef.current = 0;
      setLive(true);
    });

    es.addEventListener("order_status", (evt) => {
      const data = JSON.parse((evt as MessageEvent).data) as OrderStatusEvent;
      queryClient.setQueryData<OrderTracking>(["order-tracking", orderId], (prev) => ({
        status: data.trackStatus,
        rider: prev?.rider ?? null,
      }));
      if (data.uiStatus) {
        queryClient.setQueryData<CustomerOrder>(["order", orderId, userId], (prev) =>
          prev ? { ...prev, status: data.uiStatus! } : prev,
        );
      }
    });

    es.addEventListener("rider_location", (evt) => {
      const data = JSON.parse((evt as MessageEvent).data) as RiderLocationEvent;
      queryClient.setQueryData<OrderTracking>(["order-tracking", orderId], (prev) => ({
        status: prev?.status ?? "placed",
        rider: { lat: data.lat, lng: data.lng, recordedAt: data.recordedAt },
      }));
    });

    es.onerror = () => {
      errorCountRef.current += 1;
      setLive(false);
      // A 401/404 from the route (not-logged-in, or the order isn't the
      // caller's) will never succeed on retry — EventSource retries forever
      // on its own otherwise, so give up explicitly after a few failures
      // rather than leaving a dead connection open.
      if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
        es.close();
      }
    };

    return () => {
      es.close();
      setLive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, enabled, userId]);

  return { live };
}
