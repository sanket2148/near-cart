-- Real name+proximity shop-match candidates (see plan/tasks/decisions.md,
-- 2026-07-24). createShop's hardcoded lat/lng was just fixed — every new
-- merchant-created shop now carries a real GPS-pinned location, which makes
-- proximity-based duplicate detection viable for the first time. Combines
-- pg_trgm fuzzy name similarity with the existing PostGIS location index
-- (shops_location_gix, 0001_initial_schema.sql) so CreateShopStep.tsx can
-- surface "this might already be listed" with much better precision/recall
-- than the old plain `ilike '%name%'` substring match (searchUnclaimedShops,
-- still used unchanged by ClaimShopStep.tsx's own manual search).

create extension if not exists pg_trgm;

-- Needed for similarity() to use an index instead of a full table scan once
-- the catalog is large (~5,700 OSM-imported shops today).
create index if not exists shops_name_trgm_gix on public.shops using gin (name gin_trgm_ops);

create or replace function public.find_shop_matches(
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 200,
  p_max_rows int default 10,
  p_min_similarity real default 0.2
)
returns table (
  id uuid,
  name text,
  address_line text,
  city text,
  claimed boolean,
  distance_m double precision,
  name_score real
)
language sql
stable
as $$
  select
    s.id,
    s.name,
    s.address_line,
    s.city,
    s.claimed,
    st_distance(
      s.location,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    ) as distance_m,
    similarity(s.name, p_name) as name_score
  from public.shops s
  where s.status = 'active'
    and st_dwithin(
      s.location,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    -- Proximity alone isn't enough — a densely-listed area (market row,
    -- shopping strip) means "within radius" hits unrelated neighboring
    -- shops constantly. A real name-similarity floor keeps the suggestion
    -- list precise; the radius is what makes this stronger than
    -- searchUnclaimedShops' plain substring match, not a replacement for
    -- caring about the name at all.
    and similarity(s.name, p_name) >= p_min_similarity
  order by name_score desc, distance_m asc
  limit p_max_rows;
$$;

grant execute on function public.find_shop_matches(text, double precision, double precision, int, int, real)
  to authenticated, service_role;
