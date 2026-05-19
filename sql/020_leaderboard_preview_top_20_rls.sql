-- Align anon preview RLS with app default (top 20 by ai_score). Safe if already 20.
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
