import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PASSWORD_SCHEMA = z.string().min(8, "Password must be at least 8 characters.");

export const signIn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), password: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    const cookies = await import("./cookies.server");
    const result = await be.signInWithPassword(data.email, data.password);
    cookies.setSessionCookies(result.session);
    return { id: result.userId, email: result.email };
  });

export const signUp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), password: PASSWORD_SCHEMA }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    const cookies = await import("./cookies.server");
    const result = await be.signUpWithPassword(data.email, data.password);
    cookies.setSessionCookies(result.session);
    return { id: result.userId, email: result.email };
  });

// The OAuth code exchange itself happens client-side (src/routes/auth.callback.tsx)
// — this just takes the resulting session tokens, re-verifies them for real
// against Supabase (never trusts a client-supplied token blindly), and
// writes them into the same real HttpOnly cookies every other login path
// uses. See src/lib/auth-session/backend.server.ts's verifyOAuthSession.
export const completeOAuthSession = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().min(1),
      refreshToken: z.string().min(1),
      expiresIn: z.number().int().positive(),
    }),
  )
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    const cookies = await import("./cookies.server");
    const user = await be.verifyOAuthSession(data.accessToken);
    cookies.setSessionCookies({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
      expires_in: data.expiresIn,
    });
    return user;
  });

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const cookies = await import("./cookies.server");
  const accessToken = cookies.readAccessTokenCookie();
  if (!accessToken) return null;
  const be = await import("./backend.server");
  const user = await be.getUserForToken(accessToken);
  if (user) return user;

  // Access token expired/invalid — try a silent refresh before giving up.
  const refreshToken = cookies.readRefreshTokenCookie();
  if (!refreshToken) return null;
  const session = await be.refreshSession(refreshToken);
  if (!session) return null;
  cookies.persistRefreshedSession(session);
  const refreshedUser = await be.getUserForToken(session.access_token);
  return refreshedUser;
});

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const cookies = await import("./cookies.server");
  const accessToken = cookies.readAccessTokenCookie();
  cookies.clearSessionCookies();
  if (accessToken) {
    const be = await import("./backend.server");
    await be.signOut(accessToken);
  }
});
