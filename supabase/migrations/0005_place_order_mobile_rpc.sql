-- Mobile app support: a real Postgres RPC the mobile client can call
-- directly (it talks straight to Supabase with the anon key + a real
-- supabase.auth session — no TanStack Start server functions exist for it
-- to call, those aren't reachable from React Native).
--
-- Why this has to be a SECURITY DEFINER function, not a direct client
-- INSERT: `grant select on public.orders to authenticated` (see the
-- "orders" GRANTs in 0001_initial_schema.sql) — there is deliberately no
-- INSERT grant for `authenticated` on orders/order_items. Order creation
-- has only ever gone through the service-role key (orders/backend.server.ts's
-- placeOrder). This function is the mobile-safe equivalent: it runs with
-- the function owner's privileges (bypassing the missing INSERT grant),
-- but internally re-prices every item from the real `products` table and
-- uses auth.uid() for customer_id — never a client-supplied value — so it
-- carries the same trust guarantees as the web app's placeOrder, just
-- expressed in SQL instead of TypeScript.

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

grant execute on function public.place_order_mobile(uuid, jsonb, public.payment_method, text, numeric, numeric) to authenticated;
