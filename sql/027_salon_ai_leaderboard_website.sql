-- Add website field to leaderboard rows.
-- Run in Supabase SQL Editor after sql/024_salon_ai_leaderboard_instagram_columns.sql.

alter table public.salon_ai_leaderboard
  add column if not exists website text not null default '';

comment on column public.salon_ai_leaderboard.website is
  'Official website URL for the salon/spa (best-effort from Maps/API/crawler).';

-- Refresh latest view so it exposes the new website column as well.
create or replace view public.salon_ai_leaderboard_latest
with (security_invoker = true) as
select distinct on (slug) *
from public.salon_ai_leaderboard
where is_listed = true
order by slug, updated_at desc nulls last, created_at desc, id desc;

grant select on public.salon_ai_leaderboard_latest to anon, authenticated, service_role;
