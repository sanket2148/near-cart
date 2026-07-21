-- Phase B (catalog) — the 0001 schema modeled shops/products at a normalized,
-- textbook level but is missing fields the actual shipped UI needs to render
-- shop cards, shop detail pages, and product cards without changing their
-- JSX. Rather than fake this data or restructure the UI, add the real columns:
--
--   shops.tagline / emoji / delivery_fee_amount / free_delivery_above_amount / eta_minutes
--     — these already exist as configurable fields on the seller dashboard's
--       ShopProfile (src/lib/seller.tsx) but were missing from the DB schema.
--   products.emoji
--     — matches the emoji-as-icon convention used everywhere else in this app
--       (categories, shops, badges).
--   products.menu_section
--     — the mock data's `product.category` field (e.g. "Staples", "Dairy",
--       "Baked") is a per-shop menu grouping label, NOT the same concept as
--       the shop's business category (grocery/pharmacy/etc. — categories.id).
--       Naming it menu_section avoids conflating the two.

alter table public.shops
  add column if not exists tagline text,
  add column if not exists emoji text,
  add column if not exists delivery_fee_amount int not null default 3000,
  add column if not exists free_delivery_above_amount int not null default 39900,
  add column if not exists eta_minutes int not null default 30;

alter table public.products
  add column if not exists emoji text,
  add column if not exists menu_section text;
