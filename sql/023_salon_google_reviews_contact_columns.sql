-- Optional: phone / website / Instagram from Maps scrape (scripts/edison_nj_salon_google_reviews.py).
-- Run in Supabase SQL Editor if you ingest CSVs with these columns.

alter table public.salon_google_reviews
  add column if not exists salon_phone text not null default '';

alter table public.salon_google_reviews
  add column if not exists salon_website text not null default '';

alter table public.salon_google_reviews
  add column if not exists salon_instagram text not null default '';

comment on column public.salon_google_reviews.salon_phone is
  'Business phone from Google Maps place panel (best-effort).';
comment on column public.salon_google_reviews.salon_website is
  'Official website link from Google Maps (best-effort).';
comment on column public.salon_google_reviews.salon_instagram is
  'First Instagram profile URL found on the place page (best-effort).';
