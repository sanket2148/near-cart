import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitReview } from "@/lib/reviews/api.functions";
import { cn } from "@/lib/utils";

function StarInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                "h-7 w-7 transition-colors",
                n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewForm({
  orderId,
  shopName,
  partnerId,
  onSubmitted,
}: {
  orderId: string;
  shopName: string;
  partnerId: string | null;
  onSubmitted: () => void;
}) {
  const [shopRating, setShopRating] = useState(0);
  const [partnerRating, setPartnerRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (shopRating === 0) {
      toast.error("Rate the shop to continue.");
      return;
    }
    setSubmitting(true);
    try {
      await submitReview({
        data: {
          orderId,
          shopRating,
          partnerRating: partnerId && partnerRating > 0 ? partnerRating : undefined,
          comment: comment.trim() || undefined,
        },
      });
      toast.success("Thanks for the review!");
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit your review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <h2 className="text-sm font-bold">Rate your order</h2>
      <StarInput label={shopName} value={shopRating} onChange={setShopRating} />
      {partnerId && (
        <StarInput label="Delivery partner" value={partnerRating} onChange={setPartnerRating} />
      )}
      <Textarea
        placeholder="Add a comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
      />
      <Button variant="hero" className="w-full" onClick={submit} disabled={submitting}>
        {submitting ? "Submitting…" : "Submit review"}
      </Button>
    </div>
  );
}
