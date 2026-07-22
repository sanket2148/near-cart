import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth-session/middleware";

export const getReviewableOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.getReviewableOrder(data.orderId, context.uid);
  });

export const getMyReviewForOrder = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orderId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.getMyReviewForOrder(data.orderId, context.uid);
  });

export const submitReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orderId: z.string().min(1),
      shopRating: z.number().int().min(1).max(5),
      partnerRating: z.number().int().min(1).max(5).optional(),
      comment: z.string().max(1000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    await be.submitReview({ ...data, callerId: context.uid });
  });

// Public — no login needed to read reviews, matches offers/catalog's posture.
export const listShopReviews = createServerFn({ method: "GET" })
  .inputValidator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.listShopReviews(data.shopId);
  });
