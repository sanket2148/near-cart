import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth-session/middleware";

// authMiddleware, not public — an unauthenticated open proxy to a third
// party (Open Food Facts) would be a real abuse vector; this is a seller
// onboarding aid, gated like every other seller-data endpoint.
export const lookupBarcode = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ barcode: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.lookupBarcode(data.barcode);
  });
