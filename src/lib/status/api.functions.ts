import { createServerFn } from "@tanstack/react-start";

// Public, no authMiddleware — a status page that requires being logged in
// defeats the point (see backend.server.ts).
export const getSystemStatus = createServerFn({ method: "GET" }).handler(async () => {
  const be = await import("./backend.server");
  return be.getSystemStatus();
});
