-- Real stock quantity tracking. products.stock_qty has existed since the
-- original schema but nothing has ever written to it — sellers only had a
-- manual in_stock toggle, and real order placement never checked or
-- decremented anything. This is the foundation the rest of the inventory-
-- management work builds on: a race-safe atomic decrement usable by both
-- online orders and (a future) in-app counter-sale recorder, so the two
-- can never oversell the same unit.
--
-- stock_qty stays nullable and keeps meaning "untracked" (matches
-- ProductCard.tsx's existing `stockQty != null` check) — a seller who
-- never enters a quantity keeps today's fully-manual in_stock toggle
-- unchanged. Once a real quantity is entered, in_stock becomes derived
-- from it (0 -> false) rather than an independent manual switch.

create table if not exists public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  shop_id     uuid not null references public.shops(id) on delete cascade,
  delta       int not null,
  reason      text not null check (reason in ('online_order', 'counter_sale', 'manual_adjustment')),
  order_id    uuid references public.orders(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id, created_at desc);
create index if not exists stock_movements_shop_idx on public.stock_movements(shop_id, created_at desc);

-- Real row-level locking (`for update`), not the lighter conditional-update
-- idiom used elsewhere (e.g. setOrderStatus's `.eq("status", fromStatus)`) —
-- that idiom only guards a single-row state transition; this needs a hard
-- "don't oversell" invariant across a multi-row, multi-item sale. Validates
-- every item BEFORE mutating any of them (all-or-nothing), so a rejected
-- item never leaves an earlier item in the same call partially decremented.
--
-- Untracked items (stock_qty is null) are only checked against in_stock,
-- never decremented — tracked items get both the quantity check and the
-- decrement, with in_stock re-derived from the resulting quantity.
--
-- No grant to `authenticated`: this function trusts p_shop_id implicitly
-- (no ownership check of its own), so only server-side callers that have
-- already verified ownership in TypeScript (or another SECURITY DEFINER
-- function, e.g. place_order_mobile) may call it.
create or replace function public.decrement_stock_for_sale(
  p_shop_id uuid,
  p_items jsonb, -- [{"product_id": "uuid", "quantity": 2}, ...]
  p_reason text,
  p_order_id uuid default null
)
returns table (product_id uuid, old_stock_qty int, new_stock_qty int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_count int;
  v_locked_count int;
  rec record;
begin
  if p_reason not in ('online_order', 'counter_sale', 'manual_adjustment') then
    raise exception 'Invalid stock movement reason: %', p_reason;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No items to process';
  end if;

  -- Column names deliberately avoid product_id/old_stock_qty/new_stock_qty —
  -- this function's RETURNS TABLE names become plpgsql variables in scope
  -- for the whole function body, so a temp-table column sharing one of
  -- those names raises a real "column reference is ambiguous" error the
  -- moment it's used in a query (caught live during verification, not a
  -- hypothetical).
  create temporary table tmp_stock_items (
    pid uuid primary key,
    qty int not null,
    old_qty int,
    was_in_stock boolean
  ) on commit drop;

  insert into tmp_stock_items (pid, qty)
  select (elem->>'product_id')::uuid, (elem->>'quantity')::int
  from jsonb_array_elements(p_items) as elem;

  select count(*) into v_item_count from tmp_stock_items;

  -- Lock every referenced row (deterministic id order avoids deadlocking
  -- against another concurrent call touching an overlapping item set) and
  -- capture its pre-mutation state, before validating or mutating anything.
  v_locked_count := 0;
  for rec in
    select p.id, p.stock_qty, p.in_stock
    from public.products p
    join tmp_stock_items t on t.pid = p.id
    where p.shop_id = p_shop_id
    order by p.id
    for update of p
  loop
    update tmp_stock_items
    set old_qty = rec.stock_qty, was_in_stock = rec.in_stock
    where pid = rec.id;
    v_locked_count := v_locked_count + 1;
  end loop;

  if v_locked_count <> v_item_count then
    raise exception 'One or more items do not belong to this shop';
  end if;

  for rec in select * from tmp_stock_items loop
    if not rec.was_in_stock then
      raise exception 'Product % is out of stock', rec.pid;
    end if;
    if rec.old_qty is not null and rec.old_qty < rec.qty then
      raise exception 'Product % only has % left in stock', rec.pid, rec.old_qty;
    end if;
  end loop;

  update public.products p
  set stock_qty = p.stock_qty - t.qty,
      in_stock = (p.stock_qty - t.qty) > 0,
      updated_at = now()
  from tmp_stock_items t
  where p.id = t.pid and t.old_qty is not null;

  insert into public.stock_movements (product_id, shop_id, delta, reason, order_id)
  select t.pid, p_shop_id, -t.qty, p_reason, p_order_id
  from tmp_stock_items t;

  return query
  select
    t.pid,
    t.old_qty,
    case when t.old_qty is null then null else t.old_qty - t.qty end
  from tmp_stock_items t;
end;
$$;

grant execute on function public.decrement_stock_for_sale(uuid, jsonb, text, uuid) to service_role;

-- Re-defines place_order_mobile (0005_place_order_mobile_rpc.sql) to add the
-- same stock enforcement/decrement the web app's placeOrder now has —
-- otherwise the mobile order path stays a silent hole in the exact bug this
-- migration closes. Body is unchanged except for the new `perform` call
-- (right after re-pricing validation, before the orders insert) and this
-- comment — see 0005 for the original's own reasoning. No separate grant
-- needed for decrement_stock_for_sale here: a SECURITY DEFINER function's
-- body runs as its owner, so a nested call inside one uses that same
-- privilege regardless of who invoked the outer function.
create or replace function public.place_order_mobile(
  p_shop_id uuid,
  p_items jsonb, -- [{"product_id": "uuid", "quantity": 2}, ...]
  p_payment_method public.payment_method,
  p_address_text text,
  p_lat numeric,
  p_lng numeric
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id  uuid := auth.uid();
  v_shop         record;
  v_address_id   uuid;
  v_items_amount int;
  v_item_count   int;
  v_valid_count  int;
  v_delivery_amount int;
  v_status       public.order_status;
  v_pickup_otp   text;
  v_delivery_otp text;
  v_order        public.orders;
begin
  if v_customer_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cannot place an empty order';
  end if;

  select id, city, pincode, delivery_fee_amount, free_delivery_above_amount
  into v_shop
  from public.shops
  where id = p_shop_id;

  if not found then
    raise exception 'Shop not found: %', p_shop_id;
  end if;

  select count(*) into v_item_count from jsonb_array_elements(p_items);

  -- Re-price every item server-side from the real products table (never
  -- trust a client-supplied price), and reject anything that doesn't
  -- resolve to a real product belonging to this shop with quantity >= 1.
  select coalesce(sum(p.price_amount * (elem->>'quantity')::int), 0), count(*)
  into v_items_amount, v_valid_count
  from jsonb_array_elements(p_items) as elem
  join public.products p on p.id = (elem->>'product_id')::uuid and p.shop_id = p_shop_id
  where (elem->>'quantity')::int >= 1;

  if v_valid_count <> v_item_count then
    raise exception 'One or more items are invalid or do not belong to this shop';
  end if;

  -- Real, race-safe stock check + decrement (migration 0018) — closes the
  -- same "in_stock/stock_qty never checked" gap the web app's placeOrder
  -- now closes too. Runs before the orders insert; if it raises, this
  -- whole function call's transaction rolls back, so no order or
  -- order_items row is left behind either. order_id is null here (the
  -- order doesn't exist yet at this point) — matches the web path, which
  -- has the same structural reason for not having a real order_id yet.
  perform public.decrement_stock_for_sale(p_shop_id, p_items, 'online_order', null);

  v_delivery_amount := case when v_items_amount >= v_shop.free_delivery_above_amount then 0 else v_shop.delivery_fee_amount end;
  v_status := case when p_payment_method = 'cod' then 'cod_confirmed' else 'paid' end;
  v_pickup_otp := lpad(floor(random() * 9000 + 1000)::text, 4, '0');
  v_delivery_otp := lpad(floor(random() * 9000 + 1000)::text, 4, '0');

  insert into public.addresses (user_id, label, line1, city, pincode, lat, lng)
  values (v_customer_id, 'Delivery', p_address_text, v_shop.city, v_shop.pincode, p_lat, p_lng)
  returning id into v_address_id;

  insert into public.orders (
    customer_id, shop_id, address_id, status, payment_method,
    items_amount, delivery_amount, total_amount, pickup_otp, delivery_otp
  )
  values (
    v_customer_id, p_shop_id, v_address_id, v_status, p_payment_method,
    v_items_amount, v_delivery_amount, v_items_amount + v_delivery_amount + 900, -- +₹9 flat handling, matches HANDLING_AMOUNT in orders/backend.server.ts
    v_pickup_otp, v_delivery_otp
  )
  returning * into v_order;

  insert into public.order_items (order_id, product_id, name_snapshot, price_amount, quantity)
  select v_order.id, p.id, p.name, p.price_amount, (elem->>'quantity')::int
  from jsonb_array_elements(p_items) as elem
  join public.products p on p.id = (elem->>'product_id')::uuid;

  insert into public.order_events (order_id, to_status, note)
  values (v_order.id, v_status, 'Order placed (mobile)');

  return v_order;
end;
$$;
