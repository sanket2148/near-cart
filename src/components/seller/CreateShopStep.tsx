import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createShop, type ShopProfile } from "@/lib/seller";
import { BUSINESS_TYPE_CONFIG, type BusinessType } from "@/lib/verification";
import { knownAreas } from "@/lib/location";

type Props = {
  onCreated: (shop: ShopProfile) => void;
};

export function CreateShopStep({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [area, setArea] = useState("");
  const [tagline, setTagline] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 1 && businessType !== null && area.trim().length > 1;

  async function submit() {
    if (!canSubmit || !businessType) return;
    setSubmitting(true);
    try {
      const shop = await createShop({
        name: name.trim(),
        businessType,
        area: area.trim(),
        tagline: tagline.trim() || undefined,
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
