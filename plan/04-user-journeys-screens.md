# NearCart — User Journey Maps + Screen List

**Version:** 1.0 · Companion to PRD v1.0, Architecture, Schema & API Contracts.

> A simple map of every screen and what it does, plus the flow each screen sits in. When you tell an AI tool "build the checkout screen," it needs to know what comes before and after it. This is that context.

---

## 1. The four surfaces

| Surface | Who | Platform (MVP) |
|---|---|---|
| Customer app | Priya — busy professional | Responsive web / PWA |
| Shop dashboard | Ramesh — kirana owner | Web (mobile-friendly) |
| Partner app | Ajay — delivery partner | Web / PWA (mobile-first) |
| Admin console | Internal ops | Web (desktop) |

---

## 1a. Account creation model — one per user type, not one-size-fits-all

There are three distinct actors and each earns an account differently. This mirrors how Zomato/Blinkit/Swiggy actually split it (see `plan/tasks/decisions.md` for sourcing): the **consumer-facing** surface avoids friction, the **workforce-facing** surfaces (shop owner, delivery partner) gate immediately because there's no browsing value without an account.

| User type | When they're asked to log in | Why | First screen after OTP |
|---|---|---|---|
| **Customer** (Priya) | Deferred — only at checkout (C8/C9). Full guest browse + cart before that. | Removes signup friction from the moment with the least trust (first open); by checkout they've already found what they want. | Straight into Checkout (C10) with cart + address carried over. |
| **Shop owner** (Ramesh) | Immediate — first thing on `/sell` → "Get started" (S1). | No such thing as a "guest shop dashboard" — every screen past login is their own business data. | Shop registration (S2) → the verification wizard you already built (Phases 1–8). |
| **Delivery partner** (Ajay) | Immediate — first thing on `/partner` (P1). | Same reasoning as shop owner: partner app is 100% account-scoped (assignments, earnings, KYC). | Partner registration (P2) → KYC upload (P3). |

**Current implementation gap (as of 2026-07-10):** none of the three actually have this today. `/seller`, `/sell`, `/partner`, and `/admin/verification` have zero route guards — no `beforeLoad` check, no redirect, nothing (confirmed by reading `seller.tsx`, `partner.tsx`, `sell.tsx`, `admin.verification.tsx`). Anyone can open `/seller/onboarding` directly with no account at all. The seller-verification wizard (Phases 1–8, already built) currently assumes a shop already exists in `SellerContext` — it has no "create shop" step in front of it. Closing this gap requires the `/auth/otp/*` backend from `backlog.md` → **Auth System**, which is entirely unbuilt. That's the real prerequisite before any of the three flows below can be more than a UI mockup.

---

## 2. Customer journey map

```text
LOCATE → DISCOVER → BROWSE → CART → AUTH (at checkout) → CHECKOUT → PAY → TRACK → RECEIVE → RATE → REORDER
```

> **Decision (2026-07-10):** Login is deferred to checkout, not required to browse. See `plan/tasks/decisions.md` for the competitor research (Zomato/Blinkit/Zepto all let you browse and build a cart as a guest; phone+OTP is asked for only when you're about to pay, and OTP verify doubles as silent signup on first use). The cart is built client-side (already how `src/lib/cart.tsx` works) and merged into the account the moment OTP verification succeeds.

| Stage | What Priya does | Feeling | Key screens |
|---|---|---|---|
| Locate | Grants location or types an area/pincode | "Do they even deliver here?" | Location gate |
| Discover | Sees nearby open shops — no login needed | "What's close & open?" | Home/Discovery |
| Browse | Picks shop, searches products | "Do they have what I need?" | Shop detail, Product list, Search |
| Cart | Adds items, reviews — still no login | "Is the total fair?" | Cart |
| Auth | Enters phone + OTP only when checking out | "Fine, one code and I'm in." | Phone/OTP (inline at checkout) |
| Checkout | Address, schedule, promo | "How fast & how much?" | Checkout |
| Pay | UPI / card / COD | "Did it go through?" | Payment |
| Track | Watches partner on map | "Where's my order?" | Order tracking |
| Receive | OTP handoff at door | "Got it." | Delivery confirm |
| Rate | Scores shop + partner | "Was it good?" | Rating |
| Reorder | One-tap repeat | "Same again." | Order history |

### Customer screen list

| # | Screen | Purpose | Primary API | Auth required? |
|---|---|---|---|---|
| C1 | Splash / location permission | Soft-ask copy, then native GPS prompt | — | No |
| C1b | Manual address / pincode search | Fallback if GPS denied; also lets users change area later | `GET /serviceability?pincode=` | No |
| C1c | Not serviceable / waitlist | Shown when no shop's delivery radius covers the location | `POST /waitlist` | No |
| C2 | **Home / Discovery** | Nearby shops, category filter, search bar | `GET /shops/nearby` | No |
| C3 | Global product search | Cross-shop search within radius | `GET /search/products` | No |
| C4 | Shop detail | Hours, rating, categories, open status | `GET /shops/{id}` | No |
| C5 | Product list / browse | Items in shop, add to cart | `GET /shops/{id}/products` | No |
| C6 | Product detail | Image, price, unit, qty selector | `GET /shops/{id}/products` | No |
| C7 | **Cart** | Line items, qty edit, subtotal (client-side until login) | client + `POST /orders/quote` | No |
| C8 | Phone login (OTP request) | Triggered by tapping "Checkout"; inline/modal, not a full-page redirect | `POST /auth/otp/request` | — |
| C9 | OTP verify | Enter code. First-ever success = silent signup; existing phone = login. Then merges guest cart into the account. | `POST /auth/otp/verify`, `POST /cart/merge` | — |
| C10 | **Checkout** | Address pick (prefilled from C1/C1b), schedule now/later, promo | `POST /orders/quote` | Yes |
| C11 | Payment | Method select, gateway flow, COD | `POST /orders`, `POST /payments/{id}/verify` | Yes |
| C12 | Order placed / confirmation | Success + summary | `GET /orders/{id}` | Yes |
| C13 | **Order tracking** | Live map, partner, ETA, status timeline | `GET /orders/{id}/track` + channel | Yes |
| C14 | Delivery OTP / confirm | Show delivery OTP to partner | `GET /orders/{id}` | Yes |
| C15 | Rate order | Shop + partner stars, comment | `POST /orders/{id}/review` | Yes |
| C16 | Order history | Past orders, invoice download | `GET /orders?status=past` | Yes |
| C17 | Reorder | One-tap repeat past order | `POST /orders` | Yes |
| C18 | Addresses | Manage saved addresses | `/addresses` CRUD | Yes |
| C19 | Profile / settings | Name (optional, asked once post-order), language, payment methods | `/auth/me` | Yes |
| C20 | Coupons / referrals (P1) | Enter/share codes | promo endpoints | Yes |
| C21 | Support chat (P2) | Order-specific help | chat | Yes |

Shop owner (S-) and delivery partner (P-) flows are **not** guest-first — both require immediate phone+OTP login before anything else (S1/P1 unchanged below). There's no "browsing value" for a workforce app: you can't manage a shop or accept deliveries without an account, so gating upfront doesn't cost conversion the way it does for a shopper.

---

## 3. Shop owner journey map

```text
REGISTER → KYC → BUILD CATALOG → GO LIVE → RECEIVE ORDER → FULFILL → HANDOFF → GET PAID
```

| Stage | What Ramesh does | Key screens |
|---|---|---|
| Register | Sign up, shop basics | S1–S3 |
| KYC | Upload GST/FSSAI/ID, await verify | S4 |
| Catalog | Add products (or CSV), set prices/stock | S6 |
| Go live | Set hours, toggle open | S7, S8 |
| Receive | Get order alert, accept within 5 min | S8, S9 |
| Fulfill | Prepare, mark ready | S9 |
| Handoff | Confirm pickup OTP with partner | S9 |
| Get paid | View earnings, payouts | S10 |

### Shop owner screen list

| # | Screen | Purpose | Primary API |
|---|---|---|---|
| S1 | Login (OTP) | Auth | `/auth/otp/*` |
| S2 | Role apply / shop register | Create shop | `POST /auth/roles`, `PATCH /shop` |
| S3 | Shop profile setup | Name, category, location, radius | `PATCH /shop` |
| S4 | KYC upload | GST/FSSAI/ID docs + status | `POST /kyc/documents` |
| S5 | KYC pending state | Awaiting verification screen | `GET /kyc/documents` |
| S6 | **Catalog management** | Add/edit/delete, stock toggle, CSV | `/shop/products` (+ `/bulk`) |
| S7 | Shop hours / availability | Hours + holiday + open toggle | `/shop/hours`, `/shop/open` |
| S8 | **Order dashboard** | Live incoming orders, accept/reject | `GET /orders`, `/shop/orders/{id}/accept|reject` |
| S9 | Order detail / fulfill | Items, mark ready, pickup OTP | `/shop/orders/{id}/ready|handoff` |
| S10 | Earnings & payouts | Summary, settlement history, bank | `/shop/earnings`, `/shop/payouts`, `/shop/bank` |
| S11 | Promotions (P1) | Discounts, flash sales, free-delivery min | `/shop/promotions` |
| S12 | Analytics (P1) | Top products, peak hours, retention | `/shop/analytics` |

---

## 4. Delivery partner journey map

```text
REGISTER → KYC → GO ONLINE → GET DISPATCH → PICKUP → DELIVER → EARN
```

| Stage | What Ajay does | Key screens |
|---|---|---|
| Register | Sign up, vehicle info | P1–P2 |
| KYC | License, Aadhaar, RC upload | P3 |
| Go online | Toggle availability, set zones | P4 |
| Dispatch | Receive offer, accept | P5 |
| Pickup | Navigate to shop, confirm OTP | P6 |
| Deliver | Navigate to customer, confirm OTP | P7 |
| Earn | See trip + daily earnings | P8 |

### Partner screen list

| # | Screen | Purpose | Primary API |
|---|---|---|---|
| P1 | Login (OTP) | Auth | `/auth/otp/*` |
| P2 | Partner register | Vehicle type, basics | `POST /auth/roles` |
| P3 | KYC upload | License, Aadhaar, RC + status | `POST /kyc/documents` |
| P4 | **Home / availability** | Online toggle, preferred zones, today's earnings | `/partner/online`, `/partner/earnings` |
| P5 | Dispatch offer | Incoming order card, accept/decline + timer | `/partner/assignments/{id}/accept|decline` |
| P6 | Pickup navigation | Map to shop, confirm pickup OTP | `/partner/orders/{id}/pickup` |
| P7 | Delivery navigation | Map to customer, confirm delivery OTP | `/partner/orders/{id}/deliver` |
| P8 | Earnings tracker | Per-trip, daily/weekly, incentives | `/partner/earnings` |
| P9 | SOS / safety (P1) | Emergency button, share location | `/partner/sos` |
| P10 | In-app chat (P1) | Customer last-mile instructions | chat |

---

## 5. Admin console screen list

| # | Screen | Purpose | Primary API |
|---|---|---|---|
| A1 | Login | Admin auth | `/auth/*` |
| A2 | Dashboard | City GMV, orders, AOV at a glance | `/admin/analytics` |
| A3 | Shop management + KYC queue | Approve/suspend/remove, review docs | `/admin/shops/*` |
| A4 | Partner management | Approve/suspend, incentive plans | `/admin/partners/*` |
| A5 | Order ops | Override status, resolve disputes | `/admin/orders/*` |
| A6 | Finance & settlements | Reconciliation, payout approval, GST | `/admin/finance/*`, `/admin/payouts/*` |
| A7 | Promotions engine | Platform coupons & banners | `/admin/promotions` |
| A8 | Analytics & BI | Funnels, cohorts, city breakdowns | `/admin/analytics` |

---

## 6. Cross-surface handoff points (where flows connect)

These are the moments two surfaces meet — get them right or orders stall:

1. **Order placed** → Shop dashboard (S8) lights up. Customer waits on C14.
2. **Shop accepts** → Dispatch fires → Partner offer (P5).
3. **Shop ready + partner at shop** → Pickup OTP: shop (S9) ↔ partner (P6).
4. **Partner at door** → Delivery OTP: customer (C15) ↔ partner (P7).
5. **Delivered** → Customer rating (C16), partner earnings (P8), shop earnings (S10).

```text
Customer C14 ─placed→ Shop S8 ─accept→ Dispatch → Partner P5
        │                                            │
        │            pickup OTP (S9↔P6) ←────────────┘
        │                                            │
        └──── delivery OTP (C15↔P7) ←────────────────┘
                         │
                 DELIVERED → ratings + earnings
```

---

## 7. MVP build order (suggested)

1. Auth + roles (all surfaces share this).
2. Customer C1–C14 + Shop S1–S9 + the order flow (the core loop).
3. Partner P1–P8 (closes the delivery loop).
4. Admin A1–A6 (ops can run the platform).
5. P1 features: ratings, promotions, analytics, earnings polish.
6. P2: support chat, advanced analytics.

> Build the **core loop end to end for one city, one vertical** before widening. A working order from C5 → delivery is worth more than ten half-built screens.
