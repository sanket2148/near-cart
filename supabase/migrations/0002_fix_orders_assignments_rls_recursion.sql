-- Fix: infinite recursion between the `orders` and `assignments` RLS policies.
--
-- Root cause: `orders_partner_read` (on orders) queried `assignments` as a
-- normal table reference, which triggers assignments' own RLS policies —
-- one of which (`assignments_shop_read`) queried `orders` right back as a
-- normal table reference, triggering orders' policies again. Postgres
-- detects this as infinite recursion and refuses to evaluate either policy,
-- which blocks everyone (customers, shop owners, partners) from reading
-- orders/payments/order_items/order_events, not just anon.
--
-- Fix: wrap the two cross-table checks in SECURITY DEFINER functions — the
-- same trick has_role() already uses. A security-definer function runs with
-- its owner's privileges (the migration-running role, which owns these
-- tables), so its *internal* query bypasses RLS entirely instead of
-- re-triggering the other table's policies, breaking the cycle.

create or replace function public.is_order_partner(_order_id uuid, _user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.assignments a
    join public.delivery_partners dp on dp.id = a.partner_id
    where a.order_id = _order_id and dp.user_id = _user_id
  );
$$;

create or replace function public.is_order_shop_owner(_order_id uuid, _user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.orders o
    join public.shops s on s.id = o.shop_id
    where o.id = _order_id and s.owner_id = _user_id
  );
$$;

drop policy if exists "orders_partner_read" on public.orders;
create policy "orders_partner_read" on public.orders for select
  using (public.is_order_partner(id, auth.uid()));

drop policy if exists "assignments_shop_read" on public.assignments;
create policy "assignments_shop_read" on public.assignments for select
  using (public.is_order_shop_owner(order_id, auth.uid()));
