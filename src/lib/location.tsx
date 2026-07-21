// Customer-side location / serviceability gate.
// Mirrors the pattern used by tracking.tsx: client-only state hydrated after
// mount, persisted to localStorage. No backend yet — serviceability is
// computed against the mock shop coordinates in data.ts.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CITY_CENTER, geocodeSeed, haversineKm, type LatLng } from "./geo";
import { shops } from "./data";

const SERVICE_RADIUS_KM = 5;
const KEY = "nearcart-location";

export type LocationStatus = "unset" | "serviceable" | "unserviceable";

export type LocationState = {
  status: LocationStatus;
  coords: LatLng | null;
  label: string;
};

const EMPTY_STATE: LocationState = { status: "unset", coords: null, label: "" };

function load(): LocationState {
  try {
    if (typeof window === "undefined") return EMPTY_STATE;
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    return JSON.parse(raw) as LocationState;
  } catch {
    return EMPTY_STATE;
  }
}

function persist(state: LocationState): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore — quota exceeded or private browsing */
  }
}

export function nearestShopKm(coords: LatLng): number {
  return Math.min(...shops.map((s) => haversineKm(coords, { lat: s.lat, lng: s.lng })));
}

export function checkServiceable(coords: LatLng): boolean {
  return nearestShopKm(coords) <= SERVICE_RADIUS_KM;
}

/** Every area a live shop is in — offered as one-tap picks in the manual search. */
export function knownAreas(): string[] {
  return Array.from(new Set(shops.map((s) => s.area)));
}

/**
 * Deterministic mock geocode for the manual area/pincode search (no real
 * geocoding API yet). A known shop area resolves to that area's real
 * coordinates. Anything unrecognized is pushed well outside the service
 * radius, so the "not serviceable yet" path is reachable in the demo without
 * needing a real out-of-town address.
 */
export function geocodeArea(query: string): LatLng {
  const q = query.trim().toLowerCase();
  const match = shops.find((s) => s.area.toLowerCase() === q);
  if (match) return { lat: match.lat, lng: match.lng };

  const seed = geocodeSeed(q);
  return {
    lat: seed.lat + (seed.lat >= CITY_CENTER.lat ? 1 : -1) * 0.5,
    lng: seed.lng + (seed.lng >= CITY_CENTER.lng ? 1 : -1) * 0.5,
  };
}

type LocationContextValue = {
  state: LocationState;
  setLocation: (coords: LatLng, label: string) => void;
  reset: () => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocationState>(EMPTY_STATE);

  useEffect(() => {
    setState(load());
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      state,
      setLocation: (coords, label) => {
        const next: LocationState = {
          status: checkServiceable(coords) ? "serviceable" : "unserviceable",
          coords,
          label,
        };
        setState(next);
        persist(next);
      },
      reset: () => {
        setState(EMPTY_STATE);
        persist(EMPTY_STATE);
      },
    }),
    [state],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
