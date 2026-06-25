-- 036: Deduplicated view for restr_ai_leaderboard, one row per brand name.
-- For each (name), keeps the listed row with the highest ai_score (ties broken by review_count desc).
-- Adds location_count = how many listed rows share the same name (proxy for chain size).
--
-- Why: Outscraper source has 10,947 chain-store duplicate rows (24.4% of 44,876).
-- 565 Dunkin', 413 McDonald's, 247 Popeyes, etc. `restr_ai_leaderboard_latest`
-- (sql/034) is deduped by slug (= per-location); this view dedupes by brand name
-- so leaderboard UIs can render one entry per chain (with location_count).
--
-- Run in Supabase SQL Editor. Idempotent (CREATE OR REPLACE).

create or replace view public.restr_ai_leaderboard_dedup_by_name
with (security_invoker = true) as
  with listed as (
    select *
    from public.restr_ai_leaderboard
    where is_listed = true
  ),
  ranked as (
    select
      l.*,
      row_number() over (
        partition by l.name
        order by l.ai_score desc nulls last,
                 l.review_count desc nulls last,
                 l.updated_at desc nulls last,
                 l.id desc
      ) as rn,
      count(*) over (partition by l.name) as location_count
    from listed l
  ),
  deduped as (
    select *
    from ranked
    where rn = 1
  ),
  with_cohort_rank as (
    select
      d.*,
      row_number() over (
        order by d.ai_score desc nulls last, d.slug asc
      ) as cohort_row_num,
      count(*) over () as cohort_size
    from deduped d
  )
  select
    id,
    slug,
    name,
    address,
    state,
    county,
    town,
    zipcode,
    category,
    rating,
    review_count,
    phone,
    website,
    sentiment_p,
    freshness_f,
    ai_score,
    case
      when cohort_size <= 1 then 'MODERATE'
      when cohort_row_num::numeric / cohort_size < 0.10 then 'EXCELLENT'
      when cohort_row_num::numeric / cohort_size < 0.30 then 'GOOD'
      when cohort_row_num::numeric / cohort_size < 0.60 then 'MODERATE'
      when cohort_row_num::numeric / cohort_size < 0.80 then 'LOW'
      else 'RISKY'
    end as assessment_level,
    place_id,
    google_place_id,
    profile_updated_at,
    dim_reviews_score,
    dim_rating_score,
    dim_sentiment_score,
    dim_recency_score,
    dim_local_seo_score,
    dim_conversion_score,
    is_listed,
    created_at,
    updated_at,
    location_count
  from with_cohort_rank;

grant select on public.restr_ai_leaderboard_dedup_by_name to anon, authenticated, service_role;

comment on view public.restr_ai_leaderboard_dedup_by_name is
  'Deduplicated leaderboard view: one row per brand name, kept the listed row with highest ai_score. location_count = how many listed rows share the same name. assessment_level is recomputed within the dedup cohort (10/20/30/20/20 bands on ai_score rank), so it reflects the dedup cohort ranking, not the original full-table percentile. Companion to restr_ai_leaderboard_latest (per-slug). Read this for chain-aware leaderboard UIs.';
