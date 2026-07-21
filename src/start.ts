import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// CSRF defense for server functions (TanStack Start warns on startup
// without this — see plan/tasks/decisions.md). This is the framework's own
// built-in middleware (not hand-rolled): checks Sec-Fetch-Site first, falls
// back to Origin, then Referer, each compared against the incoming
// request's own resolved URL — so it needs no hardcoded APP_ORIGIN and
// keeps working regardless of port/domain/environment (this app's dev port
// is assigned dynamically by the sandboxing layer — see vite.config.ts).
//
// Scoped to `handlerType === 'serverFn'` only, per the framework's own
// documented recommendation — NOT server routes. src/routes/api.webhooks.razorpay.ts
// is a server route that receives real cross-origin POSTs from Razorpay's
// servers (no browser, no Origin/Referer to check); it has its own HMAC
// signature verification instead, which is the correct mechanism for a
// third-party webhook.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  // errorMiddleware wraps csrfMiddleware (not the other way round) so a
  // rejected cross-site request also gets the styled error page instead of
  // an unhandled exception.
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
