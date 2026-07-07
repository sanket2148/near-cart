# NearCart — Technical Architecture Document

**Version:** 1.0 · **Status:** Draft for review · **Companion to:** PRD v1.0
**Audience:** Solo builder + AI coding tools (Claude Code, Copilot). Read this first before any prompt session.

---

## 1. Purpose

This document is the single source of truth for *how* NearCart is built. Every AI session should be anchored to it so sessions don't drift into different stacks, naming, or boundaries. If a decision isn't here, decide it, then write it down here.

NearCart is a **three-sided hyperlocal marketplace**: Customers, Shop Owners, Delivery Partners, plus an internal Admin surface.

---

## 2. Architecture at a glance

```text
                ┌──────────────────────────────────────────────┐
                │                  CLIENTS                       │
                │  Customer app   Shop dashboard   Partner app   │
                │  Admin console                                 │
                └───────────────┬──────────────────────────────┘
                                │ HTTPS / WebSocket
                ┌───────────────▼──────────────────────────────┐
                │            APPLICATION LAYER                   │
                │  Auth · Catalog · Order · Dispatch ·           │
                │  Payment · Notification · Analytics            │
                │  (modular services behind one API gateway)     │
                └───────┬───────────────┬──────────────┬────────┘
                        │               │              │
              ┌─────────▼───┐   ┌───────▼─────┐  ┌─────▼───────┐
              │ PostgreSQL  │   │ Redis cache │  │ Search index │
              │ (source of  │   │ + sessions  │  │ (catalog)    │
              │  truth)     │   │ + geo sets  │  │              │
              └─────────────┘   └─────────────┘  └─────────────┘
                        │
              ┌─────────▼──────────────────────────────────────┐
              │  EXTERNAL: Maps · Payments · SMS/Push · Storage  │
              └────────────────────────────────────────────────┘
```

---

## 3. Two-track stack decision

The PRD specifies a full microservices stack (React Native + Node microservices + AWS ECS/RDS + Elasticsearch). That is the **target stack at scale**. As a solo builder you should *not* start there — you'll burn months on infra instead of product. Build the **MVP track** first; the boundaries below are designed so you can extract services later without rewrites.

| Concern | MVP track (build now) | Scale track (PRD target) |
|---|---|---|
| Client | One React/TanStack web app, responsive + installable PWA; one shared codebase per role | React Native iOS/Android per role |
| Backend | Modular monolith — service modules in one deployable | Independent Node microservices |
| API | REST (typed server functions / route handlers) | REST + GraphQL gateway |
| DB | Managed PostgreSQL (Lovable Cloud / Supabase) | PostgreSQL on RDS multi-AZ |
| Cache / sessions | Postgres + lightweight cache; Redis only when needed | Redis cluster |
| Search | Postgres full-text + trigram + PostGIS | Elasticsearch |
| Realtime tracking | Postgres realtime / WebSocket channel | Dedicated WS service / Firebase |
| Maps | Google Maps Platform (Places, Directions, Distance Matrix) | same |
| Payments | Razorpay (India-first; UPI/COD native) | Razorpay / Juspay |
| Notifications | FCM (push) + SMS provider (OTP) | FCM + Twilio |
| Auth | Phone OTP + JWT sessions, role claims | same + KYC service |

> **Rule for AI sessions:** Generate code for the **MVP track** unless a prompt explicitly says "scale track". Keep service *modules* separated by the boundaries in §5 even inside the monolith.

---

## 4. Core principles

1. **One Postgres is the source of truth.** Caches and search indexes are derived and disposable.
2. **Money and order state never live only in the client.** Order status transitions and payment state are server-authoritative.
3. **Roles are claims, not tables flags.** A user's role(s) come from a dedicated role table; never trust a client-sent role.
4. **Every order is an append-only event log.** State changes write to `order_events`; current status is a denormalized convenience column.
5. **Idempotency everywhere money moves.** Payment webhooks and order placement use idempotency keys.
6. **Geo is first-class.** Shop discovery, dispatch, and ETA all run off lat/lng + radius. Store coordinates on every shop, partner, and delivery address.

---

## 5. Service boundaries (module map)

Each is a module in the MVP monolith and a future microservice. Owns its own tables; other modules read through its functions, not its tables directly.

| Service | Responsibility | Owns (core tables) |
|---|---|---|
| **Auth** | OTP login, JWT/session, role assignment, KYC status flags | `users`, `user_roles`, `kyc_documents`, `otp_codes` |
| **Catalog** | Shops, products, categories, availability, search indexing | `shops`, `shop_hours`, `categories`, `products` |
| **Order** | Cart→order lifecycle state machine, ratings | `orders`, `order_items`, `order_events`, `reviews` |
| **Dispatch** | Partner availability, assignment (proximity + rating + load), live location | `delivery_partners`, `partner_locations`, `assignments` |
| **Payment** | Payment intent, webhook reconciliation, refunds, payouts/settlements | `payments`, `refunds`, `payouts`, `wallet_ledger` |
| **Notification** | Push/SMS/in-app fan-out | `notifications` (+ external FCM/SMS) |
| **Analytics** | Event capture + rollups for dashboards | `events`, materialized rollups |

---

## 6. Order lifecycle state machine

Single canonical state machine. The Order service is the only writer.

```text
CREATED → PAID/COD_CONFIRMED → SHOP_ACCEPTED → PREPARING
   → READY_FOR_PICKUP → PARTNER_ASSIGNED → PICKED_UP
   → OUT_FOR_DELIVERY → DELIVERED → CLOSED

Side states: SHOP_REJECTED, CANCELLED, PAYMENT_FAILED, REFUNDED
```

Rules:
- Shop must accept/reject within **5 minutes** (PRD §8.2) → timeout auto-routes to `SHOP_REJECTED` + refund.
- Handoffs (shop→partner, partner→customer) confirmed via **OTP** stored on the order.
- Every transition appends to `order_events` with actor, from_status, to_status, timestamp.

---

## 7. Dispatch algorithm (MVP)

Score each available partner within radius of the shop and assign the top one:

```text
score = w1 * proximity(partner, shop)      // closest first
      + w2 * partner_rating                 // quality
      - w3 * active_assignment_count        // load balancing
```

MVP: simple weighted score, recompute on a short interval, offer to top partner with accept window; fall back to next. Scale track: extract into Dispatch microservice with surge logic.

---

## 8. Realtime & geo

- **Live tracking:** partner app pushes location every N seconds → server → realtime channel the customer subscribes to for their active order only.
- **Discovery:** "shops within X km" via PostGIS `ST_DWithin` (MVP) — fast enough for launch volumes.
- **ETA / distance:** Google Distance Matrix for customer-facing ETAs; cache aggressively.

---

## 9. Security & compliance (build-time)

- Phone OTP auth; JWT with short expiry + refresh; role claims server-verified on every request.
- **Roles in a dedicated table** with a security-definer `has_role()` check; never store role on the user/profile row.
- Row-level security on all user-owned data: customers see only their orders; shops see only their orders/catalog; partners see only assigned orders.
- Payments via gateway-hosted flows — **never store card data** (PCI scope minimized). Store only gateway references.
- PII (phone, address, KYC docs) encrypted at rest; TLS in transit. KYC docs in private storage with signed, expiring URLs.
- Idempotency keys on order placement + payment webhooks; verify webhook signatures before trusting any payload.

---

## 10. Environments & config

| | Dev | Staging | Prod |
|---|---|---|---|
| DB | isolated | seeded copy | live, backed up |
| Payments | gateway test mode | test mode | live keys |
| Maps/SMS | test/limited keys | test | live |

Secrets (gateway keys, SMS, FCM) live in server-side env only — never in client bundles. Publishable/anon keys may ship to clients.

---

## 11. What NOT to build yet (guardrails for AI sessions)

Out of scope for MVP (PRD §6.2): POS integration, B2B/wholesale, loyalty/subscriptions, white-label, GraphQL, Elasticsearch, microservice extraction, multi-region. If a prompt drifts here, stop and confirm.

---

## 12. Open technical questions (track here)

1. Own fleet vs pure-gig vs hybrid dispatch (affects Dispatch + payout model).
2. Payment gateway final pick (Razorpay vs Juspay vs PhonePe).
3. KYC verification path (manual queue vs DigiLocker/Aadhaar API).
4. Single vertical at launch (grocery only) vs multi-category from day one.
