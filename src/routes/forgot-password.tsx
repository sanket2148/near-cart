import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset your password — NearCart" }] }),
  component: ForgotPasswordPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Not wrapped in AppShell, same reasoning as auth.callback.tsx — this is a
// standalone pre-login page, not part of the logged-in nav shell.
function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!EMAIL_RE.test(email)) return;
    setLoading(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    // Always show the same success state regardless of whether the email is
    // actually registered — Supabase itself doesn't leak that either, and
    // neither should this page (no account-enumeration via "email not found").
    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-card">
        {sent ? (
          <div className="space-y-3 text-center">
            <Mail className="mx-auto h-8 w-8 text-primary" />
            <h1 className="text-base font-bold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground">{email}</span>, we've sent a
              link to reset your password. It expires soon, so use it shortly after it arrives.
            </p>
            <a href="/" className="mt-2 block text-sm font-medium text-primary">
              ← Back to NearCart
            </a>
          </div>
        ) : (
          <>
            <h1 className="text-base font-bold">Reset your password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your account email and we'll send you a link to set a new password.
            </p>
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
                onClick={submit}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Send reset link <ArrowRight className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
              <a href="/" className="block text-center text-xs font-medium text-muted-foreground">
                ← Back to NearCart
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
