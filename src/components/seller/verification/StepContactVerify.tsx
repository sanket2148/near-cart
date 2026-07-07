import { useState } from "react";
import { Phone, Mail, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import type { ShopVerification } from "@/lib/verification";

type Props = {
  verification: ShopVerification;
  onUpdate: (data: Partial<ShopVerification["levels"]["l1_contact"]>) => void;
  onComplete: () => void;
};

export function StepContactVerify({ verification, onUpdate, onComplete }: Props) {
  const l1 = verification.levels.l1_contact;

  const [phoneStep, setPhoneStep] = useState<"input" | "otp" | "done">(
    l1.phoneStatus === "verified" ? "done" : "input",
  );
  const [emailStep, setEmailStep] = useState<"input" | "sending" | "done">(
    l1.emailStatus === "verified" ? "done" : "input",
  );
  const [phone, setPhone] = useState(l1.phoneNumber || "");
  const [email, setEmail] = useState(l1.emailAddress || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const phoneDone = phoneStep === "done";
  const emailDone = emailStep === "done";
  const canProceed = phoneDone && emailDone;

  async function sendOtp() {
    if (!phone || phone.length < 10) return;
    setLoading(true);
    // Mock OTP send delay
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    setPhoneStep("otp");
    onUpdate({ phoneNumber: phone, phoneStatus: "in_progress" });
  }

  async function verifyOtp() {
    if (otp.length < 6) return;
    setLoading(true);
    // Mock OTP verify — accept any 6-digit code
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setPhoneStep("done");
    onUpdate({ phoneStatus: "verified", phoneVerifiedAt: Date.now() });
  }

  async function sendEmailLink() {
    if (!email || !email.includes("@")) return;
    setEmailStep("sending");
    onUpdate({ emailAddress: email, emailStatus: "in_progress" });
    // Mock email verification — auto-verify after delay
    await new Promise((r) => setTimeout(r, 1500));
    setEmailStep("done");
    onUpdate({ emailStatus: "verified", emailVerifiedAt: Date.now() });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold">Verify your contact info</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This confirms your identity and lets customers reach your shop.
        </p>
      </div>

      {/* Phone verification */}
      <section
        className={cn(
          "rounded-2xl border bg-card p-4 shadow-card transition-all",
          phoneDone ? "border-emerald-200 bg-emerald-50/50" : "border-border",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              phoneDone ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary",
            )}
          >
            {phoneDone ? <CheckCircle2 className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold">Mobile number</h3>
            <p className="text-xs text-muted-foreground">
              {phoneDone ? `Verified: +91 ${phone}` : "We'll send an OTP to verify"}
            </p>
          </div>
          {phoneDone && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              ✓ Verified
            </span>
          )}
        </div>

        {!phoneDone && (
          <div className="mt-4 space-y-3">
            {phoneStep === "input" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="verify-phone">Phone number</Label>
                  <div className="flex gap-2">
                    <span className="flex h-10 items-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-muted-foreground">
                      +91
                    </span>
                    <Input
                      id="verify-phone"
                      type="tel"
                      placeholder="9876543210"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                </div>
                <Button
                  variant="hero"
                  className="w-full"
                  disabled={phone.length < 10 || loading}
                  onClick={sendOtp}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
                </Button>
              </>
            )}

            {phoneStep === "otp" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to +91 {phone}
                </p>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  variant="hero"
                  className="w-full"
                  disabled={otp.length < 6 || loading}
                  onClick={verifyOtp}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify OTP"}
                </Button>
                <button
                  type="button"
                  onClick={() => { setPhoneStep("input"); setOtp(""); }}
                  className="w-full text-center text-xs font-medium text-primary"
                >
                  Change number
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Email verification */}
      <section
        className={cn(
          "rounded-2xl border bg-card p-4 shadow-card transition-all",
          emailDone ? "border-emerald-200 bg-emerald-50/50" : "border-border",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              emailDone ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary",
            )}
          >
            {emailDone ? <CheckCircle2 className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold">Email address</h3>
            <p className="text-xs text-muted-foreground">
              {emailDone ? `Verified: ${email}` : "For order notifications and payouts"}
            </p>
          </div>
          {emailDone && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              ✓ Verified
            </span>
          )}
        </div>

        {!emailDone && (
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="verify-email">Email</Label>
              <Input
                id="verify-email"
                type="email"
                placeholder="yourshop@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              variant="hero"
              className="w-full"
              disabled={!email.includes("@") || emailStep === "sending"}
              onClick={sendEmailLink}
            >
              {emailStep === "sending" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
              ) : (
                "Send verification link"
              )}
            </Button>
          </div>
        )}
      </section>

      {/* Continue */}
      <Button
        variant="hero"
        size="xl"
        className="w-full"
        disabled={!canProceed}
        onClick={onComplete}
      >
        Continue <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
