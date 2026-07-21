-- NearCart — initial schema (Phase A of the backend build-out).
-- Mirrors plan/03-database-schema.md, with two changes decided 2026-07-12
-- (see plan/tasks/decisions.md):
--   1. Auth is Supabase Auth's phone OTP, not a custom service — so `users.id`
--      IS `auth.users.id` (not an independently generated UUID), and there is
--      no `otp_codes` table (Supabase owns OTP state).
--   2. The `events` table already exists in this project (used today by
--      src/lib/verification/backend.server.ts) — this migration does not
--      touch it, to avoid disturbing whatever RLS/columns it already has.
--
-- Run once via Supabase Dashboard → SQL Editor → paste this file → Run.
-- Table/type creation is idempotent (safe to re-run); policies are not
-- (re-running after a successful run will error on duplicate policy names —
-- that's fine, it means it already applied).

create extension if not exists pgcrypto;
create extension if not exists postgis;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Identity & roles
-- ═══════════════════════════════════════════════════════════════════════════

-- Profile data Supabase's own auth.users doesn't hold. id is copied from
-- auth.users.id (see the trigger at the bottom of this file), not generated.
create table if not exists public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  phone        text unique not null,
  full_name    text,
  email        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

do $$ begin
  create type public.app_role as enum ('customer','shop_owner','delivery_partner','admin');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.users(id) on delete cascade,
  role      public.app_role not null,
  unique (user_id, role)
);

do $$ begin
  create type public.kyc_status as enum ('pending','submitted','verified','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.kyc_doc_type as enum (
    'gst','fssai','pan','aadhaar','license','vehicle_rc','shop_id',
    'drug_license','trade_license','udyam','shop_establishment','pharmacist_reg'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.kyc_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  doc_type    public.kyc_doc_type not null,
  file_path   text not null,
  status      public.kyc_status not null default 'submitted',
  reviewed_by uuid references public.users(id),
  notes       text,
  created_at  timestamptz not null default now()
);

do $$ begin
  create type public.business_type as enum (
    'restaurant','pharmacy','grocery','retail','salon','electronics','bakery','home_business'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.badge_tier as enum ('none','basic','verified','premium','trusted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_level_status as enum
    ('not_started','in_progress','submitted','verified','rejected');
exception when duplicate_object then null; end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Addresses
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  label       text,
  line1       text not null,
  line2       text,
  city        text not null,
  pincode     text not null,
  lat         numeric(9,6) not null,
  lng         numeric(9,6) not null,
  location    geography(Point,4326) not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Catalog
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.categories (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  slug  text unique not null,
  icon  text
);

do $$ begin
  create type public.shop_status as enum ('pending','active','suspended','removed');
exception when duplicate_object then null; end $$;

create table if not exists public.shops (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.users(id) on delete restrict,
  name              text not null,
  category_id       uuid references public.categories(id),
  description       text,
  logo_path         text,
  phone             text,
  address_line      text not null,
  city              text not null,
  pincode           text not null,
  lat               numeric(9,6) not null,
  lng               numeric(9,6) not null,
  location          geography(Point,4326) not null,
  delivery_radius_m int not null default 5000,
  status            public.shop_status not null default 'pending',
  is_open           boolean not null default false,
  rating_avg        numeric(2,1) not null default 0,
  rating_count      int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists shops_location_gix on public.shops using gist (location);
create index if not exists shops_owner_idx on public.shops(owner_id);

create table if not exists public.shop_hours (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  open_time   time not null,
  close_time  time not null
);

create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  category_id   uuid references public.categories(id),
  name          text not null,
  description   text,
  image_path    text,
  price_amount  int not null,
  mrp_amount    int,
  unit          text,
  in_stock      boolean not null default true,
  stock_qty     int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists products_shop_idx on public.products(shop_id);
create index if not exists products_search_idx
  on public.products using gin (to_tsvector('simple', name || ' ' || coalesce(description, '')));

-- Shop verification tables (depend on shops; the shipped pipeline currently
-- writes to the generic `events` table instead — migrating it onto these is
-- tracked separately in backlog.md).
create table if not exists public.shop_verifications (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null unique references public.shops(id) on delete cascade,
  business_type   public.business_type,
  current_badge   public.badge_tier not null default 'none',
  l1_phone        public.verification_level_status not null default 'not_started',
  l1_email        public.verification_level_status not null default 'not_started',
  l2_documents    public.verification_level_status not null default 'not_started',
  l3_kyc          public.verification_level_status not null default 'not_started',
  l4_bank         public.verification_level_status not null default 'not_started',
  l5_gps          public.verification_level_status not null default 'not_started',
  l6_ai           public.verification_level_status not null default 'not_started',
  l7_review       public.verification_level_status not null default 'not_started',
  overall_status  text not null default 'incomplete',
  flagged         boolean not null default false,
  flag_reasons    text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.bank_verifications (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops(id) on delete cascade,
  account_number    text not null,
  ifsc              text not null,
  holder_name       text not null,
  penny_drop_status text not null default 'pending',
  verified_at       timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists public.gps_verifications (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  lat         numeric(9,6) not null,
  lng         numeric(9,6) not null,
  location    geography(Point,4326) not null,
  captured_at timestamptz not null default now()
);

create table if not exists public.shop_photos (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  photo_type  text not null,
  file_path   text not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.fraud_flags (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops(id) on delete cascade,
  rule_name  text not null,
  severity   text not null default 'medium',
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Delivery partners
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.partner_status as enum ('pending','active','suspended','removed');
exception when duplicate_object then null; end $$;

create table if not exists public.delivery_partners (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.users(id) on delete cascade,
  vehicle_type    text,
  status          public.partner_status not null default 'pending',
  is_online       boolean not null default false,
  rating_avg      numeric(2,1) not null default 0,
  rating_count    int not null default 0,
  preferred_zones jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists public.partner_locations (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.delivery_partners(id) on delete cascade,
  lat         numeric(9,6) not null,
  lng         numeric(9,6) not null,
  location    geography(Point,4326) not null,
  recorded_at timestamptz not null default now()
);
create index if not exists partner_loc_partner_idx on public.partner_locations(partner_id, recorded_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Orders
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.order_status as enum (
    'created','payment_failed','paid','cod_confirmed',
    'shop_accepted','shop_rejected','preparing','ready_for_pickup',
    'partner_assigned','picked_up','out_for_delivery',
    'delivered','cancelled','refunded','closed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('upi','card','netbanking','cod');
exception when duplicate_object then null; end $$;

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.users(id) on delete restrict,
  shop_id         uuid not null references public.shops(id) on delete restrict,
  address_id      uuid not null references public.addresses(id),
  status          public.order_status not null default 'created',
  payment_method  public.payment_method not null,
  items_amount    int not null,
  delivery_amount int not null default 0,
  discount_amount int not null default 0,
  total_amount    int not null,
  promo_code      text,
  scheduled_for   timestamptz,
  pickup_otp      text,
  delivery_otp    text,
  idempotency_key text unique,
  placed_at       timestamptz not null default now(),
  delivered_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders(customer_id, created_at desc);
create index if not exists orders_shop_idx on public.orders(shop_id, created_at desc);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid not null references public.products(id),
  name_snapshot text not null,
  price_amount  int not null,
  quantity      int not null check (quantity > 0)
);

create table if not exists public.order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  actor_id    uuid references public.users(id),
  from_status public.order_status,
  to_status   public.order_status not null,
  note        text,
  created_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Assignments
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.assignment_status as enum ('offered','accepted','declined','expired','completed');
exception when duplicate_object then null; end $$;

create table if not exists public.assignments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  partner_id      uuid not null references public.delivery_partners(id),
  status          public.assignment_status not null default 'offered',
  offered_at      timestamptz not null default now(),
  responded_at    timestamptz,
  earnings_amount int,
  unique (order_id, partner_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Payments, refunds, payouts, wallet
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.payment_status as enum ('created','authorized','captured','failed','refunded');
exception when duplicate_object then null; end $$;

create table if not exists public.payments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  method            public.payment_method not null,
  amount            int not null,
  status            public.payment_status not null default 'created',
  gateway_ref       text,
  gateway_signature text,
  idempotency_key   text unique,
  created_at        timestamptz not null default now()
);

create table if not exists public.refunds (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references public.payments(id) on delete cascade,
  amount      int not null,
  reason      text,
  gateway_ref text,
  created_at  timestamptz not null default now()
);

do $$ begin
  create type public.payout_status as enum ('pending','processing','paid','failed');
exception when duplicate_object then null; end $$;

create table if not exists public.payouts (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid references public.shops(id),
  partner_id   uuid references public.delivery_partners(id),
  amount       int not null,
  period_start date,
  period_end   date,
  status       public.payout_status not null default 'pending',
  created_at   timestamptz not null default now(),
  check (shop_id is not null or partner_id is not null)
);

create table if not exists public.wallet_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  order_id    uuid references public.orders(id),
  amount      int not null,
  balance     int not null,
  reason      text not null,
  created_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Reviews & notifications  (analytics `events` already exists — see header)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.reviews (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null unique references public.orders(id) on delete cascade,
  customer_id    uuid not null references public.users(id),
  shop_id        uuid not null references public.shops(id),
  partner_id     uuid references public.delivery_partners(id),
  shop_rating    int check (shop_rating between 1 and 5),
  partner_rating int check (partner_rating between 1 and 5),
  comment        text,
  created_at     timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  data       jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. auth.users → public.users sync (Supabase Auth owns identity/OTP)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, phone)
  values (new.id, coalesce(new.phone, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. Role-check helper (used throughout RLS policies below)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. GRANTs + RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- users
alter table public.users enable row level security;
grant select, insert, update on public.users to authenticated;
grant all on public.users to service_role;
create policy "users_select_own" on public.users for select using (id = auth.uid());
create policy "users_insert_own" on public.users for insert with check (id = auth.uid());
create policy "users_update_own" on public.users for update using (id = auth.uid());

-- user_roles
alter table public.user_roles enable row level security;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
create policy "user_roles_select_own" on public.user_roles for select using (user_id = auth.uid());
create policy "user_roles_admin_all" on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- kyc_documents
alter table public.kyc_documents enable row level security;
grant select, insert on public.kyc_documents to authenticated;
grant all on public.kyc_documents to service_role;
create policy "kyc_documents_select_own" on public.kyc_documents for select using (user_id = auth.uid());
create policy "kyc_documents_insert_own" on public.kyc_documents for insert with check (user_id = auth.uid());
create policy "kyc_documents_admin_all" on public.kyc_documents for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- addresses
alter table public.addresses enable row level security;
grant select, insert, update, delete on public.addresses to authenticated;
grant all on public.addresses to service_role;
create policy "addresses_owner_all" on public.addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notifications
alter table public.notifications enable row level security;
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
create policy "notifications_owner_select" on public.notifications for select using (user_id = auth.uid());
create policy "notifications_owner_update" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- wallet_ledger (read-only for owners; writes are service-role/server-function only)
alter table public.wallet_ledger enable row level security;
grant select on public.wallet_ledger to authenticated;
grant all on public.wallet_ledger to service_role;
create policy "wallet_ledger_owner_select" on public.wallet_ledger for select using (user_id = auth.uid());

-- categories (public read; admin write)
alter table public.categories enable row level security;
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
create policy "categories_public_read" on public.categories for select using (true);
create policy "categories_admin_write" on public.categories for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- shops (guest browse: anyone can read active shops; owner full on own; admin full)
alter table public.shops enable row level security;
grant select on public.shops to anon, authenticated;
grant insert, update, delete on public.shops to authenticated;
grant all on public.shops to service_role;
create policy "shops_read" on public.shops for select
  using (status = 'active' or owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "shops_owner_insert" on public.shops for insert with check (owner_id = auth.uid());
create policy "shops_owner_update" on public.shops for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "shops_admin_all" on public.shops for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- shop_hours (public read; owner writes own shop's hours)
alter table public.shop_hours enable row level security;
grant select on public.shop_hours to anon, authenticated;
grant insert, update, delete on public.shop_hours to authenticated;
grant all on public.shop_hours to service_role;
create policy "shop_hours_public_read" on public.shop_hours for select using (true);
create policy "shop_hours_owner_write" on public.shop_hours for all
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

-- products (guest browse of active shops' products; owner writes own)
alter table public.products enable row level security;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
create policy "products_read" on public.products for select
  using (
    exists (select 1 from public.shops s where s.id = shop_id and (s.status = 'active' or s.owner_id = auth.uid()))
    or public.has_role(auth.uid(), 'admin')
  );
create policy "products_owner_write" on public.products for all
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));

-- shop verification tables: owner (via shops join) + admin only, no public read
do $$
declare t text;
begin
  foreach t in array array['shop_verifications','bank_verifications','gps_verifications','shop_photos','fraud_flags']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format(
      'create policy "%1$s_owner_all" on public.%1$s for all using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())) with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()))',
      t
    );
    execute format(
      'create policy "%1$s_admin_all" on public.%1$s for all using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))',
      t
    );
  end loop;
end $$;

-- delivery_partners
alter table public.delivery_partners enable row level security;
grant select, insert, update on public.delivery_partners to authenticated;
grant all on public.delivery_partners to service_role;
create policy "delivery_partners_owner_all" on public.delivery_partners for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delivery_partners_admin_all" on public.delivery_partners for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- partner_locations (partner writes own; customer reads their active-order partner's
-- location only via a server function using the service-role key, not direct RLS)
alter table public.partner_locations enable row level security;
grant select, insert on public.partner_locations to authenticated;
grant all on public.partner_locations to service_role;
create policy "partner_locations_owner_all" on public.partner_locations for all
  using (exists (select 1 from public.delivery_partners dp where dp.id = partner_id and dp.user_id = auth.uid()))
  with check (exists (select 1 from public.delivery_partners dp where dp.id = partner_id and dp.user_id = auth.uid()));
create policy "partner_locations_admin_all" on public.partner_locations for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- orders — read-only for authenticated; status changes go through server
-- functions using the service-role key, never direct client writes.
alter table public.orders enable row level security;
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
create policy "orders_customer_read" on public.orders for select using (customer_id = auth.uid());
create policy "orders_shop_read" on public.orders for select
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));
create policy "orders_partner_read" on public.orders for select
  using (exists (
    select 1 from public.assignments a join public.delivery_partners dp on dp.id = a.partner_id
    where a.order_id = orders.id and dp.user_id = auth.uid()
  ));
create policy "orders_admin_all" on public.orders for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- order_items / order_events — same visibility as their parent order
alter table public.order_items enable row level security;
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
create policy "order_items_visible_via_order" on public.order_items for select
  using (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.customer_id = auth.uid()
      or exists (select 1 from public.shops s where s.id = o.shop_id and s.owner_id = auth.uid())
      or exists (
        select 1 from public.assignments a join public.delivery_partners dp on dp.id = a.partner_id
        where a.order_id = o.id and dp.user_id = auth.uid()
      )
      or public.has_role(auth.uid(), 'admin')
    )
  ));

alter table public.order_events enable row level security;
grant select on public.order_events to authenticated;
grant all on public.order_events to service_role;
create policy "order_events_visible_via_order" on public.order_events for select
  using (exists (
    select 1 from public.orders o where o.id = order_id and (
      o.customer_id = auth.uid()
      or exists (select 1 from public.shops s where s.id = o.shop_id and s.owner_id = auth.uid())
      or exists (
        select 1 from public.assignments a join public.delivery_partners dp on dp.id = a.partner_id
        where a.order_id = o.id and dp.user_id = auth.uid()
      )
      or public.has_role(auth.uid(), 'admin')
    )
  ));

-- assignments (partner reads/responds to own offers; shop reads its order's assignments)
alter table public.assignments enable row level security;
grant select, update on public.assignments to authenticated;
grant all on public.assignments to service_role;
create policy "assignments_partner_all" on public.assignments for all
  using (exists (select 1 from public.delivery_partners dp where dp.id = partner_id and dp.user_id = auth.uid()))
  with check (exists (select 1 from public.delivery_partners dp where dp.id = partner_id and dp.user_id = auth.uid()));
create policy "assignments_shop_read" on public.assignments for select
  using (exists (
    select 1 from public.orders o join public.shops s on s.id = o.shop_id
    where o.id = order_id and s.owner_id = auth.uid()
  ));
create policy "assignments_admin_all" on public.assignments for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- payments / refunds / payouts — no client writes anywhere; owners read their own
alter table public.payments enable row level security;
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
create policy "payments_owner_read" on public.payments for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
create policy "payments_admin_all" on public.payments for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

alter table public.refunds enable row level security;
grant select on public.refunds to authenticated;
grant all on public.refunds to service_role;
create policy "refunds_owner_read" on public.refunds for select
  using (exists (
    select 1 from public.payments p join public.orders o on o.id = p.order_id
    where p.id = payment_id and o.customer_id = auth.uid()
  ));
create policy "refunds_admin_all" on public.refunds for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

alter table public.payouts enable row level security;
grant select on public.payouts to authenticated;
grant all on public.payouts to service_role;
create policy "payouts_shop_owner_read" on public.payouts for select
  using (shop_id is not null and exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()));
create policy "payouts_partner_read" on public.payouts for select
  using (partner_id is not null and exists (select 1 from public.delivery_partners dp where dp.id = partner_id and dp.user_id = auth.uid()));
create policy "payouts_admin_all" on public.payouts for all
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- reviews — public read (shoppers browse ratings before ordering, guest included);
-- customer writes their own
alter table public.reviews enable row level security;
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;
grant all on public.reviews to service_role;
create policy "reviews_public_read" on public.reviews for select using (true);
create policy "reviews_customer_insert" on public.reviews for insert with check (customer_id = auth.uid());
