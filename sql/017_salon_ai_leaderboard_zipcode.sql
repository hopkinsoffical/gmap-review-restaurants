-- Optional US-style postal code for filtering and maps tooling.
alter table public.salon_ai_leaderboard
  add column if not exists zipcode text not null default '';

create index if not exists salon_ai_leaderboard_zipcode_idx
  on public.salon_ai_leaderboard (zipcode)
  where zipcode is not null and zipcode <> '';
