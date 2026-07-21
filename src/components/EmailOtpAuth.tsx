import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth, type AuthUser } from "@/lib/auth";

type Props = {
  title?: string;
  subtitle?: string;
  onSuccess: (user: AuthUser) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailOtpAuth({ title = "Log in to continue", subtitle, onSuccess }: Props) {
  const { requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp() {
    if (!EMAIL_RE.test(email)) return;
    setLoading(true);
    setError("");
    try {
      await requestOtp(email);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp() {
    if (otp.length < 6) return;
    setLoading(true);
    setError("");
    try {
      const user = await verifyOtp(email, otp);
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-base font-bold">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}

      {step === "email" ? (
        <div className="mt-4 space-y-3">
          <Input
            type="email"
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="text-center text-xs text-destructive">{error}</p>}
          <Button
            variant="hero"
            className="w-full"
            disabled={!EMAIL_RE.test(email) || loading}
            onClick={sendOtp}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Send Code <ArrowRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {email}</p>
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
          {error && <p className="text-center text-xs text-destructive">{error}</p>}
          <Button
            variant="hero"
            className="w-full"
            disabled={otp.length < 6 || loading}
            onClick={submitOtp}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setOtp("");
              setError("");
            }}
            className="w-full text-center text-xs font-medium text-primary"
          >
            Change email
          </button>
        </div>
      )}
    </div>
  );
}
