-- Allow multiple leaderboard rows per slug (history by updated_at).
-- Reads for anon/authenticated should use latest listed snapshot per slug.
-- Run in Supabase SQL Editor after 020_leaderboard_preview_top_20_rls.sql.

alter table public.salon_ai_leaderboard
  drop constraint if exists salon_ai_leaderboard_slug_key;

create index if not exists salon_ai_leaderboard_slug_updated_at_idx
  on public.salon_ai_leaderboard (slug, updated_at desc);

-- One logical row per slug: newest listed snapshot (for API / PostgREST).
create or replace view public.salon_ai_leaderboard_latest
with (security_invoker = true) as
select distinct on (slug) *
from public.salon_ai_leaderboard
where is_listed = true
order by slug, updated_at desc nulls last, created_at desc, id desc;

grant select on public.salon_ai_leaderboard_latest to anon, authenticated, service_role;

-- Stable set of row ids (bypasses RLS; used inside policies to avoid self-referential RLS recursion).
create or replace function public.leaderboard_latest_listed_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select distinct on (s2.slug) s2.id
  from public.salon_ai_leaderboard s2
  where s2.is_listed = true
  order by s2.slug, s2.updated_at desc nulls last, s2.created_at desc, s2.id desc;
$$;

grant execute on function public.leaderboard_latest_listed_ids() to anon, authenticated, service_role;

-- Top-N slugs by score using only the latest listed row per salon.
create or replace function public.leaderboard_top_slugs(p_limit integer default 20)
returns setof text
language sql
security definer
set search_path = public
stable
as $$
  select x.slug::text
  from (
    select distinct on (s.slug)
      s.slug,
      s.ai_score
    from public.salon_ai_leaderboard s
    where s.is_listed = true
    order by s.slug, s.updated_at desc nulls last, s.created_at desc, s.id desc
  ) x
  order by x.ai_score desc nulls last, x.slug asc
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

grant execute on function public.leaderboard_top_slugs(integer) to anon, authenticated, service_role;

-- Anon: top preview slugs only. Authenticated: all salons, but only latest listed row per slug.
drop policy if exists salon_ai_leaderboard_select_public on public.salon_ai_leaderboard;

create policy salon_ai_leaderboard_select_public
  on public.salon_ai_leaderboard
  for select
  to anon, authenticated
  using (
    is_listed = true
    and id in (select public.leaderboard_latest_listed_ids())
    and (
      coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
      or slug in (select public.leaderboard_top_slugs(20))
    )
  );
