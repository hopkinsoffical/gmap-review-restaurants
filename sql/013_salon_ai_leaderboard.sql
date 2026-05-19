-- AI salon leaderboard (public read for realtime + anon API patterns).
-- Run after 001_schema.sql in Supabase SQL Editor.

create table if not exists public.salon_ai_leaderboard (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address text not null default '',
  state text not null default '',
  county text not null default '',
  town text not null default '',
  zipcode text not null default '',
  category text not null default '',
  rating numeric(3, 2) not null,
  review_count integer not null default 0,
  phone text not null default '',
  website text not null default '',
  sentiment_p numeric(4, 3) not null default 0.8,
  freshness_f numeric(4, 3) not null default 0.75,
  ai_score numeric(5, 1) not null,
  assessment_level text not null default 'MODERATE',
  place_id text,
  is_listed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_ai_leaderboard_slug_format_chk
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index if not exists salon_ai_leaderboard_listed_score_idx
  on public.salon_ai_leaderboard (is_listed, ai_score desc);

create index if not exists salon_ai_leaderboard_state_county_idx
  on public.salon_ai_leaderboard (state, county);

drop trigger if exists salon_ai_leaderboard_set_updated_at on public.salon_ai_leaderboard;
create trigger salon_ai_leaderboard_set_updated_at
  before update on public.salon_ai_leaderboard
  for each row execute function public.set_updated_at();

alter table public.salon_ai_leaderboard enable row level security;

drop policy if exists salon_ai_leaderboard_select_public on public.salon_ai_leaderboard;
create policy salon_ai_leaderboard_select_public
  on public.salon_ai_leaderboard
  for select
  to anon, authenticated
  using (is_listed = true);

drop policy if exists salon_ai_leaderboard_service_all on public.salon_ai_leaderboard;
create policy salon_ai_leaderboard_service_all
  on public.salon_ai_leaderboard
  for all
  to service_role
  using (true)
  with check (true);

grant select on table public.salon_ai_leaderboard to anon, authenticated;
grant all on table public.salon_ai_leaderboard to service_role;

-- Optional: enable Postgres changes for this table (Supabase Dashboard → Realtime can also toggle it).
do $$
begin
  alter publication supabase_realtime add table public.salon_ai_leaderboard;
exception
  when duplicate_object then null;
end $$;

-- Listing requests (server-side insert only, same pattern as contact_leads).
create table if not exists public.leaderboard_listing_requests (
  id uuid primary key default gen_random_uuid(),
  salon_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null default '',
  address text not null default '',
  message text not null default '',
  request_kind text not null default 'add_store',
  user_agent text,
  created_at timestamptz not null default now(),
  constraint leaderboard_listing_requests_kind_chk
    check (request_kind in ('add_store', 'more_coverage'))
);

create index if not exists leaderboard_listing_requests_created_at_idx
  on public.leaderboard_listing_requests (created_at desc);

alter table public.leaderboard_listing_requests enable row level security;

drop policy if exists leaderboard_listing_requests_service_all on public.leaderboard_listing_requests;
create policy leaderboard_listing_requests_service_all
  on public.leaderboard_listing_requests
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.leaderboard_listing_requests to service_role;
