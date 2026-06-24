// Shared live-tracking store for NearCart, keyed by orderId.
// Single source of truth that ALL roles (buyer, seller, partner) read/write.
// Mock/local: persisted to localStorage and synced across tabs/roles in the
// same browser via BroadcastChannel + storage events (stands in for realtime).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { etaFromKm, haversineKm, roundCoord, type LatLng } from "./geo";

export type TrackStatus =
  | "placed"
  | "ready"
  | "picked_up"
  | "in_transit"
  | "delivered";

export const TRACK_STEPS: { key: TrackStatus; label: string; sub: string }[] = [
  { key: "placed", label: "Order Placed", sub: "Shop is notified" },
  { key: "ready", label: "Ready for Pickup", sub: "Packed & waiting for rider" },
  { key: "picked_up", label: "Picked Up", sub: "Rider collected the order" },
  { key: "in_transit", label: "In Transit", sub: "On the way to you" },
  { key: "delivered", label: "Delivered", sub: "Order completed 🎉" },
];

export const TRACK_STATUS_LABEL: Record<TrackStatus, string> = {
  placed: "Order Placed",
  ready: "Ready for Pickup",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  delivered: "Delivered",
};

export const TRACK_ORDER: TrackStatus[] = [
  "placed",
  "ready",
  "picked_up",
  "in_transit",
  "delivered",
];

export function nextTrackStatus(s: TrackStatus): TrackStatus | null {
  const i = TRACK_ORDER.indexOf(s);
  return i >= 0 && i < TRACK_ORDER.length - 1 ? TRACK_ORDER[i + 1] : null;
}

export type NamedPoint = LatLng & { label: string };

export type TrackSession = {
  orderId: string;
  pickup: NamedPoint;
  drop: NamedPoint;
  rider: LatLng | null;
  riderName: string;
  status: TrackStatus;
  etaMinutes: number | null;
  remainingKm: number | null;
  totalKm: number | null;
  updatedAt: number;
};

export type SessionInit = {
  pickup: NamedPoint;
  drop: NamedPoint;
  status?: TrackStatus;
  riderName?: string;
};

const KEY = "nearcart-tracking";
const CHANNEL = "nearcart-tracking";

type Store = Record<string, TrackSession>;

function load(): Store {
  try {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function persist(store: Store) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

type TrackingContextValue = {
  getSession: (orderId: string) => TrackSession | undefined;
  ensureSession: (orderId: string, init: SessionInit) => void;
  setStatus: (orderId: string, status: TrackStatus) => void;
  setRiderPosition: (orderId: string, pos: LatLng) => void;
  setRouteInfo: (orderId: string, totalKm: number, durationMin: number) => void;
  updateDrop: (orderId: string, drop: NamedPoint) => void;
  updatePickup: (orderId: string, pickup: NamedPoint) => void;
};

const TrackingContext = createContext<TrackingContextValue | null>(null);

export function TrackingProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>({});
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Hydrate after mount + subscribe to cross-tab updates.
  useEffect(() => {
    setStore(load());

    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setStore(load());
    };
    window.addEventListener("storage", onStorage);

    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = () => setStore(load());
      channelRef.current = bc;
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      bc?.close();
    };
  }, []);

  const broadcast = useCallback(() => {
    channelRef.current?.postMessage("update");
  }, []);

  const commit = useCallback(
    (mutate: (prev: Store) => Store) => {
      setStore((prev) => {
        const next = mutate(prev);
        persist(next);
        return next;
      });
      // Notify other tabs/roles after the write.
      queueMicrotask(broadcast);
    },
    [broadcast],
  );

  const value = useMemo<TrackingContextValue>(() => {
    const recompute = (s: TrackSession): TrackSession => {
      if (!s.rider) return s;
      const remainingKm = haversineKm(s.rider, s.drop);
      return {
        ...s,
        remainingKm,
        etaMinutes: s.status === "delivered" ? 0 : etaFromKm(remainingKm),
      };
    };

    return {
      getSession: (orderId) => store[orderId],
      ensureSession: (orderId, init) =>
        commit((prev) => {
          if (prev[orderId]) return prev;
          const total = haversineKm(init.pickup, init.drop);
          return {
            ...prev,
            [orderId]: {
              orderId,
              pickup: init.pickup,
              drop: init.drop,
              rider: null,
              riderName: init.riderName ?? "Delivery partner",
              status: init.status ?? "placed",
              etaMinutes: etaFromKm(total),
              remainingKm: total,
              totalKm: total,
              updatedAt: Date.now(),
            },
          };
        }),
      setStatus: (orderId, status) =>
        commit((prev) => {
          const s = prev[orderId];
          if (!s) return prev;
          return { ...prev, [orderId]: { ...s, status, updatedAt: Date.now() } };
        }),
      setRiderPosition: (orderId, pos) =>
        commit((prev) => {
          const s = prev[orderId];
          if (!s) return prev;
          const updated = recompute({
            ...s,
            rider: roundCoord(pos),
            updatedAt: Date.now(),
          });
          return { ...prev, [orderId]: updated };
        }),
      setRouteInfo: (orderId, totalKm, durationMin) =>
        commit((prev) => {
          const s = prev[orderId];
          if (!s) return prev;
          return {
            ...prev,
            [orderId]: {
              ...s,
              totalKm,
              etaMinutes: s.rider ? s.etaMinutes : durationMin,
              remainingKm: s.rider ? s.remainingKm : totalKm,
            },
          };
        }),
      updateDrop: (orderId, drop) =>
        commit((prev) => {
          const s = prev[orderId];
          if (!s) return prev;
          return { ...prev, [orderId]: { ...s, drop, updatedAt: Date.now() } };
        }),
      updatePickup: (orderId, pickup) =>
        commit((prev) => {
          const s = prev[orderId];
          if (!s) return prev;
          return { ...prev, [orderId]: { ...s, pickup, updatedAt: Date.now() } };
        }),
    };
  }, [store, commit]);

  return (
    <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>
  );
}

export function useTracking(): TrackingContextValue {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error("useTracking must be used within TrackingProvider");
  return ctx;
}

// Subscribe to a single session (re-renders when it changes).
export function useTrackSession(orderId: string): TrackSession | undefined {
  const { getSession } = useTracking();
  return getSession(orderId);
}
