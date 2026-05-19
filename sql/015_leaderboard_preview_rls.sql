-- Public preview: anon (and clients using anon key) only see top 20 by ai_score.
-- Logged-in Supabase users (JWT role = authenticated) see all listed rows.
-- Adds Google Place id + profile refresh timestamp for /api/leaderboard/refresh-salon.

alter table public.salon_ai_leaderboard
  add column if not exists google_place_id text;

alter table public.salon_ai_leaderboard
  add column if not exists profile_updated_at timestamptz;

create index if not exists salon_ai_leaderboard_google_place_id_idx
  on public.salon_ai_leaderboard (google_place_id)
  where google_place_id is not null and google_place_id <> '';

-- Stable top-N by score (bypasses RLS; used only inside policies).
create or replace function public.leaderboard_top_slugs(p_limit integer default 20)
returns setof text
language sql
security definer
set search_path = public
stable
as $$
  select s.slug::text
  from public.salon_ai_leaderboard s
  where s.is_listed = true
  order by s.ai_score desc nulls last, s.slug asc
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

grant execute on function public.leaderboard_top_slugs(integer) to anon, authenticated, service_role;

drop policy if exists salon_ai_leaderboard_select_public on public.salon_ai_leaderboard;

create policy salon_ai_leaderboard_select_public
  on public.salon_ai_leaderboard
  for select
  to anon, authenticated
  using (
    is_listed = true
    and (
      coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
      or slug in (select public.leaderboard_top_slugs(20))
    )
  );
