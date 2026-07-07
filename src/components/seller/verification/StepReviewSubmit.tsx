import { CheckCircle2, AlertTriangle, ArrowRight, FileText, Landmark, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS_TYPE_CONFIG, type ShopVerification } from "@/lib/verification";

type Props = {
  verification: ShopVerification;
  onSubmit: () => void;
  onGoToStep: (step: number) => void;
};

export function StepReviewSubmit({ verification, onSubmit, onGoToStep }: Props) {
  const bType = verification.businessType;
  const config = bType ? BUSINESS_TYPE_CONFIG[bType] : null;

  const l1 = verification.levels.l1_contact;
  const l2 = verification.levels.l2_documents;
  const l3 = verification.levels.l3_kyc;
  const l4 = verification.levels.l4_bank;
  const l5 = verification.levels.l5_gps;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-extrabold">Review and submit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Double check your details before submitting for official verification.
        </p>
      </div>

      <div className="space-y-4">
        {/* Step 1 Contact */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">1. Contact verification</h3>
            <button
              onClick={() => onGoToStep(1)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>Phone: +91 {l1.phoneNumber}</p>
            <p>Email: {l1.emailAddress}</p>
          </div>
        </div>

        {/* Step 2 Business Type */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">2. Business type</h3>
            <button
              onClick={() => onGoToStep(2)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="text-base">{config?.emoji}</span>
            <span>{config?.label}</span>
          </div>
        </div>

        {/* Step 3 Documents */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">3. Documents uploaded</h3>
            <button
              onClick={() => onGoToStep(3)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          {l2.documents.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No documents uploaded.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {l2.documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span>{doc.fileName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Step 4 Identity KYC */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">4. Identity KYC</h3>
            <button
              onClick={() => onGoToStep(4)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>PAN Name: {l3.panName}</p>
            <p>PAN: {l3.panNumber}</p>
            <p>Aadhaar Last 4: ****{l3.aadhaarLast4}</p>
          </div>
        </div>

        {/* Step 5 Bank Details */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">5. Bank details</h3>
            <button
              onClick={() => onGoToStep(5)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground flex items-start gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">{l4.accountHolderName}</p>
              <p>IFSC: {l4.ifsc}</p>
              <p>A/C: ****{l4.accountNumber.slice(-4)}</p>
            </div>
          </div>
        </div>

        {/* Step 6 GPS & Photos */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">6. Shop photos & location</h3>
            <button
              onClick={() => onGoToStep(6)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          <div className="mt-2 space-y-2 text-xs text-muted-foreground">
            {l5.lat && l5.lng && (
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>GPS coordinates captured ({l5.lat.toFixed(4)}, {l5.lng.toFixed(4)})</span>
              </p>
            )}
            <p>Photos uploaded: {l5.photos.length} ({l5.photos.map((p) => p.type).join(", ")})</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
        <div className="flex gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-800">Verification terms</h4>
            <p className="mt-1 text-xs text-amber-700 leading-snug">
              By submitting, you declare that all information and documents provided are genuine. Fake or modified documents will lead to permanent suspension of your shop.
            </p>
          </div>
        </div>
      </div>

      <Button
        variant="hero"
        size="xl"
        className="w-full"
        onClick={onSubmit}
      >
        Submit for verification <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
