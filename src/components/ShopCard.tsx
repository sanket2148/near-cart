import { Link } from "@tanstack/react-router";
import { Star, Clock, Bike } from "lucide-react";
import type { Shop } from "@/lib/data";
import { formatINR } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

import { VerificationBadge } from "@/components/VerificationBadge";

export function ShopCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center gap-3 p-3">
        <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="border-t border-dashed border-border px-3 py-2">
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Link
      to="/shop/$shopId"
      params={{ shopId: shop.id }}
      className={cn(
        "group block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:shadow-float",
        !shop.isOpen && "opacity-70",
      )}
    >
      <div className="flex items-center gap-3 p-3">
        {shop.logoUrl ? (
          <img
            src={shop.logoUrl}
            alt={shop.name}
            className="h-16 w-16 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-hero text-3xl">
            {shop.emoji}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="truncate font-bold leading-tight">{shop.name}</h3>
              {shop.badgeTier && (
                <VerificationBadge tier={shop.badgeTier} size="sm" showLabel={false} />
              )}
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-success px-1.5 py-0.5 text-xs font-bold text-success-foreground">
              <Star className="h-3 w-3 fill-current" /> {shop.rating}
            </span>
          </div>
          <p className="truncate text-sm text-muted-foreground">{shop.tagline}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {shop.etaMinutes} min
            </span>
            <span className="flex items-center gap-1">
              <Bike className="h-3.5 w-3.5" /> {shop.distanceKm} km · {shop.area}
            </span>
            {shop.claimed === false ? (
              <span className="font-semibold text-muted-foreground">Not yet taking orders</span>
            ) : (
              <span
                className={cn("font-semibold", shop.isOpen ? "text-primary" : "text-destructive")}
              >
                {shop.openLabel ?? (shop.isOpen ? "Open" : "Closed")}
              </span>
            )}
          </div>
        </div>
      </div>
      {shop.claimed === false ? (
        <div className="border-t border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground">
          Listed from public sources — not open for online orders yet
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-dashed border-border px-3 py-2 text-xs">
          <span className="text-muted-foreground">Delivery {formatINR(shop.deliveryFee)}</span>
          <span className="font-semibold text-primary">Free above {formatINR(shop.freeAbove)}</span>
        </div>
      )}
    </Link>
  );
}
