-- Real ratings, computed from real reviews. The `reviews` table has existed
-- since 0001_initial_schema.sql with correct RLS (customer inserts their
-- own, everyone reads) but nothing ever wrote to it — shops.rating_avg and
-- delivery_partners.rating_avg have been static seed values this whole time,
-- not derived from anything real. See plan/tasks/decisions.md, 2026-07-19.
--
-- Recomputing via trigger (not a read-time subquery) keeps every existing
-- read path — getNearbyShops, getShop, getAvailablePartners, etc. — cheap
-- and unchanged; only the review-write path pays the aggregation cost.

create or replace function public.recompute_shop_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_shop_id uuid := coalesce(new.shop_id, old.shop_id);
begin
  update public.shops
  set rating_avg = coalesce(
        (select round(avg(shop_rating)::numeric, 1) from public.reviews
         where shop_id = target_shop_id and shop_rating is not null),
        0),
      rating_count = (
        select count(*) from public.reviews
        where shop_id = target_shop_id and shop_rating is not null)
  where id = target_shop_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_recompute_shop_rating on public.reviews;
create trigger reviews_recompute_shop_rating
after insert or update or delete on public.reviews
for each row execute function public.recompute_shop_rating();

create or replace function public.recompute_partner_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_partner_id uuid := coalesce(new.partner_id, old.partner_id);
begin
  if target_partner_id is null then
    return coalesce(new, old);
  end if;
  update public.delivery_partners
  set rating_avg = coalesce(
        (select round(avg(partner_rating)::numeric, 1) from public.reviews
         where partner_id = target_partner_id and partner_rating is not null),
        0),
      rating_count = (
        select count(*) from public.reviews
        where partner_id = target_partner_id and partner_rating is not null)
  where id = target_partner_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_recompute_partner_rating on public.reviews;
create trigger reviews_recompute_partner_rating
after insert or update or delete on public.reviews
for each row execute function public.recompute_partner_rating();
