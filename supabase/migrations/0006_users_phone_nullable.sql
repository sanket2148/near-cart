-- Fixes a real bug found while switching to email-based auth for testing
-- (Twilio requires a paid account to actually deliver OTP SMS to India;
-- Supabase's built-in email provider needs nothing extra). The
-- handle_new_auth_user() trigger (0001_initial_schema.sql) inserted
-- coalesce(new.phone, '') for phone-less signups — but phone was
-- `unique not null`, so the FIRST email-only user got phone = '' fine, and
-- every subsequent email-only user collided on that same empty string and
-- failed the whole auth.users insert (the trigger runs in the same
-- transaction). This surfaced as an opaque "Database error creating new
-- user" / 500 from the Admin API with no clear cause.
--
-- Fix: make phone nullable and stop coalescing to '' — a real NULL is
-- correctly excluded from the UNIQUE constraint by Postgres (unlike '',
-- which is a real, collidable value), so any number of phone-less users
-- can now coexist.

alter table public.users alter column phone drop not null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, phone, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Clean up the one orphaned row this bug already produced.
update public.users set phone = null where phone = '';
