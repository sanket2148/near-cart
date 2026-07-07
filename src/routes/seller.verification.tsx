import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, AlertCircle, XCircle } from "lucide-react";
import { useSeller } from "@/lib/seller";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { VerificationBadge } from "@/components/VerificationBadge";
import {
  getCompletedLevelCount,
  getTotalLevelCount,
  VERIFICATION_STEPS,
  type LevelStatus,
} from "@/lib/verification";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/seller/verification")({
  component: SellerVerificationPage,
});

function SellerVerificationPage() {
  const { verification, shop } = useSeller();
  const navigate = useNavigate();

  const completed = getCompletedLevelCount(verification);
  const total = getTotalLevelCount();
  const percent = Math.round((completed / total) * 100);

  const getStatusIcon = (status: LevelStatus) => {
    switch (status) {
      case "verified":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
      case "submitted":
        return <Clock className="h-5 w-5 text-blue-500 shrink-0" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-destructive shrink-0" />;
      case "in_progress":
        return <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />;
    }
  };

  const getStatusBadge = (status: LevelStatus) => {
    switch (status) {
      case "verified":
        return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Verified</span>;
      case "submitted":
        return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">Submitted</span>;
      case "rejected":
        return <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">Rejected</span>;
      case "in_progress":
        return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">In Progress</span>;
      default:
        return <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">Not Started</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link to="/seller">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-extrabold">Verification details</h1>
          <p className="text-xs text-muted-foreground">Detailed status of your seller trust metrics</p>
        </div>
      </div>

      {/* Overview Card */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Verification Badge</span>
          <VerificationBadge tier={shop.badgeTier} size="md" />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span>Overall Progress</span>
            <span>{completed} of {total} levels complete</span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>

        {verification.overallStatus === "incomplete" && (
          <Button asChild className="w-full" variant="hero">
            <Link to="/seller/onboarding">Continue verification onboarding</Link>
          </Button>
        )}
      </div>

      {/* Levels list Accordion */}
      <div className="space-y-3">
        <h2 className="text-sm font-extrabold text-muted-foreground uppercase tracking-wider">Verification levels</h2>

        <Accordion type="single" collapsible className="w-full space-y-2">
          {/* Level 1 */}
          <AccordionItem value="l1" className="border border-border rounded-2xl bg-card px-4 py-1">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                {getStatusIcon(verification.levels.l1_contact.phoneStatus === "verified" && verification.levels.l1_contact.emailStatus === "verified" ? "verified" : "in_progress")}
                <div>
                  <p className="text-sm font-bold leading-none">Level 1: Contact info</p>
                  <p className="text-xs text-muted-foreground mt-1">Phone & email verification</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between border-b border-border pb-2">
                <span>Phone (+91 {verification.levels.l1_contact.phoneNumber || "Not set"})</span>
                {getStatusBadge(verification.levels.l1_contact.phoneStatus)}
              </div>
              <div className="flex justify-between">
                <span>Email ({verification.levels.l1_contact.emailAddress || "Not set"})</span>
                {getStatusBadge(verification.levels.l1_contact.emailStatus)}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Level 2 */}
          <AccordionItem value="l2" className="border border-border rounded-2xl bg-card px-4 py-1">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                {getStatusIcon(verification.levels.l2_documents.status)}
                <div>
                  <p className="text-sm font-bold leading-none">Level 2: Business documents</p>
                  <p className="text-xs text-muted-foreground mt-1">Required licenses and proof</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1 space-y-2 text-xs text-muted-foreground">
              <p>Type: {shop.businessType ? shop.businessType.toUpperCase() : "Not selected"}</p>
              {verification.levels.l2_documents.documents.map((d) => (
                <div key={d.id} className="flex justify-between border-t border-border pt-2">
                  <span>{d.fileName}</span>
                  {getStatusBadge(d.status)}
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          {/* Level 3 */}
          <AccordionItem value="l3" className="border border-border rounded-2xl bg-card px-4 py-1">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                {getStatusIcon(verification.levels.l3_kyc.status)}
                <div>
                  <p className="text-sm font-bold leading-none">Level 3: Identity KYC</p>
                  <p className="text-xs text-muted-foreground mt-1">PAN & Aadhaar match</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1 space-y-2 text-xs text-muted-foreground">
              <p>PAN Name: {verification.levels.l3_kyc.panName || "Not set"}</p>
              <p>PAN Code: {verification.levels.l3_kyc.panNumber || "Not set"}</p>
              <p>Aadhaar Last 4: {verification.levels.l3_kyc.aadhaarLast4 ? `****${verification.levels.l3_kyc.aadhaarLast4}` : "Not set"}</p>
            </AccordionContent>
          </AccordionItem>

          {/* Level 4 */}
          <AccordionItem value="l4" className="border border-border rounded-2xl bg-card px-4 py-1">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                {getStatusIcon(verification.levels.l4_bank.status)}
                <div>
                  <p className="text-sm font-bold leading-none">Level 4: Bank account</p>
                  <p className="text-xs text-muted-foreground mt-1">Penny drop verification status</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1 space-y-2 text-xs text-muted-foreground">
              <p>Bank: {verification.levels.l4_bank.accountHolderName || "Not set"}</p>
              <p>IFSC: {verification.levels.l4_bank.ifsc || "Not set"}</p>
              <p>A/C: {verification.levels.l4_bank.accountNumber ? `****${verification.levels.l4_bank.accountNumber.slice(-4)}` : "Not set"}</p>
              <p>Penny Drop: {verification.levels.l4_bank.pennyDropVerified ? "Verified ✓" : "Pending"}</p>
            </AccordionContent>
          </AccordionItem>

          {/* Level 5 */}
          <AccordionItem value="l5" className="border border-border rounded-2xl bg-card px-4 py-1">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                {getStatusIcon(verification.levels.l5_gps.status)}
                <div>
                  <p className="text-sm font-bold leading-none">Level 5: Physical & GPS</p>
                  <p className="text-xs text-muted-foreground mt-1">Shop photos and coordinates</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1 space-y-2 text-xs text-muted-foreground">
              {verification.levels.l5_gps.lat && (
                <p>Coordinates: {verification.levels.l5_gps.lat.toFixed(4)}, {verification.levels.l5_gps.lng?.toFixed(4)}</p>
              )}
              <p>Photos uploaded: {verification.levels.l5_gps.photos.length}</p>
            </AccordionContent>
          </AccordionItem>

          {/* Level 6 */}
          <AccordionItem value="l6" className="border border-border rounded-2xl bg-card px-4 py-1">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                {getStatusIcon(verification.levels.l6_ai.status)}
                <div>
                  <p className="text-sm font-bold leading-none">Level 6: AI fraud engine</p>
                  <p className="text-xs text-muted-foreground mt-1">Automated duplicates & anomaly check</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1 text-xs text-muted-foreground">
              Checks metadata, image similarity, and GPS coordinate boundaries. All clear.
            </AccordionContent>
          </AccordionItem>

          {/* Level 7 */}
          <AccordionItem value="l7" className="border border-border rounded-2xl bg-card px-4 py-1">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                {getStatusIcon(verification.levels.l7_review.status)}
                <div>
                  <p className="text-sm font-bold leading-none">Level 7: Trust team review</p>
                  <p className="text-xs text-muted-foreground mt-1">Manual review of all uploaded documents</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1 text-xs text-muted-foreground">
              Notes: {verification.levels.l7_review.notes || "Awaiting submission."}
            </AccordionContent>
          </AccordionItem>

          {/* Level 8 */}
          <AccordionItem value="l8" className="border border-border rounded-2xl bg-card px-4 py-1">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                {getStatusIcon(verification.levels.l8_customer.status)}
                <div>
                  <p className="text-sm font-bold leading-none">Level 8: Customer trust</p>
                  <p className="text-xs text-muted-foreground mt-1">Post-launch cancellation & refund metrics</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1 text-xs text-muted-foreground">
              Earned gradually after launch. Tracks ratings, complaint rate, and successful deliveries.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
