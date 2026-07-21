// Server-only real Supabase Auth session issuance (email OTP). Replaces
// src/lib/auth.tsx's custom localStorage dev-mode flow and
// src/lib/auth-bridge/ (both retired once this ships) — see
// plan/tasks/decisions.md for the authorization-hardening plan this is
// Phase 1 of. Every server function elsewhere in the app currently trusts
// client-supplied ids (customerId, shopId, ...) because there has never
// been a real session to check against; this module is what makes a real
// `context.uid` (see ./middleware.ts) possible for the first time.
//
// Deliberately uses the ANON key, not the service-role key — this is an
// auth operation, not a privileged data operation, and matches
// mobile/src/lib/auth.tsx's already-proven real-session pattern exactly.
// Email OTP, not phone: phone sign-in is disabled at the Supabase project
// level (no funded SMS provider), the same wall the mobile app hit and
// pivoted around.

import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

let _anon: SupabaseClient | null = null;

function anon(): SupabaseClient {
  if (_anon) return _anon;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Auth session backend not configured: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY missing.",
    );
  }
  _anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _anon;
}

export async function requestOtp(email: string): Promise<void> {
  const { error } = await anon().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

export type VerifiedSession = { userId: string; email: string; session: Session };

export async function verifyOtp(email: string, code: string): Promise<VerifiedSession> {
  const { data, error } = await anon().auth.verifyOtp({ email, token: code, type: "email" });
  if (error) throw new Error(error.message);
  if (!data.session || !data.user?.email)
    throw new Error("Verification succeeded but no session was returned.");
  return { userId: data.user.id, email: data.user.email, session: data.session };
}

export async function refreshSession(refreshToken: string): Promise<Session | null> {
  const { data, error } = await anon().auth.refreshSession({ refresh_token: refreshToken });
  if (error) return null;
  return data.session;
}

/** Re-verifies an access token against Supabase (not just a local JWT decode) — used by authMiddleware. */
export async function getUserForToken(
  accessToken: string,
): Promise<{ id: string; email: string } | null> {
  const { data, error } = await anon().auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

/**
 * Revokes the refresh token server-side via the Admin API (the only way to
 * invalidate a specific token without first "being" that user — a real
 * admin-level auth operation, not a data-access shortcut, same reasoning
 * the retired auth-bridge module used for its Admin API calls). Best-effort:
 * deleting the session cookies (done by the caller, api.functions.ts) is
 * what actually logs the user out of this app regardless of whether this
 * revocation succeeds.
 */
export async function signOut(accessToken: string): Promise<void> {
  const client = admin();
  if (!client) return;
  await client.auth.admin.signOut(accessToken, "global").catch(() => undefined);
}
