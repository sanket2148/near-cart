import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSeller } from "@/lib/seller";
import { getCompletedLevelCount, getTotalLevelCount } from "@/lib/verification";
import { Progress } from "@/components/ui/progress";

type Props = {
  children: ReactNode;
};

export function VerificationLockGate({ children }: Props) {
  const { verification } = useSeller();
  const isApproved = verification.overallStatus === "approved";

  if (isApproved) {
    return <>{children}</>;
  }

  const completed = getCompletedLevelCount(verification);
  const total = getTotalLevelCount();
  const percent = Math.round((completed / total) * 100);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="relative mb-6">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 border border-amber-200 text-amber-500 shadow-card animate-trusted-glow">
          <ShieldAlert className="h-10 w-10 animate-pulse" />
        </span>
        <span className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-card border border-border shadow-md text-muted-foreground">
          <Lock className="h-4 w-4" />
        </span>
      </div>

      <h2 className="text-xl font-extrabold tracking-tight">Shop Verification Required</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
        To start selling, listing products, and accepting orders, you must complete your seller verification profile.
      </p>

      {/* Progress info */}
      <div className="mt-6 w-full max-w-xs space-y-2 border border-border bg-card rounded-2xl p-4 shadow-card">
        <div className="flex justify-between text-xs font-semibold">
          <span>Verification Progress</span>
          <span>{completed} of {total} complete</span>
        </div>
        <Progress value={percent} className="h-2 bg-muted [&>div]:bg-amber-500" />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Button asChild variant="hero" size="lg" className="w-full">
          <Link to="/seller/onboarding">
            {completed > 0 ? "Continue Verification" : "Verify My Shop"}{" "}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <Link
        to="/seller/verification"
        className="mt-4 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
      >
        View Verification Steps
      </Link>
    </div>
  );
}
