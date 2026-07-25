import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";

// Mints a real Supabase session for a throwaway test account and injects the
// exact __Host-nc-at/__Host-nc-rt cookies src/lib/auth-session/cookies.server.ts
// sets on a real login, so most tests can exercise authenticated pages
// without re-driving the login UI on every single test. (Login moved from
// email OTP to email+password 2026-07-24 — signInWithPassword below is now
// the exact same call the real EmailPasswordAuth component itself makes,
// not a workaround for anything; a real login-UI e2e test is fully
// straightforward now, unlike the old OTP flow's code-format mismatch.)

function env() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    throw new Error(
      "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY env vars.",
    );
  }
  return { url, anonKey, serviceKey };
}

export type TestUser = { id: string; email: string };

export async function createTestUser(emailPrefix: string): Promise<TestUser> {
  const { url, serviceKey } = env();
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const email = `${emailPrefix}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "Test1234!",
    email_confirm: true,
  });
  if (error) throw new Error(`createTestUser failed: ${error.message}`);
  await admin.from("users").upsert({ id: data.user.id, email });
  return { id: data.user.id, email };
}

export async function deleteTestUser(id: string): Promise<void> {
  const { url, serviceKey } = env();
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  await admin.auth.admin.deleteUser(id).catch(() => {});
}

export function adminClient() {
  const { url, serviceKey } = env();
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Logs the browser context in as `user` by injecting a real session's cookies — same cookies a real OTP login would set. */
export async function loginAs(
  context: BrowserContext,
  user: TestUser,
  baseURL: string,
): Promise<void> {
  const { url, anonKey } = env();
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({
    email: user.email,
    password: "Test1234!",
  });
  if (error) throw new Error(`loginAs signIn failed: ${error.message}`);
  await context.addCookies([
    {
      name: "__Host-nc-at",
      value: data.session.access_token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: "__Host-nc-rt",
      value: data.session.refresh_token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}
