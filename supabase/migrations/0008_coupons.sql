-- Coupons/offers — new table for the "Offers & Coupons" sidebar destination,
-- which had no backing table at all until now (see plan/tasks/decisions.md,
-- 2026-07-18). Publicly readable when active, since browsing offers doesn't
-- require login (same posture as `shops`/`products`). Redemption at checkout
-- is NOT wired up this pass — that needs pricing-engine changes in
-- orders/backend.server.ts, tracked separately in backlog.md. This is
-- display-only: a customer can see and copy a code, applying it at checkout
-- is a follow-up.

create table if not exists public.coupons (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  title              text not null,
  description        text,
  discount_type      text not null check (discount_type in ('percent','flat')),
  discount_value     int not null check (discount_value > 0),
  min_order_amount   int not null default 0,
  active             boolean not null default true,
  expires_at         timestamptz,
  created_at         timestamptz not null default now()
);

alter table public.coupons enable row level security;

grant select on public.coupons to anon, authenticated;
grant all on public.coupons to service_role;

create policy "coupons_public_read_active" on public.coupons for select
  using (active = true and (expires_at is null or expires_at > now()));
