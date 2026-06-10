-- Migration: Supabase restaurant tables → RDS (EC2 shared DB)
-- Source tables (Supabase):
--   public.info_gather_restaurants      → restaurant_info_gather
--   public.info_gather_google_profiles  → restaurant_google_profiles
--
-- Run this on the RDS (localhost:15432, db=vforce) AFTER the tunnel is active:
--   PGPASSWORD=testapp123 psql -h localhost -p 15432 -U vforce_app -d vforce \
--     -f sql/022_restaurant_tables_rds_migration.sql

-- ─── restaurant_info_gather ────────────────────────────────────────────────

create table if not exists public.restaurant_info_gather (
  id                      uuid primary key,
  camis                   text,
  name                    text,
  dba                     text,
  cuisine_description     text,
  boro                    text,
  building                text,
  street                  text,
  zipcode                 text,
  phone                   text,
  latitude                double precision,
  longitude               double precision,
  latest_grade            text,
  latest_score            integer,
  latest_inspection_date  date,
  google_query            text,
  enrichment_status       text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists restaurant_info_gather_camis_idx
  on public.restaurant_info_gather (camis);

create index if not exists restaurant_info_gather_boro_idx
  on public.restaurant_info_gather (boro);

create index if not exists restaurant_info_gather_enrichment_status_idx
  on public.restaurant_info_gather (enrichment_status);

create index if not exists restaurant_info_gather_zipcode_idx
  on public.restaurant_info_gather (zipcode);

-- ─── restaurant_google_profiles ────────────────────────────────────────────

create table if not exists public.restaurant_google_profiles (
  id                          uuid primary key,
  restaurant_id               uuid references public.restaurant_info_gather(id) on delete set null deferrable initially deferred,
  camis                       text,
  place_id                    text,
  cid                         text,
  fid                         text,
  google_maps_url             text,
  title                       text,
  category_name               text,
  categories                  jsonb,
  address                     text,
  street                      text,
  city                        text,
  postal_code                 text,
  state                       text,
  phone                       text,
  phone_unformatted           text,
  website                     text,
  google_menu_url             text,
  best_menu_url               text,
  best_menu_url_source        text,
  google_food_url             text,
  order_online                jsonb,
  order_by                    jsonb,
  reserve_table_url           text,
  table_reservation_links     jsonb,
  price                       text,
  rating                      double precision,
  reviews_count               integer,
  reviews_distribution        jsonb,
  opening_hours               jsonb,
  additional_opening_hours    jsonb,
  popular_times_histogram     jsonb,
  additional_info             jsonb,
  image_url                   text,
  image_urls                  jsonb,
  temporarily_closed          boolean not null default false,
  permanently_closed          boolean not null default false,
  match_confidence            double precision,
  match_status                text,
  raw                         jsonb,
  scraped_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- place_id is NOT unique: same Google business can map to multiple CAMIS records
create index if not exists restaurant_google_profiles_place_id_idx
  on public.restaurant_google_profiles (place_id)
  where place_id is not null;

create index if not exists restaurant_google_profiles_restaurant_id_idx
  on public.restaurant_google_profiles (restaurant_id);

create index if not exists restaurant_google_profiles_camis_idx
  on public.restaurant_google_profiles (camis);

create index if not exists restaurant_google_profiles_match_status_idx
  on public.restaurant_google_profiles (match_status);

create index if not exists restaurant_google_profiles_rating_idx
  on public.restaurant_google_profiles (rating);
