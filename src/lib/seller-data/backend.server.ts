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
import { insertNotification } from "@/lib/notifications/backend.server";

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

/** Returns the owning shop's id once ownership is confirmed — callers that need it (e.g. addProduct) can reuse it without a second query. */
async function assertProductOwner(productId: string, callerId: string): Promise<string> {
  const { data, error } = await admin()
    .from("products")
    .select("shop_id, shops(owner_id)")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new Error(`Ownership check failed: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  const ownerId = Array.isArray(row?.shops) ? row.shops[0]?.owner_id : row?.shops?.owner_id;
  if (!row || ownerId !== callerId) throw new OwnershipError("This isn't your product.");
  return row.shop_id as string;
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
};

export async function createShop(ownerId: string, input: NewShopInput): Promise<ShopProfile> {
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
      lat: 12.9352,
      lng: 77.6245,
      status: "active",
      is_open: false,
    })
    .select("id")
    .single();
  if (error) throw new Error(`createShop failed: ${error.message}`);

  await admin()
    .from("shop_verifications")
    .insert({ shop_id: shop.id, business_type: input.businessType });

  const created = await getMyShop(ownerId);
  if (!created) throw new Error("createShop: shop vanished immediately after creation");
  return created;
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
    imageUrl: publicImageUrl(row.image_path),
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
      in_stock: input.inStock,
    })
    .select("*")
    .single();
  if (error) throw new Error(`addProduct failed: ${error.message}`);
  return mapProductRow(data);
}

export async function updateProduct(
  productId: string,
  callerId: string,
  patch: Partial<Product>,
): Promise<void> {
  await assertProductOwner(productId, callerId);
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.emoji !== undefined) row.emoji = patch.emoji;
  if (patch.price !== undefined) row.price_amount = Math.round(patch.price * 100);
  if (patch.mrp !== undefined)
    row.mrp_amount = patch.mrp != null ? Math.round(patch.mrp * 100) : null;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.category !== undefined) row.menu_section = patch.category;
  if (patch.inStock !== undefined) row.in_stock = patch.inStock;
  if (Object.keys(row).length === 0) return;

  const { error } = await admin().from("products").update(row).eq("id", productId);
  if (error) throw new Error(`updateProduct failed: ${error.message}`);
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

const CUSTOMER_NOTIFICATION: Record<string, { title: string; body: (shopName: string) => string }> =
  {
    shop_accepted: { title: "Order accepted", body: (shop) => `${shop} accepted your order.` },
    shop_rejected: {
      title: "Order rejected",
      body: (shop) => `${shop} couldn't accept your order.`,
    },
    preparing: {
      title: "Order being prepared",
      body: (shop) => `${shop} is preparing your order.`,
    },
    ready_for_pickup: {
      title: "Order ready",
      body: (shop) => `Your order from ${shop} is ready and waiting for pickup.`,
    },
    out_for_delivery: {
      title: "Out for delivery",
      body: (shop) => `Your order from ${shop} is on its way.`,
    },
    delivered: {
      title: "Order delivered",
      body: (shop) => `Your order from ${shop} has been delivered. Enjoy!`,
    },
  };

async function setOrderStatus(orderId: string, dbStatus: string, note: string): Promise<void> {
  const { data: before } = await admin()
    .from("orders")
    .select("status, customer_id, shops(name)")
    .eq("id", orderId)
    .single();
  const { error } = await admin().from("orders").update({ status: dbStatus }).eq("id", orderId);
  if (error) throw new Error(`setOrderStatus failed: ${error.message}`);
  await admin()
    .from("order_events")
    .insert({ order_id: orderId, from_status: before?.status ?? null, to_status: dbStatus, note });

  const notif = CUSTOMER_NOTIFICATION[dbStatus];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shopName = (before as any)?.shops?.name ?? "The shop";
  if (notif && before?.customer_id) {
    await insertNotification(
      before.customer_id,
      "order_status",
      notif.title,
      notif.body(shopName),
      {
        orderId,
        status: dbStatus,
      },
    );
  }
}

export async function acceptOrder(orderId: string, callerId: string): Promise<void> {
  await assertOrderOwner(orderId, callerId);
  await setOrderStatus(orderId, "shop_accepted", "Accepted by shop");
}

export async function rejectOrder(orderId: string, callerId: string): Promise<void> {
  await assertOrderOwner(orderId, callerId);
  await setOrderStatus(orderId, "shop_rejected", "Rejected by shop");
}

/**
 * `currentStatus` is no longer a parameter — it used to be client-supplied,
 * which let a caller claim any status and skip straight to any point in the
 * flow (e.g. claim "ready" to jump an order to "out_for_delivery" without it
 * ever being accepted/prepared). Now derived from the order's real DB status,
 * the same "derive, don't trust" fix already applied to orders/tracking-data
 * in Phase 3. See plan/tasks/decisions.md.
 */
export async function advanceOrder(orderId: string, callerId: string): Promise<void> {
  await assertOrderOwner(orderId, callerId);
  const { data: order, error } = await admin()
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();
  if (error) throw new Error(`advanceOrder failed: ${error.message}`);
  const currentStatus = toSellerStatus(order.status);

  const flow: Exclude<SellerOrderStatus, "new" | "rejected">[] = [
    "accepted",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
  ];
  const next =
    currentStatus === "new"
      ? "accepted"
      : flow[flow.indexOf(currentStatus as (typeof flow)[number]) + 1];
  if (!next) return;
  await setOrderStatus(orderId, FROM_SELLER_STATUS[next], `Advanced to ${next}`);
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

/** Offers this order to a partner (they must accept before it becomes real dispatch). */
export async function offerToPartner(
  orderId: string,
  callerId: string,
  partnerId: string,
): Promise<void> {
  await assertOrderOwner(orderId, callerId);
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
