// Cookie read/write helpers, split out of api.functions.ts into their own
// .server.ts file after a real browser load (not curl, which only exercises
// SSR/RPC endpoints) surfaced a genuine client-bundle break: a plain
// top-level `@tanstack/react-start/server` import gets flagged by TanStack
// Start's Vite import-protection plugin for ANY file reachable from the
// client entry, even when the functions using it are only ever called from
// inside a createServerFn handler or middleware .server() callback — the
// plugin checks the file's imports, not which function body ends up calling
// them. Only .server.ts files are excluded from the client build; this file
// is always reached via a dynamic `await import("./cookies.server")` from
// api.functions.ts/middleware.ts, matching every other backend.server.ts in
// this codebase's own convention. See plan/tasks/decisions.md, 2026-07-19.
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import type { Session } from "@supabase/supabase-js";

/** The only fields this file actually needs off a Session — narrower than the
 * real type (which also requires a full `user: User`) so callers that only
 * have the token trio (e.g. completeOAuthSession, reconstructing a session
 * from a client-exchanged OAuth code) don't need to fabricate one. A real
 * `Session` object already satisfies this structurally. */
export type SessionTokens = Pick<Session, "access_token" | "refresh_token" | "expires_in">;

export const ACCESS_COOKIE = "__Host-nc-at";
export const REFRESH_COOKIE = "__Host-nc-rt";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function cookieHeader(name: string, value: string, maxAgeSeconds: number): string {
  // `__Host-` prefix requires: no Domain attribute, Path=/, Secure. Binds the
  // cookie to this exact origin — see the bundled auth-server-primitives skill.
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

function clearCookieHeader(name: string): string {
  return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function setSessionCookies(session: SessionTokens): void {
  setResponseHeader("set-cookie", [
    cookieHeader(ACCESS_COOKIE, session.access_token, session.expires_in),
    cookieHeader(REFRESH_COOKIE, session.refresh_token, THIRTY_DAYS),
  ]);
}

export function clearSessionCookies(): void {
  setResponseHeader("set-cookie", [
    clearCookieHeader(ACCESS_COOKIE),
    clearCookieHeader(REFRESH_COOKIE),
  ]);
}

/** Parses the `cookie` request header — TanStack Start doesn't expose a parsed cookie jar, just the raw header. */
function readCookie(name: string): string | undefined {
  const header = getRequestHeader("cookie");
  if (!header) return undefined;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return undefined;
}

export function readAccessTokenCookie(): string | undefined {
  return readCookie(ACCESS_COOKIE);
}

export function readRefreshTokenCookie(): string | undefined {
  return readCookie(REFRESH_COOKIE);
}

/** Re-sets both cookies after a successful silent refresh. */
export function persistRefreshedSession(session: Session): void {
  setSessionCookies(session);
}
