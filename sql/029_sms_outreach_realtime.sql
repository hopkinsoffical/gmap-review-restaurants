-- Enable Postgres changes for SMS funnel tables (same pattern as sql/013_salon_ai_leaderboard.sql).
-- After running: Supabase Studio → Database → Replication may also show these tables; either path is fine.
--
-- Important: Realtime subscriptions use the same JWT as your client (usually anon). RLS SELECT still applies.
-- sql/027 only grants service_role policies on these tables — anon/authenticated have NO select policy by default,
-- so a browser client with anon key will NOT receive postgres_changes events even after this publication.
-- Options: (a) poll Table Editor / SQL, (b) add a narrow SELECT policy for trusted roles only,
-- (c) listen from a server using service_role (not typical in browser).

do $$
begin
  alter publication supabase_realtime add table public.sms_outreach_event;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.sms_outreach_session;
exception
  when duplicate_object then null;
end $$;
