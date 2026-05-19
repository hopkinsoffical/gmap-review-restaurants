-- Edison, NJ — Google Maps scraped salon reviews (Playwright pipeline).
-- Run in Supabase SQL Editor after prior migrations. Safe to re-run (IF NOT EXISTS).

create table if not exists public.edison_nj_salon_google_reviews (
  id uuid primary key default gen_random_uuid(),
  row_fingerprint text not null,
  salon_google_url text not null,
  search_city text not null default '',
  salon_name text not null default '',
  salon_address text not null default '',
  reviewer_name text not null default '',
  reviewer_url text not null default '',
  rating numeric(3, 2),
  review_text text not null default '',
  relative_time text not null default '',
  published_at date,
  language text not null default 'unknown',
  scraped_at timestamptz not null default now(),
  constraint edison_nj_salon_google_reviews_fingerprint_key unique (row_fingerprint)
);

create index if not exists edison_nj_salon_google_reviews_salon_url_idx
  on public.edison_nj_salon_google_reviews (salon_google_url);

create index if not exists edison_nj_salon_google_reviews_salon_name_idx
  on public.edison_nj_salon_google_reviews (salon_name);

comment on table public.edison_nj_salon_google_reviews is
  'Google Maps review rows scraped for Edison NJ (scripts/edison_nj_salon_google_reviews.py).';

alter table public.edison_nj_salon_google_reviews enable row level security;
