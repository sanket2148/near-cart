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
import { useLocation, knownAreas, geocodeArea, checkServiceable } from "@/lib/location";

type View = "prompt" | "requesting" | "manual" | "waitlist";

export function LocationModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, setLocation } = useLocation();
  const [view, setView] = useState<View>(state.status === "unserviceable" ? "waitlist" : "prompt");
  const [query, setQuery] = useState("");
  const [gpsFailed, setGpsFailed] = useState(false);

  function resolve(coords: { lat: number; lng: number }, label: string) {
    setLocation(coords, label);
    // setLocation triggers a re-render on the next tick, but we need to know
    // right now whether to close (serviceable) or show the waitlist view —
    // checkServiceable is the same pure check useLocation applies internally.
    if (checkServiceable(coords)) {
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
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "Current location"),
      () => {
        setGpsFailed(true);
        setView("manual");
      },
      { timeout: 8000 },
    );
  }

  function submitManual(area: string) {
    const trimmed = area.trim();
    if (!trimmed) return;
    resolve(geocodeArea(trimmed), trimmed);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setView(state.status === "unserviceable" ? "waitlist" : "prompt");
      }}
    >
      <DialogContent className="max-w-sm text-center sm:text-center">
        <DialogTitle className="sr-only">Set your delivery location</DialogTitle>

        {view === "waitlist" ? (
          <WaitlistView label={state.label} onTryAnother={() => setView("prompt")} />
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
              onClick={() => onOpenChange(false)}
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
              disabled={!query.trim()}
              onClick={() => submitManual(query)}
            >
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
                  onClick={() => submitManual(area)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40 hover:bg-primary/5"
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
