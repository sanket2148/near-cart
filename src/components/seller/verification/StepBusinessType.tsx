import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BUSINESS_TYPE_CONFIG, type BusinessType, type ShopVerification } from "@/lib/verification";

type Props = {
  verification: ShopVerification;
  onSelect: (type: BusinessType) => void;
  onComplete: () => void;
};

export function StepBusinessType({ verification, onSelect, onComplete }: Props) {
  const selected = verification.businessType;

  const types = Object.entries(BUSINESS_TYPE_CONFIG) as [BusinessType, typeof BUSINESS_TYPE_CONFIG[BusinessType]][];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold">What type of business?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This determines what documents we'll need for verification.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {types.map(([key, config]) => {
          const isSelected = selected === key;
          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelect(key)}
              className={cn(
                "group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all",
                isSelected
                  ? "border-primary bg-primary/5 shadow-float"
                  : "border-border bg-card shadow-card hover:border-primary/40 hover:shadow-md",
              )}
            >
              {isSelected && (
                <span className="absolute right-2 top-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </span>
              )}
              <span className="text-3xl">{config.emoji}</span>
              <span className="text-sm font-bold leading-tight">{config.label}</span>
              <span className="text-[11px] leading-snug text-muted-foreground">{config.description}</span>
              {config.riskTier === "high" && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                  Extra docs required
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <span className="text-lg">{BUSINESS_TYPE_CONFIG[selected].emoji}</span>
            {BUSINESS_TYPE_CONFIG[selected].label}
          </h3>
          <div className="mt-2 space-y-1">
            {BUSINESS_TYPE_CONFIG[selected].requiredDocs.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Required: </span>
                {BUSINESS_TYPE_CONFIG[selected].requiredDocs
                  .map((d) => d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
                  .join(", ")}
              </p>
            )}
            {BUSINESS_TYPE_CONFIG[selected].optionalDocs.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Optional: </span>
                {BUSINESS_TYPE_CONFIG[selected].optionalDocs
                  .map((d) => d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
                  .join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      <Button
        variant="hero"
        size="xl"
        className="w-full"
        disabled={!selected}
        onClick={onComplete}
      >
        Continue <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
