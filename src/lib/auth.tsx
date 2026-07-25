// Real email+password auth via Supabase Auth, through
// src/lib/auth-session/'s server functions (real cookie-based session — see
// plan/tasks/decisions.md for the authorization-hardening plan this
// continues). Replaced email OTP 2026-07-24 — no custom SMTP is configured
// for this project, so OTP codes rode Supabase's default, heavily rate-
// limited email provider and could go undelivered; password auth needs no
// outbound email for login at all. Shared by all three user types
// (customer, seller, partner).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  signIn as signInFn,
  signUp as signUpFn,
  logout as logoutFn,
  getCurrentUser,
} from "./auth-session/api.functions";

export type AuthUser = {
  id: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then((u) => setUser(u))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signIn: async (email: string, password: string) => {
        const account = await signInFn({ data: { email, password } });
        setUser(account);
        return account;
      },
      signUp: async (email: string, password: string) => {
        const account = await signUpFn({ data: { email, password } });
        setUser(account);
        return account;
      },
      logout: async () => {
        await logoutFn();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
