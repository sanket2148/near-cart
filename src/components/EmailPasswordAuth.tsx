import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, type AuthUser } from "@/lib/auth";

type Props = {
  title?: string;
  subtitle?: string;
  onSuccess: (user: AuthUser) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function EmailPasswordAuth({ title = "Log in to continue", subtitle, onSuccess }: Props) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emailValid = EMAIL_RE.test(email);
  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;
  const canSubmit =
    mode === "login"
      ? emailValid && password.length > 0
      : emailValid && passwordValid && password === confirmPassword;

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const user = mode === "login" ? await signIn(email, password) : await signUp(email, password);
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="text-base font-bold">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}

      <div className="mt-4 space-y-3">
        <Input
          type="email"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder={
            mode === "signup" ? `Password (min ${MIN_PASSWORD_LENGTH} characters)` : "Password"
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === "signup" && (
          <Input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        )}
        {mode === "signup" && password.length > 0 && !passwordValid && (
          <p className="text-xs text-muted-foreground">
            Password must be at least {MIN_PASSWORD_LENGTH} characters.
          </p>
        )}
        {mode === "signup" && confirmPassword.length > 0 && password !== confirmPassword && (
          <p className="text-xs text-destructive">Passwords don't match.</p>
        )}
        {error && <p className="text-center text-xs text-destructive">{error}</p>}

        <Button variant="hero" className="w-full" disabled={!canSubmit || loading} onClick={submit}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {mode === "login" ? "Log in" : "Create account"}{" "}
              <ArrowRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>

        <button
          type="button"
          onClick={() => switchMode(mode === "login" ? "signup" : "login")}
          className="w-full text-center text-xs font-medium text-primary"
        >
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
