-- Barcode-driven product onboarding (see plan/tasks/decisions.md,
-- 2026-07-25). Sellers previously typed every product field by hand
-- (seller.products.tsx's ProductDialog) — a scanned barcode can now
-- pre-fill name/unit/category via a real lookup (Open Food Facts,
-- barcode/backend.server.ts) instead.
--
-- Scoped per-shop, not globally unique: two different shops legitimately
-- sell the same barcoded product (e.g. two kiranas both stocking Maggi).
-- The partial unique index is what turns "scanning a barcode already in
-- THIS shop's own catalog" into a real 23505 conflict addProduct can catch
-- and surface as "you already have this" — same idiom already used for
-- placeOrder's idempotency_key and the OSM shop import's external_id.

alter table public.products add column if not exists barcode text;

create unique index if not exists products_shop_barcode_uidx
  on public.products(shop_id, barcode)
  where barcode is not null;
