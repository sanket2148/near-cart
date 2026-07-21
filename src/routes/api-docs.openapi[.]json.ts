// Serves the hand-maintained OpenAPI document (src/lib/api-docs/openapi.ts)
// as JSON, for src/routes/api-docs.tsx's Swagger UI to fetch.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api-docs/openapi.json")({
  server: {
    handlers: {
      GET: async () => {
        const { openApiDocument } = await import("@/lib/api-docs/openapi");
        return Response.json(openApiDocument);
      },
    },
  },
});
