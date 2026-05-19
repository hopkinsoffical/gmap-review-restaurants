-- Google Place resource id (ChIJ… / places/…); mirrors google_place_id for API naming parity.
alter table public.salon_ai_leaderboard
  add column if not exists place_id text;

update public.salon_ai_leaderboard
set place_id = google_place_id
where (place_id is null or trim(place_id) = '')
  and google_place_id is not null
  and trim(google_place_id) <> '';

create index if not exists salon_ai_leaderboard_place_id_idx
  on public.salon_ai_leaderboard (place_id)
  where place_id is not null and trim(place_id) <> '';
