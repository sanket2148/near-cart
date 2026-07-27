import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, type AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.5 14.5 0 0 1-.76-4.59c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.92-2.14 15.89-5.82l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

type Props = {
  title?: string;
  subtitle?: string;
  onSuccess: (user: AuthUser) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Code + callback route are built and verified (tsc/eslint/vite build) and
// the redirect flow itself works correctly (confirmed live: clicking the
// button correctly reaches Supabase's real /auth/v1/authorize endpoint with
// the right params) — but the Google provider isn't actually enabled on the
// Supabase project yet (`"Unsupported provider: provider is not enabled"`),
// so the button is hidden until that's confirmed working. Flip this back to
// true once the Supabase dashboard's Google provider is genuinely live —
// nothing else needs to change.
const GOOGLE_LOGIN_ENABLED = false;

export function EmailPasswordAuth({ title = "Log in to continue", subtitle, onSuccess }: Props) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  // Full-page redirect to Google — signInWithOAuth() stashes a PKCE
  // code_verifier in this browser before navigating away, which
  // src/routes/auth.callback.tsx needs to complete the exchange once Google
  // redirects back. Nothing to await here beyond the redirect kicking off;
  // googleLoading just prevents a double-click while that happens.
  async function continueWithGoogle() {
    setGoogleLoading(true);
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
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
        {GOOGLE_LOGIN_ENABLED && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={googleLoading || loading}
              onClick={continueWithGoogle}
            >
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </Button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

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
