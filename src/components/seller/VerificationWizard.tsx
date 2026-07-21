import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCircle2, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  BUSINESS_TYPE_CONFIG,
  type ShopVerification,
  type BusinessType,
  type DocumentUpload,
  type LevelStatus,
  type ShopPhoto,
  saveVerification,
  computeBadgeTier,
} from "@/lib/verification";
import { finalizeVerification } from "@/lib/verification/api.functions";

import { StepContactVerify } from "./verification/StepContactVerify";
import { StepBusinessType } from "./verification/StepBusinessType";
import { StepDocumentUpload } from "./verification/StepDocumentUpload";
import { StepOwnerKYC } from "./verification/StepOwnerKYC";
import { StepBankDetails } from "./verification/StepBankDetails";
import { StepShopPhotos } from "./verification/StepShopPhotos";
import { StepReviewSubmit } from "./verification/StepReviewSubmit";

type Props = {
  initialVerification: ShopVerification;
  onCompleteAll: (verification: ShopVerification) => void;
  onBackToDashboard: () => void;
};

const WIZARD_STEPS = [
  { step: 1, label: "Contact" },
  { step: 2, label: "Biz Type" },
  { step: 3, label: "Documents" },
  { step: 4, label: "KYC" },
  { step: 5, label: "Bank" },
  { step: 6, label: "Photos & GPS" },
  { step: 7, label: "Review" },
];

export function VerificationWizard({
  initialVerification,
  onCompleteAll,
  onBackToDashboard,
}: Props) {
  const [verification, setVerification] = useState<ShopVerification>(initialVerification);
  const [activeStep, setActiveStep] = useState<number>(initialVerification.currentStep || 1);
  const [submitting, setSubmitting] = useState(false);

  const updateState = (updater: (prev: ShopVerification) => ShopVerification) => {
    setVerification((prev) => {
      const next = updater(prev);
      saveVerification(next);
      return next;
    });
  };

  const handleNext = () => {
    if (activeStep < 7) {
      const nextStep = activeStep + 1;
      setActiveStep(nextStep);
      updateState((prev) => ({
        ...prev,
        currentStep: nextStep,
        updatedAt: Date.now(),
      }));
    }
  };

  const handlePrev = () => {
    if (activeStep > 1) {
      const prevStep = activeStep - 1;
      setActiveStep(prevStep);
      updateState((prev) => ({
        ...prev,
        currentStep: prevStep,
        updatedAt: Date.now(),
      }));
    }
  };

  const handleGoToStep = (step: number) => {
    if (step >= 1 && step <= 7) {
      // Validate that the user can go to this step (e.g. they can't skip ahead too far)
      // For ease of demo, we allow going to any previously visited step or the next step
      setActiveStep(step);
      updateState((prev) => ({
        ...prev,
        currentStep: step,
        updatedAt: Date.now(),
      }));
    }
  };

  const handleContactUpdate = (data: Partial<ShopVerification["levels"]["l1_contact"]>) => {
    updateState((prev) => ({
      ...prev,
      levels: {
        ...prev.levels,
        l1_contact: {
          ...prev.levels.l1_contact,
          ...data,
        },
      },
    }));
  };

  const handleBusinessTypeSelect = (type: BusinessType) => {
    updateState((prev) => {
      // If changing business type, clear documents
      const docsCleared = prev.businessType !== type ? [] : prev.levels.l2_documents.documents;
      return {
        ...prev,
        businessType: type,
        levels: {
          ...prev.levels,
          l2_documents: {
            status: docsCleared.length > 0 ? prev.levels.l2_documents.status : "not_started",
            documents: docsCleared,
          },
        },
      };
    });
  };

  const handleDocumentUpload = (doc: DocumentUpload) => {
    updateState((prev) => {
      const existingDocs = prev.levels.l2_documents.documents;
      const index = existingDocs.findIndex((d) => d.docType === doc.docType);
      const updatedDocs = [...existingDocs];
      if (index > -1) {
        updatedDocs[index] = doc;
      } else {
        updatedDocs.push(doc);
      }

      const requiredDocs = prev.businessType
        ? BUSINESS_TYPE_CONFIG[prev.businessType].requiredDocs
        : [];
      const anyRequiredRejected = requiredDocs.some((d) =>
        updatedDocs.some((u) => u.docType === d && u.status === "rejected"),
      );
      const allRequiredVerified =
        requiredDocs.length > 0 &&
        requiredDocs.every((d) =>
          updatedDocs.some((u) => u.docType === d && u.status === "verified"),
        );
      const allRequiredUploaded = requiredDocs.every((d) =>
        updatedDocs.some((u) => u.docType === d && u.status !== "rejected"),
      );

      let status: LevelStatus = "in_progress";
      if (anyRequiredRejected) status = "rejected";
      else if (requiredDocs.length === 0 ? updatedDocs.length > 0 : allRequiredVerified)
        status = "verified";
      else if (allRequiredUploaded) status = "submitted";

      return {
        ...prev,
        levels: {
          ...prev.levels,
          l2_documents: { status, documents: updatedDocs },
        },
      };
    });

    if (doc.status === "rejected") {
      toast.error(doc.rejectionReason ?? "Document was rejected — please re-upload.");
    } else if (doc.status === "verified") {
      toast.success("Document verified");
    } else {
      toast.success("Document submitted — under review");
    }
  };

  const handleKYCUpdate = (data: Partial<ShopVerification["levels"]["l3_kyc"]>) => {
    updateState((prev) => ({
      ...prev,
      levels: {
        ...prev.levels,
        l3_kyc: {
          ...prev.levels.l3_kyc,
          ...data,
          status: "verified",
        },
      },
    }));
    toast.success("Identity KYC verified");
  };

  const handleBankUpdate = (data: Partial<ShopVerification["levels"]["l4_bank"]>) => {
    updateState((prev) => ({
      ...prev,
      levels: {
        ...prev.levels,
        l4_bank: {
          ...prev.levels.l4_bank,
          ...data,
        },
      },
    }));
  };

  const handleGpsUpdate = (lat: number, lng: number) => {
    updateState((prev) => ({
      ...prev,
      levels: {
        ...prev.levels,
        l5_gps: {
          ...prev.levels.l5_gps,
          lat,
          lng,
          capturedAt: Date.now(),
        },
      },
    }));
    toast.success("GPS Location captured");
  };

  const handlePhotoAdd = (photo: ShopPhoto) => {
    updateState((prev) => {
      const updatedPhotos = [...prev.levels.l5_gps.photos, photo];
      const front = updatedPhotos.find((p) => p.type === "front");
      const board = updatedPhotos.find((p) => p.type === "board");
      const gpsSet = prev.levels.l5_gps.lat !== null && prev.levels.l5_gps.lng !== null;
      const requiredLooksGood = (p?: ShopPhoto) => !!p && p.analysis?.decision !== "REJECTED";

      return {
        ...prev,
        levels: {
          ...prev.levels,
          l5_gps: {
            ...prev.levels.l5_gps,
            photos: updatedPhotos,
            status:
              gpsSet && requiredLooksGood(front) && requiredLooksGood(board)
                ? "verified"
                : prev.levels.l5_gps.status,
          },
        },
      };
    });
    toast.success(`Photo of ${photo.type} uploaded`);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const overall = await finalizeVerification({
        data: {
          merchantRef: verification.merchantRef,
          shopId: verification.shopId,
          form: {
            ownerName: verification.levels.l3_kyc.panName || undefined,
            businessType: verification.businessType || undefined,
          },
        },
      });
      const decision = overall?.decision ?? "UNDER_REVIEW";

      const l6Status: LevelStatus = decision === "REJECTED" ? "rejected" : "verified";
      const l7Status: LevelStatus =
        decision === "VERIFIED" ? "verified" : decision === "REJECTED" ? "rejected" : "submitted";
      const notes =
        decision === "VERIFIED"
          ? "Approved automatically by the verification pipeline."
          : decision === "REJECTED"
            ? "Rejected — one or more documents failed verification. Re-upload and resubmit."
            : "Submitted — pending manual review by the trust team.";
      const rejectedDocs = verification.levels.l2_documents.documents.filter(
        (d) => d.status === "rejected",
      );

      const next: ShopVerification = {
        ...verification,
        levels: {
          ...verification.levels,
          l6_ai: { status: l6Status },
          l7_review: { status: l7Status, notes },
        },
        overallStatus:
          decision === "VERIFIED"
            ? "approved"
            : decision === "REJECTED"
              ? "incomplete"
              : "pending_review",
        flagged: decision === "REJECTED",
        flagReasons:
          decision === "REJECTED"
            ? rejectedDocs.map((d) => d.rejectionReason ?? `${d.docType} rejected`)
            : verification.flagReasons,
        updatedAt: Date.now(),
      };
      next.currentBadge = computeBadgeTier(next);

      setVerification(next);
      saveVerification(next);
      onCompleteAll(next);

      if (decision === "VERIFIED") toast.success("Shop verified successfully!");
      else if (decision === "REJECTED")
        toast.error("Verification rejected — please review and resubmit.");
      else toast.success("Submitted for review. We'll notify you once approved.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not submit verification. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (activeStep) {
      case 1:
        return (
          <StepContactVerify
            verification={verification}
            onUpdate={handleContactUpdate}
            onComplete={handleNext}
          />
        );
      case 2:
        return (
          <StepBusinessType
            verification={verification}
            onSelect={handleBusinessTypeSelect}
            onComplete={handleNext}
          />
        );
      case 3:
        return (
          <StepDocumentUpload
            verification={verification}
            onUpload={handleDocumentUpload}
            onComplete={handleNext}
          />
        );
      case 4:
        return (
          <StepOwnerKYC
            verification={verification}
            onUpdate={handleKYCUpdate}
            onComplete={handleNext}
          />
        );
      case 5:
        return (
          <StepBankDetails
            verification={verification}
            onUpdate={handleBankUpdate}
            onComplete={handleNext}
          />
        );
      case 6:
        return (
          <StepShopPhotos
            verification={verification}
            onUpdateGps={handleGpsUpdate}
            onAddPhoto={handlePhotoAdd}
            onComplete={handleNext}
          />
        );
      case 7:
        return (
          <StepReviewSubmit
            verification={verification}
            onGoToStep={handleGoToStep}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header / Back navigation */}
      <div className="flex items-center gap-3">
        {activeStep > 1 ? (
          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="icon" onClick={onBackToDashboard}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-xl font-extrabold">Shop Verification</h1>
          <p className="text-xs text-muted-foreground">Step {activeStep} of 7</p>
        </div>
      </div>

      {/* Wizard stepper bar */}
      <div className="relative flex justify-between items-center rounded-2xl border border-border bg-card p-4 shadow-card overflow-x-auto no-scrollbar">
        {WIZARD_STEPS.map((s) => {
          const isCompleted = activeStep > s.step;
          const isActive = activeStep === s.step;

          return (
            <div key={s.step} className="flex items-center">
              <button
                type="button"
                onClick={() => handleGoToStep(s.step)}
                disabled={s.step > activeStep && !isCompleted}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all shrink-0",
                  isCompleted
                    ? "bg-emerald-500 text-white"
                    : isActive
                      ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : s.step}
              </button>
              {s.step < 7 && (
                <ChevronRight className="h-4 w-4 mx-1.5 text-muted-foreground shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Wizard Step Component */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-card">{renderStep()}</div>
    </div>
  );
}
