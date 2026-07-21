// Customer-side location / serviceability gate.
// Mirrors the pattern used by tracking.tsx: client-only state hydrated after
// mount, persisted to localStorage. Serviceability itself is checked against
// the real Supabase shops table (catalog/api.functions.ts's
// checkServiceability, a real server round-trip) — it used to check a
// hardcoded mock shop list in data.ts, which only worked by coincidence
// whenever that list's coordinates happened to match the real catalog's, and
// silently drifted wrong as real shops were added with their own real
// coordinates. geocodeArea/knownAreas below are still mock — there's no real
// geocoding API integrated yet, so typing a free-text area still resolves to
// a deterministic fake coordinate, not a real address lookup.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CITY_CENTER, geocodeSeed, type LatLng } from "./geo";
import { shops } from "./data";
import { checkServiceability } from "./catalog/api.functions";

const KEY = "nearcart-location";

export type LocationStatus = "unset" | "serviceable" | "unserviceable";

export type LocationState = {
  status: LocationStatus;
  coords: LatLng | null;
  label: string;
  /** Epoch ms of the last "Maybe later" dismissal, if any — lets the
   * auto-prompt (AppShell) ask once and then stay quiet on later page
   * navigations, instead of reopening every time status stays "unset". A
   * still-unset location is asked for again explicitly at checkout, where
   * it's actually needed — see checkout.tsx. */
  dismissedAt: number | null;
};

const EMPTY_STATE: LocationState = { status: "unset", coords: null, label: "", dismissedAt: null };

function load(): LocationState {
  try {
    if (typeof window === "undefined") return EMPTY_STATE;
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    // `?? null` covers state persisted before dismissedAt existed.
    const parsed = JSON.parse(raw) as LocationState;
    return { ...parsed, dismissedAt: parsed.dismissedAt ?? null };
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
  /** False until the initial localStorage read (useEffect below) has run.
   * On a fresh full-page load, effects fire child-before-parent, so a
   * consumer like AppShell can render/effect BEFORE this provider has
   * hydrated — reading `state` at that instant always sees EMPTY_STATE
   * ("unset", dismissedAt: null) regardless of what's actually persisted.
   * Consumers that auto-open the location prompt based on `state` must wait
   * for isHydrated, or they'll briefly show it on every hard reload even
   * when the user already answered (dismissed or set a real location). */
  isHydrated: boolean;
  /** Resolves to the real status once the server-side serviceability check
   * (against the real Supabase shops table) completes — callers that need
   * to branch on the result (e.g. LocationModal deciding whether to close
   * or show the waitlist) should await this rather than re-deriving it. */
  setLocation: (coords: LatLng, label: string) => Promise<LocationStatus>;
  /** Records a "Maybe later" — status stays "unset", but the auto-prompt
   * (AppShell) won't reopen on its own until checkout explicitly re-asks. */
  dismiss: () => void;
  reset: () => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocationState>(EMPTY_STATE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setState(load());
    setIsHydrated(true);
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      state,
      isHydrated,
      setLocation: async (coords, label) => {
        const result = await checkServiceability({ data: { lat: coords.lat, lng: coords.lng } });
        const status: LocationStatus = result.serviceable ? "serviceable" : "unserviceable";
        const next: LocationState = { status, coords, label, dismissedAt: null };
        setState(next);
        persist(next);
        return status;
      },
      dismiss: () => {
        const next: LocationState = { ...state, dismissedAt: Date.now() };
        setState(next);
        persist(next);
      },
      reset: () => {
        setState(EMPTY_STATE);
        persist(EMPTY_STATE);
      },
    }),
    [state, isHydrated],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
