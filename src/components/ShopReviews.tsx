import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { listShopReviews } from "@/lib/reviews/api.functions";
import { cn } from "@/lib/utils";

export function ShopReviews({
  shopId,
  rating,
  ratingCount,
}: {
  shopId: string;
  rating: number;
  ratingCount: number;
}) {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["shop-reviews", shopId],
    queryFn: () => listShopReviews({ data: { shopId } }),
  });

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold">Ratings & reviews</h2>
        {ratingCount > 0 && (
          <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {rating.toFixed(1)} (
            {ratingCount})
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No reviews yet — be the first to order and rate this shop.
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {reviews.slice(0, 10).map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn(
                      "h-3.5 w-3.5",
                      n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                    )}
                  />
                ))}
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
              {r.comment && <p className="mt-1.5 text-sm text-muted-foreground">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
