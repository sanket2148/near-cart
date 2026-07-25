import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  searchUnclaimedShops,
  claimShop,
  type ShopProfile,
  type UnclaimedShop,
} from "@/lib/seller";
import { BUSINESS_TYPE_CONFIG, type BusinessType } from "@/lib/verification";

type Props = {
  onClaimed: (shop: ShopProfile) => void;
  onSwitchToCreate: () => void;
};

export function ClaimShopStep({ onClaimed, onSwitchToCreate }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnclaimedShop[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<UnclaimedShop | null>(null);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [claiming, setClaiming] = useState(false);

  // Simple debounce — this search box has no other consumer, not worth a
  // shared hook for one call site.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchUnclaimedShops(query.trim()));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [query]);

  async function submitClaim() {
    if (!selected || !businessType) return;
    setClaiming(true);
    try {
      const shop = await claimShop(selected.id, businessType);
      onClaimed(shop);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not claim this shop. Please try again.",
      );
    } finally {
      setClaiming(false);
    }
  }

  if (selected) {
    const types = Object.entries(BUSINESS_TYPE_CONFIG) as [
      BusinessType,
      (typeof BUSINESS_TYPE_CONFIG)[BusinessType],
    ][];
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md space-y-5">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to search
          </button>

          <div className="text-center">
            <h1 className="text-xl font-extrabold">{selected.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.addressLine}, {selected.city}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>What kind of business is this?</Label>
            <p className="text-xs text-muted-foreground">
              We found this listing publicly — confirm the category so customers can find you
              correctly.
            </p>
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

          <Button
            variant="hero"
            size="xl"
            className="w-full"
            disabled={!businessType || claiming}
            onClick={submitClaim}
          >
            {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim this shop"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-extrabold">Is your shop already listed?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search for it below — claiming it skips re-entering details we already have.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by shop name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {searching && (
          <div className="flex justify-center py-4 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No listings found for "{query.trim()}".
          </p>
        )}

        {results.length > 0 && (
          <ul className="space-y-2">
            {results.map((shop) => (
              <li key={shop.id}>
                <button
                  type="button"
                  onClick={() => setSelected(shop)}
                  className="flex w-full items-start gap-2 rounded-xl border border-border bg-card p-3 text-left shadow-card hover:border-primary/40"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-bold">{shop.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {shop.addressLine}, {shop.city}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button variant="ghost" className="w-full" onClick={onSwitchToCreate}>
          Can't find your shop? Create a new one
        </Button>
      </div>
    </div>
  );
}
