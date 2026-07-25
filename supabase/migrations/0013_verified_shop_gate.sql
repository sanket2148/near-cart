-- Real "claimed + verified" gate for customer-facing browse (see
-- plan/tasks/decisions.md). Customers should only ever see a shop once a
-- real merchant owns it (claimed = true) AND it's passed real verification
-- (shop_verifications.overall_status = 'approved') — today that's zero
-- shops, which is the honest state, not a bug to work around.
--
-- Re-defines the two functions from 0012_nearby_shops_postgis.sql with the
-- added filter — same signatures, same GiST-indexed radius/KNN approach,
-- just narrower.

create or replace function public.nearby_shops(
  user_lat double precision,
  user_lng double precision,
  radius_m int default 15000,
  max_rows int default 200
)
returns setof public.shops
language sql
stable
as $$
  select s.*
  from public.shops s
  join public.shop_verifications sv on sv.shop_id = s.id
  where s.status = 'active'
    and s.claimed = true
    and sv.overall_status = 'approved'
    and st_dwithin(
      s.location,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius_m
    )
  order by s.location <-> st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
  limit max_rows;
$$;

create or replace function public.nearest_shop_distance_m(
  user_lat double precision,
  user_lng double precision
)
returns double precision
language sql
stable
as $$
  select st_distance(
    s.location,
    st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
  )
  from public.shops s
  join public.shop_verifications sv on sv.shop_id = s.id
  where s.status = 'active'
    and s.claimed = true
    and sv.overall_status = 'approved'
  order by s.location <-> st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
  limit 1;
$$;

-- Bookkeeping only, not a visibility bypass — see decisions.md. Lets the
-- original 6 seed.mjs demo shops be told apart from real merchant data
-- without deleting them; they're still subject to the same claimed+verified
-- gate above like everything else.
alter table public.shops
  add column if not exists is_demo boolean not null default false;
