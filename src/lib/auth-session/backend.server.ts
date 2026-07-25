// Server-only real Supabase Auth session issuance (email + password —
// replaced email OTP 2026-07-24, see plan/tasks/decisions.md: the OTP email
// itself was real and correct, but this project has no custom SMTP
// configured, so it rode Supabase's default email provider, which is
// heavily rate-limited/unreliable for real delivery — a real user could
// request a code and never receive it. Password auth needs zero outbound
// email for login, matching what e2e/auth-helper.ts's test users already
// proved works reliably (createTestUser has used
// `admin.auth.admin.createUser({..., password, email_confirm: true})` +
// `signInWithPassword` all along, for exactly this reason). Replaces
// src/lib/auth.tsx's custom localStorage dev-mode flow and
// src/lib/auth-bridge/ (both retired once real sessions shipped) — see
// plan/tasks/decisions.md for the authorization-hardening plan this
// continues. Every server function elsewhere in the app derives identity
// from this real session via ./middleware.ts, never a client-supplied id.
//
// signIn uses the anon key (an auth operation, not a privileged data
// operation — matches mobile/src/lib/auth.tsx's pattern). signUp needs the
// service-role key specifically to set `email_confirm: true` at creation —
// the anon key's own `signUp()` would still require a real confirmation
// email, which is the exact dependency this change removes. No password-
// reset flow exists yet (would need email again) — deliberately deferred,
// not an oversight.
//
// Phone sign-in remains disabled at the Supabase project level (no funded
// SMS provider) — unrelated to this change, unaffected by it.

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

export type VerifiedSession = { userId: string; email: string; session: Session };

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<VerifiedSession> {
  const { data, error } = await anon().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session || !data.user?.email)
    throw new Error("Sign-in succeeded but no session was returned.");
  return { userId: data.user.id, email: data.user.email, session: data.session };
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<VerifiedSession> {
  const adminClient = admin();
  if (!adminClient) throw new Error("Sign-up not configured (service role key missing).");

  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw new Error(createErr.message);

  // createUser doesn't itself return a usable session — sign in immediately
  // with the same credentials to get real access/refresh tokens, same as
  // any other login.
  const { data: signedIn, error: signInErr } = await anon().auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !signedIn.session) {
    throw new Error(signInErr?.message ?? "Account created but sign-in failed.");
  }
  return { userId: created.user.id, email: created.user.email ?? email, session: signedIn.session };
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
