// Real weekly shop hours — `shop_hours` has existed since Phase A with fully
// correct RLS (public read, owner-only write via a real shops.owner_id
// check) but was never wired to anything at all; shops only ever had a
// manual open/closed toggle. This module needs NO service-role client at
// all — both the public read and the owner-scoped write are entirely
// enforced by the table's own RLS policies, the cleanest possible case of
// the "flip to RLS" pattern the auth-hardening plan flagged as a good
// future candidate. See plan/tasks/decisions.md, 2026-07-19.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth-session/middleware";

function anonClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "Shop-hours backend not configured: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY missing.",
    );
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type ShopHourEntry = { dayOfWeek: number; openTime: string; closeTime: string };

/** Public — no login needed to see a shop's hours. Absence of a row for a day means closed that day. */
export const getShopHours = createServerFn({ method: "GET" })
  .inputValidator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ data }): Promise<ShopHourEntry[]> => {
    const { data: rows, error } = await anonClient()
      .from("shop_hours")
      .select("day_of_week, open_time, close_time")
      .eq("shop_id", data.shopId)
      .order("day_of_week", { ascending: true });
    if (error) throw new Error(`getShopHours failed: ${error.message}`);
    return (rows ?? []).map((r) => ({
      dayOfWeek: r.day_of_week,
      openTime: String(r.open_time).slice(0, 5),
      closeTime: String(r.close_time).slice(0, 5),
    }));
  });

const HourEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
});

/**
 * Replaces the caller's shop's whole weekly schedule. Ownership is entirely
 * enforced by `shop_hours_owner_write`'s RLS check on context.scopedClient —
 * there is no separate ownership check in this file because the database
 * itself refuses to touch a row this session's uid doesn't own.
 */
export const setShopHours = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopId: z.string().min(1), hours: z.array(HourEntrySchema).max(7) }))
  .handler(async ({ context, data }) => {
    const { error: delErr } = await context.scopedClient
      .from("shop_hours")
      .delete()
      .eq("shop_id", data.shopId);
    if (delErr) throw new Error(`setShopHours failed: ${delErr.message}`);
    if (data.hours.length === 0) return;

    const { error: insErr } = await context.scopedClient.from("shop_hours").insert(
      data.hours.map((h) => ({
        shop_id: data.shopId,
        day_of_week: h.dayOfWeek,
        open_time: `${h.openTime}:00`,
        close_time: `${h.closeTime}:00`,
      })),
    );
    if (insErr) throw new Error(`setShopHours failed: ${insErr.message}`);
  });
