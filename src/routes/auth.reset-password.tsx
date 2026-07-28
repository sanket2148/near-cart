import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { completeExternalSession } from "@/lib/auth-session/api.functions";
import { MIN_PASSWORD_LENGTH } from "@/components/EmailPasswordAuth";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password — NearCart" }] }),
  component: ResetPasswordPage,
});

// Same PKCE-exchange shape as auth.callback.tsx: forgot-password.tsx's
// resetPasswordForEmail() stashed a code_verifier in this browser before the
// email was sent, so only this browser can complete the exchange when the
// user clicks the link. Not wrapped in AppShell for the same reason as
// auth.callback.tsx — a standalone pre-login page, not part of the nav shell.
function ResetPasswordPage() {
  const [exchanging, setExchanging] = useState(true);
  const [exchangeError, setExchangeError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (cancelled) return;
      if (error) {
        setExchangeError(
          "This reset link is invalid or has expired. Request a new one from the login page.",
        );
      }
      setExchanging(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;
  const canSubmit = passwordValid && password === confirmPassword;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      // updateUser() doesn't rotate tokens, but re-reading the client's
      // current session (rather than reusing whatever exchangeCodeForSession
      // returned earlier) is the real source of truth for what to hand off.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error(sessionError?.message ?? "No session available after password update.");
      }
      await completeExternalSession({
        data: {
          accessToken: sessionData.session.access_token,
          refreshToken: sessionData.session.refresh_token,
          expiresIn: sessionData.session.expires_in,
        },
      });
      window.location.href = "/";
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't update your password.");
      setSubmitting(false);
    }
  }

  if (exchanging) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
      </div>
    );
  }

  if (exchangeError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-semibold text-destructive">{exchangeError}</p>
        <a href="/forgot-password" className="text-sm font-medium text-primary">
          Request a new reset link
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-card">
        <h1 className="text-base font-bold">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a new password for your account.
        </p>
        <div className="mt-4 space-y-3">
          <Input
            type="password"
            placeholder={`New password (min ${MIN_PASSWORD_LENGTH} characters)`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {password.length > 0 && !passwordValid && (
            <p className="text-xs text-muted-foreground">
              Password must be at least {MIN_PASSWORD_LENGTH} characters.
            </p>
          )}
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p className="text-xs text-destructive">Passwords don't match.</p>
          )}
          {submitError && <p className="text-center text-xs text-destructive">{submitError}</p>}
          <Button variant="hero" className="w-full" disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Update password <ArrowRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
