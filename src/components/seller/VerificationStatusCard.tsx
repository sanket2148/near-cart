import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { VerificationBadge } from "@/components/VerificationBadge";
import { cn } from "@/lib/utils";
import type { ShopVerification } from "@/lib/verification";
import {
  BADGE_CONFIG,
  getCompletedLevelCount,
  getTotalLevelCount,
  getNextIncompleteStep,
  VERIFICATION_STEPS,
  computeBadgeTier,
} from "@/lib/verification";

type VerificationStatusCardProps = {
  verification: ShopVerification;
};

const TIER_PROGRESS_COLORS: Record<string, string> = {
  none: "[&>div]:bg-muted-foreground bg-muted",
  basic: "[&>div]:bg-emerald-500 bg-emerald-200",
  verified: "[&>div]:bg-amber-500 bg-amber-200",
  premium: "[&>div]:bg-blue-500 bg-blue-200",
  trusted: "[&>div]:bg-amber-400 bg-amber-200",
};

export function VerificationStatusCard({
  verification,
}: VerificationStatusCardProps) {
  const tier = computeBadgeTier(verification);
  const completedLevels = getCompletedLevelCount(verification);
  const totalLevels = getTotalLevelCount();
  const nextStepId = getNextIncompleteStep(verification);
  const nextStep = VERIFICATION_STEPS.find((s) => s.id === nextStepId);
  const isFullyVerified = completedLevels === totalLevels;
  const isFlagged = verification.flagged === true;
  const progressPercent = totalLevels > 0 ? (completedLevels / totalLevels) * 100 : 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">
          <ShieldCheck className="h-4 w-4 text-primary" /> Verification
        </h2>
        <VerificationBadge tier={tier} size="md" showNone />
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <Progress
          value={progressPercent}
          className={cn("h-2", TIER_PROGRESS_COLORS[tier])}
        />
        <p className="mt-1.5 text-sm text-muted-foreground">
          {completedLevels} of {totalLevels} levels complete
        </p>
      </div>

      {/* Flagged warning banner */}
      {isFlagged && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="text-sm font-medium text-destructive">
            Your verification is under review. Please contact support.
          </span>
        </div>
      )}

      {/* Next step callout (not fully verified & not flagged) */}
      {!isFullyVerified && !isFlagged && nextStep && (
        <div className="mt-3 rounded-xl bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-medium">
              Next: {nextStep.title}
            </span>
          </div>
          <Link
            to="/seller/onboarding"
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary"
          >
            Continue verification <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Fully verified success state */}
      {isFullyVerified && !isFlagged && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">
            Your shop is fully verified
          </span>
        </div>
      )}

      {/* CTA button */}
      <Link
        to="/seller/onboarding"
        className={cn(
          "mt-3 flex items-center justify-between rounded-xl border border-border bg-background p-3 transition-colors hover:bg-accent/5",
        )}
      >
        <span className="text-sm font-bold">
          {isFullyVerified ? "View verification status" : "Complete verification"}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </section>
  );
}
