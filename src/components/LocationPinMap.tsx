// Draggable-pin map for the "confirm your exact location" step in
// LocationModal.tsx. Raw GPS (or a manually-entered area) is typically only
// accurate to 5-20m — real quick-commerce apps (Blinkit/Zepto/Swiggy
// Instamart) never trust that alone; they show the rough fix on a map and
// have the user drag the pin onto the actual gate/entrance before geocoding
// that final position. Same loadGoogleMaps()/onMapsAuthFailure() pattern as
// DeliveryMap.tsx, but a single draggable marker instead of a live route.
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, onMapsAuthFailure } from "@/lib/maps";
import { Loader2, MapPinned } from "lucide-react";
import type { LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";

type Props = {
  center: LatLng;
  onChange: (coords: LatLng) => void;
  className?: string;
};

export function LocationPinMap({ center, onChange, className }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Init map + draggable marker once. Deliberately not re-run when `center`
  // changes later — see the second effect, which repositions in place
  // instead, so a parent re-render (e.g. from a fresh GPS read) doesn't
  // fight the user mid-drag by tearing down and rebuilding the map.
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onMapsAuthFailure(() => {
      if (!cancelled) setStatus("error");
    });
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !divRef.current) return;
        const maps = google.maps;
        const map = new maps.Map(divRef.current, {
          center,
          zoom: 17, // close enough to actually distinguish a building/gate, unlike DeliveryMap's overview zoom
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });
        mapRef.current = map;

        const marker = new maps.Marker({
          position: center,
          map,
          draggable: true,
          title: "Drag to your exact location",
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: "#ea580c",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          onChangeRef.current({ lat: pos.lat(), lng: pos.lng() });
        });
        markerRef.current = marker;

        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If `center` changes for a reason OTHER than this component's own drag
  // callback (e.g. the parent re-requests GPS), resync the marker/map —
  // but only when it's a real jump, not the echo of our own last dragend.
  const lastReported = useRef(center);
  useEffect(() => {
    if (status !== "ready") return;
    if (center.lat === lastReported.current.lat && center.lng === lastReported.current.lng) return;
    lastReported.current = center;
    markerRef.current?.setPosition(center);
    mapRef.current?.panTo(center);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, center.lat, center.lng]);

  return (
    // `relative` is load-bearing for the status overlay below (`absolute
    // inset-0`) and deliberately not overridable via `className` — a caller
    // passing their own sizing/spacing classes without remembering to
    // include `relative` would let that overlay escape its container and
    // intercept clicks well outside the map (confirmed live: it swallowed
    // the "Confirm this location" button in LocationModal.tsx before this
    // was split out).
    <div className={cn("relative overflow-hidden", className ?? "h-56 w-full rounded-2xl")}>
      <div ref={divRef} className="h-full w-full" />
      {status !== "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
          {status === "loading" ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs font-medium">Loading map…</span>
            </>
          ) : (
            <>
              <MapPinned className="h-6 w-6" />
              <span className="px-6 text-center text-xs font-medium">
                Map couldn't load — using your GPS location as-is.
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
