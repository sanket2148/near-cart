import {
  Shield,
  ShieldCheck,
  ShieldPlus,
  Award,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BadgeTier } from "@/lib/verification";
import { BADGE_CONFIG } from "@/lib/verification";

type VerificationBadgeProps = {
  tier: BadgeTier;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showNone?: boolean;
  className?: string;
};

const TIER_ICONS: Record<BadgeTier, LucideIcon> = {
  none: Shield,
  basic: ShieldCheck,
  verified: ShieldCheck,
  premium: ShieldPlus,
  trusted: Award,
};

const SIZE_CONFIG = {
  sm: { icon: "h-3.5 w-3.5", text: "text-[11px]", px: "px-2 py-0.5", gap: "gap-1" },
  md: { icon: "h-4 w-4", text: "text-xs", px: "px-2.5 py-1", gap: "gap-1.5" },
  lg: { icon: "h-5 w-5", text: "text-sm", px: "px-3 py-1.5", gap: "gap-1.5" },
};

const TIER_STYLES: Record<BadgeTier, string> = {
  none: "text-muted-foreground bg-muted border-border",
  basic: "text-emerald-600 bg-emerald-50 border-emerald-200",
  verified: "text-amber-600 bg-amber-50 border-amber-200",
  premium: "text-blue-600 bg-blue-50 border-blue-200",
  trusted:
    "text-amber-500 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300",
};

export function VerificationBadge({
  tier,
  size = "md",
  showLabel = true,
  showNone = false,
  className,
}: VerificationBadgeProps) {
  if (tier === "none" && !showNone) return null;

  const config = BADGE_CONFIG[tier];
  const Icon = TIER_ICONS[tier];
  const sizeConf = SIZE_CONFIG[size];
  const isTrusted = tier === "trusted";

  const badge = (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold",
        sizeConf.px,
        sizeConf.gap,
        TIER_STYLES[tier],
        isTrusted && "animate-trusted-glow",
        className,
      )}
    >
      <Icon
        className={cn(
          sizeConf.icon,
          tier === "verified" && "fill-current",
        )}
      />
      {showLabel && (
        <span className={sizeConf.text}>{config.label}</span>
      )}

      {/* Shimmer overlay for trusted tier */}
      {isTrusted && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
        >
          <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </span>
      )}
    </span>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("relative inline-flex", isTrusted && "relative")}>
            {badge}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
