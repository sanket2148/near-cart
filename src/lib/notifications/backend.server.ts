// Write-side of the notifications table — `notifications` only grants
// select/update to `authenticated` (see 0001_initial_schema.sql), so every
// insert needs the service-role client, unlike api.functions.ts's own
// read/mark-read functions which run entirely on context.scopedClient.
//
// Other backend.server.ts modules (seller-data, partner-data, admin-data)
// import insertNotification directly — this is a shared cross-cutting
// utility (same category as src/lib/geo.ts's haversineKm), not an
// ownership-check helper, so it's exempt from the "each backend.server.ts
// is self-contained" convention that applies to per-module auth helpers.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Notifications backend not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

export async function insertNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin()
    .from("notifications")
    .insert({ user_id: userId, type, title, body: body ?? null, data: data ?? null });
  // Notifications are a side-effect, not the primary operation (order status
  // change, verification decision) — a failure here must never roll back or
  // fail the caller's real mutation, just log it.
  if (error) console.error(`insertNotification failed (${type}):`, error.message);
}
