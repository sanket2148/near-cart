-- Wishlist / saved products — new table for the customer-facing "Wishlist"
-- sidebar destination, which had no backing table at all until now (see
-- plan/tasks/decisions.md, 2026-07-18). Same request-scoped + RLS pattern as
-- `addresses`/`notifications`: no service-role client needed anywhere in
-- src/lib/wishlist/, ownership is enforced by the database itself.

create table if not exists public.wishlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists wishlists_user_idx on public.wishlists(user_id);

alter table public.wishlists enable row level security;

grant select, insert, delete on public.wishlists to authenticated;
grant all on public.wishlists to service_role;

create policy "wishlists_owner_all" on public.wishlists for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
