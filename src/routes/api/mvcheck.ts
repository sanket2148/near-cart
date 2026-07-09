import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/mvcheck")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const be = await import("@/lib/verification/backend.server");
          const sub = await be.getSubmission("mr_selftest_probe");
          return Response.json({
            ok: true,
            hasUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
            hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            hasAi: !!process.env.LOVABLE_API_KEY,
            documents: sub.documents.length,
          });
        } catch (e) {
          return Response.json({ ok: false, error: String(e) }, { status: 500 });
        }
      },
    },
  },
});
