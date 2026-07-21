# Task: Backend Build-Out (Phases A–H, Payments, CSRF, API Docs, Document Verification)

**Completed:** 2026-07-17
**Sprint:** Backend Build-Out (not originally tracked in `active-sprint.md` — this entry retroactively closes that gap; the authoritative phase-by-phase record lives in `backlog.md`'s "Backend Build-Out" section and `decisions.md`, both updated continuously throughout, not just at the end)

## Summary

Took NearCart from a fully mock/localStorage demo to a real, Supabase-backed application across every domain: catalog, cart/orders, seller ops, delivery-partner ops, admin verification review, live order-status + GPS tracking, and a scaffolded (not-yet-live) payment gateway integration. Also fixed a real CSRF gap, added self-hosted Swagger API documentation, and scaffolded real government-registry document verification (GST/FSSAI/PAN). Every phase followed the same discipline: `tsc --noEmit` → `eslint` → live compile check → live render check (headless browser) → end-to-end verification against the live Supabase project via direct Node scripts → tracker docs updated before moving on.

**This file intentionally does not repeat the full narrative for each phase** — `backlog.md`'s "Backend Build-Out" section has an `[x]` entry per phase with what was built/deferred, and `decisions.md` has a dated entry per phase with the full Context/Decision/Alternatives/Consequence reasoning (including every bug found and fixed along the way: RLS infinite recursion, phone-number normalization, the TanStack Start `**/server/**` import-protection trap, missing OTP generation, a stale-tracking-store bug, and others). This entry is the index into that record, per `README.md`'s "one truth" rule — treat `backlog.md`/`decisions.md` as authoritative for detail, this file as the map.

## Files Created (by phase)

- **Phase A — Foundation:** `supabase/migrations/0001_initial_schema.sql` through `0004_geo_autofill_trigger.sql` (schema, RLS-recursion fix, catalog display fields, PostGIS auto-fill trigger).
- **Phase B — Catalog:** `src/lib/catalog/{backend.server.ts,api.functions.ts}`.
- **Auth bridge (unblocks Phase C):** `src/lib/auth-bridge/{backend.server.ts,api.functions.ts}`.
- **Phase C — Orders:** `src/lib/orders/{backend.server.ts,api.functions.ts}` (replaced the deleted `src/lib/orders.ts`).
- **Phase D — Seller ops:** `src/lib/seller-data/{backend.server.ts,api.functions.ts}`.
- **Phase E — Partner ops:** `src/lib/partner-data/{backend.server.ts,api.functions.ts}`.
- **Phase G — Admin (scoped to the verification queue):** `src/lib/admin-data/{backend.server.ts,api.functions.ts}`.
- **Real partner GPS tracking (Phase H follow-up):** `src/lib/tracking-data/{backend.server.ts,api.functions.ts}`.
- **Phase F — Payments (scaffolded, not live):** `src/lib/payments/{backend.server.ts,api.functions.ts,checkout-widget.ts}`, `src/routes/api.webhooks.razorpay.ts` (the app's first real HTTP server route).
- **API documentation:** `src/lib/api-docs/openapi.ts`, `src/routes/api-docs.tsx`, `src/routes/api-docs.openapi[.]json.ts`.
- **Document registry verification (scaffolded, not live):** `src/lib/doc-verify/backend.server.ts`.

## Files Substantially Rewritten (data-source swap, same Context/hook shape)

- `src/lib/seller.tsx`, `src/lib/partner.tsx` — rewritten to fetch/mutate through the real backend via TanStack Query, while keeping `useSeller()`/`usePartner()`'s exact same shape so no consuming route needed to change.
- `src/lib/auth.tsx` — `verifyOtp` now bridges to a real Supabase Auth user via `auth-bridge`, though the session itself is still a custom localStorage object, not a real `supabase.auth` session (see `decisions.md`, Phase H, for why that matters — it's the reason true `postgres_changes` Realtime isn't possible yet).
- `src/lib/verification.ts` / `src/lib/verification/backend.server.ts` — `FileAnalysis` gained an optional `registryCheck` field; `analyzeFile()` gained a step that cross-checks GST/FSSAI/PAN numbers against the real government registry when configured.
- `src/routes/{cart,checkout,orders,order.$orderId,seller,seller.track.$orderId,partner,partner.track.$orderId,partner.deliveries,admin.verification}.tsx`, `src/components/seller/CreateShopStep.tsx`, `src/components/partner/CreatePartnerProfile.tsx` — rewired from mock/localStorage to the real backend across every phase above.
- `src/start.ts` — added the framework's own `createCsrfMiddleware`, fixing a real gap (server functions were unprotected from cross-site POSTs).

## Notes for Future Agents

- **What's real vs. scaffolded:** Catalog, orders, seller ops, partner ops, admin verification queue, order-status polling, and partner GPS tracking are fully real and verified end-to-end against the live database. Payments (Razorpay) and document registry verification (Deepvue) are real, complete integrations that are **inactive** — gated behind env vars that don't exist yet (`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET`, `DEEPVUE_CLIENT_ID`/`DEEPVUE_CLIENT_SECRET`) — until real accounts are set up, at which point they activate with zero further code changes.
- **No true Realtime yet.** Every "live" surface (order status, partner GPS) uses `refetchInterval` polling, not `postgres_changes` websockets — the browser never holds a real Supabase Auth session (see above), so RLS-gated Realtime would just return zero rows to an anon-key subscriber. Fixing this properly means migrating `auth.tsx` off its custom session onto real `supabase.auth` — not attempted here.
- **Known, explicitly-declined-not-forgotten gaps** (all logged individually in `backlog.md`): full admin dashboard beyond the verification queue; PAN/Aadhaar/bank/GPS/shop-photo raw data staying in `localStorage` rather than the purpose-built DB tables; payment retry UI for a dismissed Razorpay checkout; Aadhaar/Udyam/drug-license/trade-license/shop-establishment document verification (the last four have no third-party API at all, researched and confirmed, not just deprioritized).
- **`plan/02-api-contracts.md` and `plan/03-database-schema.md`** were updated alongside this entry (see their own "§0 implementation reality" sections) to reflect what actually shipped where it diverged from the original plan — read those sections, not just the aspirational endpoint/table tables further down, for what's really there.
