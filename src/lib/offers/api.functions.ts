import { createServerFn } from "@tanstack/react-start";

export const listActiveCoupons = createServerFn({ method: "GET" }).handler(async () => {
  const be = await import("./backend.server");
  return be.listActiveCoupons();
});
