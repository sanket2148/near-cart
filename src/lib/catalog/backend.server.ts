// Server-only catalog queries (Phase B of the backend build-out).
// Real Supabase-backed shops/products, replacing the static arrays that used
// to live in src/lib/data.ts. Mirrors the two-file split already proven by
// src/lib/verification/{backend.server.ts,api.functions.ts}.
//
// "Nearby" distance is computed in JS (haversine) after fetching active
// shops, not via a PostGIS spatial query — the catalog is small enough that
// this is simpler than adding a custom RPC function for ST_DWithin, and can
// be revisited if/when the shop count actually gets large.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { haversineKm, type LatLng } from "@/lib/geo";
import type { BusinessType, BadgeTier } from "@/lib/verification";

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Catalog backend not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

// Same public bucket seller-data/backend.server.ts uploads real shop/product
// photos into — see plan/tasks/decisions.md, 2026-07-19.
const PUBLIC_BUCKET = "public-media";

function publicImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return admin().storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ─── Real open/closed status from shop_hours (2026-07-19) ───────────────────
// `shop_hours` existed since Phase A, fully RLS-correct, but nothing ever
// wrote to or read from it — every shop only ever had a manual is_open
// toggle a seller could forget to flip. When a shop HAS configured real
// hours, this computes a genuine "open now" + human label from them;
// otherwise falls back to the manual toggle exactly as before — zero
// regression for shops that never set hours. day_of_week follows
// JS Date#getDay() (0 = Sunday ... 6 = Saturday), matching the column's
// 0-6 check constraint with no other convention specified anywhere else in
// this codebase. See plan/tasks/decisions.md.

export type ShopHourRow = { day_of_week: number; open_time: string; close_time: string };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function computeOpenStatus(
  hours: ShopHourRow[],
  manualIsOpen: boolean,
  now: Date = new Date(),
): { isOpen: boolean; label: string } {
  if (hours.length === 0) {
    return { isOpen: manualIsOpen, label: manualIsOpen ? "Open" : "Closed" };
  }

  const nowDay = now.getDay();
  const nowHhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const today = hours.find((h) => h.day_of_week === nowDay);

  if (today) {
    const open = today.open_time.slice(0, 5);
    const close = today.close_time.slice(0, 5);
    if (nowHhmm >= open && nowHhmm < close) {
      return { isOpen: true, label: `Open · closes ${formatTime12h(close)}` };
    }
    if (nowHhmm < open) {
      return { isOpen: false, label: `Opens today at ${formatTime12h(open)}` };
    }
  }

  // Closed now — find the next day (starting tomorrow, wrapping the week) with hours.
  for (let offset = 1; offset <= 7; offset++) {
    const day = (nowDay + offset) % 7;
    const entry = hours.find((h) => h.day_of_week === day);
    if (entry) {
      const open = formatTime12h(entry.open_time.slice(0, 5));
      const when = offset === 1 ? "tomorrow" : DAY_NAMES[day];
      return { isOpen: false, label: `Opens ${when} at ${open}` };
    }
  }

  return { isOpen: false, label: "Closed" };
}

// ─── Shapes the client already renders (matches the old src/lib/data.ts types) ─

export type CatalogShop = {
  id: string;
  name: string;
  category: string;
  tagline: string;
  emoji: string;
  rating: number;
  ratingCount: number;
  distanceKm: number;
  etaMinutes: number;
  /** Real, hours-aware status when the shop has configured shop_hours; falls back to the manual toggle otherwise. */
  isOpen: boolean;
  /** e.g. "Open · closes 9:00 PM", "Opens tomorrow at 9:00 AM" — always present, human-readable. */
  openLabel: string;
  deliveryFee: number;
  freeAbove: number;
  area: string;
  lat: number;
  lng: number;
  businessType?: BusinessType;
  badgeTier?: BadgeTier;
  logoUrl?: string;
};

export type CatalogProduct = {
  id: string;
  shopId: string;
  shopName?: string;
  name: string;
  emoji: string;
  price: number;
  mrp?: number;
  unit: string;
  category: string;
  inStock: boolean;
  stockQty?: number;
  imageUrl?: string;
};

const SHOP_SELECT =
  "*, categories(slug), shop_verifications(business_type, current_badge), shop_hours(day_of_week, open_time, close_time)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapShopRow(row: any, userLoc?: LatLng): CatalogShop {
  const verification = Array.isArray(row.shop_verifications)
    ? row.shop_verifications[0]
    : row.shop_verifications;
  const openStatus = computeOpenStatus(
    (row.shop_hours ?? []) as ShopHourRow[],
    Boolean(row.is_open),
  );
  return {
    id: row.id,
    name: row.name,
    category: row.categories?.slug ?? "",
    tagline: row.tagline ?? "",
    emoji: row.emoji ?? "🏪",
    rating: Number(row.rating_avg ?? 0),
    ratingCount: row.rating_count ?? 0,
    distanceKm: userLoc
      ? Number(haversineKm(userLoc, { lat: row.lat, lng: row.lng }).toFixed(1))
      : 0,
    etaMinutes: row.eta_minutes ?? 30,
    isOpen: openStatus.isOpen,
    openLabel: openStatus.label,
    deliveryFee: (row.delivery_fee_amount ?? 0) / 100,
    freeAbove: (row.free_delivery_above_amount ?? 0) / 100,
    area: row.address_line,
    lat: Number(row.lat),
    lng: Number(row.lng),
    businessType: (verification?.business_type as BusinessType | undefined) ?? undefined,
    badgeTier: (verification?.current_badge as BadgeTier | undefined) ?? "none",
    logoUrl: publicImageUrl(row.logo_path),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProductRow(row: any): CatalogProduct {
  return {
    id: row.id,
    shopId: row.shop_id,
    shopName: row.shops?.name,
    name: row.name,
    emoji: row.emoji ?? "📦",
    price: (row.price_amount ?? 0) / 100,
    mrp: row.mrp_amount != null ? row.mrp_amount / 100 : undefined,
    unit: row.unit ?? "",
    category: row.menu_section ?? "",
    inStock: Boolean(row.in_stock),
    stockQty: row.stock_qty ?? undefined,
    imageUrl: publicImageUrl(row.image_path),
  };
}

export type NearbyShopsInput = { lat?: number; lng?: number; category?: string };

export type CatalogCategory = { id: string; name: string; emoji: string };

export async function getCategories(): Promise<CatalogCategory[]> {
  const { data, error } = await admin().from("categories").select("id, name, slug, icon");
  if (error) throw new Error(`getCategories failed: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.slug, name: row.name, emoji: row.icon ?? "" }));
}

export async function getNearbyShops(input: NearbyShopsInput): Promise<CatalogShop[]> {
  const { data, error } = await admin().from("shops").select(SHOP_SELECT).eq("status", "active");
  if (error) throw new Error(`getNearbyShops failed: ${error.message}`);

  const userLoc =
    input.lat != null && input.lng != null ? { lat: input.lat, lng: input.lng } : undefined;
  let shops = (data ?? []).map((row) => mapShopRow(row, userLoc));
  if (input.category) shops = shops.filter((s) => s.category === input.category);
  return shops;
}

export async function getShop(shopId: string): Promise<CatalogShop | null> {
  const { data, error } = await admin()
    .from("shops")
    .select(SHOP_SELECT)
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw new Error(`getShop failed: ${error.message}`);
  return data ? mapShopRow(data) : null;
}

export async function getShopProducts(shopId: string): Promise<CatalogProduct[]> {
  const { data, error } = await admin().from("products").select("*").eq("shop_id", shopId);
  if (error) throw new Error(`getShopProducts failed: ${error.message}`);
  return (data ?? []).map(mapProductRow);
}

export async function searchShops(query: string): Promise<CatalogShop[]> {
  const { data, error } = await admin()
    .from("shops")
    .select(SHOP_SELECT)
    .eq("status", "active")
    .ilike("name", `%${query}%`);
  if (error) throw new Error(`searchShops failed: ${error.message}`);
  return (data ?? []).map((row) => mapShopRow(row));
}

export async function searchProducts(query: string): Promise<CatalogProduct[]> {
  const { data, error } = await admin()
    .from("products")
    .select("*, shops(name)")
    .ilike("name", `%${query}%`)
    .limit(30);
  if (error) throw new Error(`searchProducts failed: ${error.message}`);
  return (data ?? []).map(mapProductRow);
}
