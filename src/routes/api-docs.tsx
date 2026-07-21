// Self-hosted Swagger UI (no CDN) for NearCart's server functions. See
// src/lib/api-docs/openapi.ts for the spec itself and why "Try it out" only
// really works for the one real REST route (the Razorpay webhook).
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import "swagger-ui-dist/swagger-ui.css";

export const Route = createFileRoute("/api-docs")({
  head: () => ({ meta: [{ title: "API Docs — NearCart" }] }),
  component: ApiDocsPage,
});

function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;

    void (async () => {
      // swagger-ui-dist manipulates the DOM directly and references `window`
      // at load time — must only ever be imported client-side, after mount.
      const { SwaggerUIBundle, SwaggerUIStandalonePreset } = await import("swagger-ui-dist");
      if (disposed || !containerRef.current) return;

      SwaggerUIBundle({
        url: "/api-docs/openapi.json",
        domNode: containerRef.current,
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        plugins: [SwaggerUIBundle.plugins.DownloadUrl],
        layout: "StandaloneLayout",
      });
    })();

    return () => {
      disposed = true;
    };
  }, []);

  return (
    <div>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Heads up:</strong> these are TanStack Start server-function RPCs, not plain REST
        endpoints — the real transport is a same-origin call to an internally-hashed path, not the
        readable <code>/rpc/...</code> paths shown below. <strong>“Try it out” will fail</strong>{" "}
        for every operation except <code>POST /api/webhooks/razorpay</code>, the one genuine HTTP
        route. Read each operation's request/response schema instead.
      </div>
      <div ref={containerRef} />
    </div>
  );
}
