-- Real radius-bounded, indexed nearby-shop queries (see
-- plan/tasks/decisions.md). getNearbyShops/checkServiceability previously
-- fetched *every* active shop (no radius filter, no pagination) and did
-- distance math in JS afterward — harmless at a handful of manually-created
-- shops, but PostgREST's default 1000-row cap silently truncated the
-- result once the OSM import grew the catalog into the thousands, and
-- checkServiceability could already be returning the wrong "nearest shop"
-- if the true nearest fell outside whichever ~1000 (arbitrarily ordered)
-- rows came back. Both now use the real GiST index already on
-- shops.location (0001_initial_schema.sql's shops_location_gix) via
-- PostGIS ST_DWithin (radius filter) and the <-> KNN operator (nearest-
-- first ordering) instead.
--
-- `returns setof public.shops` (not a custom type) so PostgREST's function-
-- embedding support lets callers still request `?select=*,categories(slug),...`
-- on top of the RPC call, exactly like a normal table query — no need to
-- duplicate the existing SHOP_SELECT/mapShopRow logic.

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
  where s.status = 'active'
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
  where s.status = 'active'
  order by s.location <-> st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
  limit 1;
$$;

grant execute on function public.nearby_shops(double precision, double precision, int, int)
  to anon, authenticated, service_role;
grant execute on function public.nearest_shop_distance_m(double precision, double precision)
  to anon, authenticated, service_role;
