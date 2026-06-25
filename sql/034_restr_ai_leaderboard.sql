-- Restaurant AI leaderboard (Google Visibility ranking).
-- Schema mirrors public.salon_ai_leaderboard after migrations 013–027 + 021 history pattern.
-- Run in Supabase SQL Editor after prior migrations.

create table if not exists public.restr_ai_leaderboard (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
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
  google_place_id text,
  profile_updated_at timestamptz,
  instagram_url text not null default '',
  instagram_handle text not null default '',
  instagram_source text not null default '',
  instagram_checked_at timestamptz,
  dim_reviews_score numeric(5, 1) not null default 0,
  dim_rating_score numeric(5, 1) not null default 0,
  dim_sentiment_score numeric(5, 1) not null default 0,
  dim_recency_score numeric(5, 1) not null default 0,
  dim_local_seo_score numeric(5, 1) not null default 0,
  dim_conversion_score numeric(5, 1) not null default 0,
  is_listed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restr_ai_leaderboard_slug_format_chk
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint restr_ai_leaderboard_level_chk
    check (assessment_level in ('EXCELLENT', 'GOOD', 'MODERATE', 'LOW', 'RISKY'))
);

create index if not exists restr_ai_leaderboard_listed_score_idx
  on public.restr_ai_leaderboard (is_listed, ai_score desc);

create index if not exists restr_ai_leaderboard_state_county_idx
  on public.restr_ai_leaderboard (state, county);

create index if not exists restr_ai_leaderboard_state_town_score_idx
  on public.restr_ai_leaderboard (state, town, ai_score desc)
  where is_listed = true;

create index if not exists restr_ai_leaderboard_zipcode_idx
  on public.restr_ai_leaderboard (zipcode);

create index if not exists restr_ai_leaderboard_google_place_id_idx
  on public.restr_ai_leaderboard (google_place_id)
  where google_place_id is not null and google_place_id <> '';

create index if not exists restr_ai_leaderboard_place_id_idx
  on public.restr_ai_leaderboard (place_id)
  where place_id is not null and place_id <> '';

create index if not exists restr_ai_leaderboard_slug_updated_at_idx
  on public.restr_ai_leaderboard (slug, updated_at desc);

create index if not exists restr_ai_leaderboard_instagram_handle_idx
  on public.restr_ai_leaderboard (instagram_handle);

drop trigger if exists restr_ai_leaderboard_set_updated_at on public.restr_ai_leaderboard;
create trigger restr_ai_leaderboard_set_updated_at
  before update on public.restr_ai_leaderboard
  for each row execute function public.set_updated_at();

comment on table public.restr_ai_leaderboard is
  'Restaurant Google Visibility leaderboard — structure aligned with salon_ai_leaderboard.';

comment on column public.restr_ai_leaderboard.dim_local_seo_score is
  '0-100 Google local visibility: profile completeness, hours, menu, photos, categories.';

comment on column public.restr_ai_leaderboard.dim_conversion_score is
  '0-100 customer acquisition readiness: phone, reservations, delivery/takeout, menu links.';

-- Latest listed snapshot per slug (append-only history).
create or replace view public.restr_ai_leaderboard_latest
with (security_invoker = true) as
select distinct on (slug) *
from public.restr_ai_leaderboard
where is_listed = true
order by slug, updated_at desc nulls last, created_at desc, id desc;

grant select on public.restr_ai_leaderboard_latest to anon, authenticated, service_role;

create or replace function public.restr_leaderboard_latest_listed_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select distinct on (s2.slug) s2.id
  from public.restr_ai_leaderboard s2
  where s2.is_listed = true
  order by s2.slug, s2.updated_at desc nulls last, s2.created_at desc, s2.id desc;
$$;

grant execute on function public.restr_leaderboard_latest_listed_ids() to anon, authenticated, service_role;

create or replace function public.restr_leaderboard_top_slugs(p_limit integer default 20)
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
    from public.restr_ai_leaderboard s
    where s.is_listed = true
    order by s.slug, s.updated_at desc nulls last, s.created_at desc, s.id desc
  ) x
  order by x.ai_score desc nulls last, x.slug asc
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

grant execute on function public.restr_leaderboard_top_slugs(integer) to anon, authenticated, service_role;

alter table public.restr_ai_leaderboard enable row level security;

drop policy if exists restr_ai_leaderboard_select_public on public.restr_ai_leaderboard;
create policy restr_ai_leaderboard_select_public
  on public.restr_ai_leaderboard
  for select
  to anon, authenticated
  using (
    is_listed = true
    and id in (select public.restr_leaderboard_latest_listed_ids())
    and (
      coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
      or slug in (select public.restr_leaderboard_top_slugs(20))
    )
  );

drop policy if exists restr_ai_leaderboard_service_all on public.restr_ai_leaderboard;
create policy restr_ai_leaderboard_service_all
  on public.restr_ai_leaderboard
  for all
  to service_role
  using (true)
  with check (true);

grant select on table public.restr_ai_leaderboard to anon, authenticated;
grant all on table public.restr_ai_leaderboard to service_role;

do $$
begin
  alter publication supabase_realtime add table public.restr_ai_leaderboard;
exception
  when duplicate_object then null;
end $$;
