-- Unclaimed shop listings imported from OpenStreetMap (see
-- plan/tasks/decisions.md 2026-07-22 "OSM shop import + claim flow"). Lets a
-- shop row exist with no real owner yet — the cold-start fix for a
-- marketplace that today only shows shops that have already gone through
-- full merchant onboarding. `location` needs no attention here: it's already
-- trigger-maintained from lat/lng (0004_geo_autofill_trigger.sql).

alter table public.shops
  alter column owner_id drop not null,
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'osm')),
  add column if not exists external_id text,
  add column if not exists claimed boolean not null default true,
  add column if not exists claimed_at timestamptz;

-- Every existing row already has owner_id set, and source/claimed default to
-- 'manual'/true, so this is satisfied for all current data with no backfill.
alter table public.shops
  add constraint shops_claimed_owner_consistency
  check ((claimed and owner_id is not null) or (not claimed and owner_id is null));

-- Prevents importing the same OSM node twice. Partial (not a plain unique
-- column) since external_id is meaningless/absent for manually-created
-- shops — Postgres already treats multiple NULLs as non-conflicting, but
-- scoping to source='osm' keeps the index's intent explicit either way.
create unique index if not exists shops_external_id_osm_uq
  on public.shops (external_id) where source = 'osm';
