import { useState } from "react";
import { Landmark, CheckCircle2, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ShopVerification } from "@/lib/verification";

type Props = {
  verification: ShopVerification;
  onUpdate: (data: Partial<ShopVerification["levels"]["l4_bank"]>) => void;
  onComplete: () => void;
};

export function StepBankDetails({ verification, onUpdate, onComplete }: Props) {
  const l4 = verification.levels.l4_bank;
  const [account, setAccount] = useState(l4.accountNumber || "");
  const [confirmAccount, setConfirmAccount] = useState(l4.accountNumber || "");
  const [ifsc, setIfsc] = useState(l4.ifsc || "");
  const [holderName, setHolderName] = useState(l4.accountHolderName || "");
  const [step, setStep] = useState<"form" | "verifying" | "done">(
    l4.pennyDropVerified ? "done" : "form",
  );

  const accountMatch = account.length > 0 && account === confirmAccount;
  const ifscValid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
  const canVerify = accountMatch && ifscValid && holderName.trim().length >= 3;

  // Check name match with KYC PAN name
  const panName = verification.levels.l3_kyc.panName;
  const nameMatches =
    panName &&
    holderName &&
    panName.toLowerCase().trim() === holderName.toLowerCase().trim();

  async function handlePennyDrop() {
    setStep("verifying");
    onUpdate({
      accountNumber: account,
      ifsc: ifsc.toUpperCase(),
      accountHolderName: holderName.trim(),
      status: "in_progress",
    });
    // Simulate penny-drop verification
    await new Promise((r) => setTimeout(r, 2500));
    setStep("done");
    onUpdate({
      status: "verified",
      pennyDropVerified: true,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold">Bank account verification</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your bank details for receiving payments. We'll verify with a ₹1 penny drop.
        </p>
      </div>

      <section
        className={cn(
          "space-y-4 rounded-2xl border p-4 shadow-card transition-all",
          step === "done" ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-card",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              step === "done" ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary",
            )}
          >
            {step === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
          </span>
          <div>
            <h3 className="font-bold">Bank account</h3>
            <p className="text-xs text-muted-foreground">
              {step === "done"
                ? `Verified: ****${account.slice(-4)} · ${holderName}`
                : "Savings or current account"}
            </p>
          </div>
        </div>

        {step !== "done" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="bank-account">Account number</Label>
              <Input
                id="bank-account"
                type="text"
                placeholder="Account number"
                value={account}
                onChange={(e) => setAccount(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank-confirm">Confirm account number</Label>
              <Input
                id="bank-confirm"
                type="text"
                placeholder="Re-enter account number"
                value={confirmAccount}
                onChange={(e) => setConfirmAccount(e.target.value.replace(/\D/g, ""))}
              />
              {confirmAccount.length > 0 && !accountMatch && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Account numbers don't match
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank-ifsc">IFSC Code</Label>
              <Input
                id="bank-ifsc"
                placeholder="SBIN0001234"
                maxLength={11}
                className="uppercase"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              />
              {ifsc.length >= 11 && !ifscValid && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Invalid IFSC format
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank-name">Account holder name</Label>
              <Input
                id="bank-name"
                placeholder="Name as on bank account"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
              />
              {panName && holderName.length > 3 && (
                <p
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    nameMatches ? "text-emerald-600" : "text-amber-600",
                  )}
                >
                  {nameMatches ? (
                    <><CheckCircle2 className="h-3 w-3" /> Matches PAN name</>
                  ) : (
                    <><AlertTriangle className="h-3 w-3" /> Different from PAN name "{panName}"</>
                  )}
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {step === "verifying" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="text-sm font-bold">Verifying bank account…</p>
            <p className="text-xs text-muted-foreground">
              Sending ₹1 to verify your account details
            </p>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Bank account verified</p>
            <p className="text-xs text-emerald-700">
              ₹1 penny drop successful · Account holder: {holderName}
            </p>
          </div>
        </div>
      )}

      {step === "form" && (
        <Button
          variant="hero"
          size="xl"
          className="w-full"
          disabled={!canVerify}
          onClick={handlePennyDrop}
        >
          Verify with penny drop (₹1)
        </Button>
      )}

      {step === "done" && (
        <Button variant="hero" size="xl" className="w-full" onClick={onComplete}>
          Continue <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
