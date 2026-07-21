// Singleton loader for the Google Maps JavaScript API (browser key).
// Uses the Lovable managed Google Maps connector browser key + tracking channel.

// We avoid pulling in @types/google.maps; the maps namespace is treated as any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleMaps = { maps: any };

let loader: Promise<GoogleMaps> | null = null;

// Google Maps invokes window.gm_authFailure when the API key / referrer is
// rejected (e.g. RefererNotAllowedMapError). This happens AFTER the script
// loads, so the loader promise still resolves and Google renders its own gray
// error card into the map div. We surface it to subscribers so components can
// show a clean, on-brand fallback instead.
const authFailureListeners = new Set<() => void>();

export function onMapsAuthFailure(cb: () => void): () => void {
  authFailureListeners.add(cb);
  return () => authFailureListeners.delete(cb);
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).gm_authFailure = () => {
    authFailureListeners.forEach((cb) => cb());
  };
}

export function loadGoogleMaps(): Promise<GoogleMaps> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  const w = window as unknown as { google?: GoogleMaps };
  if (w.google?.maps) return Promise.resolve(w.google);
  if (loader) return loader;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

  if (!key) {
    return Promise.reject(new Error("Google Maps browser key is not configured"));
  }

  loader = new Promise((resolve, reject) => {
    const cbName = "__nearcartInitMaps";
    (window as unknown as Record<string, unknown>)[cbName] = () => {
      resolve((window as unknown as { google: GoogleMaps }).google);
    };
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key,
      loading: "async",
      callback: cbName,
      libraries: "geometry",
    });
    if (channel) params.set("channel", channel);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loader = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return loader;
}

const GEOCODE_TIMEOUT_MS = 5000;

/**
 * Reverse-geocodes real GPS coordinates into a short, human-readable label
 * (roughly "neighborhood, city") via the Google Maps Geocoder — the same
 * loaded API DeliveryMap.tsx already uses, not a new integration. Returns
 * null on any failure (no key configured, no results, network error, ...) or
 * timeout so callers can fall back to a plain label instead of breaking the
 * location flow — reverse geocoding is a nicety here, not something the app
 * depends on. The explicit timeout matters: confirmed live that under
 * RefererNotAllowedMapError the JS API script still loads (so
 * loadGoogleMaps() resolves, same as DeliveryMap.tsx already accounts for)
 * but geocoder.geocode()'s callback never fires at all — no "OK", no error
 * status, nothing — so without a timeout this hangs forever and blocks the
 * entire location flow, not just this enhancement.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const google = await loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geocodeCall = new Promise<any>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      geocoder.geocode({ location: { lat, lng } }, (results: any[] | null, status: string) => {
        if (status === "OK" && results && results[0]) resolve(results[0]);
        else reject(new Error(status));
      });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("geocode timed out")), GEOCODE_TIMEOUT_MS);
      geocodeCall.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const components = (result.address_components ?? []) as any[];
    const find = (type: string) => components.find((c) => c.types?.includes(type))?.long_name;
    const neighborhood = find("sublocality_level_1") ?? find("neighborhood") ?? find("sublocality");
    const city = find("locality") ?? find("administrative_area_level_2");
    const short = [neighborhood, city].filter(Boolean).join(", ");
    if (short) return short;

    // Fall back to the first couple of comma-separated segments of the full
    // formatted address (usually street + area) rather than the whole
    // string, which tends to be long enough to always get truncated in the
    // header's fixed-width label.
    const formatted = result.formatted_address as string | undefined;
    if (formatted) return formatted.split(",").slice(0, 2).join(",").trim();

    return null;
  } catch {
    return null;
  }
}
