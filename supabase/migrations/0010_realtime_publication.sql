-- Unblocks real Supabase Realtime (postgres_changes) for order/tracking
-- updates. Without this, a postgres_changes subscription authenticates and
-- opens successfully but silently receives zero events for these tables,
-- because they were never added to the `supabase_realtime` publication —
-- confirmed via a live subscribe-and-trigger test, 2026-07-19. See
-- plan/tasks/decisions.md and src/routes/api.live.order.$orderId.ts.
--
-- Run once via Supabase Dashboard -> SQL Editor -> paste this file -> Run
-- (same manual convention as every prior migration in this folder; there is
-- no `supabase db push`/CLI tooling wired into this project).

alter publication supabase_realtime add table public.orders, public.order_events, public.partner_locations;

-- Verify afterward with:
--   select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime';
-- Expect orders / order_events / partner_locations to now appear in the list
-- (alongside anything already there from other tables, if any).
