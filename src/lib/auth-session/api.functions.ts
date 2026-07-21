import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const requestOtp = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    await be.requestOtp(data.email);
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email(), code: z.string().min(4).max(10) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    const cookies = await import("./cookies.server");
    const result = await be.verifyOtp(data.email, data.code);
    cookies.setSessionCookies(result.session);
    return { id: result.userId, email: result.email };
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
