import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, MapPin, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  createShop,
  searchUnclaimedShops,
  findPossibleShopMatches,
  type ShopProfile,
  type UnclaimedShop,
} from "@/lib/seller";
import { BUSINESS_TYPE_CONFIG, type BusinessType } from "@/lib/verification";
import { knownAreas } from "@/lib/location";
import { reverseGeocode } from "@/lib/maps";
import { LocationPinMap } from "@/components/LocationPinMap";
import type { LatLng } from "@/lib/geo";

type Props = {
  onCreated: (shop: ShopProfile) => void;
  /** Present only when there's somewhere to switch to — mirrors ClaimShopStep's onSwitchToCreate. */
  onSwitchToClaim?: () => void;
};

type PinStatus = "idle" | "requesting" | "ready" | "denied";

export function CreateShopStep({ onCreated, onSwitchToClaim }: Props) {
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [area, setArea] = useState("");
  const [tagline, setTagline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [possibleMatches, setPossibleMatches] = useState<UnclaimedShop[]>([]);
  // Real GPS pin for the shop's own location — see backend.server.ts's
  // createShop for why this is required, not optional: every new shop used
  // to land at one hardcoded point, silently breaking the real PostGIS
  // proximity search once it shipped.
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [pinStatus, setPinStatus] = useState<PinStatus>("idle");

  function requestPin() {
    setPinStatus("requesting");
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPinStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(point);
        setPinStatus("ready");
        if (!area.trim()) {
          reverseGeocode(point.lat, point.lng).then((label) => {
            if (label) setArea((current) => (current.trim() ? current : label));
          });
        }
      },
      () => setPinStatus("denied"),
      { timeout: 8000, enableHighAccuracy: true },
    );
  }

  // Soft, non-blocking duplicate check — a merchant typing a name that's
  // already an unclaimed listing (most likely one of the OSM-imported ones)
  // should be nudged toward claiming it instead of creating a second, real
  // duplicate shop. Never blocks submission — chain/franchise names can
  // legitimately collide. See plan/tasks/decisions.md. Before a location is
  // pinned this is name-only (searchUnclaimedShops); once `coords` exists,
  // upgrade to the combined name+proximity check (findPossibleShopMatches,
  // 2026-07-24) — a real coordinate makes location the stronger signal.
  useEffect(() => {
    if (name.trim().length < 3) {
      setPossibleMatches([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const matches = coords
          ? await findPossibleShopMatches(name.trim(), coords.lat, coords.lng)
          : await searchUnclaimedShops(name.trim());
        setPossibleMatches(matches);
      } catch {
        setPossibleMatches([]);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [name, coords]);

  const canSubmit =
    name.trim().length > 1 && businessType !== null && area.trim().length > 1 && coords !== null;

  async function submit() {
    if (!canSubmit || !businessType || !coords) return;
    setSubmitting(true);
    try {
      const shop = await createShop({
        name: name.trim(),
        businessType,
        area: area.trim(),
        tagline: tagline.trim() || undefined,
        lat: coords.lat,
        lng: coords.lng,
      });
      onCreated(shop);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create shop. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const types = Object.entries(BUSINESS_TYPE_CONFIG) as [
    BusinessType,
    (typeof BUSINESS_TYPE_CONFIG)[BusinessType],
  ][];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-extrabold">Set up your shop</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us about your business — you'll verify documents next.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="shop-name">Shop name</Label>
          <Input
            id="shop-name"
            placeholder="e.g. Ramesh General Stores"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {possibleMatches.length > 0 && onSwitchToClaim && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold text-primary">
              Found {possibleMatches.length} existing listing
              {possibleMatches.length > 1 ? "s" : ""} that might be your shop
            </p>
            <ul className="space-y-1.5">
              {possibleMatches.slice(0, 3).map((m) => (
                <li key={m.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  <span>
                    <span className="font-semibold text-foreground">{m.name}</span> —{" "}
                    {m.addressLine}, {m.city}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onSwitchToClaim}
              className="text-xs font-semibold text-primary underline underline-offset-2"
            >
              Claim one of these instead →
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Business type</Label>
          <div className="grid grid-cols-2 gap-2">
            {types.map(([key, config]) => {
              const isSelected = businessType === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setBusinessType(key)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-float"
                      : "border-border bg-card shadow-card hover:border-primary/40",
                  )}
                >
                  {isSelected && (
                    <span className="absolute right-1.5 top-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    </span>
                  )}
                  <span className="text-xl">{config.emoji}</span>
                  <span className="text-xs font-bold leading-tight">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="shop-area">Area</Label>
          <Input
            id="shop-area"
            list="known-areas"
            placeholder="e.g. Koramangala"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
          <datalist id="known-areas">
            {knownAreas().map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>

        <div className="space-y-1.5">
          <Label>Shop location</Label>
          {coords ? (
            <div className="space-y-2">
              <LocationPinMap
                center={coords}
                onChange={setCoords}
                className="h-40 w-full rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Drag the pin if it's not quite right — customers nearby find you by this exact spot.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={requestPin}
              disabled={pinStatus === "requesting"}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card p-3 text-sm font-semibold text-primary hover:border-primary/40 disabled:opacity-60"
            >
              {pinStatus === "requesting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPinned className="h-4 w-4" />
              )}
              Pin my shop's location
            </button>
          )}
          {pinStatus === "denied" && (
            <p className="text-xs text-destructive">
              Couldn't get your location — check your browser's location permission and try again.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="shop-tagline">Tagline (optional)</Label>
          <Input
            id="shop-tagline"
            placeholder="e.g. 30 years of trusted kirana"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>

        <Button
          variant="hero"
          size="xl"
          className="w-full"
          disabled={!canSubmit || submitting}
          onClick={submit}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Create shop <ArrowRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
