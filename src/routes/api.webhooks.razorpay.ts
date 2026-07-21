// Razorpay webhook endpoint — the source-of-truth backstop for payment
// confirmation (Phase F, scaffolded, not live — see plan/tasks/decisions.md).
// Configure this URL (https://<your-domain>/api/webhooks/razorpay) in the
// Razorpay dashboard once a real account exists, subscribed to
// `payment.captured` and `payment.failed`.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("x-razorpay-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const rawBody = await request.text();
        const be = await import("@/lib/payments/backend.server");

        if (!be.verifyWebhookSignature(rawBody, signature)) {
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          await be.handleWebhookEvent(JSON.parse(rawBody));
        } catch {
          return new Response("Malformed payload", { status: 400 });
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
