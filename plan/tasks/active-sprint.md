# Active Sprint — None (backlog-driven)

**Status:** No sprint is currently in progress. The last one (Backend Build-Out — see `plan/tasks/done/2026-07-17-backend-build-out.md`) closed out every phase of the original plan (A–H) plus payments, a CSRF fix, API documentation, and scaffolded document-registry verification.
**Last updated:** 2026-07-17

---

## Current Context

- **Tech stack:** TanStack Start + React 19, Tailwind v4, shadcn/ui, **real Supabase backend** (Postgres + PostGIS + Auth Admin API + Storage) — no longer localStorage-only. See `plan/02-api-contracts.md` §0 and `plan/03-database-schema.md` §0 for the actual implementation reality, which has diverged in places from the original plan docs below them.
- **State pattern:** React Context wrapping TanStack Query over real `createServerFn` RPCs (`src/lib/{catalog,orders,seller-data,partner-data,admin-data,tracking-data,payments,auth-bridge,verification,doc-verify}/`), not `useState`/localStorage — except the seller verification wizard's deep per-level detail, which is still localStorage (`src/lib/verification.ts`), and the fake rider-position animation used as a demo fallback (`src/lib/tracking.tsx`).
- **API reference:** `/api-docs` (self-hosted Swagger UI) documents every server function and the one real REST route.

## What's Real vs. Scaffolded (read before picking a next sprint)

- **Fully real, verified end-to-end:** catalog, cart/checkout→orders, seller shop/product/order management, delivery-partner registration/dispatch/jobs, admin verification queue (approve/reject only — see below), order-status polling, partner GPS tracking.
- **Real code, inactive until credentials exist:** Razorpay payments (`src/lib/payments/`) and Deepvue GST/FSSAI/PAN registry verification (`src/lib/doc-verify/`) — both fully built and gated behind env vars that don't exist yet in `.env`. Adding the keys activates them with no further code changes.
- **Still localStorage:** the verification wizard's raw per-document detail (KYC files, PAN/Aadhaar numbers, bank details, GPS photos) — only roll-up status fields sync to the real DB. See `plan/tasks/decisions.md`, 2026-07-15.

## Next Sprint Candidates

See `plan/tasks/backlog.md` for the full, current list with `[x]`/`[ ]` status per item. Not re-listed here to avoid a second copy going stale — `backlog.md` is the live source. Notable open threads as of this entry:

- Get real Razorpay/Deepvue credentials and flip the two scaffolded integrations live.
- Full admin dashboard (`/admin/shops`, `/admin/partners`, `/admin/orders`, analytics) — explicitly deferred as new UI construction, not backend wiring.
- Real Supabase Auth sessions in the browser (prerequisite for true `postgres_changes` Realtime, replacing today's polling).
- SMS/email provider setup for real OTP delivery.
- Mobile app (React Native/Expo) — see `plan/tasks/done/2026-07-07-expo-mobile-integration.md` for what already exists; no shared `packages/` yet.

## Rules Reminder (from `README.md`)

When a new sprint starts: rewrite this file with the sprint goal, mark tasks `[/]` as you work them, then `[x]` + move the detail to a new `plan/tasks/done/YYYY-MM-DD-description.md` when it closes. Keep `backlog.md`/`decisions.md` as the ongoing, continuously-updated record — don't wait until a sprint ends to log anything there.
