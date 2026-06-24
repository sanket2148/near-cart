// Singleton loader for the Google Maps JavaScript API (browser key).
// Uses the Lovable managed Google Maps connector browser key + tracking channel.

// We avoid pulling in @types/google.maps; the maps namespace is treated as any.
type GoogleMaps = { maps: any };

let loader: Promise<GoogleMaps> | null = null;

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
