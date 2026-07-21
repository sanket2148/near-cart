// Location picker as a dismissible modal, not a full-screen gate — matches
// how Blinkit/Zepto-style quick-commerce apps handle this: you can always
// browse (getNearbyShops already degrades gracefully to "all active shops,
// unsorted by distance" when no coords are set), location is something you
// set via a lightweight prompt whenever you want, not a hard wall before
// seeing anything. See plan/tasks/backlog.md's UI/UX audit findings.
import { useState } from "react";
import { MapPin, Loader2, Search, ArrowLeft, Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLocation, knownAreas, geocodeArea } from "@/lib/location";
import { reverseGeocode } from "@/lib/maps";
import { LocationPinMap } from "@/components/LocationPinMap";
import type { LatLng } from "@/lib/geo";

type View = "prompt" | "requesting" | "confirm" | "manual" | "waitlist";

export function LocationModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, setLocation, dismiss } = useLocation();
  const [view, setView] = useState<View>(state.status === "unserviceable" ? "waitlist" : "prompt");
  const [query, setQuery] = useState("");
  const [gpsFailed, setGpsFailed] = useState(false);
  const [checkingManual, setCheckingManual] = useState(false);
  // Raw GPS fix, shown on the confirm-map step and updated as the user drags
  // the pin — see LocationPinMap.tsx's header comment for why this step
  // exists (raw GPS is typically only accurate to 5-20m, not precise enough
  // to identify the right gate/entrance; real quick-commerce apps always
  // have the user confirm/adjust before geocoding the final position).
  const [pendingCoords, setPendingCoords] = useState<LatLng | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function resolve(coords: { lat: number; lng: number }, label: string) {
    // setLocation now does a real server-side serviceability check (against
    // the real Supabase shops table) and resolves with the outcome, so the
    // view decision below waits on the same round-trip rather than
    // re-deriving it locally. The "requesting"/spinner view (set by callers
    // before invoking resolve) stays up for this whole await.
    const status = await setLocation(coords, label);
    if (status === "serviceable") {
      onOpenChange(false);
      setView("prompt");
    } else {
      setView("waitlist");
    }
  }

  function requestGPS() {
    setView("requesting");
    setGpsFailed(false);
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsFailed(true);
      setView("manual");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Land on the confirm-map step with the raw fix, rather than
        // resolving immediately — see pendingCoords' doc comment above.
        setPendingCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setView("confirm");
      },
      () => {
        setGpsFailed(true);
        setView("manual");
      },
      // enableHighAccuracy trades battery/speed for a real GPS fix instead
      // of network/cell-tower positioning — worth it here since this is a
      // one-time "set my location" request, not continuous tracking.
      { timeout: 8000, enableHighAccuracy: true },
    );
  }

  async function confirmLocation() {
    if (!pendingCoords || confirming) return;
    setConfirming(true);
    try {
      // Reverse-geocode the FINAL (possibly user-dragged) position, not the
      // original raw GPS fix — best-effort: falls back to the generic label
      // if geocoding fails for any reason (no Maps key,
      // RefererNotAllowedMapError, no results, offline, ...), since the
      // location itself is still perfectly usable either way.
      const label =
        (await reverseGeocode(pendingCoords.lat, pendingCoords.lng)) ?? "Current location";
      await resolve(pendingCoords, label);
    } finally {
      setConfirming(false);
    }
  }

  async function submitManual(area: string) {
    const trimmed = area.trim();
    if (!trimmed || checkingManual) return;
    setCheckingManual(true);
    try {
      await resolve(geocodeArea(trimmed), trimmed);
    } finally {
      setCheckingManual(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setView(state.status === "unserviceable" ? "waitlist" : "prompt");
          setPendingCoords(null);
        }
      }}
    >
      <DialogContent className="max-w-sm text-center sm:text-center">
        <DialogTitle className="sr-only">Set your delivery location</DialogTitle>

        {view === "waitlist" ? (
          <WaitlistView label={state.label} onTryAnother={() => setView("prompt")} />
        ) : view === "confirm" && pendingCoords ? (
          <div className="text-left">
            <button
              type="button"
              onClick={() => {
                setPendingCoords(null);
                setView("prompt");
              }}
              className="mb-4 flex items-center gap-1 text-sm text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h2 className="text-lg font-bold">Is this the right spot?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag the pin to your exact gate or entrance — GPS alone can be off by a building or
              two.
            </p>
            <LocationPinMap
              center={pendingCoords}
              onChange={setPendingCoords}
              className="mt-3 h-56 w-full rounded-2xl"
            />
            <Button
              variant="hero"
              size="lg"
              className="mt-4 w-full"
              disabled={confirming}
              onClick={confirmLocation}
            >
              {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm this location
            </Button>
          </div>
        ) : view !== "manual" ? (
          <div className="flex flex-col items-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-2xl shadow-card">
              📍
            </span>
            <h2 className="mt-4 text-lg font-bold">See what's near you</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We show shops that actually deliver to your address — share your location, or skip
              this for now and browse everything.
            </p>
            <Button
              variant="hero"
              size="lg"
              className="mt-5 w-full"
              disabled={view === "requesting"}
              onClick={requestGPS}
            >
              {view === "requesting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              Enable location
            </Button>
            <button
              type="button"
              onClick={() => setView("manual")}
              className="mt-3 text-sm font-semibold text-primary hover:underline"
            >
              Enter my area manually
            </button>
            {gpsFailed && (
              <p className="mt-3 text-xs text-destructive">
                Couldn't get your location — enter your area or pincode instead.
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                dismiss();
                onOpenChange(false);
              }}
              className="mt-4 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Maybe later — just let me browse
            </button>
          </div>
        ) : (
          <div className="text-left">
            <button
              type="button"
              onClick={() => setView("prompt")}
              className="mb-4 flex items-center gap-1 text-sm text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h2 className="text-lg font-bold">Where should we deliver?</h2>

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-card">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitManual(query)}
                placeholder="Enter area or pincode"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Button
              variant="hero"
              size="lg"
              className="mt-3 w-full"
              disabled={!query.trim() || checkingManual}
              onClick={() => submitManual(query)}
            >
              {checkingManual && <Loader2 className="h-4 w-4 animate-spin" />}
              Check availability
            </Button>

            <p className="mt-5 text-xs font-semibold text-muted-foreground">
              Or pick a nearby area
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {knownAreas().map((area) => (
                <button
                  key={area}
                  type="button"
                  disabled={checkingManual}
                  onClick={() => submitManual(area)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WaitlistView({ label, onTryAnother }: { label: string; onTryAnother: () => void }) {
  const [notify, setNotify] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    if (!notify.trim()) return;
    try {
      localStorage.setItem(
        "nearcart-waitlist",
        JSON.stringify({ contact: notify.trim(), at: Date.now() }),
      );
    } catch {
      /* ignore */
    }
    setSubmitted(true);
  }

  return (
    <div className="flex flex-col items-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-2xl">
        🗺️
      </span>
      <h2 className="mt-4 text-lg font-bold">We're not in {label || "your area"} yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        NearCart is currently live only in a few Bengaluru neighborhoods. You can still browse —
        leave your contact and we'll let you know the moment we launch near you.
      </p>

      {submitted ? (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> You're on the list — thanks!
        </div>
      ) : (
        <div className="mt-5 w-full">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-card">
            <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={notify}
              onChange={(e) => setNotify(e.target.value)}
              placeholder="Phone or email"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Button
            variant="hero"
            size="lg"
            className="mt-3 w-full"
            disabled={!notify.trim()}
            onClick={submit}
          >
            Notify me
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={onTryAnother}
        className="mt-5 text-sm font-semibold text-primary hover:underline"
      >
        Try a different location
      </button>
    </div>
  );
}
