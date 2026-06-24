// Geolocation hook for capturing the delivery partner's live GPS position.
// Handles permission states and falls back gracefully when unavailable.
import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";

export type GeoPermission = "idle" | "prompt" | "granted" | "denied" | "unsupported";

export type LiveLocation = {
  position: LatLng | null;
  accuracy: number | null;
  permission: GeoPermission;
  error: string | null;
  watching: boolean;
  start: () => void;
  stop: () => void;
};

export function useLiveLocation(
  onUpdate?: (pos: LatLng) => void,
): LiveLocation {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [permission, setPermission] = useState<GeoPermission>("idle");
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const watchId = useRef<number | null>(null);
  const cb = useRef(onUpdate);
  cb.current = onUpdate;

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("unsupported");
    }
  }, []);

  const stop = useCallback(() => {
    if (watchId.current !== null && navigator?.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setWatching(false);
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("unsupported");
      setError("Location is not supported on this device.");
      return;
    }
    setPermission("prompt");
    setError(null);
    setWatching(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next: LatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setPermission("granted");
        setPosition(next);
        setAccuracy(pos.coords.accuracy);
        cb.current?.(next);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission("denied");
          setError("Location permission denied. Enable it to share your live position.");
        } else {
          setError(err.message || "Unable to get your location.");
        }
        setWatching(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { position, accuracy, permission, error, watching, start, stop };
}
