// Real email+OTP auth via Supabase Auth, through the new src/lib/auth-session/
// server functions (real cookie-based session — see plan/tasks/decisions.md
// for the authorization-hardening plan this is Phase 1 of). Replaces the old
// custom localStorage dev-mode phone/OTP flow and src/lib/auth-bridge/
// (both retired). Shared by all three user types (customer, seller, partner).
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { requestOtp as requestOtpFn, verifyOtp as verifyOtpFn, logout as logoutFn, getCurrentUser } from "./auth-session/api.functions";

export type AuthUser = {
  id: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<AuthUser>;
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
      requestOtp: async (email: string) => {
        await requestOtpFn({ data: { email } });
      },
      verifyOtp: async (email: string, code: string) => {
        const account = await verifyOtpFn({ data: { email, code } });
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
