// Demo movement engine: animates the rider from pickup → drop and advances
// the order status over time. Used as a stand-in for a real rider's GPS when
// running a single-device demo. Writes to the shared tracking store so any
// other open role view (buyer/seller) sees the live updates.
import { useEffect, useRef, useState } from "react";
import { lerp } from "@/lib/geo";
import {
  useTracking,
  type TrackSession,
  type TrackStatus,
} from "@/lib/tracking";

const STEP_MS = 1200;
const STEPS = 60;

export function useDeliverySimulation(orderId: string, session?: TrackSession) {
  const { setRiderPosition, setStatus } = useTracking();
  const [running, setRunning] = useState(false);
  const tRef = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRunning(false);
  };

  const start = () => {
    if (!session || running) return;
    tRef.current = 0;
    setRunning(true);
    setStatus(orderId, "ready");
    timer.current = setInterval(() => {
      tRef.current += 1;
      const t = tRef.current / STEPS;
      const pickupHold = 0.12; // wait at shop, then pick up
      let pos;
      let status: TrackStatus;
      if (t <= pickupHold) {
        pos = session.pickup;
        status = "ready";
      } else if (t >= 1) {
        pos = session.drop;
        status = "delivered";
      } else {
        const ratio = (t - pickupHold) / (1 - pickupHold);
        pos = lerp(session.pickup, session.drop, ratio);
        status = ratio < 0.15 ? "picked_up" : "in_transit";
      }
      setRiderPosition(orderId, pos);
      setStatus(orderId, status);
      if (t >= 1) stop();
    }, STEP_MS);
  };

  useEffect(() => () => stop(), []);

  return { running, start, stop };
}
