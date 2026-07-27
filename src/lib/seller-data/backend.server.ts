// Server-only seller operations (Phase D of the backend build-out).
// Replaces src/lib/seller.tsx's localStorage persistence for shop/products/
// orders with real DB rows, while SellerProvider keeps exposing the exact
// same Context shape so seller.index.tsx/seller.orders.tsx/seller.products.tsx
// etc. don't need to change at all.
//
// NOT touched here (deliberately out of scope for Phase D):
//   - Verification wizard state (src/lib/verification.ts) — still
//     localStorage; its own migration off the generic `events` table is a
//     separately tracked backlog item.
//
// getAvailablePartners()/offerToPartner() were added in Phase E — they're
// the seller-initiated half of real dispatch; src/lib/partner-data/ has the
// partner-initiated half (accept/decline/pickup/deliver).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/lib/data";
import type { BusinessType, BadgeTier } from "@/lib/verification";
import { insertNotification, notifyLowStockCrossings } from "@/lib/notifications/backend.server";

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Seller backend not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

// ─── Ownership checks (Phase 4 of the authorization-hardening plan, 2026-07-19) ─
// Every function below used to trust a client-supplied shopId/productId/orderId
// with zero verification — any authenticated caller could mutate any other
// seller's shop, products, or orders just by knowing/guessing an id. `callerId`
// must always be the session-derived context.uid, never a client-supplied
// value. See plan/tasks/decisions.md.

class OwnershipError extends Error {}

async function assertShopOwner(shopId: string, callerId: string): Promise<void> {
  const { data, error } = await admin()
    .from("shops")
    .select("owner_id")
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw new Error(`Ownership check failed: ${error.message}`);
  if (!data || data.owner_id !== callerId) throw new OwnershipError("This isn't your shop.");
}

/** Returns the owning shop id + current name once ownership is confirmed — callers that need either (e.g. updateProduct's catalog link) can reuse it without a second query. */
async function assertProductOwner(
  productId: string,
  callerId: string,
): Promise<{ shopId: string; name: string }> {
  const { data, error } = await admin()
    .from("products")
    .select("shop_id, name, shops(owner_id)")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new Error(`Ownership check failed: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  const ownerId = Array.isArray(row?.shops) ? row.shops[0]?.owner_id : row?.shops?.owner_id;
  if (!row || ownerId !== callerId) throw new OwnershipError("This isn't your product.");
  return { shopId: row.shop_id as string, name: row.name as string };
}

async function assertOrderOwner(orderId: string, callerId: string): Promise<void> {
  const { data, error } = await admin()
    .from("orders")
    .select("shop_id, shops(owner_id)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Ownership check failed: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  const ownerId = Array.isArray(row?.shops) ? row.shops[0]?.owner_id : row?.shops?.owner_id;
  if (!row || ownerId !== callerId) throw new OwnershipError("This order isn't for your shop.");
}

// ─── Shop ────────────────────────────────────────────────────────────────────

export type ShopProfile = {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  area: string;
  isOpen: boolean;
  deliveryFee: number;
  freeAbove: number;
  etaMinutes: number;
  businessType: BusinessType | null;
  badgeTier: BadgeTier;
  verificationStatus: "incomplete" | "pending_review" | "approved" | "suspended";
  logoUrl?: string;
};

// Same public bucket catalog/backend.server.ts reads from — see
// plan/tasks/decisions.md, 2026-07-19.
const PUBLIC_BUCKET = "public-media";

function publicImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return admin().storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapShopRow(row: any): ShopProfile {
  const verification = Array.isArray(row.shop_verifications)
    ? row.shop_verifications[0]
    : row.shop_verifications;
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline ?? "",
    emoji: row.emoji ?? "🏪",
    area: row.address_line,
    isOpen: Boolean(row.is_open),
    deliveryFee: (row.delivery_fee_amount ?? 0) / 100,
    freeAbove: (row.free_delivery_above_amount ?? 0) / 100,
    etaMinutes: row.eta_minutes ?? 30,
    businessType: (verification?.business_type as BusinessType | undefined) ?? null,
    badgeTier: (verification?.current_badge as BadgeTier | undefined) ?? "none",
    verificationStatus:
      (verification?.overall_status as ShopProfile["verificationStatus"] | undefined) ??
      "incomplete",
    logoUrl: publicImageUrl(row.logo_path),
  };
}

const SHOP_SELECT = "*, shop_verifications(business_type, current_badge, overall_status)";

export async function getMyShop(ownerId: string): Promise<ShopProfile | null> {
  const { data, error } = await admin()
    .from("shops")
    .select(SHOP_SELECT)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(`getMyShop failed: ${error.message}`);
  return data ? mapShopRow(data) : null;
}

export type NewShopInput = {
  name: string;
  businessType: BusinessType;
  area: string;
  tagline?: string;
  lat: number;
  lng: number;
};

/**
 * A shop only ever needs one of these, created exactly once, right when it
 * first gets a real owner (verification is strictly 1:1 with `shop_id`, see
 * `shop_verifications`'s unique FK). `claimShop` below provisions its own
 * inline (wrapped in a short retry — see `retryFlaky`), since an OSM-
 * imported unclaimed shop deliberately has none yet: there's no owner to
 * run KYC against until someone claims it.
 */
async function provisionVerification(shopId: string, businessType: BusinessType): Promise<void> {
  await admin().from("shop_verifications").insert({ shop_id: shopId, business_type: businessType });
}

// Real Bengaluru bounding box (generous — covers the metro area plus
// margin), just enough to reject obviously-bogus values (0,0 from a client
// bug, out-of-range floats, ...) before they land in PostGIS. Not a tight
// service-area check — `nearby_shops`'s radius filter already handles "too
// far to be useful" at query time; this is only a sanity gate.
const LAT_MIN = 12.6;
const LAT_MAX = 13.3;
const LNG_MIN = 77.3;
const LNG_MAX = 77.9;

function assertRealCoords(lat: number, lng: number): void {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < LAT_MIN ||
    lat > LAT_MAX ||
    lng < LNG_MIN ||
    lng > LNG_MAX
  ) {
    throw new Error("Shop location looks invalid — please re-pin your shop's location on the map.");
  }
}

export async function createShop(ownerId: string, input: NewShopInput): Promise<ShopProfile> {
  // Every shop used to land at the exact same hardcoded point regardless of
  // where it actually is — harmless while there was no real proximity
  // search, but once `nearby_shops`'s PostGIS radius/KNN query shipped
  // (migration 0012), a shop's real coordinates are load-bearing: a fake
  // shared point makes every new merchant either wrongly invisible (outside
  // the customer's radius) or wrongly ranked (falsely "closest"). The
  // merchant now pins their real location client-side (see
  // CreateShopStep.tsx) and it's required, not optional.
  assertRealCoords(input.lat, input.lng);

  const { data: category } = await admin()
    .from("categories")
    .select("id")
    .eq("slug", input.businessType)
    .maybeSingle();

  const { data: shop, error } = await admin()
    .from("shops")
    .insert({
      owner_id: ownerId,
      name: input.name,
      category_id: category?.id ?? null,
      tagline: input.tagline ?? "",
      address_line: input.area,
      city: "Bengaluru",
      pincode: "560095",
      lat: input.lat,
      lng: input.lng,
      status: "active",
      is_open: false,
    })
    .select("id")
    .single();
  if (error) throw new Error(`createShop failed: ${error.message}`);

  await provisionVerification(shop.id, input.businessType);

  const created = await getMyShop(ownerId);
  if (!created) throw new Error("createShop: shop vanished immediately after creation");
  return created;
}

export type UnclaimedShop = {
  id: string;
  name: string;
  addressLine: string;
  city: string;
};

/** Simple name search over unclaimed listings — enough for a merchant to find "is this my shop?" during onboarding. */
export async function searchUnclaimedShops(query: string): Promise<UnclaimedShop[]> {
  const { data, error } = await admin()
    .from("shops")
    .select("id, name, address_line, city")
    .eq("claimed", false)
    .eq("status", "active")
    .ilike("name", `%${query}%`)
    .limit(20);
  if (error) throw new Error(`searchUnclaimedShops failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    addressLine: row.address_line,
    city: row.city,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShopMatchRow = any;

/**
 * Real name+proximity duplicate check for the "create a new shop" flow (see
 * plan/tasks/decisions.md 2026-07-24) — combines pg_trgm name similarity
 * with a PostGIS radius filter (migration 0014), unlike searchUnclaimedShops'
 * plain substring match. Only meaningful once the merchant has pinned a real
 * location (CreateShopStep.tsx calls this instead of searchUnclaimedShops
 * once `coords` exists). Filtered to unclaimed listings here — only those are
 * actionable for a merchant creating a shop; the underlying SQL function
 * also returns claimed shops so it can back an admin-side duplicate hint
 * later without a second implementation.
 */
export async function findPossibleShopMatches(
  name: string,
  lat: number,
  lng: number,
): Promise<UnclaimedShop[]> {
  const { data, error } = await admin().rpc("find_shop_matches", {
    p_name: name,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) throw new Error(`findPossibleShopMatches failed: ${error.message}`);
  return ((data ?? []) as ShopMatchRow[])
    .filter((row) => row.claimed === false)
    .map((row) => ({
      id: row.id,
      name: row.name,
      addressLine: row.address_line,
      city: row.city,
    }));
}

/**
 * Claims an OSM-imported (or otherwise unclaimed) shop for the calling
 * user — the other half of the cold-start fix alongside
 * `supabase/import-osm-shops.mjs` (see plan/tasks/decisions.md 2026-07-22).
 * The conditional update (`WHERE claimed = false`) is what actually
 * prevents two merchants racing to claim the same listing — matches the
 * optimistic-concurrency pattern already used throughout this file
 * (`setOrderStatus`) and partner-data's `acceptJob`: whichever request's
 * update matches zero rows lost the race and must not proceed to
 * provision verification for a shop it doesn't actually own.
 */
/**
 * Retries a flaky-under-load step. Empirically, this dev environment's
 * request handling can very occasionally make a row inserted/updated a
 * moment ago briefly invisible to the *next* query in the same handler
 * (confirmed NOT a Postgres/RLS/constraint issue — the identical sequence
 * run as a plain standalone script against the same project never
 * reproduces it) — so a short retry is the pragmatic fix here, not a
 * change to the actual claim logic above, which is already correct and
 * race-safe on its own.
 */
async function retryFlaky<T>(fn: () => Promise<T>, attempts = 3, delayMs = 150): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export async function claimShop(
  shopId: string,
  callerId: string,
  businessType: BusinessType,
): Promise<ShopProfile> {
  const already = await getMyShop(callerId);
  if (already) throw new Error("You already have a shop — one account can only own one shop.");

  const { data: claimed, error } = await admin()
    .from("shops")
    .update({ owner_id: callerId, claimed: true, claimed_at: new Date().toISOString() })
    .eq("id", shopId)
    .eq("claimed", false)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`claimShop failed: ${error.message}`);
  if (!claimed) throw new Error("This shop was already claimed — someone got there first.");

  await retryFlaky(async () => {
    const { error: verifyErr } = await admin()
      .from("shop_verifications")
      .insert({ shop_id: shopId, business_type: businessType });
    if (verifyErr) throw new Error(`provisionVerification failed: ${verifyErr.message}`);
  });

  const result = await retryFlaky(async () => {
    const shop = await getMyShop(callerId);
    if (!shop) throw new Error("claimShop: shop not visible yet after claiming");
    return shop;
  });
  return result;
}

export async function updateShop(
  shopId: string,
  callerId: string,
  patch: Partial<ShopProfile>,
): Promise<void> {
  await assertShopOwner(shopId, callerId);
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.tagline !== undefined) row.tagline = patch.tagline;
  if (patch.emoji !== undefined) row.emoji = patch.emoji;
  if (patch.area !== undefined) row.address_line = patch.area;
  if (patch.isOpen !== undefined) row.is_open = patch.isOpen;
  if (patch.deliveryFee !== undefined)
    row.delivery_fee_amount = Math.round(patch.deliveryFee * 100);
  if (patch.freeAbove !== undefined)
    row.free_delivery_above_amount = Math.round(patch.freeAbove * 100);
  if (patch.etaMinutes !== undefined) row.eta_minutes = patch.etaMinutes;
  if (Object.keys(row).length === 0) return;

  const { error } = await admin().from("shops").update(row).eq("id", shopId);
  if (error) throw new Error(`updateShop failed: ${error.message}`);
}

type LevelStatus = "not_started" | "in_progress" | "submitted" | "verified" | "rejected";

/**
 * The verification WIZARD's full progress (documents, KYC, bank, GPS, etc.)
 * still lives in localStorage (src/lib/verification.ts) — raw PAN/Aadhaar/
 * bank details/GPS coordinates and uploaded-file records are a separately
 * tracked backlog item (a real PII-storage decision, not just wiring), not
 * done here. But the level *statuses* map 1:1 onto shop_verifications'
 * l1_phone..l7_review columns, which existed since Phase A and were never
 * written — this closes that gap so the admin queue and any future page can
 * see real per-level progress, not just the badge/overall-status summary.
 */
// The seller's own wizard may only ever move a shop between these two
// statuses — "approved"/"suspended" are admin-only decisions, already
// correctly gated behind adminMiddleware in admin-data/backend.server.ts
// (approveShop/rejectShop/suspendShop). Before this check, a seller could
// call this function with overallStatus: "approved" directly and
// self-approve their own shop, skipping admin review entirely — found while
// auditing this module for Phase 4 of the authorization-hardening plan, not
// one of the originally-scoped items, but the same class of bug (a
// client-trusted status value) and too serious to leave once found.
const SELLER_SETTABLE_STATUS = new Set(["incomplete", "pending_review"]);

export async function syncVerificationSummary(
  shopId: string,
  callerId: string,
  summary: {
    businessType: BusinessType | null;
    badgeTier: BadgeTier;
    overallStatus: string;
    levels?: {
      l1Phone: LevelStatus;
      l1Email: LevelStatus;
      l2Documents: LevelStatus;
      l3Kyc: LevelStatus;
      l4Bank: LevelStatus;
      l5Gps: LevelStatus;
      l6Ai: LevelStatus;
      l7Review: LevelStatus;
    };
  },
): Promise<void> {
  await assertShopOwner(shopId, callerId);
  if (!SELLER_SETTABLE_STATUS.has(summary.overallStatus)) {
    throw new OwnershipError("Only an admin can approve or suspend a shop.");
  }

  const row: Record<string, unknown> = {
    business_type: summary.businessType,
    current_badge: summary.badgeTier,
    overall_status: summary.overallStatus,
  };
  if (summary.levels) {
    row.l1_phone = summary.levels.l1Phone;
    row.l1_email = summary.levels.l1Email;
    row.l2_documents = summary.levels.l2Documents;
    row.l3_kyc = summary.levels.l3Kyc;
    row.l4_bank = summary.levels.l4Bank;
    row.l5_gps = summary.levels.l5Gps;
    row.l6_ai = summary.levels.l6Ai;
    row.l7_review = summary.levels.l7Review;
  }
  const { error } = await admin().from("shop_verifications").update(row).eq("shop_id", shopId);
  if (error) throw new Error(`syncVerificationSummary failed: ${error.message}`);
}

// ─── Catalog products (migration 0016) ─────────────────────────────────────
// Links barcode-identified products across different shops to one shared
// canonical record, so scanning a barcode another shop already has doesn't
// need a fresh Open Food Facts lookup and two shops selling the same real
// item aren't storing/maintaining fully independent name/description copies.
// Deliberately barcode-only — no fuzzy name matching (see migration comment).

/** Finds or creates the catalog_products row for a barcode, returning its id. */
async function getOrCreateCatalogProduct(barcode: string, name: string): Promise<string> {
  const { data: existing, error: selErr } = await admin()
    .from("catalog_products")
    .select("id")
    .eq("barcode", barcode)
    .maybeSingle();
  if (selErr) throw new Error(`getOrCreateCatalogProduct lookup failed: ${selErr.message}`);
  if (existing) return existing.id;

  const { data: created, error: insErr } = await admin()
    .from("catalog_products")
    .insert({ barcode, name })
    .select("id")
    .single();
  if (insErr) {
    // 23505 = another shop linked this exact barcode in the gap between our
    // select and insert — just use the row that won the race.
    if (insErr.code === "23505") {
      const { data: race, error: raceErr } = await admin()
        .from("catalog_products")
        .select("id")
        .eq("barcode", barcode)
        .single();
      if (raceErr)
        throw new Error(`getOrCreateCatalogProduct race lookup failed: ${raceErr.message}`);
      return race.id;
    }
    throw new Error(`getOrCreateCatalogProduct insert failed: ${insErr.message}`);
  }
  return created.id;
}

/** Fast local lookup checked before the external Open Food Facts call — covers barcodes any shop (food or not) already scanned. */
export async function getCatalogProductByBarcode(barcode: string): Promise<{ name: string } | null> {
  const { data, error } = await admin()
    .from("catalog_products")
    .select("name")
    .eq("barcode", barcode)
    .maybeSingle();
  if (error) throw new Error(`getCatalogProductByBarcode failed: ${error.message}`);
  return data ? { name: data.name } : null;
}

// ─── Products ────────────────────────────────────────────────────────────────

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
    stockQty: row.stock_qty ?? undefined,
    imageUrl: publicImageUrl(row.image_path),
    barcode: row.barcode ?? undefined,
  };
}

export async function getMyProducts(shopId: string, callerId: string): Promise<Product[]> {
  await assertShopOwner(shopId, callerId);
  const { data, error } = await admin()
    .from("products")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getMyProducts failed: ${error.message}`);
  return (data ?? []).map(mapProductRow);
}

export async function addProduct(
  shopId: string,
  callerId: string,
  input: Omit<Product, "id" | "shopId">,
): Promise<Product> {
  await assertShopOwner(shopId, callerId);
  const catalogProductId = input.barcode
    ? await getOrCreateCatalogProduct(input.barcode, input.name)
    : null;
  // Tracked (stockQty provided) means in_stock is derived from the real
  // quantity, not the client-sent toggle — untracked products keep the
  // existing fully-manual behavior unchanged.
  const inStock = input.stockQty != null ? input.stockQty > 0 : input.inStock;
  const { data, error } = await admin()
    .from("products")
    .insert({
      shop_id: shopId,
      name: input.name,
      emoji: input.emoji,
      price_amount: Math.round(input.price * 100),
      mrp_amount: input.mrp != null ? Math.round(input.mrp * 100) : null,
      unit: input.unit,
      menu_section: input.category,
      in_stock: inStock,
      stock_qty: input.stockQty ?? null,
      barcode: input.barcode || null,
      catalog_product_id: catalogProductId,
    })
    .select("*")
    .single();
  if (error) {
    // 23505 = unique_violation on products_shop_barcode_uidx (migration
    // 0015) — this exact barcode is already in this shop's own catalog. A
    // real, catchable conflict, not a generic failure — see
    // seller.products.tsx's "Already in your catalog" nudge.
    if (error.code === "23505") {
      throw new Error("You already have a product with this barcode in your catalog.");
    }
    throw new Error(`addProduct failed: ${error.message}`);
  }
  return mapProductRow(data);
}

export async function updateProduct(
  productId: string,
  callerId: string,
  patch: Partial<Product>,
): Promise<void> {
  const current = await assertProductOwner(productId, callerId);
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.emoji !== undefined) row.emoji = patch.emoji;
  if (patch.price !== undefined) row.price_amount = Math.round(patch.price * 100);
  if (patch.mrp !== undefined)
    row.mrp_amount = patch.mrp != null ? Math.round(patch.mrp * 100) : null;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.category !== undefined) row.menu_section = patch.category;
  // Tracked (stockQty provided) means in_stock derives from the real
  // quantity — a manual inStock patch alongside it is ignored, same
  // derivation rule as addProduct. Once a product starts tracking a real
  // quantity, going back to untracked isn't supported by this patch shape
  // yet (a rare enough case to leave as a known gap, not worth the extra
  // nullable-vs-omitted schema complexity for this pass).
  if (patch.stockQty !== undefined) {
    row.stock_qty = patch.stockQty;
    row.in_stock = patch.stockQty > 0;
  } else if (patch.inStock !== undefined) {
    row.in_stock = patch.inStock;
  }
  if (patch.barcode !== undefined) {
    row.barcode = patch.barcode || null;
    row.catalog_product_id = patch.barcode
      ? await getOrCreateCatalogProduct(patch.barcode, patch.name ?? current.name)
      : null;
  }
  if (Object.keys(row).length === 0) return;

  const { error } = await admin().from("products").update(row).eq("id", productId);
  if (error) {
    if (error.code === "23505") {
      throw new Error("You already have a product with this barcode in your catalog.");
    }
    throw new Error(`updateProduct failed: ${error.message}`);
  }
}

export async function removeProduct(productId: string, callerId: string): Promise<void> {
  await assertProductOwner(productId, callerId);
  const { error } = await admin().from("products").delete().eq("id", productId);
  if (error) throw new Error(`removeProduct failed: ${error.message}`);
}

export async function toggleStock(productId: string, callerId: string): Promise<void> {
  await assertProductOwner(productId, callerId);
  const { data, error } = await admin()
    .from("products")
    .select("in_stock")
    .eq("id", productId)
    .single();
  if (error) throw new Error(`toggleStock lookup failed: ${error.message}`);
  const { error: updateErr } = await admin()
    .from("products")
    .update({ in_stock: !data.in_stock })
    .eq("id", productId);
  if (updateErr) throw new Error(`toggleStock failed: ${updateErr.message}`);
}

// ─── Quick Sale: recording a real in-person counter sale (Phase 2, 2026-07-28) ─
// The actual answer to "how do we track sales that bypass NearCart" — real-
// world research found under 2% of India's kirana stores run any billing
// software, and the few that do are fragmented across incompatible vendors
// with no common API (see plan/tasks/decisions.md). A vendor POS integration
// isn't a sound bet; this is a universal, zero-dependency in-app recorder
// instead. Routes through the exact same decrement_stock_for_sale RPC
// placeOrder uses (migration 0018), just with reason='counter_sale' and no
// order_id — guarantees an online order and a counter sale can never race
// each other into overselling the same unit. No orders/order_items rows are
// created; this isn't a marketplace order.
export type CounterSaleItem = { productId: string; quantity: number };

export async function recordCounterSale(
  shopId: string,
  callerId: string,
  items: CounterSaleItem[],
): Promise<void> {
  await assertShopOwner(shopId, callerId);
  if (items.length === 0) throw new Error("No items to record.");
  const { data: stockResults, error } = await admin().rpc("decrement_stock_for_sale", {
    p_shop_id: shopId,
    p_items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_reason: "counter_sale",
    p_order_id: null,
  });
  if (error) throw new Error(error.message);
  await notifyLowStockCrossings(shopId, stockResults ?? []);
}

// ─── Orders (seller side) ───────────────────────────────────────────────────

export type SellerOrderStatus =
  "new" | "accepted" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "rejected";

export type SellerOrderLine = {
  name: string;
  emoji: string;
  price: number;
  unit: string;
  quantity: number;
};

export type SellerOrder = {
  id: string;
  customerName: string;
  address: string;
  phone: string;
  lines: SellerOrderLine[];
  total: number;
  paymentMethod: string;
  placedAt: number;
  status: SellerOrderStatus;
  partnerId?: string;
  fulfillmentType: "delivery" | "pickup";
  /** Shop→customer handoff code for a pickup order — undefined for delivery orders. */
  pickupOtp?: string;
};

function toSellerStatus(dbStatus: string): SellerOrderStatus {
  switch (dbStatus) {
    case "shop_accepted":
      return "accepted";
    case "preparing":
      return "preparing";
    case "ready_for_pickup":
      return "ready";
    case "partner_assigned":
    case "picked_up":
    case "out_for_delivery":
      return "out_for_delivery";
    case "delivered":
    case "closed":
      return "delivered";
    case "shop_rejected":
    case "cancelled":
    case "refunded":
    case "payment_failed":
      return "rejected";
    default:
      return "new"; // created / paid / cod_confirmed — awaiting shop action
  }
}

const FROM_SELLER_STATUS: Record<Exclude<SellerOrderStatus, "new">, string> = {
  accepted: "shop_accepted",
  preparing: "preparing",
  ready: "ready_for_pickup",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  rejected: "shop_rejected",
};

const SELLER_ORDER_SELECT =
  "*, users(full_name, phone), addresses(line1), order_items(name_snapshot, price_amount, quantity, products(emoji, unit)), assignments(partner_id, status)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSellerOrderRow(row: any): SellerOrder {
  const items = (row.order_items ?? []) as {
    name_snapshot: string;
    price_amount: number;
    quantity: number;
    products?: { emoji?: string; unit?: string };
  }[];
  const assignments = (row.assignments ?? []) as { partner_id: string; status: string }[];
  const activeAssignment = assignments.find(
    (a) => a.status === "offered" || a.status === "accepted",
  );
  return {
    id: row.id,
    customerName: row.users?.full_name || row.users?.phone || "Customer",
    address: row.addresses?.line1 ?? "",
    phone: row.users?.phone ?? "",
    lines: items.map((l) => ({
      name: l.name_snapshot,
      emoji: l.products?.emoji ?? "📦",
      price: l.price_amount / 100,
      unit: l.products?.unit ?? "",
      quantity: l.quantity,
    })),
    total: row.total_amount / 100,
    paymentMethod: row.payment_method,
    placedAt: new Date(row.placed_at).getTime(),
    status: toSellerStatus(row.status),
    partnerId: activeAssignment?.partner_id,
    fulfillmentType: row.fulfillment_type === "pickup" ? "pickup" : "delivery",
    pickupOtp: row.fulfillment_type === "pickup" ? (row.pickup_otp ?? undefined) : undefined,
  };
}

export async function getShopOrders(shopId: string, callerId: string): Promise<SellerOrder[]> {
  await assertShopOwner(shopId, callerId);
  const { data, error } = await admin()
    .from("orders")
    .select(SELLER_ORDER_SELECT)
    .eq("shop_id", shopId)
    .order("placed_at", { ascending: false });
  if (error) throw new Error(`getShopOrders failed: ${error.message}`);
  return (data ?? []).map(mapSellerOrderRow);
}

// `title`/`body` take the fulfillment type too — most entries ignore it (the
// wording already reads fine either way), but "delivered" genuinely needs to
// say something different for a pickup order the customer just walked in and
// collected themselves versus one a partner actually delivered.
const CUSTOMER_NOTIFICATION: Record<
  string,
  { title: (f: "delivery" | "pickup") => string; body: (shop: string, f: "delivery" | "pickup") => string }
> = {
  shop_accepted: {
    title: () => "Order accepted",
    body: (shop) => `${shop} accepted your order.`,
  },
  shop_rejected: {
    title: () => "Order rejected",
    body: (shop) => `${shop} couldn't accept your order.`,
  },
  preparing: {
    title: () => "Order being prepared",
    body: (shop) => `${shop} is preparing your order.`,
  },
  ready_for_pickup: {
    title: () => "Order ready",
    body: (shop) => `Your order from ${shop} is ready and waiting for pickup.`,
  },
  out_for_delivery: {
    title: () => "Out for delivery",
    body: (shop) => `Your order from ${shop} is on its way.`,
  },
  delivered: {
    title: (f) => (f === "pickup" ? "Order picked up" : "Order delivered"),
    body: (shop, f) =>
      f === "pickup"
        ? `You've picked up your order from ${shop}. Enjoy!`
        : `Your order from ${shop} has been delivered. Enjoy!`,
  },
};

async function requireOrderState(
  orderId: string,
): Promise<{ status: string; fulfillmentType: "delivery" | "pickup" }> {
  const { data, error } = await admin()
    .from("orders")
    .select("status, fulfillment_type")
    .eq("id", orderId)
    .single();
  if (error) throw new Error(`Could not read order status: ${error.message}`);
  return {
    status: data.status,
    fulfillmentType: data.fulfillment_type === "pickup" ? "pickup" : "delivery",
  };
}

/**
 * `fromDbStatus` must be a status the caller just read for this same order —
 * the update is conditioned on the row still being at that exact status, so
 * it's a no-op (throws, doesn't silently overwrite) if the order moved on
 * concurrently. This is what makes every caller's status-transition guard
 * actually race-proof rather than just a check-then-write with a gap in the
 * middle: two concurrent accept/advance calls (double-click, a stale seller
 * tab racing a customer cancellation) can no longer both land, because only
 * the one whose `fromDbStatus` still matches the real row succeeds. See
 * plan/tasks/decisions.md 2026-07-22 for the live-reproduced bug this closes.
 */
async function setOrderStatus(
  orderId: string,
  fromDbStatus: string,
  toDbStatus: string,
  note: string,
): Promise<void> {
  const { data: shopInfo } = await admin()
    .from("orders")
    .select("customer_id, fulfillment_type, shops(name)")
    .eq("id", orderId)
    .single();

  const { data: updated, error } = await admin()
    .from("orders")
    .update({ status: toDbStatus })
    .eq("id", orderId)
    .eq("status", fromDbStatus)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`setOrderStatus failed: ${error.message}`);
  if (!updated) {
    throw new Error("This order's status has already changed — refresh and try again.");
  }

  await admin()
    .from("order_events")
    .insert({ order_id: orderId, from_status: fromDbStatus, to_status: toDbStatus, note });

  const notif = CUSTOMER_NOTIFICATION[toDbStatus];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shopName = (shopInfo as any)?.shops?.name ?? "The shop";
  const fulfillmentType: "delivery" | "pickup" =
    shopInfo?.fulfillment_type === "pickup" ? "pickup" : "delivery";
  if (notif && shopInfo?.customer_id) {
    await insertNotification(
      shopInfo.customer_id,
      "order_status",
      notif.title(fulfillmentType),
      notif.body(shopName, fulfillmentType),
      {
        orderId,
        status: toDbStatus,
      },
    );
  }
}

// Only orders still genuinely awaiting shop action can be accepted/rejected —
// blocks re-accepting/re-rejecting an order some other action (or a
// concurrent request) already moved past this point.
const SELLER_ACTIONABLE_DB_STATUSES = new Set(["created", "paid", "cod_confirmed"]);

export async function acceptOrder(orderId: string, callerId: string): Promise<void> {
  await assertOrderOwner(orderId, callerId);
  const { status: dbStatus } = await requireOrderState(orderId);
  if (!SELLER_ACTIONABLE_DB_STATUSES.has(dbStatus)) {
    throw new Error("This order has already been actioned — refresh to see its current status.");
  }
  await setOrderStatus(orderId, dbStatus, "shop_accepted", "Accepted by shop");
}

export async function rejectOrder(orderId: string, callerId: string): Promise<void> {
  await assertOrderOwner(orderId, callerId);
  const { status: dbStatus } = await requireOrderState(orderId);
  if (!SELLER_ACTIONABLE_DB_STATUSES.has(dbStatus)) {
    throw new Error("This order has already been actioned — refresh to see its current status.");
  }
  await setOrderStatus(orderId, dbStatus, "shop_rejected", "Rejected by shop");
}

/**
 * `currentStatus` is no longer a parameter — it used to be client-supplied,
 * which let a caller claim any status and skip straight to any point in the
 * flow (e.g. claim "ready" to jump an order to "out_for_delivery" without it
 * ever being accepted/prepared). Now derived from the order's real DB status,
 * the same "derive, don't trust" fix already applied to orders/tracking-data
 * in Phase 3. See plan/tasks/decisions.md.
 *
 * Guards against a real, live-confirmed bug (decisions.md 2026-07-22): `flow`
 * deliberately excludes "rejected" — the seller-side status every terminal DB
 * status (shop_rejected/cancelled/refunded/payment_failed) maps to via
 * `toSellerStatus` — so `flow.indexOf("rejected")` used to return -1 and the
 * old `+ 1` arithmetic silently computed `flow[0]` == "accepted" instead of
 * "no next status." A stale seller view (open before a customer's
 * cancellation) could click "Mark as Preparing" and resurrect the cancelled
 * order. Terminal and not-yet-accepted statuses now explicitly return before
 * that arithmetic ever runs, and `setOrderStatus`'s conditional update closes
 * the remaining race for a status that changes between this read and the
 * write below.
 */
export async function advanceOrder(orderId: string, callerId: string): Promise<void> {
  await assertOrderOwner(orderId, callerId);
  const { status: dbStatus, fulfillmentType } = await requireOrderState(orderId);
  const currentStatus = toSellerStatus(dbStatus);

  // Pickup orders skip partner_assigned/picked_up/out_for_delivery entirely
  // — the customer collects in person, so "ready" advances straight to the
  // existing terminal "delivered" (the UI relabels it "Picked up").
  const flow: Exclude<SellerOrderStatus, "new" | "rejected">[] =
    fulfillmentType === "pickup"
      ? ["accepted", "preparing", "ready", "delivered"]
      : ["accepted", "preparing", "ready", "out_for_delivery", "delivered"];
  if (currentStatus === "new" || currentStatus === "rejected") return; // nothing to advance
  const next = flow[flow.indexOf(currentStatus) + 1];
  if (!next) return;
  await setOrderStatus(orderId, dbStatus, FROM_SELLER_STATUS[next], `Advanced to ${next}`);
}

// ─── Delivery partners (Phase E — real accounts, seller side of assignment) ─

export type AvailablePartner = {
  id: string;
  name: string;
  vehicle: string;
  phone: string;
  rating: number;
  available: boolean;
};

/**
 * Phase 7 re-sweep (2026-07-19) found this had NO auth check at all — any
 * unauthenticated caller could hit the server function directly and scrape
 * every active delivery partner's real name + phone number. Phase 4 missed
 * it because it's a cross-shop directory lookup, not a single owned
 * resource, so the per-call `assertShopOwner`/`assertOrderOwner` pattern
 * didn't naturally apply. Fixed with the narrowest check that fits: the
 * caller must own at least one real shop (i.e. actually be a seller) before
 * seeing any partner's contact details. See plan/tasks/decisions.md.
 */
export async function getAvailablePartners(callerId: string): Promise<AvailablePartner[]> {
  const { data: ownShop } = await admin()
    .from("shops")
    .select("id")
    .eq("owner_id", callerId)
    .limit(1)
    .maybeSingle();
  if (!ownShop) throw new OwnershipError("Only sellers can view available delivery partners.");

  const { data, error } = await admin()
    .from("delivery_partners")
    .select("id, vehicle_type, rating_avg, users(full_name, phone)")
    .eq("is_online", true)
    .eq("status", "active");
  if (error) throw new Error(`getAvailablePartners failed: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.users?.full_name || row.users?.phone || "Partner",
    vehicle: row.vehicle_type ?? "",
    phone: row.users?.phone ?? "",
    rating: Number(row.rating_avg ?? 5),
    available: true, // already filtered to online + active; no busy-tracking yet
  }));
}

/**
 * Offers this order to a partner (they must accept before it becomes real
 * dispatch). Guards a real gap (plan/tasks/decisions.md 2026-07-22): nothing
 * previously stopped a seller (or a retry) from offering the same order to a
 * second partner before the first offer was resolved, leaving two live
 * "offered" rows a partner-data/acceptJob race could both accept. The
 * authoritative fix is acceptJob's own conditional order-claim — this is a
 * cheaper first line of defense that avoids creating the redundant row (and
 * confusing a second partner with a request that can never actually win) in
 * the common case; it doesn't need to be airtight against the same
 * millisecond-level race acceptJob already closes.
 */
export async function offerToPartner(
  orderId: string,
  callerId: string,
  partnerId: string,
): Promise<void> {
  await assertOrderOwner(orderId, callerId);
  // Defense-in-depth, not the only guard — the seller UI never renders a
  // partner-assignment control for a pickup order, but this file's
  // convention elsewhere is to not rely on the client alone (see the
  // authorization-hardening notes throughout this module).
  const { fulfillmentType } = await requireOrderState(orderId);
  if (fulfillmentType === "pickup") {
    throw new Error("This is a self-pickup order — no delivery partner needed.");
  }
  const { data: existing, error: existingErr } = await admin()
    .from("assignments")
    .select("id")
    .eq("order_id", orderId)
    .in("status", ["offered", "accepted"])
    .limit(1);
  if (existingErr) throw new Error(`offerToPartner failed: ${existingErr.message}`);
  if (existing && existing.length > 0) {
    throw new Error("This order already has a pending or accepted delivery partner.");
  }
  const { error } = await admin()
    .from("assignments")
    .insert({ order_id: orderId, partner_id: partnerId, status: "offered" });
  if (error) throw new Error(`offerToPartner failed: ${error.message}`);
}

// ─── Real shop/product photos (2026-07-19) ──────────────────────────────────
// shops.logo_path/products.image_path existed since Phase A and were never
// wired to anything — every shop/product showed only an emoji. Unlike every
// other function in this file (still Phase-4 unfixed, client-trusted ids —
// see plan/tasks/decisions.md), these two are new code and use a real
// ownership check derived from the caller's session, not a client-supplied
// owner id, since there's no reason to add a new insecure function on top of
// the ones already tracked for a future fix.

const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function decodeImage(dataBase64: string, mimeType: string): { buffer: Buffer; ext: string } {
  if (!ALLOWED_IMAGE_MIME.includes(mimeType))
    throw new Error(`Unsupported image type: ${mimeType}`);
  const buffer = Buffer.from(dataBase64, "base64");
  if (buffer.length === 0) throw new Error("Image is empty.");
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Image exceeds the 5 MB limit.");
  return { buffer, ext: mimeType.split("/")[1] };
}

/** `callerId` must be the session-derived context.uid — throws if the caller doesn't own this shop. */
export async function uploadShopLogo(
  shopId: string,
  callerId: string,
  dataBase64: string,
  mimeType: string,
): Promise<string> {
  const { data: shop, error } = await admin()
    .from("shops")
    .select("owner_id")
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw new Error(`uploadShopLogo failed: ${error.message}`);
  if (!shop || shop.owner_id !== callerId) throw new Error("This isn't your shop.");

  const { buffer, ext } = decodeImage(dataBase64, mimeType);
  const path = `shops/${shopId}.${ext}`;
  const { error: upErr } = await admin()
    .storage.from(PUBLIC_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  const { error: updateErr } = await admin()
    .from("shops")
    .update({ logo_path: path })
    .eq("id", shopId);
  if (updateErr) throw new Error(`uploadShopLogo failed: ${updateErr.message}`);

  return admin().storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** `callerId` must be the session-derived context.uid — throws if the caller doesn't own the shop this product belongs to. */
export async function uploadProductImage(
  productId: string,
  callerId: string,
  dataBase64: string,
  mimeType: string,
): Promise<string> {
  const { data: product, error } = await admin()
    .from("products")
    .select("id, shops(owner_id)")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new Error(`uploadProductImage failed: ${error.message}`);
  const shopOwner = Array.isArray(product?.shops) ? product.shops[0] : product?.shops;
  if (!product || shopOwner?.owner_id !== callerId) throw new Error("This isn't your product.");

  const { buffer, ext } = decodeImage(dataBase64, mimeType);
  const path = `products/${productId}.${ext}`;
  const { error: upErr } = await admin()
    .storage.from(PUBLIC_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  const { error: updateErr } = await admin()
    .from("products")
    .update({ image_path: path })
    .eq("id", productId);
  if (updateErr) throw new Error(`uploadProductImage failed: ${updateErr.message}`);

  return admin().storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
}
