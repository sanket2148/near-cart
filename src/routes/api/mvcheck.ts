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
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { dataBase64: string; mimeType: string };
          const be = await import("@/lib/verification/backend.server");
          const res = await be.analyzeFile({
            merchantRef: "mr_selftest_probe",
            category: "document",
            docType: "fssai",
            fileName: "test.png",
            mimeType: body.mimeType,
            dataBase64: body.dataBase64,
            form: { businessName: "Sharma Kirana Store", ownerName: "Sharma", address: "Koramangala Bengaluru" },
          });
          return Response.json({ ok: true, res });
        } catch (e) {
          return Response.json({ ok: false, error: String(e) }, { status: 500 });
        }
      },
    },
  },
});

