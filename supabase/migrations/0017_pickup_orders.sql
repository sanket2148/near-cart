-- Self-pickup order support — customer collects in person at the shop
-- instead of a delivery partner delivering it. Built additively on existing
-- columns rather than new enum values:
--   - 'ready_for_pickup' already means "ready for whoever collects it next"
--     (a delivery partner, or now the customer) — no new status for "ready".
--   - Pickup orders skip 'partner_assigned'/'picked_up'/'out_for_delivery'
--     entirely; advanceOrder (seller-data/backend.server.ts) goes straight
--     from 'ready_for_pickup' to the existing terminal 'delivered' — the
--     client swaps the *display label* to "Picked up", no new DB value.
--   - pickup_otp already existed (generated in placeOrder, never surfaced
--     anywhere) — repurposed as the shop→customer handoff code for pickup
--     orders. Mutually exclusive with its original shop→partner meaning:
--     an order is always exactly one of delivery or pickup.

alter table public.orders
  add column if not exists fulfillment_type text not null default 'delivery'
    check (fulfillment_type in ('delivery', 'pickup'));

-- Pickup orders never collect a delivery address (see placeOrder). Every
-- existing row already has a real address_id, so relaxing this to nullable
-- is safe for current data — the check constraint below re-imposes the
-- requirement for delivery orders specifically.
alter table public.orders
  alter column address_id drop not null;

alter table public.orders
  add constraint orders_address_required_for_delivery
  check (fulfillment_type = 'pickup' or address_id is not null);
