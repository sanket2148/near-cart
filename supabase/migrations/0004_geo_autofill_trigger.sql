-- Auto-derive the `location geography(Point,4326)` column from `lat`/`lng` on
-- every insert/update, on every table that has both. Without this, every
-- future INSERT (the seed script, and every later server function that
-- creates a shop/address/etc.) would need to hand-construct a PostGIS value
-- itself and risk it drifting out of sync with lat/lng — auto-deriving it
-- server-side removes that whole class of bug.

create or replace function public.set_location_from_latlng()
returns trigger
language plpgsql
as $$
begin
  new.location := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  return new;
end;
$$;

drop trigger if exists shops_set_location on public.shops;
create trigger shops_set_location
  before insert or update of lat, lng on public.shops
  for each row execute function public.set_location_from_latlng();

drop trigger if exists addresses_set_location on public.addresses;
create trigger addresses_set_location
  before insert or update of lat, lng on public.addresses
  for each row execute function public.set_location_from_latlng();

drop trigger if exists gps_verifications_set_location on public.gps_verifications;
create trigger gps_verifications_set_location
  before insert or update of lat, lng on public.gps_verifications
  for each row execute function public.set_location_from_latlng();

drop trigger if exists partner_locations_set_location on public.partner_locations;
create trigger partner_locations_set_location
  before insert or update of lat, lng on public.partner_locations
  for each row execute function public.set_location_from_latlng();
