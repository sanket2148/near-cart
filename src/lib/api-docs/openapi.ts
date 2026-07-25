// Hand-maintained OpenAPI 3.0 document describing NearCart's server
// functions (TanStack Start `createServerFn` RPCs) plus the one real REST
// endpoint (the Razorpay webhook). Served at /api-docs/openapi.json and
// rendered by Swagger UI at /api-docs — see src/routes/api-docs.tsx.
//
// IMPORTANT — these are RPC operations, not addressable REST routes. Every
// server function actually dispatches through an internal, hashed
// `/_serverFn/<id>` path assigned at build time, not the tidy `/rpc/...`
// paths used below. Those paths exist so Swagger UI has something readable
// to group/link operations under; they are NOT real URLs you can curl.
// "Try it out" will fail for all of them except the one genuine REST route
// (POST /api/webhooks/razorpay). See the `info.description` banner text.
//
// This spec is manually kept in sync with the actual Zod validators and
// backend.server.ts return types — it is not generated at build time. If
// you add/change a server function, update this file too.

const errorResponse = {
  description:
    "Thrown errors surface as a 500 with the error message in the body (see src/start.ts's errorMiddleware). Validation failures from the Zod validator surface as 400.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
};

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "NearCart Server API",
    version: "1.0.0",
    description:
      "Reference documentation for NearCart's backend — hyperlocal marketplace (customer, seller, delivery partner, admin). " +
      "Every operation below except **POST /api/webhooks/razorpay** is a TanStack Start `createServerFn` RPC, not a plain REST endpoint: " +
      "the real transport is a same-origin POST/GET to an internally-hashed `/_serverFn/<id>` path, protected by CSRF middleware " +
      "(Origin/Sec-Fetch-Site checked — see src/start.ts). The paths shown here (`/rpc/...`) are logical groupings for readability, " +
      "not real URLs. **“Try it out” will not work for RPC operations** — use it only on the webhook endpoint, which is a real HTTP route. " +
      "Every operation that acts on a specific customer/shop/order/partner resource derives the caller's identity from a real, verified " +
      "Supabase Auth session (HttpOnly cookies, never a client-supplied id) and checks real ownership before reading or mutating anything — " +
      "see plan/tasks/decisions.md's 6-phase authorization-hardening history for the full audit trail.",
  },
  tags: [
    {
      name: "Catalog",
      description: "Public browsing — categories, shops, products, search. No auth.",
    },
    { name: "Orders", description: "Customer order placement and tracking." },
    {
      name: "Payments",
      description:
        "Razorpay integration — scaffolded, inactive until RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are configured.",
    },
    {
      name: "Seller",
      description:
        "Shop owner operations — shop profile, catalog management, order fulfillment, dispatch.",
    },
    {
      name: "Partner",
      description: "Delivery partner operations — profile, online status, job lifecycle.",
    },
    {
      name: "Admin",
      description:
        "Platform admin operations, gated by adminMiddleware + a real user_roles row — verification review queue, shop/partner/order management, live stats.",
    },
    { name: "Tracking", description: "Live order status + delivery partner GPS position." },
    {
      name: "Auth",
      description:
        "Real Supabase Auth email-OTP session — HttpOnly cookies, no tokens in client JS.",
    },
    {
      name: "Verification",
      description:
        "Seller KYC/document verification pipeline (AI-assisted OCR + duplicate/authenticity checks).",
    },
    {
      name: "Addresses",
      description:
        "Customer address book. Built directly on context.scopedClient + RLS (addresses_owner_all) — no service-role client at all, the DB enforces ownership by construction.",
    },
    {
      name: "Profile",
      description:
        "Customer's own name/email. Email is read-only (it's the real Auth identity, verified via OTP).",
    },
    {
      name: "Wishlist",
      description: "Saved products. Same scopedClient + RLS pattern as Addresses.",
    },
    {
      name: "Offers",
      description: "Public coupon browsing. No auth — matches Catalog's posture.",
    },
    {
      name: "Notifications",
      description:
        "Read/mark-read only via scopedClient + RLS — rows are written by other flows (order status changes, verification decisions) using a separate service-role helper, not by any endpoint here.",
    },
    {
      name: "Reviews",
      description:
        "Post-delivery shop/partner ratings. Reviewer identity is never exposed on the public read.",
    },
    {
      name: "Shop Hours",
      description:
        "Weekly open/close schedule. Entirely RLS-enforced (shop_hours_owner_write) — the only module with no backend.server.ts at all, no service-role client anywhere.",
    },
    {
      name: "Webhooks",
      description: "Real inbound HTTP endpoints (not RPCs) for third-party gateway callbacks.",
    },
  ],
  paths: {
    // ─── Catalog ────────────────────────────────────────────────────────────
    "/rpc/catalog/getCategories": {
      get: {
        tags: ["Catalog"],
        operationId: "getCategories",
        summary: "List shop categories",
        description: "No input. Returns every row in `categories`.",
        responses: {
          "200": {
            description: "Categories",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Category" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/catalog/getNearbyShops": {
      get: {
        tags: ["Catalog"],
        operationId: "getNearbyShops",
        summary: "List active shops, optionally sorted by distance",
        description:
          "Fetches every `status='active'` shop, then computes `distanceKm` in JS (haversine) if `lat`/`lng` are given — not a PostGIS spatial query. `category` filters client-side after mapping (not applied server-side yet; see backend.server.ts).",
        parameters: [
          { name: "lat", in: "query", schema: { type: "number" }, required: false },
          { name: "lng", in: "query", schema: { type: "number" }, required: false },
          {
            name: "category",
            in: "query",
            schema: { type: "string" },
            required: false,
            description: "Category slug.",
          },
        ],
        responses: {
          "200": {
            description: "Shops",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/CatalogShop" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/catalog/getShop": {
      get: {
        tags: ["Catalog"],
        operationId: "getShop",
        summary: "Get a single shop by id",
        parameters: [{ name: "shopId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Shop, or null if not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CatalogShop" },
                nullable: true,
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/catalog/getShopProducts": {
      get: {
        tags: ["Catalog"],
        operationId: "getShopProducts",
        summary: "List a shop's products",
        parameters: [{ name: "shopId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Products",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/CatalogProduct" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/catalog/searchCatalog": {
      get: {
        tags: ["Catalog"],
        operationId: "searchCatalog",
        summary: "Search shops and products by name",
        description:
          "Runs two queries in parallel (searchShops + searchProducts internally) and returns both result sets.",
        parameters: [
          { name: "query", in: "query", required: true, schema: { type: "string", minLength: 1 } },
        ],
        responses: {
          "200": {
            description: "Matching shops and products",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    shops: { type: "array", items: { $ref: "#/components/schemas/CatalogShop" } },
                    products: {
                      type: "array",
                      items: { $ref: "#/components/schemas/CatalogProduct" },
                    },
                  },
                },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },

    // ─── Orders ─────────────────────────────────────────────────────────────
    "/rpc/orders/quoteOrder": {
      get: {
        tags: ["Orders"],
        operationId: "quoteOrder",
        summary: "Price a cart without placing an order, optionally previewing a coupon",
        description:
          "Called from checkout.tsx when the user applies a coupon code, to preview the real server-computed discount before placing the order. " +
          "`couponCode` is optional; if given, `coupons` is looked up for real (active, not expired, min order met) — an invalid/inapplicable code returns `discountAmount: 0` plus a human-readable `couponError`, not a thrown error, so the rest of the quote still renders. " +
          "**Unit note:** unlike placeOrder's response, amounts here are in **paise** (raw DB units), not decimal rupees — a pre-existing inconsistency, not something this spec is fixing.",
        parameters: [
          { name: "shopId", in: "query", required: true, schema: { type: "string" } },
          {
            name: "items",
            in: "query",
            required: true,
            schema: { type: "array", items: { $ref: "#/components/schemas/OrderItemInput" } },
            description:
              "Serialized as JSON in practice, not real query-string array syntax — RPC input, not a literal query string.",
          },
          {
            name: "couponCode",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "A coupons.code value, matched case-insensitively.",
          },
        ],
        responses: {
          "200": {
            description: "Quote (amounts in paise)",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/OrderQuote" } },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/orders/placeOrder": {
      post: {
        tags: ["Orders"],
        operationId: "placeOrder",
        summary: "Place an order",
        description:
          "Re-prices items server-side from `products` (never trusts client-sent prices), creates an `addresses` row, generates 4-digit pickup/delivery handoff codes, and — if a Razorpay gateway is configured (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET; not configured today) — creates a real Razorpay order and leaves the order unpaid (`status: 'created'`) instead of instantly 'paid'. See the `payment` field on the response. " +
          "`couponCode` is optional and, like quoteOrder, only ever a code — there is no `discountAmount` field on this request at all, so the discount is always recomputed server-side from the coupon table, never trusted from the client.",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/PlaceOrderInput" } },
          },
        },
        responses: {
          "200": {
            description: "The created order",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/CustomerOrder" } },
            },
          },
          "400": errorResponse,
          "500": errorResponse,
        },
      },
    },
    "/rpc/orders/listOrders": {
      get: {
        tags: ["Orders"],
        operationId: "listOrders",
        summary: "List the logged-in customer's orders",
        description:
          "Requires a real session (authMiddleware) — the customer id is derived from the verified access-token cookie, never accepted as a parameter.",
        responses: {
          "200": {
            description: "Orders, newest first",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/CustomerOrder" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/orders/getOrder": {
      get: {
        tags: ["Orders"],
        operationId: "getOrder",
        summary: "Get a single order by id",
        description:
          "Requires a real session (authMiddleware) and ownership — returns null (not an error) if the order exists but doesn't belong to the caller, so existence can't be probed.",
        parameters: [{ name: "orderId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Order, or null if not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CustomerOrder" },
                nullable: true,
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/orders/cancelOrder": {
      post: {
        tags: ["Orders"],
        operationId: "cancelOrder",
        summary: "Cancel the caller's own order, while it's still early enough",
        description:
          "Requires authMiddleware. Only allowed while the order is in created/paid/cod_confirmed/shop_accepted — once the shop has started actually preparing it, this is rejected (a stricter cutoff than admin-data's force-cancel, since letting a customer unilaterally cancel mid-prep would waste real food/goods). Notifies the shop owner. Distinct from admin's cancelOrder — this one also enforces that the order belongs to the caller.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId"],
                properties: { orderId: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "No content" },
          "400": errorResponse,
          "500": errorResponse,
        },
      },
    },

    // ─── Payments ───────────────────────────────────────────────────────────
    "/rpc/payments/verifyPayment": {
      post: {
        tags: ["Payments"],
        operationId: "verifyPayment",
        summary: "Verify a Razorpay Checkout.js success callback and mark the order paid",
        description:
          'Computes HMAC-SHA256("razorpayOrderId|razorpayPaymentId", RAZORPAY_KEY_SECRET) and compares it (timing-safe) to razorpaySignature. ' +
          "Only flips the order to 'paid' on a match. Requires a real session (authMiddleware) and ownership of orderId, on top of the signature check. **Scaffolded, not live** — throws \"Payment gateway not configured\" until RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET exist. See also POST /api/webhooks/razorpay, the source-of-truth backstop for the same confirmation.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId", "razorpayOrderId", "razorpayPaymentId", "razorpaySignature"],
                properties: {
                  orderId: { type: "string" },
                  razorpayOrderId: { type: "string" },
                  razorpayPaymentId: { type: "string" },
                  razorpaySignature: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Verified — order is now 'paid'" },
          "500": {
            description: "Signature mismatch, or gateway not configured",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },

    // ─── Seller ─────────────────────────────────────────────────────────────
    "/rpc/seller/getMyShop": {
      get: {
        tags: ["Seller"],
        operationId: "getMyShop",
        summary: "Get the shop owned by a user",
        parameters: [{ name: "ownerId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Shop, or null if this account has no shop yet",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ShopProfile" },
                nullable: true,
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/seller/createShop": {
      post: {
        tags: ["Seller"],
        operationId: "createShop",
        summary: "Create a new shop for an account",
        description:
          "Shop starts closed (`isOpen: false`) with the caller's real, client-captured GPS coordinates (rejected server-side if outside a generous Bengaluru bounding box) and no products. A matching `shop_verifications` row is created at `overall_status: 'incomplete'`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["ownerId", "name", "businessType", "area", "lat", "lng"],
                properties: {
                  ownerId: { type: "string" },
                  name: { type: "string" },
                  businessType: {
                    type: "string",
                    description:
                      "One of the BusinessType slugs (restaurant, pharmacy, grocery, retail, salon, electronics, bakery, home_business).",
                  },
                  area: { type: "string" },
                  tagline: { type: "string" },
                  lat: {
                    type: "number",
                    description: "Real GPS latitude, pinned by the merchant client-side.",
                  },
                  lng: {
                    type: "number",
                    description: "Real GPS longitude, pinned by the merchant client-side.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "The created shop",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ShopProfile" } },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/seller/searchUnclaimedShops": {
      get: {
        tags: ["Seller"],
        operationId: "searchUnclaimedShops",
        summary: "Search unclaimed (OSM-imported) shop listings by name",
        description:
          'Lets a prospective merchant find "is this my shop?" among shops imported from OpenStreetMap (`claimed: false`) during onboarding — see claimShop.',
        parameters: [{ name: "query", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Up to 20 matching unclaimed shops",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      addressLine: { type: "string" },
                      city: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/seller/findPossibleShopMatches": {
      get: {
        tags: ["Seller"],
        operationId: "findPossibleShopMatches",
        summary: "Find likely-duplicate unclaimed shops by name + real proximity",
        description:
          "Stronger version of searchUnclaimedShops used once a merchant has pinned a real GPS location while creating a new shop (CreateShopStep.tsx): combines pg_trgm name similarity with a PostGIS radius filter (`find_shop_matches` SQL function, migration 0014) instead of a plain substring match, so naming variants of a real nearby OSM-imported listing are still caught.",
        parameters: [
          { name: "name", in: "query", required: true, schema: { type: "string" } },
          { name: "lat", in: "query", required: true, schema: { type: "number" } },
          { name: "lng", in: "query", required: true, schema: { type: "number" } },
        ],
        responses: {
          "200": {
            description: "Up to 10 nearby unclaimed shops, ranked by name similarity then distance",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      addressLine: { type: "string" },
                      city: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/seller/claimShop": {
      post: {
        tags: ["Seller"],
        operationId: "claimShop",
        summary: "Claim an unclaimed (OSM-imported) shop for the calling account",
        description:
          "Atomically fails with a real error if the shop was already claimed by someone else (optimistic-concurrency guard, not a first-write-wins silent overwrite), or if the caller already owns a shop. On success, provisions a `shop_verifications` row exactly like createShop does, and the caller proceeds through the same verification flow.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shopId", "businessType"],
                properties: {
                  shopId: { type: "string" },
                  businessType: {
                    type: "string",
                    description:
                      "One of the BusinessType slugs (restaurant, pharmacy, grocery, retail, salon, electronics, bakery, home_business) — confirmed/corrected by the merchant, since OSM's inferred type may be wrong or absent.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "The now-claimed shop",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ShopProfile" } },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/seller/updateShop": {
      post: {
        tags: ["Seller"],
        operationId: "updateShop",
        summary: "Patch shop fields",
        description:
          "`patch` is an untyped record passed straight through — only recognized keys (name/tagline/emoji/area/isOpen/deliveryFee/freeAbove/etaMinutes) are written; anything else is silently ignored.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shopId", "patch"],
                properties: {
                  shopId: { type: "string" },
                  patch: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/seller/syncVerificationSummary": {
      post: {
        tags: ["Seller"],
        operationId: "syncVerificationSummary",
        summary:
          "Sync the verification wizard's summary + per-level status into shop_verifications",
        description:
          "The wizard's deep detail (documents, PAN/Aadhaar, bank, GPS) stays localStorage-only — only these roll-up fields are persisted server-side.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shopId", "summary"],
                properties: {
                  shopId: { type: "string" },
                  summary: {
                    type: "object",
                    required: ["businessType", "badgeTier", "overallStatus"],
                    properties: {
                      businessType: { type: "string", nullable: true },
                      badgeTier: { type: "string" },
                      overallStatus: { type: "string" },
                      levels: {
                        type: "object",
                        description: "Optional — all 8 present or omit entirely.",
                        properties: {
                          l1Phone: { $ref: "#/components/schemas/LevelStatus" },
                          l1Email: { $ref: "#/components/schemas/LevelStatus" },
                          l2Documents: { $ref: "#/components/schemas/LevelStatus" },
                          l3Kyc: { $ref: "#/components/schemas/LevelStatus" },
                          l4Bank: { $ref: "#/components/schemas/LevelStatus" },
                          l5Gps: { $ref: "#/components/schemas/LevelStatus" },
                          l6Ai: { $ref: "#/components/schemas/LevelStatus" },
                          l7Review: { $ref: "#/components/schemas/LevelStatus" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/seller/getMyProducts": {
      get: {
        tags: ["Seller"],
        operationId: "getMyProducts",
        summary: "List a shop's products (seller view)",
        parameters: [{ name: "shopId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Products",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Product" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/seller/addProduct": {
      post: {
        tags: ["Seller"],
        operationId: "addProduct",
        summary: "Add a product to a shop",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shopId", "input"],
                properties: {
                  shopId: { type: "string" },
                  input: { $ref: "#/components/schemas/ProductInput" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "The created product",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/seller/updateProduct": {
      post: {
        tags: ["Seller"],
        operationId: "updateProduct",
        summary: "Patch a product",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["productId", "patch"],
                properties: {
                  productId: { type: "string" },
                  patch: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/seller/removeProduct": {
      post: {
        tags: ["Seller"],
        operationId: "removeProduct",
        summary: "Delete a product",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["productId"],
                properties: { productId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/seller/toggleStock": {
      post: {
        tags: ["Seller"],
        operationId: "toggleStock",
        summary: "Toggle a product's in-stock flag",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["productId"],
                properties: { productId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/seller/getShopOrders": {
      get: {
        tags: ["Seller"],
        operationId: "getShopOrders",
        summary: "List a shop's incoming orders",
        parameters: [{ name: "shopId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Orders",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/SellerOrder" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/seller/acceptOrder": {
      post: {
        tags: ["Seller"],
        operationId: "acceptOrder",
        summary: "Accept an incoming order",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId"],
                properties: { orderId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/seller/rejectOrder": {
      post: {
        tags: ["Seller"],
        operationId: "rejectOrder",
        summary: "Reject an incoming order",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId"],
                properties: { orderId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/seller/advanceOrder": {
      post: {
        tags: ["Seller"],
        operationId: "advanceOrder",
        summary: "Advance an order to its next fulfillment status",
        description:
          "`currentStatus` must be the caller's current view of the order's SellerOrderStatus — used to compute the next status, not re-derived server-side from the DB.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId", "currentStatus"],
                properties: {
                  orderId: { type: "string" },
                  currentStatus: { $ref: "#/components/schemas/SellerOrderStatus" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/seller/getAvailablePartners": {
      get: {
        tags: ["Seller"],
        operationId: "getAvailablePartners",
        summary: "List online, active delivery partners",
        description:
          "No input. Used to populate the dispatch picker when a seller offers an order to a partner.",
        responses: {
          "200": {
            description: "Partners",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/AvailablePartner" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/seller/offerToPartner": {
      post: {
        tags: ["Seller"],
        operationId: "offerToPartner",
        summary: "Offer an order to a delivery partner",
        description:
          "Creates an `assignments` row with status 'offered' — this is an offer, not an assignment; the partner must call acceptJob before the order moves to partner_assigned.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId", "partnerId"],
                properties: { orderId: { type: "string" }, partnerId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },

    // ─── Partner ────────────────────────────────────────────────────────────
    "/rpc/partner/getMyProfile": {
      get: {
        tags: ["Partner"],
        operationId: "getMyProfile",
        summary: "Get the delivery-partner profile for a user",
        parameters: [{ name: "userId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Profile, or null if not registered as a partner yet",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RiderProfile" },
                nullable: true,
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/partner/createProfile": {
      post: {
        tags: ["Partner"],
        operationId: "createProfile",
        summary: "Register a new delivery partner",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId", "name", "vehicle", "area"],
                properties: {
                  userId: { type: "string" },
                  name: { type: "string" },
                  vehicle: { type: "string" },
                  area: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "The created profile",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RiderProfile" } },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/partner/toggleOnline": {
      post: {
        tags: ["Partner"],
        operationId: "toggleOnline",
        summary: "Toggle a partner's online/offline status",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["partnerId"],
                properties: { partnerId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/partner/getMyJobs": {
      get: {
        tags: ["Partner"],
        operationId: "getMyJobs",
        summary: "List a partner's delivery jobs (offers + history)",
        parameters: [
          { name: "partnerId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Jobs, newest offer first",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/DeliveryJob" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/partner/acceptJob": {
      post: {
        tags: ["Partner"],
        operationId: "acceptJob",
        summary: "Accept an offered delivery job",
        description: "assignmentId, not orderId. Moves the order to partner_assigned.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["assignmentId"],
                properties: { assignmentId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/partner/declineJob": {
      post: {
        tags: ["Partner"],
        operationId: "declineJob",
        summary: "Decline an offered delivery job",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["assignmentId"],
                properties: { assignmentId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/partner/advanceJob": {
      post: {
        tags: ["Partner"],
        operationId: "advanceJob",
        summary: "Advance a job: accepted → picked_up → delivered",
        description:
          "On the final transition (picked_up → delivered), also computes and records payout (₹25 + ₹8/km, a placeholder formula — see decisions.md) onto the assignment.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["assignmentId", "currentStatus"],
                properties: {
                  assignmentId: { type: "string" },
                  currentStatus: { $ref: "#/components/schemas/JobStatus" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },

    // ─── Admin ──────────────────────────────────────────────────────────────
    "/rpc/admin/listShopsForReview": {
      get: {
        tags: ["Admin"],
        operationId: "listShopsForReview",
        summary: "List shops pending verification review",
        description:
          "Requires a real session AND a `user_roles` row with `role = 'admin'` (adminMiddleware — see decisions.md, Phase 2 of the authorization-hardening plan). No input. Returns shops with `shop_verifications.overall_status = 'pending_review'`.",
        responses: {
          "200": {
            description: "Pending shops",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/AdminShopReview" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/admin/approveShop": {
      post: {
        tags: ["Admin"],
        operationId: "approveShop",
        summary: "Approve a shop's verification",
        description:
          "Requires adminMiddleware. Sets shop_verifications.overall_status = 'approved' and sends the shop owner a real notification (see decisions.md, 2026-07-19 \"Notification producers\").",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shopId"],
                properties: { shopId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/admin/rejectShop": {
      post: {
        tags: ["Admin"],
        operationId: "rejectShop",
        summary: "Reject a shop's verification",
        description:
          "Requires adminMiddleware. Sets shop_verifications.overall_status = 'incomplete' (there's no distinct 'rejected' status — the shop just re-enters the incomplete pipeline) and sends the shop owner a real notification.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shopId"],
                properties: { shopId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/admin/listAllShops": {
      get: {
        tags: ["Admin"],
        operationId: "listAllShops",
        summary: "List every shop on the platform (full roster, not just the review queue)",
        description: "Requires adminMiddleware. No input. Up to 500 rows, newest first.",
        responses: {
          "200": {
            description: "Shops",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/AdminShop" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/admin/suspendShop": {
      post: {
        tags: ["Admin"],
        operationId: "suspendShop",
        summary: "Suspend a shop",
        description:
          "Requires adminMiddleware. Sets shop_verifications.overall_status = 'suspended' and notifies the owner.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shopId"],
                properties: { shopId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/admin/reactivateShop": {
      post: {
        tags: ["Admin"],
        operationId: "reactivateShop",
        summary: "Reactivate a suspended shop",
        description:
          "Requires adminMiddleware. Sets shop_verifications.overall_status = 'approved' and notifies the owner.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shopId"],
                properties: { shopId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/admin/listAllPartners": {
      get: {
        tags: ["Admin"],
        operationId: "listAllPartners",
        summary: "List every delivery partner on the platform",
        description: "Requires adminMiddleware. No input. Up to 500 rows, newest first.",
        responses: {
          "200": {
            description: "Partners",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/AdminPartner" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/admin/suspendPartner": {
      post: {
        tags: ["Admin"],
        operationId: "suspendPartner",
        summary: "Suspend a delivery partner",
        description:
          "Requires adminMiddleware. Sets status='suspended', is_online=false, and notifies the partner.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["partnerId"],
                properties: { partnerId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/admin/reactivatePartner": {
      post: {
        tags: ["Admin"],
        operationId: "reactivatePartner",
        summary: "Reactivate a suspended delivery partner",
        description: "Requires adminMiddleware. Sets status='active' and notifies the partner.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["partnerId"],
                properties: { partnerId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/admin/listAllOrders": {
      get: {
        tags: ["Admin"],
        operationId: "listAllOrders",
        summary: "List orders platform-wide, optionally filtered by status",
        description: "Requires adminMiddleware. Up to 200 rows, newest first.",
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "A raw orders.status value (e.g. 'delivered', 'cancelled').",
          },
        ],
        responses: {
          "200": {
            description: "Orders",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/AdminOrder" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/admin/cancelOrder": {
      post: {
        tags: ["Admin"],
        operationId: "cancelOrder",
        summary: "Force-cancel an order",
        description:
          "Requires adminMiddleware. A status override + audit-trail entry only — no refund/payout-reversal logic exists yet (payments are still scaffolded). Rejects (throws) if the order is already in a terminal state (delivered/cancelled/refunded/etc).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId"],
                properties: { orderId: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "No content" },
          "400": errorResponse,
          "500": errorResponse,
        },
      },
    },
    "/rpc/admin/getAdminStats": {
      get: {
        tags: ["Admin"],
        operationId: "getAdminStats",
        summary: "Live platform aggregates for the admin dashboard",
        description:
          "Requires adminMiddleware. No input, no stored time-series — computed fresh from current rows on every call.",
        responses: {
          "200": {
            description: "Stats",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/AdminStats" } },
            },
          },
          "500": errorResponse,
        },
      },
    },

    // ─── Tracking ───────────────────────────────────────────────────────────
    "/rpc/tracking/getOrderTracking": {
      get: {
        tags: ["Tracking"],
        operationId: "getOrderTracking",
        summary: "Get an order's real status + its assigned partner's latest GPS position",
        description:
          "Maps the DB's 15-state order_status down to a 5-stage TrackStatus. `rider` is null until a partner has both accepted the order AND pushed at least one location. Requires a real session (authMiddleware) and ownership — returns the 'placed, no rider' default if the order isn't the caller's own, rather than an error.",
        parameters: [{ name: "orderId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Tracking snapshot",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/OrderTracking" } },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/tracking/pushPartnerLocation": {
      post: {
        tags: ["Tracking"],
        operationId: "pushPartnerLocation",
        summary: "Record a delivery partner's current GPS position",
        description:
          "Called by the partner's browser (throttled to 1 per 8s) from a real navigator.geolocation.watchPosition callback — see src/routes/partner.track.$orderId.tsx. Appends a row to partner_locations; does not overwrite previous positions. Requires a real session (authMiddleware) — the delivery_partners row is looked up from the caller's own uid server-side, never accepted as a parameter.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["lat", "lng"],
                properties: { lat: { type: "number" }, lng: { type: "number" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },

    // ─── Auth ───────────────────────────────────────────────────────────────
    // ensureRealUser/the dev-mode phone-OTP bridge described here previously
    // was retired 2026-07-18 when the web app moved to real Supabase email-OTP
    // sessions (src/lib/auth-session/) — see plan/tasks/decisions.md. Email
    // OTP was itself replaced 2026-07-24 by email+password (no custom SMTP is
    // configured for this project, so OTP codes rode Supabase's default,
    // heavily rate-limited email provider and could go undelivered). The
    // entries below reflect the real endpoints that replaced it.
    "/rpc/auth/signUp": {
      post: {
        tags: ["Auth"],
        operationId: "signUp",
        summary: "Create a new account with email + password and start a real session",
        description:
          "Uses the service-role Admin API to create the user with `email_confirm: true` (no confirmation email is sent or required), then signs in immediately to mint a real session. Sets `__Host-nc-at`/`__Host-nc-rt` HttpOnly cookies (access + refresh token) — the tokens never reach client JS.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Signed-up (and signed-in) user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { id: { type: "string" }, email: { type: "string" } },
                },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/auth/signIn": {
      post: {
        tags: ["Auth"],
        operationId: "signIn",
        summary: "Log in with email + password and start a real session",
        description:
          "Real Supabase Auth `signInWithPassword`. Sets `__Host-nc-at`/`__Host-nc-rt` HttpOnly cookies (access + refresh token) — the tokens never reach client JS. Returns only the user's id/email. Every other authenticated server function reads these cookies via `authMiddleware`, never a client-supplied user id (see decisions.md, Phase 1 of the authorization-hardening plan).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Signed-in user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { id: { type: "string" }, email: { type: "string" } },
                },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/auth/getCurrentUser": {
      get: {
        tags: ["Auth"],
        operationId: "getCurrentUser",
        summary: "Resolve the caller's session from cookies, refreshing if needed",
        description:
          "No input — reads the `__Host-nc-at`/`__Host-nc-rt` cookies directly. Silently refreshes an expired access token via the refresh token cookie before giving up. Returns null if not signed in.",
        responses: { "200": { description: "The current user, or null" }, "500": errorResponse },
      },
    },
    "/rpc/auth/logout": {
      post: {
        tags: ["Auth"],
        operationId: "logout",
        summary: "Revoke the session and clear cookies",
        description:
          "No input. Clears both session cookies and revokes the refresh token server-side.",
        responses: { "200": { description: "Logged out" }, "500": errorResponse },
      },
    },

    // ─── Verification ───────────────────────────────────────────────────────
    "/rpc/verification/submitVerificationFile": {
      post: {
        tags: ["Verification"],
        operationId: "submitVerificationFile",
        summary: "Upload and analyze a KYC document or shop photo",
        description:
          "Requires a real session (authMiddleware) and ownership of shopId. Runs a real pipeline: SHA-256 duplicate detection (global, across all merchants), AI-vision OCR + field extraction + quality/authenticity scoring (Lovable AI gateway), comparison against the registration form, a weighted confidence score, and a VERIFIED/UNDER_REVIEW/REJECTED decision. For gst/fssai/pan documents, ALSO cross-checks the OCR'd number against the real government registry (GSTN/FoSCoS via Deepvue) — scaffolded, inactive until DEEPVUE_CLIENT_ID/DEEPVUE_CLIENT_SECRET are configured; see the `registryCheck` field on the response. Stores the file in a private Supabase Storage bucket. Persists results to the generic `events` table (not the purpose-built kyc_documents/shop_photos tables — a known gap, see decisions.md), tagged with shopId so a merchantRef alone is never sufficient to read another shop's documents.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "merchantRef",
                  "shopId",
                  "category",
                  "docType",
                  "fileName",
                  "mimeType",
                  "dataBase64",
                ],
                properties: {
                  merchantRef: { type: "string", minLength: 3, maxLength: 80 },
                  shopId: { type: "string" },
                  category: { type: "string", enum: ["document", "photo"] },
                  docType: {
                    type: "string",
                    maxLength: 60,
                    description: "e.g. 'fssai', 'gst', 'front', 'selfie'.",
                  },
                  fileName: { type: "string", maxLength: 200 },
                  mimeType: {
                    type: "string",
                    maxLength: 120,
                    description: "image/jpeg, image/png, image/webp, or application/pdf.",
                  },
                  dataBase64: {
                    type: "string",
                    description: "Base64-encoded file content, no data: prefix. 10 MB max.",
                  },
                  form: { $ref: "#/components/schemas/VerificationForm" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Analysis result",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/FileAnalysis" } },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/verification/getVerificationSubmission": {
      get: {
        tags: ["Verification"],
        operationId: "getVerificationSubmission",
        summary: "Get all analyzed documents + the latest finalized decision for a merchant",
        description:
          "Requires a real session (authMiddleware) and ownership of shopId — merchantRef alone was never a real security boundary (it's a random client-generated id with no stored owner link before this).",
        parameters: [
          {
            name: "merchantRef",
            in: "query",
            required: true,
            schema: { type: "string", minLength: 3, maxLength: 80 },
          },
          { name: "shopId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Submission view",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/SubmissionView" } },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/verification/finalizeVerification": {
      post: {
        tags: ["Verification"],
        operationId: "finalizeVerification",
        summary: "Compute and record the overall verification decision",
        description:
          "Requires a real session (authMiddleware) and ownership of shopId. Averages confidence across all submitted documents; REJECTED if any document was rejected, UNDER_REVIEW if any is under review or none exist, else VERIFIED.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["merchantRef", "shopId"],
                properties: {
                  merchantRef: { type: "string", minLength: 3, maxLength: 80 },
                  shopId: { type: "string" },
                  form: { $ref: "#/components/schemas/VerificationForm" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Overall decision",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  nullable: true,
                  properties: {
                    decision: { type: "string", enum: ["VERIFIED", "UNDER_REVIEW", "REJECTED"] },
                    confidence: { type: "number" },
                    documentCount: { type: "integer" },
                    updatedAt: { type: "integer", nullable: true },
                  },
                },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/verification/getVerificationFileUrl": {
      post: {
        tags: ["Verification"],
        operationId: "getVerificationFileUrl",
        summary: "Get a short-lived signed URL for an uploaded verification file",
        description:
          "Requires a real session (authMiddleware) and ownership of shopId — the merchantRef embedded in `path` is cross-checked against a real document event tagged with this shopId, so a caller can't request a signed URL for a file they don't actually own even if they can guess/construct the path. 1-hour expiry. POST (not GET) because it's exercising a privileged storage operation, not a plain read.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["path", "shopId"],
                properties: {
                  path: { type: "string", minLength: 1, maxLength: 300 },
                  shopId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Signed URL",
            content: {
              "application/json": {
                schema: { type: "object", properties: { url: { type: "string" } } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },

    // ─── Addresses ──────────────────────────────────────────────────────────
    "/rpc/addresses/listAddresses": {
      get: {
        tags: ["Addresses"],
        operationId: "listAddresses",
        summary: "List the caller's own saved addresses",
        description:
          "Requires authMiddleware. RLS scopes rows to the caller — no explicit filter needed in app code. Default address first, then newest first.",
        responses: {
          "200": {
            description: "Addresses",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Address" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/addresses/addAddress": {
      post: {
        tags: ["Addresses"],
        operationId: "addAddress",
        summary: "Add a new address",
        description:
          "Requires authMiddleware. Inserts via context.scopedClient (RLS-enforced), never a service-role client.",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/AddressInput" } },
          },
        },
        responses: {
          "200": {
            description: "The created address",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Address" } } },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/addresses/updateAddress": {
      post: {
        tags: ["Addresses"],
        operationId: "updateAddress",
        summary: "Update an existing address",
        description:
          "Requires authMiddleware. RLS rejects (silently affects 0 rows) if the id isn't the caller's own.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/AddressInput" },
                  { type: "object", required: ["id"], properties: { id: { type: "string" } } },
                ],
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/addresses/deleteAddress": {
      post: {
        tags: ["Addresses"],
        operationId: "deleteAddress",
        summary: "Delete an address",
        description: "Requires authMiddleware. RLS-scoped.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/addresses/setDefaultAddress": {
      post: {
        tags: ["Addresses"],
        operationId: "setDefaultAddress",
        summary: "Mark an address as the default",
        description:
          "Requires authMiddleware. Clears is_default on every one of the caller's own addresses first, then sets it on the given id — RLS-scoped throughout.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },

    // ─── Profile ────────────────────────────────────────────────────────────
    "/rpc/profile/getProfile": {
      get: {
        tags: ["Profile"],
        operationId: "getProfile",
        summary: "Get the caller's own profile",
        description:
          "Requires authMiddleware. Reads from `users` via context.scopedClient (users_select_own RLS).",
        responses: {
          "200": {
            description: "Profile",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Profile" } } },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/profile/updateProfile": {
      post: {
        tags: ["Profile"],
        operationId: "updateProfile",
        summary: "Update the caller's own display name",
        description:
          "Requires authMiddleware. Email is deliberately not editable here — it's the real Supabase Auth identity, not a free-text field.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fullName"],
                properties: { fullName: { type: "string", maxLength: 80 } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },

    // ─── Wishlist ───────────────────────────────────────────────────────────
    "/rpc/wishlist/listWishlist": {
      get: {
        tags: ["Wishlist"],
        operationId: "listWishlist",
        summary: "List the caller's saved products",
        description:
          "Requires authMiddleware. RLS-scoped. Rows whose product has since been deleted are filtered out.",
        responses: {
          "200": {
            description: "Wishlist",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/WishlistProduct" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/wishlist/isWishlisted": {
      get: {
        tags: ["Wishlist"],
        operationId: "isWishlisted",
        summary: "Check whether a product is in the caller's wishlist",
        description: "Requires authMiddleware.",
        parameters: [
          { name: "productId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Result",
            content: {
              "application/json": {
                schema: { type: "object", properties: { wishlisted: { type: "boolean" } } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/wishlist/addToWishlist": {
      post: {
        tags: ["Wishlist"],
        operationId: "addToWishlist",
        summary: "Add a product to the caller's wishlist",
        description:
          "Requires authMiddleware. Idempotent — a duplicate-key error (already wishlisted) is swallowed, not thrown.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["productId"],
                properties: { productId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/wishlist/removeFromWishlist": {
      post: {
        tags: ["Wishlist"],
        operationId: "removeFromWishlist",
        summary: "Remove a product from the caller's wishlist",
        description: "Requires authMiddleware. RLS-scoped.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["productId"],
                properties: { productId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },

    // ─── Offers ─────────────────────────────────────────────────────────────
    "/rpc/offers/listActiveCoupons": {
      get: {
        tags: ["Offers"],
        operationId: "listActiveCoupons",
        summary: "List active, unexpired coupons",
        description:
          "No auth — public data (coupons_public_read_active RLS: active=true and not expired). Used by /offers to browse codes, and by orders/quoteOrder+placeOrder to actually apply one.",
        responses: {
          "200": {
            description: "Coupons",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Coupon" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },

    // ─── Notifications ──────────────────────────────────────────────────────
    "/rpc/notifications/listNotifications": {
      get: {
        tags: ["Notifications"],
        operationId: "listNotifications",
        summary: "List the caller's own notifications, newest first",
        description:
          "Requires authMiddleware. RLS-scoped (notifications_owner_select). Up to 100 rows. Rows are produced by seller-data/setOrderStatus, partner-data/advanceJob, and admin-data's shop/partner approve-reject-suspend-reactivate functions via a shared service-role insertNotification helper — not by any endpoint in this tag.",
        responses: {
          "200": {
            description: "Notifications",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/AppNotification" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/notifications/markNotificationRead": {
      post: {
        tags: ["Notifications"],
        operationId: "markNotificationRead",
        summary: "Mark one notification read",
        description:
          "Requires authMiddleware. RLS-scoped (notifications_owner_update) — only affects the row if it's the caller's own and still unread.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },
    "/rpc/notifications/markAllNotificationsRead": {
      post: {
        tags: ["Notifications"],
        operationId: "markAllNotificationsRead",
        summary: "Mark every one of the caller's unread notifications read",
        description: "Requires authMiddleware. RLS-scoped.",
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },

    // ─── Reviews ────────────────────────────────────────────────────────────
    "/rpc/reviews/getReviewableOrder": {
      get: {
        tags: ["Reviews"],
        operationId: "getReviewableOrder",
        summary: "Check whether an order is eligible for a review, and get its shop/partner",
        description:
          "Requires authMiddleware. Returns null (not an error) if the order isn't the caller's own or isn't delivered yet — a caller can't use this to probe another order's existence/status.",
        parameters: [{ name: "orderId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Reviewable order, or null",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReviewableOrder" },
                nullable: true,
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/reviews/getMyReviewForOrder": {
      get: {
        tags: ["Reviews"],
        operationId: "getMyReviewForOrder",
        summary: "Get the caller's own review for an order, if one exists",
        description: "Requires authMiddleware.",
        parameters: [{ name: "orderId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "The caller's review, or null",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MyReview" },
                nullable: true,
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/reviews/submitReview": {
      post: {
        tags: ["Reviews"],
        operationId: "submitReview",
        summary: "Submit a shop (and optionally partner) rating for a delivered order",
        description:
          "Requires authMiddleware. Rejects if the order isn't the caller's own, isn't delivered, or already has a review (one review per order).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["orderId", "shopRating"],
                properties: {
                  orderId: { type: "string" },
                  shopRating: { type: "integer", minimum: 1, maximum: 5 },
                  partnerRating: { type: "integer", minimum: 1, maximum: 5 },
                  comment: { type: "string", maxLength: 1000 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "No content" },
          "400": errorResponse,
          "500": errorResponse,
        },
      },
    },
    "/rpc/reviews/listShopReviews": {
      get: {
        tags: ["Reviews"],
        operationId: "listShopReviews",
        summary: "List a shop's public reviews",
        description:
          "No auth — public data, matches offers/catalog's posture. Reviewer identity is deliberately never exposed (reviews.customer_id isn't selected). Up to 50, newest first.",
        parameters: [{ name: "shopId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Reviews",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/ShopReview" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },

    // ─── Shop Hours ─────────────────────────────────────────────────────────
    "/rpc/shop-hours/getShopHours": {
      get: {
        tags: ["Shop Hours"],
        operationId: "getShopHours",
        summary: "Get a shop's real weekly hours",
        description:
          "No auth — public data (shop_hours_public_read RLS: using (true)). day_of_week follows JS Date#getDay() (0 = Sunday).",
        parameters: [{ name: "shopId", in: "query", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Hours",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/ShopHourEntry" } },
              },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/rpc/shop-hours/setShopHours": {
      post: {
        tags: ["Shop Hours"],
        operationId: "setShopHours",
        summary: "Replace a shop's weekly hours",
        description:
          "Requires authMiddleware. Entirely RLS-enforced (shop_hours_owner_write, no service-role client anywhere in this module) — delete-all-then-insert, since there's no unique constraint on (shop_id, day_of_week) to upsert against. A non-owner's write silently affects 0 rows rather than erroring, per RLS's insert-with-select semantics.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shopId", "hours"],
                properties: {
                  shopId: { type: "string" },
                  hours: {
                    type: "array",
                    maxItems: 7,
                    items: { $ref: "#/components/schemas/ShopHourEntry" },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "No content" }, "500": errorResponse },
      },
    },

    // ─── Webhooks (the one real REST route) ────────────────────────────────
    "/api/webhooks/razorpay": {
      post: {
        tags: ["Webhooks"],
        operationId: "razorpayWebhook",
        summary:
          "Razorpay payment event webhook (real HTTP route — Try it out works here, given valid values)",
        description:
          "The only genuinely real, fetchable URL in this document. Configure it in the Razorpay dashboard once a real account exists, subscribed to payment.captured and payment.failed. " +
          "Verifies `X-Razorpay-Signature` (HMAC-SHA256 of the raw body, RAZORPAY_WEBHOOK_SECRET) before processing. Idempotent — safe to receive the same event twice.",
        parameters: [
          {
            name: "X-Razorpay-Signature",
            in: "header",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  event: { type: "string", example: "payment.captured" },
                  payload: {
                    type: "object",
                    properties: {
                      payment: {
                        type: "object",
                        properties: {
                          entity: {
                            type: "object",
                            properties: { id: { type: "string" }, order_id: { type: "string" } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Processed" },
          "400": { description: "Missing/invalid signature, or malformed payload" },
        },
      },
    },
  },
  components: {
    schemas: {
      Error: { type: "object", properties: { message: { type: "string" } } },
      LevelStatus: {
        type: "string",
        enum: ["not_started", "in_progress", "submitted", "verified", "rejected"],
      },
      Category: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" }, emoji: { type: "string" } },
      },
      CatalogShop: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          tagline: { type: "string" },
          emoji: { type: "string" },
          rating: { type: "number" },
          ratingCount: { type: "integer" },
          distanceKm: { type: "number" },
          etaMinutes: { type: "integer" },
          isOpen: { type: "boolean" },
          deliveryFee: { type: "number", description: "INR, decimal." },
          freeAbove: { type: "number", description: "INR, decimal." },
          area: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          businessType: { type: "string", nullable: true },
          badgeTier: { type: "string", nullable: true },
        },
      },
      CatalogProduct: {
        type: "object",
        properties: {
          id: { type: "string" },
          shopId: { type: "string" },
          shopName: { type: "string" },
          name: { type: "string" },
          emoji: { type: "string" },
          price: { type: "number", description: "INR, decimal." },
          mrp: { type: "number", nullable: true, description: "INR, decimal." },
          unit: { type: "string" },
          category: { type: "string" },
          inStock: { type: "boolean" },
        },
      },
      OrderItemInput: {
        type: "object",
        required: ["productId", "quantity"],
        properties: { productId: { type: "string" }, quantity: { type: "integer", minimum: 1 } },
      },
      OrderQuote: {
        type: "object",
        description: "All amounts in PAISE (raw DB units) — see the operation description.",
        properties: {
          itemsAmount: { type: "integer" },
          deliveryAmount: { type: "integer" },
          handlingAmount: { type: "integer" },
          discountAmount: { type: "integer" },
          couponError: {
            type: "string",
            nullable: true,
            description:
              "Set when couponCode was given but invalid/inapplicable; discountAmount is 0 in that case.",
          },
          totalAmount: { type: "integer" },
          etaMinutes: { type: "integer" },
        },
      },
      PlaceOrderInput: {
        type: "object",
        description:
          "customerId is not part of this request body — it's derived server-side from the caller's verified session.",
        required: ["shopId", "items", "paymentMethod", "addressText", "lat", "lng"],
        properties: {
          shopId: { type: "string" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/OrderItemInput" },
            minItems: 1,
          },
          paymentMethod: { type: "string", enum: ["upi", "card", "netbanking", "cod"] },
          addressText: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          couponCode: {
            type: "string",
            description:
              "Optional. Only a code — the discount is always recomputed server-side, never accepted as an amount.",
          },
        },
      },
      OrderLine: {
        type: "object",
        properties: {
          name: { type: "string" },
          emoji: { type: "string" },
          price: { type: "number", description: "INR, decimal." },
          unit: { type: "string" },
          quantity: { type: "integer" },
        },
      },
      CustomerOrder: {
        type: "object",
        description:
          "All monetary fields are INR decimal here — unlike OrderQuote, which is paise.",
        properties: {
          id: { type: "string" },
          shopId: { type: "string" },
          shopName: { type: "string" },
          shopEmoji: { type: "string" },
          lines: { type: "array", items: { $ref: "#/components/schemas/OrderLine" } },
          subtotal: { type: "number" },
          deliveryFee: { type: "number" },
          handling: { type: "number" },
          total: { type: "number" },
          paymentMethod: { type: "string" },
          address: { type: "string" },
          etaMinutes: { type: "integer" },
          placedAt: { type: "integer", description: "Unix ms." },
          status: {
            type: "string",
            enum: ["placed", "accepted", "preparing", "out_for_delivery", "delivered", "cancelled"],
          },
          payment: {
            type: "object",
            nullable: true,
            description:
              "Present only when placeOrder started a real Razorpay payment (gateway configured). Absent today.",
            properties: {
              required: { type: "boolean", enum: [true] },
              razorpayOrderId: { type: "string" },
              amount: { type: "integer", description: "Paise (Razorpay's own unit)." },
              currency: { type: "string" },
              keyId: { type: "string" },
            },
          },
        },
      },
      ShopProfile: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          tagline: { type: "string" },
          emoji: { type: "string" },
          area: { type: "string" },
          isOpen: { type: "boolean" },
          deliveryFee: { type: "number", description: "INR, decimal." },
          freeAbove: { type: "number", description: "INR, decimal." },
          etaMinutes: { type: "integer" },
          businessType: { type: "string", nullable: true },
          badgeTier: { type: "string" },
          verificationStatus: {
            type: "string",
            enum: ["incomplete", "pending_review", "approved", "suspended"],
          },
        },
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          shopId: { type: "string" },
          name: { type: "string" },
          emoji: { type: "string" },
          price: { type: "number", description: "INR, decimal." },
          mrp: { type: "number", nullable: true },
          unit: { type: "string" },
          category: { type: "string" },
          inStock: { type: "boolean" },
        },
      },
      ProductInput: {
        type: "object",
        required: ["name", "emoji", "price", "unit", "category", "inStock"],
        properties: {
          name: { type: "string" },
          emoji: { type: "string" },
          price: { type: "number", minimum: 0 },
          mrp: { type: "number", minimum: 0 },
          unit: { type: "string" },
          category: { type: "string" },
          inStock: { type: "boolean" },
        },
      },
      SellerOrderStatus: {
        type: "string",
        enum: [
          "new",
          "accepted",
          "preparing",
          "ready",
          "out_for_delivery",
          "delivered",
          "rejected",
        ],
      },
      SellerOrderLine: {
        type: "object",
        properties: {
          name: { type: "string" },
          emoji: { type: "string" },
          price: { type: "number" },
          unit: { type: "string" },
          quantity: { type: "integer" },
        },
      },
      SellerOrder: {
        type: "object",
        properties: {
          id: { type: "string" },
          customerName: { type: "string" },
          address: { type: "string" },
          phone: { type: "string" },
          lines: { type: "array", items: { $ref: "#/components/schemas/SellerOrderLine" } },
          total: { type: "number" },
          paymentMethod: { type: "string" },
          placedAt: { type: "integer" },
          status: { $ref: "#/components/schemas/SellerOrderStatus" },
          partnerId: { type: "string", nullable: true },
        },
      },
      AvailablePartner: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          vehicle: { type: "string" },
          phone: { type: "string" },
          rating: { type: "number" },
          available: { type: "boolean" },
        },
      },
      RiderProfile: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          phone: { type: "string" },
          vehicle: { type: "string" },
          area: { type: "string" },
          rating: { type: "number" },
          online: { type: "boolean" },
          joinedAt: { type: "string" },
        },
      },
      JobStatus: {
        type: "string",
        enum: ["new", "accepted", "picked_up", "delivered", "declined"],
      },
      DeliveryJob: {
        type: "object",
        properties: {
          id: { type: "string", description: "This is the assignment id, not the order id." },
          orderId: { type: "string" },
          shopName: { type: "string" },
          shopEmoji: { type: "string" },
          shopAddress: { type: "string" },
          customerName: { type: "string" },
          customerAddress: { type: "string" },
          customerPhone: { type: "string" },
          itemCount: { type: "integer" },
          orderValue: { type: "number", description: "INR, decimal." },
          paymentMethod: { type: "string", enum: ["UPI", "COD"] },
          distanceKm: { type: "number" },
          payout: {
            type: "number",
            description: "INR, decimal. Placeholder formula: ₹25 + ₹8/km.",
          },
          tip: {
            type: "number",
            nullable: true,
            description: "Always absent today — no tipping UI at checkout.",
          },
          assignedAt: { type: "integer" },
          completedAt: { type: "integer", nullable: true },
          status: { $ref: "#/components/schemas/JobStatus" },
        },
      },
      AdminShopReview: {
        type: "object",
        properties: {
          shopId: { type: "string" },
          name: { type: "string" },
          businessType: { type: "string", nullable: true },
          createdAt: { type: "integer" },
          overallStatus: { type: "string" },
          riskLevel: { type: "string", enum: ["low", "medium", "high"] },
          flags: { type: "array", items: { type: "string" } },
        },
      },
      AdminShop: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          ownerName: { type: "string" },
          ownerPhone: { type: "string" },
          businessType: { type: "string", nullable: true },
          overallStatus: { type: "string" },
          isOpen: { type: "boolean" },
          city: { type: "string" },
          createdAt: { type: "integer" },
        },
      },
      AdminPartner: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          phone: { type: "string" },
          vehicle: { type: "string" },
          status: { type: "string" },
          online: { type: "boolean" },
          ratingAvg: { type: "number" },
          createdAt: { type: "integer" },
        },
      },
      AdminOrder: {
        type: "object",
        properties: {
          id: { type: "string" },
          shopName: { type: "string" },
          customerName: { type: "string" },
          status: { type: "string" },
          totalAmount: { type: "number", description: "Rupees (converted from paise)." },
          placedAt: { type: "integer" },
        },
      },
      AdminStats: {
        type: "object",
        properties: {
          shopsByStatus: { type: "object", additionalProperties: { type: "integer" } },
          partnersByStatus: { type: "object", additionalProperties: { type: "integer" } },
          ordersByStatus: { type: "object", additionalProperties: { type: "integer" } },
          revenueToday: {
            type: "number",
            description:
              "Rupees. Sum of total_amount for orders not in created/payment_failed/cancelled/shop_rejected — confirmed gross order value, not net-of-refunds revenue.",
          },
          revenueWeek: { type: "number" },
          verificationApprovalRate: { type: "number", nullable: true },
        },
      },
      Address: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string", nullable: true },
          line1: { type: "string" },
          line2: { type: "string", nullable: true },
          city: { type: "string" },
          pincode: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          isDefault: { type: "boolean" },
        },
      },
      AddressInput: {
        type: "object",
        required: ["line1", "city", "pincode", "lat", "lng"],
        properties: {
          label: { type: "string", maxLength: 40 },
          line1: { type: "string" },
          line2: { type: "string", maxLength: 200 },
          city: { type: "string" },
          pincode: { type: "string", minLength: 4, maxLength: 10 },
          lat: { type: "number" },
          lng: { type: "number" },
        },
      },
      Profile: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string" },
          fullName: { type: "string", nullable: true },
        },
      },
      WishlistProduct: {
        type: "object",
        properties: {
          wishlistId: { type: "string" },
          productId: { type: "string" },
          name: { type: "string" },
          emoji: { type: "string", nullable: true },
          priceAmount: { type: "integer", description: "Paise." },
          mrpAmount: { type: "integer", nullable: true, description: "Paise." },
          unit: { type: "string", nullable: true },
          inStock: { type: "boolean" },
          shopId: { type: "string" },
          shopName: { type: "string" },
        },
      },
      Coupon: {
        type: "object",
        properties: {
          id: { type: "string" },
          code: { type: "string" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          discountType: { type: "string", enum: ["percent", "flat"] },
          discountValue: {
            type: "integer",
            description:
              "Whole rupees (NOT paise — unlike every order/product amount field, see decisions.md 2026-07-19).",
          },
          minOrderAmount: { type: "integer", description: "Whole rupees." },
          expiresAt: { type: "string", nullable: true, format: "date-time" },
        },
      },
      AppNotification: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            description: "e.g. 'order_status', 'verification_status', 'account_status'.",
          },
          title: { type: "string" },
          body: { type: "string", nullable: true },
          readAt: { type: "string", nullable: true, format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ReviewableOrder: {
        type: "object",
        properties: {
          shopId: { type: "string" },
          shopName: { type: "string" },
          partnerId: { type: "string", nullable: true },
        },
      },
      MyReview: {
        type: "object",
        properties: {
          shopRating: { type: "integer" },
          partnerRating: { type: "integer", nullable: true },
          comment: { type: "string", nullable: true },
        },
      },
      ShopReview: {
        type: "object",
        properties: {
          id: { type: "string" },
          rating: { type: "integer" },
          comment: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ShopHourEntry: {
        type: "object",
        required: ["dayOfWeek", "openTime", "closeTime"],
        properties: {
          dayOfWeek: {
            type: "integer",
            minimum: 0,
            maximum: 6,
            description: "0 = Sunday ... 6 = Saturday (JS Date#getDay()).",
          },
          openTime: { type: "string", pattern: "^\\d{2}:\\d{2}$", example: "09:00" },
          closeTime: { type: "string", pattern: "^\\d{2}:\\d{2}$", example: "21:00" },
        },
      },
      OrderTracking: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["placed", "ready", "picked_up", "in_transit", "delivered"],
          },
          rider: {
            type: "object",
            nullable: true,
            properties: {
              lat: { type: "number" },
              lng: { type: "number" },
              recordedAt: { type: "integer", description: "Unix ms of the last GPS push." },
            },
          },
        },
      },
      VerificationForm: {
        type: "object",
        properties: {
          businessName: { type: "string" },
          ownerName: { type: "string" },
          address: { type: "string" },
          businessType: { type: "string" },
        },
      },
      FileAnalysis: {
        type: "object",
        properties: {
          docId: { type: "string" },
          category: { type: "string", enum: ["document", "photo"] },
          docType: { type: "string" },
          fileName: { type: "string" },
          filePath: { type: "string" },
          sha256: { type: "string" },
          sizeBytes: { type: "integer" },
          mimeType: { type: "string" },
          confidence: { type: "number", description: "0..1" },
          decision: { type: "string", enum: ["VERIFIED", "UNDER_REVIEW", "REJECTED"] },
          qualityScore: { type: "number" },
          authenticityScore: { type: "number" },
          matchScore: { type: "number" },
          duplicate: { type: "boolean" },
          ocrText: { type: "string" },
          extractedFields: { type: "object", additionalProperties: true },
          matchDetails: { type: "object", additionalProperties: { type: "number" } },
          issues: { type: "array", items: { type: "string" } },
          createdAt: { type: "integer" },
          registryCheck: {
            type: "object",
            nullable: true,
            description:
              "Real government-registry cross-check (GSTN/FoSCoS via Deepvue) for gst/fssai/pan documents — present only when DEEPVUE_CLIENT_ID/DEEPVUE_CLIENT_SECRET are configured (absent today) and a plausible registry number was OCR'd from the file. See src/lib/doc-verify/backend.server.ts.",
            properties: {
              verified: { type: "boolean" },
              status: { type: "string", nullable: true },
              registryName: { type: "string", nullable: true },
              nameMatchScore: {
                type: "number",
                nullable: true,
                description: "0..1 similarity to the registration form's business name.",
              },
            },
          },
        },
      },
      SubmissionView: {
        type: "object",
        properties: {
          merchantRef: { type: "string" },
          documents: { type: "array", items: { $ref: "#/components/schemas/FileAnalysis" } },
          overall: {
            type: "object",
            nullable: true,
            properties: {
              decision: { type: "string", enum: ["VERIFIED", "UNDER_REVIEW", "REJECTED"] },
              confidence: { type: "number" },
              documentCount: { type: "integer" },
              updatedAt: { type: "integer", nullable: true },
            },
          },
        },
      },
    },
  },
};
