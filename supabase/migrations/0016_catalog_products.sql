-- Canonical product catalog, linked to (not replacing) the existing
-- per-shop `products` table. See plan/tasks/decisions.md for the reasoning:
-- a full products -> shop_products rename was considered and rejected for
-- now, because order_items.product_id and wishlist.product_id both
-- reference products(id) directly, and 0005's place_order_mobile RPC joins
-- on it too — renaming/re-keying that table would touch every one of those
-- in the same migration for no immediate benefit. This is the lower-risk
-- version: `products` keeps its id and stays the per-shop listing (price,
-- stock, unit stay there, since those are genuinely shop-specific), and a
-- new nullable catalog_product_id links rows that are provably the same
-- real-world item (same barcode) to one shared canonical record.
--
-- Only barcode-identified products can be linked — fuzzy name matching
-- across shops is deliberately not attempted here (too easy to merge two
-- different products that happen to share a name).

create table if not exists public.catalog_products (
  id           uuid primary key default gen_random_uuid(),
  barcode      text not null unique,
  name         text not null,
  description  text,
  image_path   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.products
  add column if not exists catalog_product_id uuid references public.catalog_products(id);

create index if not exists products_catalog_product_idx
  on public.products(catalog_product_id);

-- Backfill: one catalog_products row per distinct existing barcode, picking
-- the earliest-created row sharing that barcode as the representative
-- record (arbitrary but deterministic — this is a starting point, not a
-- claim that row necessarily has the "best" name/image).
insert into public.catalog_products (barcode, name, description, image_path)
select distinct on (p.barcode)
  p.barcode, p.name, p.description, p.image_path
from public.products p
where p.barcode is not null
order by p.barcode, p.created_at asc
on conflict (barcode) do nothing;

update public.products p
set catalog_product_id = cp.id
from public.catalog_products cp
where p.barcode is not null
  and p.barcode = cp.barcode
  and p.catalog_product_id is null;
