import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { completeOAuthSession } from "@/lib/auth-session/api.functions";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing you in… — NearCart" }] }),
  component: AuthCallbackPage,
});

// Deliberately NOT wrapped in AppShell — this page exists for a few hundred
// milliseconds between Google's redirect and the next real page load, and
// doesn't need the catalog/location queries AppShell's nav depends on.
//
// The PKCE code exchange has to happen here, client-side, not as a server
// function: signInWithOAuth() (EmailPasswordAuth.tsx) stashed a code_verifier
// in this same browser before redirecting to Google, and only this browser
// can complete the exchange. Once that succeeds we hold a real Supabase
// session client-side, but this app's actual trust boundary is the
// server-issued HttpOnly cookies (src/lib/auth-session/cookies.server.ts) —
// so the resulting tokens get handed to completeOAuthSession(), which
// re-verifies them for real before writing those same cookies. A full page
// navigation (not a router push) back to "/" afterward makes AuthProvider
// remount and pick the new session up via its existing getCurrentUser() call,
// exactly like every other real page load already does — no changes needed
// to auth.tsx itself.
function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.href,
        );
        if (exchangeError || !data.session) {
          throw new Error(exchangeError?.message ?? "No session returned.");
        }
        await completeOAuthSession({
          data: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresIn: data.session.expires_in,
          },
        });
        if (!cancelled) window.location.href = "/";
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't complete Google sign-in.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <>
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <a href="/" className="text-sm font-medium text-primary">
            ← Back to NearCart
          </a>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        </>
      )}
    </div>
  );
}
