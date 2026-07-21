import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "@/lib/auth-session/middleware";

// Every function below requires a real, verified admin session — see
// plan/tasks/decisions.md for the authorization-hardening plan (Phase 2).
// Before this, none of these had ANY check at all: any caller who knew the
// URL could view or mutate the entire platform. adminMiddleware resolves a
// real context.uid and rejects (403) unless a public.user_roles row with
// role='admin' exists for that uid.

/** Cheap admin-access check for the /admin layout's UX gate — the real enforcement is adminMiddleware on every function below, this just lets the route show "not authorized" without waiting on a heavier call. */
export const checkAdminAccess = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => ({ ok: true as const }));

export const listShopsForReview = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const be = await import("./backend.server");
    return be.listShopsForReview();
  });

export const approveShop = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.approveShop(data.shopId);
  });

export const rejectShop = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.rejectShop(data.shopId);
  });

// ─── Shops ───────────────────────────────────────────────────────────────

export const listAllShops = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const be = await import("./backend.server");
    return be.listAllShops();
  });

export const suspendShop = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.suspendShop(data.shopId);
  });

export const reactivateShop = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.reactivateShop(data.shopId);
  });

// ─── Partners ────────────────────────────────────────────────────────────

export const listAllPartners = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const be = await import("./backend.server");
    return be.listAllPartners();
  });

export const suspendPartner = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ partnerId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.suspendPartner(data.partnerId);
  });

export const reactivatePartner = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ partnerId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.reactivatePartner(data.partnerId);
  });

// ─── Orders ──────────────────────────────────────────────────────────────

export const listAllOrders = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(z.object({ status: z.string().optional() }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.listAllOrders(data.status);
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.cancelOrder(data.orderId);
  });

// ─── Stats ───────────────────────────────────────────────────────────────

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .handler(async () => {
    const be = await import("./backend.server");
    return be.getAdminStats();
  });
