# NearCart — Database Schema Design

**Version:** 1.0 · PostgreSQL (with PostGIS) · Companion to PRD v1.0 & Technical Architecture.

> Get this right early — migrations are painful later, and AI tools generate far better code when the schema is explicit. This is the canonical schema. All field names below are authoritative; do not invent alternatives.

---

## 0. Implementation reality (added 2026-07-17)

This schema was applied for real across four migrations, live in the Supabase project — `supabase/migrations/0001_initial_schema.sql` through `0004_geo_autofill_trigger.sql`. §3–§5 below are the *original* design; this section notes where the applied reality differs or extends it. Full narrative for each is in `plan/tasks/decisions.md` (search for "Phase A", "Phase B (catalog migration)", "Phase G", "2026-07-15 — Verification pipeline migration").

- **0002_fix_orders_assignments_rls_recursion.sql** — `orders_partner_read` and `assignments_shop_read` RLS policies originally cross-referenced each other as normal (non-bypassing) table queries, which Postgres detects and blocks as a recursive policy cycle. Fixed with `SECURITY DEFINER` helper functions (`is_order_partner()`, `is_order_shop_owner()`), mirroring the existing `has_role()` pattern. This affected real customers/shops/partners, not just anon — found via live-DB testing, not `tsc`/lint.
- **0003_catalog_display_fields.sql** — added `shops.tagline`/`emoji`/`delivery_fee_amount`/`free_delivery_above_amount`/`eta_minutes` and `products.emoji`/`menu_section`. The original §3 tables below don't have these; the real customer-facing catalog UI needed them and they were added rather than dropping UI fidelity to match the doc.
- **0004_geo_autofill_trigger.sql** — `location geography(Point,4326)` (§2's "Geo" convention) was never being populated from `lat`/`lng` by any application code; added a trigger (`set_location_from_latlng()`) so it derives automatically on `shops`/`addresses`/`gps_verifications`/`partner_locations` inserts/updates, instead of requiring every write path to remember to set both.
- **`kyc_documents`, `bank_verifications`, `gps_verifications`, `shop_photos`, `fraud_flags` (§3) are still unused.** The verification wizard's document/photo/bank/GPS *detail* stays in `localStorage` (`src/lib/verification.ts`) and, for uploaded files specifically, in the generic `events` table (`mv.document`/`mv.submission` rows) rather than these purpose-built tables — a known, explicitly-tracked gap, not an oversight. What *does* sync for real: `shop_verifications`' roll-up columns (`business_type`, `current_badge`, `overall_status`, `flagged`, `flag_reasons`, and — as of 2026-07-15 — the 8 per-level status columns `l1_phone`..`l7_review`).
- **`payments`, `refunds`, `partner_locations`, `assignments` are real and in active use** — `payments` backs the scaffolded (not yet live) Razorpay integration; `partner_locations` backs real GPS tracking (partner writes via a service-role server function, not direct RLS-authorized client writes — see below); `assignments` backs real seller→partner dispatch (offer → accept → pickup → deliver).
- **RLS note that matters for anyone building client-side Realtime:** every RLS policy in §5 assumes `auth.uid()` resolves to a real, signed-in Supabase Auth user. It doesn't yet — the app's actual auth session is a custom `localStorage` object (see `plan/02-api-contracts.md` §0), so the browser never carries a real Supabase JWT. This is why every real DB write in this app goes through a service-role server function rather than a direct RLS-authorized client write, even for tables whose RLS policy would otherwise allow it (e.g. `partner_locations_owner_all`) — and why `postgres_changes` Realtime isn't usable from the browser yet either.

---

## 1. ER overview

```text
users ──< user_roles
users ──< kyc_documents
users ──1 delivery_partners ──< partner_locations
users ──< addresses
users(owner) ──< shops ──< products
                  shops ──< shop_hours
products >── categories
users(customer) ──< orders >── shops
orders ──< order_items >── products
orders ──< order_events
orders ──1 assignments >── delivery_partners
orders ──1 payments ──< refunds
orders ──1 reviews
delivery_partners ──< payouts
shops ──< payouts
* ──< notifications
* ──< events   (analytics)
```

---

## 2. Conventions

- PK: `id uuid default gen_random_uuid()`.
- Timestamps: `created_at`, `updated_at timestamptz default now()`.
- Money: integer **paise** (₹1 = 100) to avoid float errors. Field suffix `_amount`.
- Geo: `location geography(Point, 4326)` + separate `lat`/`lng` numeric for convenience.
- Enums via Postgres `enum` types (listed in §4).
- Every table: GRANTs + RLS enabled (see §5).

---

## 3. Tables

### 3.1 Identity & roles

> **2026-07-12 — Auth is Supabase Auth (phone OTP), not custom.** See `plan/tasks/decisions.md`. Supabase's own `auth.users` table holds identity + owns OTP verification/sessions — `otp_codes` below is dropped, it's no longer needed. `public.users.id` is the *same* UUID as `auth.users.id` (not a separate FK), populated by an upsert-on-first-login server function rather than a signup endpoint. This is also why the RLS policies in §5 use `auth.uid()` directly — that only resolves to a real value when Supabase Auth issued the session.

```sql
-- users: profile data Supabase's own auth.users doesn't hold.
-- id is NOT generated here — it's copied from auth.users.id on first login.
create table users (
  id           uuid primary key references auth.users(id) on delete cascade,
  phone        text unique not null,
  full_name    text,
  email        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create type app_role as enum ('customer','shop_owner','delivery_partner','admin');

create table user_roles (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references users(id) on delete cascade,
  role      app_role not null,
  unique (user_id, role)
);

create type kyc_status as enum ('pending','submitted','verified','rejected');
create type kyc_doc_type as enum ('gst','fssai','pan','aadhaar','license','vehicle_rc','shop_id','drug_license','trade_license','udyam','shop_establishment','pharmacist_reg');

create table kyc_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  doc_type    kyc_doc_type not null,
  file_path   text not null,            -- private storage key
  status      kyc_status not null default 'submitted',
  reviewed_by uuid references users(id),
  notes       text,
  created_at  timestamptz default now()
);

-- Business types and verification badges
create type business_type as enum (
  'restaurant', 'pharmacy', 'grocery', 'retail', 'salon', 'electronics', 'bakery', 'home_business'
);

create type badge_tier as enum ('none', 'basic', 'verified', 'premium', 'trusted');
create type verification_level_status as enum ('not_started', 'in_progress', 'submitted', 'verified', 'rejected');

-- NOTE (2026-07-12): the shipped pipeline (src/lib/verification/backend.server.ts)
-- currently writes to a generic `events` table instead of the tables below —
-- see plan/tasks/decisions.md 2026-07-09/07-10. Part of the backend build-out
-- is migrating it onto these tables now that the service-role key actually works.

-- Shop verification tracking
create table shop_verifications (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null unique references shops(id) on delete cascade,
  business_type   business_type,
  current_badge   badge_tier not null default 'none',
  l1_phone        verification_level_status not null default 'not_started',
  l1_email        verification_level_status not null default 'not_started',
  l2_documents    verification_level_status not null default 'not_started',
  l3_kyc          verification_level_status not null default 'not_started',
  l4_bank         verification_level_status not null default 'not_started',
  l5_gps          verification_level_status not null default 'not_started',
  l6_ai           verification_level_status not null default 'not_started',
  l7_review       verification_level_status not null default 'not_started',
  overall_status  text not null default 'incomplete', -- incomplete, pending_review, approved, suspended
  flagged         boolean default false,
  flag_reasons    text[] default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Bank details verification (Penny Drop)
create table bank_verifications (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references shops(id) on delete cascade,
  account_number    text not null,
  ifsc              text not null,
  holder_name       text not null,
  penny_drop_status text not null default 'pending', -- pending, verified, failed
  verified_at       timestamptz,
  created_at        timestamptz default now()
);

-- Physical GPS coordinates and verification photos
create table gps_verifications (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shops(id) on delete cascade,
  lat          numeric(9,6) not null,
  lng          numeric(9,6) not null,
  location     geography(Point,4326) not null,
  captured_at  timestamptz default now()
);

create table shop_photos (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shops(id) on delete cascade,
  photo_type   text not null, -- 'front', 'interior', 'board', 'selfie'
  file_path    text not null,
  uploaded_at  timestamptz default now()
);

-- Fraud detection flags
create table fraud_flags (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shops(id) on delete cascade,
  rule_name    text not null, -- 'duplicate_gst', 'reused_photo', 'gps_mismatch'
  severity     text not null default 'medium',
  resolved     boolean default false,
  created_at   timestamptz default now()
);
```
```

### 3.2 Addresses

```sql
create table addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  label       text,                     -- Home, Work
  line1       text not null,
  line2       text,
  city        text not null,
  pincode     text not null,
  lat         numeric(9,6) not null,
  lng         numeric(9,6) not null,
  location    geography(Point,4326) not null,
  is_default  boolean default false,
  created_at  timestamptz default now()
);
```

### 3.3 Catalog

```sql
create table categories (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  slug      text unique not null,
  icon      text
);

create type shop_status as enum ('pending','active','suspended','removed');

create table shops (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references users(id) on delete restrict,
  name          text not null,
  category_id   uuid references categories(id),
  description   text,
  logo_path     text,
  phone         text,
  address_line  text not null,
  city          text not null,
  pincode       text not null,
  lat           numeric(9,6) not null,
  lng           numeric(9,6) not null,
  location      geography(Point,4326) not null,
  delivery_radius_m int not null default 5000,
  status        shop_status not null default 'pending',
  is_open       boolean default false,   -- live owner toggle
  rating_avg    numeric(2,1) default 0,
  rating_count  int default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index shops_location_gix on shops using gist (location);

create table shop_hours (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  open_time   time not null,
  close_time  time not null
);

create table products (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references shops(id) on delete cascade,
  category_id   uuid references categories(id),
  name          text not null,
  description   text,
  image_path    text,
  price_amount  int not null,            -- paise
  mrp_amount    int,
  unit          text,                    -- kg, pc, 500ml
  in_stock      boolean default true,
  stock_qty     int,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index products_shop_idx on products(shop_id);
create index products_search_idx on products using gin (to_tsvector('simple', name || ' ' || coalesce(description,'')));
```

### 3.4 Delivery partners

```sql
create type partner_status as enum ('pending','active','suspended','removed');

create table delivery_partners (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references users(id) on delete cascade,
  vehicle_type  text,                    -- bike, bicycle
  status        partner_status not null default 'pending',
  is_online     boolean default false,
  rating_avg    numeric(2,1) default 0,
  rating_count  int default 0,
  preferred_zones jsonb,
  created_at    timestamptz default now()
);

create table partner_locations (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references delivery_partners(id) on delete cascade,
  lat         numeric(9,6) not null,
  lng         numeric(9,6) not null,
  location    geography(Point,4326) not null,
  recorded_at timestamptz default now()
);
create index partner_loc_partner_idx on partner_locations(partner_id, recorded_at desc);
```

### 3.5 Orders

```sql
create type order_status as enum (
  'created','payment_failed','paid','cod_confirmed',
  'shop_accepted','shop_rejected','preparing','ready_for_pickup',
  'partner_assigned','picked_up','out_for_delivery',
  'delivered','cancelled','refunded','closed'
);
create type payment_method as enum ('upi','card','netbanking','cod');

create table orders (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references users(id) on delete restrict,
  shop_id           uuid not null references shops(id) on delete restrict,
  address_id        uuid not null references addresses(id),
  status            order_status not null default 'created',
  payment_method    payment_method not null,
  items_amount      int not null,        -- paise, sum of line items
  delivery_amount   int not null default 0,
  discount_amount   int not null default 0,
  total_amount      int not null,
  promo_code        text,
  scheduled_for     timestamptz,         -- null = now
  pickup_otp        text,                -- shop -> partner handoff
  delivery_otp      text,                -- partner -> customer handoff
  idempotency_key   text unique,
  placed_at         timestamptz default now(),
  delivered_at      timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index orders_customer_idx on orders(customer_id, created_at desc);
create index orders_shop_idx on orders(shop_id, created_at desc);

create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  product_id   uuid not null references products(id),
  name_snapshot text not null,           -- frozen at order time
  price_amount int not null,             -- frozen
  quantity     int not null check (quantity > 0)
);

create table order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  actor_id    uuid references users(id),
  from_status order_status,
  to_status   order_status not null,
  note        text,
  created_at  timestamptz default now()
);
```

### 3.6 Assignments

```sql
create type assignment_status as enum ('offered','accepted','declined','expired','completed');

create table assignments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  partner_id    uuid not null references delivery_partners(id),
  status        assignment_status not null default 'offered',
  offered_at    timestamptz default now(),
  responded_at  timestamptz,
  earnings_amount int,                   -- paise credited on completion
  unique (order_id, partner_id)
);
```

### 3.7 Payments, refunds, payouts, wallet

```sql
create type payment_status as enum ('created','authorized','captured','failed','refunded');

create table payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  method          payment_method not null,
  amount          int not null,
  status          payment_status not null default 'created',
  gateway_ref     text,                  -- gateway order/payment id
  gateway_signature text,
  idempotency_key text unique,
  created_at      timestamptz default now()
);

create table refunds (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references payments(id) on delete cascade,
  amount      int not null,
  reason      text,
  gateway_ref text,
  created_at  timestamptz default now()
);

create type payout_status as enum ('pending','processing','paid','failed');

create table payouts (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid references shops(id),
  partner_id  uuid references delivery_partners(id),
  amount      int not null,
  period_start date,
  period_end   date,
  status      payout_status not null default 'pending',
  created_at  timestamptz default now(),
  check (shop_id is not null or partner_id is not null)
);

create table wallet_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  order_id    uuid references orders(id),
  amount      int not null,              -- +credit / -debit
  balance     int not null,
  reason      text not null,
  created_at  timestamptz default now()
);
```

### 3.8 Reviews, notifications, analytics

```sql
create table reviews (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique references orders(id) on delete cascade,
  customer_id   uuid not null references users(id),
  shop_id       uuid not null references shops(id),
  partner_id    uuid references delivery_partners(id),
  shop_rating   int check (shop_rating between 1 and 5),
  partner_rating int check (partner_rating between 1 and 5),
  comment       text,
  created_at    timestamptz default now()
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  data        jsonb,
  read_at     timestamptz,
  created_at  timestamptz default now()
);

create table events (                    -- analytics firehose
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id),
  name        text not null,
  props       jsonb,
  created_at  timestamptz default now()
);
create index events_name_idx on events(name, created_at desc);
```

---

## 4. Enum summary

`app_role`, `kyc_status`, `kyc_doc_type`, `shop_status`, `partner_status`, `order_status`, `payment_method`, `payment_status`, `assignment_status`, `payout_status`.

---

## 5. RLS & GRANTs (required pattern)

Every public-schema table needs GRANTs **and** RLS. Use a security-definer role check:

```sql
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;
```

Access rules:
- `users`, `addresses`, `notifications`, `wallet_ledger`: owner-only (`auth.uid() = user_id`).
- `user_roles`, `kyc_documents`: owner read; admin (`has_role`) full.
- `shops`, `products`, `categories`, `shop_hours`: public read of `active`/`is_open`; owner writes own shop; admin full.
- `orders`, `order_items`, `order_events`: customer reads own; shop reads orders for own shop; assigned partner reads assigned order; admin full. **Status writes go through server functions only.**
- `payments`, `refunds`, `payouts`: no client writes — service-role / server functions only; owners read their own summaries.
- `delivery_partners`, `partner_locations`, `assignments`: partner reads/writes own; customer reads partner location only for their active order (via server function); admin full.

Default grant block per user-facing table:
```sql
grant select, insert, update, delete on public.<table> to authenticated;
grant all on public.<table> to service_role;
-- grant select on public.<table> to anon;  -- ONLY for public catalog reads
```

---

## 6. Denormalization & derived data

- `shops.rating_avg/rating_count`, `delivery_partners.rating_avg/rating_count`: recomputed on new review.
- `orders.status`: convenience mirror of latest `order_events.to_status`.
- `order_items.name_snapshot` / `price_amount`: frozen at order time so catalog edits never rewrite history.

---

## 7. Migration discipline

1. One change per migration, forward-only.
2. Never edit a shipped migration — add a new one.
3. Add table → GRANT → ENABLE RLS → CREATE POLICY, in that order, same migration.
4. Backfill data in its own migration after schema is live.
