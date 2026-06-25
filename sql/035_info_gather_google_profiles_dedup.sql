-- 035: Deduplicated source view for info_gather_google_profiles (Outscraper ingest).
-- One row per place_id = the most recently scraped record.
-- Replaces ad-hoc DISTINCT in pipelines/ingest_restr_ai_leaderboard.py.
--
-- Run in Supabase SQL Editor. Idempotent (CREATE OR REPLACE).

create or replace view public.info_gather_google_profiles_dedup
with (security_invoker = true) as
  select distinct on (place_id) *
  from public.info_gather_google_profiles
  where place_id is not null
  order by place_id, updated_at desc nulls last, scraped_at desc nulls last, id desc;

grant select on public.info_gather_google_profiles_dedup to anon, authenticated, service_role;

comment on view public.info_gather_google_profiles_dedup is
  'Deduplicated source view: one row per place_id, latest scrape first. Used by pipelines/ingest_restr_ai_leaderboard.py.';
