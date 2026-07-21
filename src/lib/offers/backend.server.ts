// Server-only coupon reads. Public data (no user-specific record), so this
// mirrors catalog/backend.server.ts's service-role convention rather than
// authMiddleware's scoped client — there's no owner to scope by. Requires
// supabase/migrations/0008_coupons.sql to have been run; see
// plan/tasks/decisions.md, 2026-07-18.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Offers backend not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

export type Coupon = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discountType: "percent" | "flat";
  discountValue: number;
  minOrderAmount: number;
  expiresAt: string | null;
};

export async function listActiveCoupons(): Promise<Coupon[]> {
  const { data, error } = await admin()
    .from("coupons")
    .select(
      "id, code, title, description, discount_type, discount_value, min_order_amount, expires_at",
    )
    .eq("active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    minOrderAmount: row.min_order_amount,
    expiresAt: row.expires_at,
  }));
}
