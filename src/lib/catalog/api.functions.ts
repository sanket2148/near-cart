// Server functions (typed RPC) for the catalog backend. Same pattern as
// src/lib/verification/api.functions.ts: dynamic-import the server-only
// module so it never leaks into the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const NearbyShopsSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  category: z.string().optional(),
});

export const getCategories = createServerFn({ method: "GET" }).handler(async () => {
  const be = await import("./backend.server");
  return be.getCategories();
});

export const getNearbyShops = createServerFn({ method: "GET" })
  .inputValidator(NearbyShopsSchema)
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.getNearbyShops(data);
  });

export const checkServiceability = createServerFn({ method: "GET" })
  .inputValidator(z.object({ lat: z.number(), lng: z.number() }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.checkServiceability(data.lat, data.lng);
  });

export const getShop = createServerFn({ method: "GET" })
  .inputValidator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.getShop(data.shopId);
  });

export const getShopProducts = createServerFn({ method: "GET" })
  .inputValidator(z.object({ shopId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.getShopProducts(data.shopId);
  });

export const searchCatalog = createServerFn({ method: "GET" })
  .inputValidator(z.object({ query: z.string().min(1) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    const [shops, products] = await Promise.all([
      be.searchShops(data.query),
      be.searchProducts(data.query),
    ]);
    return { shops, products };
  });
