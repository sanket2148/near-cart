// Real system-status checks (inspired by openstatus.dev's status-page
// model, at the user's request — see plan/tasks/decisions.md). Every check
// here does something real and schema-free: no new table, no migration,
// nothing decorative. Public — a status page that requires being logged in
// to view defeats the point (it's exactly what you'd check *during* an
// incident, possibly one affecting auth itself).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

export type CheckStatus = "operational" | "degraded" | "down" | "not_configured";

export type ServiceCheck = {
  name: string;
  status: CheckStatus;
  detail: string;
  latencyMs?: number;
};

export type SystemStatus = {
  checkedAt: string;
  overall: "operational" | "degraded" | "down";
  services: ServiceCheck[];
};

async function checkDatabase(): Promise<ServiceCheck> {
  const client = admin();
  if (!client) {
    return { name: "Database", status: "down", detail: "Service role key not configured." };
  }
  const start = Date.now();
  const { error } = await client.from("categories").select("id").limit(1);
  const latencyMs = Date.now() - start;
  if (error) {
    return { name: "Database", status: "down", detail: error.message, latencyMs };
  }
  return {
    name: "Database",
    status: latencyMs > 2000 ? "degraded" : "operational",
    detail:
      latencyMs > 2000 ? "Responding, but slower than usual." : "Queries are responding normally.",
    latencyMs,
  };
}

async function checkPayments(): Promise<ServiceCheck> {
  // Real check, not a live ping to Razorpay — this project has no funded
  // Razorpay account yet (see payments/backend.server.ts), so "not
  // configured" is the honest status, not a fabricated "operational".
  const paymentsBe = await import("@/lib/payments/backend.server");
  const configured = paymentsBe.isConfigured();
  return configured
    ? { name: "Payments (Razorpay)", status: "operational", detail: "Gateway configured." }
    : {
        name: "Payments (Razorpay)",
        status: "not_configured",
        detail:
          "No gateway configured yet — orders use the cash-on-delivery / instant-paid fallback.",
      };
}

function checkWebApp(): ServiceCheck {
  // If this function ran at all, the web app + its server functions are
  // responding — real, not decorative, just trivially always true from
  // inside a request this code is handling.
  return { name: "Web App", status: "operational", detail: "Serving requests normally." };
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const [database, payments] = await Promise.all([checkDatabase(), checkPayments()]);
  const services = [checkWebApp(), database, payments];

  const overall: SystemStatus["overall"] = services.some((s) => s.status === "down")
    ? "down"
    : services.some((s) => s.status === "degraded")
      ? "degraded"
      : "operational";

  return { checkedAt: new Date().toISOString(), overall, services };
}
