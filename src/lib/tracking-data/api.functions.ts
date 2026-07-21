import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth-session/middleware";

export const getOrderTracking = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.getOrderTracking(data.orderId, context.uid);
  });

// partnerId is deliberately NOT part of this validator — the real
// delivery_partners row is derived from the verified session (context.uid)
// inside backend.server.ts, never accepted from the client (see
// plan/tasks/decisions.md, Phase 3 of the authorization-hardening plan).
export const pushPartnerLocation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ lat: z.number(), lng: z.number() }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.pushPartnerLocation({ callerId: context.uid, lat: data.lat, lng: data.lng });
  });
