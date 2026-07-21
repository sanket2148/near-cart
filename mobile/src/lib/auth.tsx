// Real email+OTP auth via Supabase Auth directly — NOT the web app's
// custom localStorage session (src/lib/auth.tsx in the web app). Mobile
// gets a real supabase.auth session (JWT), which is what makes the RLS
// policies + the place_order_mobile RPC (0005_place_order_mobile_rpc.sql)
// actually work.
//
// EMAIL, NOT PHONE — a deliberate pivot (2026-07-18): phone OTP needs an
// SMS provider (Twilio et al.), and Twilio requires a paid account to
// actually deliver to India. Supabase's built-in email provider needs no
// third-party signup at all. Phone auth may come back later (see
// backlog.md) — this can run alongside it eventually, since
// 0006_users_phone_nullable.sql already made public.users.phone optional
// specifically to allow email-only accounts to coexist with phone ones.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type AuthUser = { id: string; email: string };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionToUser(session: Session | null): AuthUser | null {
  if (!session?.user?.email) return null;
  return { id: session.user.id, email: session.user.email };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user: sessionToUser(session),
    loading,
    requestOtp: async (email) => {
      // shouldCreateUser: true — first-time sign-in doubles as sign-up, matching
      // the phone-OTP flow's original behavior (no separate registration step).
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
    },
    verifyOtp: async (email, code) => {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
    },
    logout: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
