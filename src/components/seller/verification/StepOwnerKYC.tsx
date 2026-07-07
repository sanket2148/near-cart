import { useState } from "react";
import { CreditCard, Fingerprint, CheckCircle2, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ShopVerification } from "@/lib/verification";

type Props = {
  verification: ShopVerification;
  onUpdate: (data: Partial<ShopVerification["levels"]["l3_kyc"]>) => void;
  onComplete: () => void;
};

export function StepOwnerKYC({ verification, onUpdate, onComplete }: Props) {
  const l3 = verification.levels.l3_kyc;
  const [pan, setPan] = useState(l3.panNumber || "");
  const [panName, setPanName] = useState(l3.panName || "");
  const [aadhaar, setAadhaar] = useState(l3.aadhaarLast4 || "");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(l3.status === "verified");

  const panValid = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase());
  const canVerify = panValid && panName.trim().length >= 3 && aadhaar.length === 4;

  async function handleVerify() {
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 1500));
    setVerifying(false);
    setVerified(true);
    onUpdate({
      status: "verified",
      panNumber: pan.toUpperCase(),
      panName: panName.trim(),
      aadhaarLast4: aadhaar,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold">Owner KYC verification</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify your identity with PAN and Aadhaar. This builds trust with customers.
        </p>
      </div>

      {/* PAN Card */}
      <section
        className={cn(
          "space-y-3 rounded-2xl border p-4 shadow-card transition-all",
          verified ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-card",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              verified ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary",
            )}
          >
            {verified ? <CheckCircle2 className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
          </span>
          <div>
            <h3 className="font-bold">PAN Card</h3>
            <p className="text-xs text-muted-foreground">
              {verified ? `Verified: ${pan.toUpperCase()}` : "Permanent Account Number"}
            </p>
          </div>
        </div>

        {!verified && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="pan-number">PAN Number</Label>
              <Input
                id="pan-number"
                placeholder="ABCDE1234F"
                maxLength={10}
                className="uppercase"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              />
              {pan.length > 0 && !panValid && pan.length >= 10 && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Invalid PAN format
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pan-name">Name as on PAN</Label>
              <Input
                id="pan-name"
                placeholder="Full name"
                value={panName}
                onChange={(e) => setPanName(e.target.value)}
              />
            </div>
          </>
        )}
      </section>

      {/* Aadhaar */}
      <section
        className={cn(
          "space-y-3 rounded-2xl border p-4 shadow-card transition-all",
          verified ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-card",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              verified ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary",
            )}
          >
            {verified ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Fingerprint className="h-5 w-5" />
            )}
          </span>
          <div>
            <h3 className="font-bold">Aadhaar</h3>
            <p className="text-xs text-muted-foreground">
              {verified ? `Last 4 digits: ****${aadhaar}` : "We only store the last 4 digits"}
            </p>
          </div>
        </div>

        {!verified && (
          <div className="space-y-1.5">
            <Label htmlFor="aadhaar-last4">Last 4 digits of Aadhaar</Label>
            <Input
              id="aadhaar-last4"
              type="text"
              placeholder="1234"
              maxLength={4}
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        )}
      </section>

      {/* Name match indicator */}
      {verified && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Identity verified</p>
            <p className="text-xs text-emerald-700">
              PAN name "{panName}" will be matched with your bank account name during bank verification.
            </p>
          </div>
        </div>
      )}

      {!verified && (
        <Button
          variant="hero"
          size="xl"
          className="w-full"
          disabled={!canVerify || verifying}
          onClick={handleVerify}
        >
          {verifying ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Verifying identity…</>
          ) : (
            "Verify identity"
          )}
        </Button>
      )}

      {verified && (
        <Button variant="hero" size="xl" className="w-full" onClick={onComplete}>
          Continue <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
