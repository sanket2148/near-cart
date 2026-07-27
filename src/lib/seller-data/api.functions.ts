import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth-session/middleware";

const ProductInputSchema = z.object({
  name: z.string().min(1),
  emoji: z.string().min(1),
  price: z.number().min(0),
  mrp: z.number().min(0).optional(),
  unit: z.string(),
  category: z.string(),
  inStock: z.boolean(),
  barcode: z.string().optional(),
  /** Present only when the seller tracks a real quantity — absent means "untracked," matching stock_qty's own null-means-untracked convention. */
  stockQty: z.number().int().min(0).optional(),
});

// Every function below used to trust a client-supplied ownerId/shopId/
// productId/orderId with zero verification — see plan/tasks/decisions.md,
// Phase 4 of the authorization-hardening plan. All identity is now derived
// from the verified session (context.uid) via authMiddleware; ownership is
// re-checked inside backend.server.ts for every shop/product/order access.

export const getMyShop = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const be = await import("./backend.server");
    return be.getMyShop(context.uid);
  });

export const createShop = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      name: z.string().min(1),
      businessType: z.string().min(1),
      area: z.string().min(1),
      tagline: z.string().optional(),
      lat: z.number(),
      lng: z.number(),
    }),
  )
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return be.createShop(context.uid, data as any);
  });

export const searchUnclaimedShops = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ query: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.searchUnclaimedShops(data.query);
  });

export const findPossibleShopMatches = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ name: z.string().min(1), lat: z.number(), lng: z.number() }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.findPossibleShopMatches(data.name, data.lat, data.lng);
  });

export const claimShop = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopId: z.string().min(1), businessType: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return be.claimShop(data.shopId, context.uid, data.businessType as any);
  });

// patch is now an explicit allowlisted shape instead of z.record(z.string(),
// z.any()) — the backend already whitelisted these exact 8 fields
// internally (so this wasn't an exploitable mass-assignment hole), but an
// untyped "any" validator is still bad API hygiene and the real fix
// (ownership check on shopId) lives in backend.server.ts's assertShopOwner.
const ShopPatchSchema = z.object({
  name: z.string().min(1).optional(),
  tagline: z.string().optional(),
  emoji: z.string().optional(),
  area: z.string().min(1).optional(),
  isOpen: z.boolean().optional(),
  deliveryFee: z.number().min(0).optional(),
  freeAbove: z.number().min(0).optional(),
  etaMinutes: z.number().min(0).optional(),
});

export const updateShop = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopId: z.string().min(1), patch: ShopPatchSchema }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.updateShop(data.shopId, context.uid, data.patch);
  });

const LevelStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "submitted",
  "verified",
  "rejected",
]);

export const syncVerificationSummary = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopId: z.string().min(1),
      summary: z.object({
        businessType: z.string().nullable(),
        badgeTier: z.string(),
        overallStatus: z.string(),
        levels: z
          .object({
            l1Phone: LevelStatusSchema,
            l1Email: LevelStatusSchema,
            l2Documents: LevelStatusSchema,
            l3Kyc: LevelStatusSchema,
            l4Bank: LevelStatusSchema,
            l5Gps: LevelStatusSchema,
            l6Ai: LevelStatusSchema,
            l7Review: LevelStatusSchema,
          })
          .optional(),
      }),
    }),
  )
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return be.syncVerificationSummary(data.shopId, context.uid, data.summary as any);
  });

export const getCatalogProductByBarcode = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ barcode: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.getCatalogProductByBarcode(data.barcode);
  });

export const getMyProducts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.getMyProducts(data.shopId, context.uid);
  });

export const addProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopId: z.string().min(1), input: ProductInputSchema }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.addProduct(data.shopId, context.uid, data.input);
  });

const ProductPatchSchema = ProductInputSchema.partial();

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ productId: z.string().min(1), patch: ProductPatchSchema }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.updateProduct(data.productId, context.uid, data.patch);
  });

export const removeProduct = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ productId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.removeProduct(data.productId, context.uid);
  });

export const toggleStock = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ productId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.toggleStock(data.productId, context.uid);
  });

export const getShopOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.getShopOrders(data.shopId, context.uid);
  });

export const acceptOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.acceptOrder(data.orderId, context.uid);
  });

export const rejectOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.rejectOrder(data.orderId, context.uid);
  });

// currentStatus is no longer part of this request — it's derived from the
// order's real DB status inside advanceOrder, not accepted from the client.
export const advanceOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.advanceOrder(data.orderId, context.uid);
  });

export const getAvailablePartners = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const be = await import("./backend.server");
    return be.getAvailablePartners(context.uid);
  });

export const offerToPartner = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orderId: z.string().min(1), partnerId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.offerToPartner(data.orderId, context.uid, data.partnerId);
  });

// ~7MB base64 ceiling comfortably covers the 5MB binary limit enforced in backend.server.ts.
const UploadImageSchema = z.object({
  dataBase64: z.string().min(1).max(7_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const uploadShopLogo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(UploadImageSchema.extend({ shopId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    const url = await be.uploadShopLogo(data.shopId, context.uid, data.dataBase64, data.mimeType);
    return { url };
  });

export const uploadProductImage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(UploadImageSchema.extend({ productId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    const url = await be.uploadProductImage(
      data.productId,
      context.uid,
      data.dataBase64,
      data.mimeType,
    );
    return { url };
  });
