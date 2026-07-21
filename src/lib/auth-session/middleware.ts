// Real per-request authorization middleware — Phase 1/2 of the
// authorization-hardening plan (plan/tasks/decisions.md). Only ever touches
// the anon key (a public credential already shipped to the browser as
// VITE_SUPABASE_ANON_KEY) plus the caller's own session cookie — but cookie
// reads/writes go through a dynamic `import("./cookies.server")` (not a
// plain top-level import), same as every backend.server.ts in this
// codebase: a top-level `@tanstack/react-start/server` import gets flagged
// by TanStack Start's Vite import-protection plugin for any file reachable
// from the client entry, even when it's only used inside a middleware
// .server() callback — this file used to import getRequestHeader directly
// and broke the client bundle for exactly that reason (caught via a real
// browser load, not curl, which only exercises SSR/RPC endpoints). See
// plan/tasks/decisions.md, 2026-07-19.
import { createMiddleware } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Resolves a verified `uid` + a request-scoped Supabase client (anon key,
 * bearer = the caller's own access token — so this client's every query is
 * subject to RLS AS that specific user, not the service-role bypass).
 * Silently attempts a refresh if the access token is missing/expired,
 * re-persisting fresh cookies via the same cookies.server.ts path
 * auth-session/api.functions.ts uses.
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new AuthError("Auth not configured", 500);

  const cookies = await import("./cookies.server");
  let accessToken = cookies.readAccessTokenCookie();

  async function verify(token: string) {
    const client = createClient(url as string, anonKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return { uid: data.user.id, scopedClient: client };
  }

  let resolved = accessToken ? await verify(accessToken) : null;

  if (!resolved) {
    const refreshToken = cookies.readRefreshTokenCookie();
    if (refreshToken) {
      const be = await import("./backend.server");
      const session = await be.refreshSession(refreshToken);
      if (session) {
        cookies.persistRefreshedSession(session);
        accessToken = session.access_token;
        resolved = await verify(accessToken);
      }
    }
  }

  if (!resolved) throw new AuthError("Unauthorized", 401);

  return next({ context: { uid: resolved.uid, scopedClient: resolved.scopedClient } });
});

export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    const { data } = await context.scopedClient
      .from("user_roles")
      .select("role")
      .eq("user_id", context.uid)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw new AuthError("Forbidden", 403);
    return next();
  });
