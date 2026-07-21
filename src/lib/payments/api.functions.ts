import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth-session/middleware";

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orderId: z.string().min(1),
      razorpayOrderId: z.string().min(1),
      razorpayPaymentId: z.string().min(1),
      razorpaySignature: z.string().min(1),
    }),
  )
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.verifyPayment({ ...data, callerId: context.uid });
  });
