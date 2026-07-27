import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth-session/middleware";

const OrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
});

export const quoteOrder = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      shopId: z.string().min(1),
      items: z.array(OrderItemSchema),
      couponCode: z.string().min(1).optional(),
      fulfillmentType: z.enum(["delivery", "pickup"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.quoteOrder(data);
  });

// customerId is deliberately NOT part of this validator — it's derived from
// the verified session (context.uid), never accepted from the client. Before
// this, any caller could place an order "as" any customerId they specified
// (see plan/tasks/decisions.md, Phase 3 of the authorization-hardening plan).
export const placeOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      shopId: z.string().min(1),
      items: z.array(OrderItemSchema).min(1),
      paymentMethod: z.enum(["upi", "card", "netbanking", "cod"]),
      fulfillmentType: z.enum(["delivery", "pickup"]).default("delivery"),
      // Required for delivery orders — enforced in backend.server.ts, not
      // here; this validator is shape-only, the server function is the real
      // trust boundary (same convention as everything else in this file).
      addressText: z.string().min(1).optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      couponCode: z.string().min(1).optional(),
      // Client-generated once per checkout attempt and reused across
      // retries (network retry, refresh-and-resubmit, a double-click that
      // both fire) — see backend.server.ts's placeOrder for how this makes
      // a retry return the already-created order instead of a duplicate.
      idempotencyKey: z.string().min(8).max(200),
    }),
  )
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.placeOrder({ ...data, customerId: context.uid });
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const be = await import("./backend.server");
    return be.listOrders(context.uid);
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.getOrder(data.orderId, context.uid);
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.cancelOrder(data.orderId, context.uid);
  });
