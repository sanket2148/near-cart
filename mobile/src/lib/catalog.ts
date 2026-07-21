// Real catalog queries, direct to Supabase with the anon key — RLS already
// grants public/anon read access to shops/products/categories (confirmed
// during Phase A of the web backend build-out), so no auth is needed just
// to browse. Mirrors the query shape of the web app's
// src/lib/catalog/backend.server.ts, just run client-side instead of via a
// service-role server function.
import { supabase } from "./supabase";
import type { Shop, Product, Category } from "@/lib/data";

const SHOP_SELECT = "*, categories(slug), shop_verifications(business_type, current_badge)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapShopRow(row: any): Shop {
  const verification = Array.isArray(row.shop_verifications) ? row.shop_verifications[0] : row.shop_verifications;
  return {
    id: row.id,
    name: row.name,
    category: row.categories?.slug ?? "",
    tagline: row.tagline ?? "",
    emoji: row.emoji ?? "🏪",
    rating: Number(row.rating_avg ?? 0),
    ratingCount: row.rating_count ?? 0,
    distanceKm: 0,
    etaMinutes: row.eta_minutes ?? 30,
    isOpen: Boolean(row.is_open),
    deliveryFee: (row.delivery_fee_amount ?? 0) / 100,
    freeAbove: (row.free_delivery_above_amount ?? 0) / 100,
    area: row.address_line ?? row.city ?? "",
    lat: row.lat,
    lng: row.lng,
    businessType: verification?.business_type ?? undefined,
    badgeTier: verification?.current_badge ?? undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProductRow(row: any): Product {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    emoji: row.emoji ?? "📦",
    price: (row.price_amount ?? 0) / 100,
    mrp: row.mrp_amount != null ? row.mrp_amount / 100 : undefined,
    unit: row.unit ?? "",
    category: row.menu_section ?? "",
    inStock: Boolean(row.in_stock),
  };
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("id, name, slug, icon");
  if (error) throw new Error(`getCategories failed: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.slug, name: row.name, emoji: row.icon ?? "" }));
}

export async function getShops(): Promise<Shop[]> {
  const { data, error } = await supabase.from("shops").select(SHOP_SELECT).eq("status", "active");
  if (error) throw new Error(`getShops failed: ${error.message}`);
  return (data ?? []).map(mapShopRow);
}

export async function getShop(shopId: string): Promise<Shop | null> {
  const { data, error } = await supabase.from("shops").select(SHOP_SELECT).eq("id", shopId).maybeSingle();
  if (error) throw new Error(`getShop failed: ${error.message}`);
  return data ? mapShopRow(data) : null;
}

export async function getShopProducts(shopId: string): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*").eq("shop_id", shopId).order("created_at", { ascending: false });
  if (error) throw new Error(`getShopProducts failed: ${error.message}`);
  return (data ?? []).map(mapProductRow);
}
