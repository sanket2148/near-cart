// Geo helpers for NearCart live tracking (mock, client-side).
// Deterministic pseudo-geocoding around Koramangala, Bengaluru so every
// address/shop maps to a stable point without calling a geocoding API.

export type LatLng = { lat: number; lng: number };

// Koramangala, Bengaluru — the demo service area.
export const CITY_CENTER: LatLng = { lat: 12.9352, lng: 77.6245 };

function hashString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Stable point within ~2.2km of the city center for a given string.
export function geocodeSeed(seed: string): LatLng {
  const h = hashString(seed || "nearcart");
  const a = (h % 1000) / 1000 - 0.5;
  const b = (Math.floor(h / 1000) % 1000) / 1000 - 0.5;
  return {
    lat: CITY_CENTER.lat + a * 0.04,
    lng: CITY_CENTER.lng + b * 0.04,
  };
}

const R = 6371; // earth radius km
function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// ETA in minutes for a distance, assuming a city scooter speed.
export function etaFromKm(km: number, speedKmh = 20): number {
  return Math.max(1, Math.round((km / speedKmh) * 60));
}

// Linear interpolation between two points (t in 0..1).
export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

export function roundCoord(p: LatLng): LatLng {
  return { lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 };
}
