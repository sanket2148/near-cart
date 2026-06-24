// Singleton loader for the Google Maps JavaScript API (browser key).
// Uses the Lovable managed Google Maps connector browser key + tracking channel.

let loader: Promise<typeof globalThis.google> | null = null;

declare global {
  // eslint-disable-next-line no-var
  var google: typeof globalThis.google;
}

export function loadGoogleMaps(): Promise<typeof globalThis.google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  const w = window as unknown as { google?: typeof globalThis.google };
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
      resolve((window as unknown as { google: typeof globalThis.google }).google);
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
