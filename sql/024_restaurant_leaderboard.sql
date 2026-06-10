-- Restaurant Leaderboard table
-- Mirrors salon_ai_leaderboard structure for restaurants.
-- Slug format: {kebab-title}-{md5(place_id)[0:10]}
-- Each ingest run UPSERTS (on slug); latest row wins via updated_at.

create table if not exists public.restaurant_leaderboard (
  id              uuid primary key default gen_random_uuid(),

  -- identity
  slug            text not null,          -- e.g. katzs-delicatessen-c9ea5bea06
  place_id        text,                   -- Google place_id (ChIJ...)
  camis           text,                   -- NYC DOH camis
  name            text not null,
  address         text,
  city            text,
  state           text default 'NY',
  zipcode         text,
  category        text,
  phone           text,
  website         text,
  image_url       text,

  -- review basics
  rating          numeric(3,2),
  review_count    integer not null default 0,
  reviews_distribution jsonb,

  -- DOH
  latest_grade    text,
  latest_score    integer,

  -- 9 raw dimension scores (0–100)
  dim_rating_score        numeric(5,1) not null default 0,
  dim_volume_score        numeric(5,1) not null default 0,
  dim_sentiment_score     numeric(5,1) not null default 0,
  dim_food_safety_score   numeric(5,1) not null default 0,
  dim_profile_score       numeric(5,1) not null default 0,
  dim_service_score       numeric(5,1) not null default 0,
  dim_value_score         numeric(5,1) not null default 0,
  dim_ops_score           numeric(5,1) not null default 0,
  dim_conversion_score    numeric(5,1) not null default 0,

  -- composite
  restaurant_score    numeric(5,1) not null,
  assessment_level    text not null default 'MODERATE',

  -- match quality
  match_confidence    numeric(4,3),
  match_status        text,

  is_listed   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint restaurant_leaderboard_slug_format_chk
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint restaurant_leaderboard_level_chk
    check (assessment_level in ('EXCELLENT','GOOD','MODERATE','LOW','RISKY'))
);

-- One row per slug (upsert target)
create unique index if not exists restaurant_leaderboard_slug_uidx
  on public.restaurant_leaderboard (slug);

create index if not exists restaurant_leaderboard_place_id_idx
  on public.restaurant_leaderboard (place_id);

create index if not exists restaurant_leaderboard_score_idx
  on public.restaurant_leaderboard (restaurant_score desc);

create index if not exists restaurant_leaderboard_city_score_idx
  on public.restaurant_leaderboard (city, restaurant_score desc);

create index if not exists restaurant_leaderboard_zipcode_idx
  on public.restaurant_leaderboard (zipcode);

-- Latest view (mirrors salon_ai_leaderboard_latest pattern)
create or replace view public.restaurant_leaderboard_latest as
  select * from public.restaurant_leaderboard
  where is_listed = true
  order by restaurant_score desc;

-- RLS: public read, service_role write
alter table public.restaurant_leaderboard enable row level security;

drop policy if exists restaurant_leaderboard_public_read on public.restaurant_leaderboard;
create policy restaurant_leaderboard_public_read
  on public.restaurant_leaderboard for select
  to anon, authenticated
  using (is_listed = true);

drop policy if exists restaurant_leaderboard_service_all on public.restaurant_leaderboard;
create policy restaurant_leaderboard_service_all
  on public.restaurant_leaderboard for all
  to service_role
  using (true) with check (true);

grant select on public.restaurant_leaderboard to anon, authenticated;
grant all   on public.restaurant_leaderboard to service_role;
grant select on public.restaurant_leaderboard_latest to anon, authenticated;
