-- Restaurant Diagnostic Score table
-- 9 indicators, Bayesian-adjusted composite 0–100, assessment level EXCELLENT→RISKY
--
-- Joins:
--   restaurant_info_gather          (DOH source: grade, inspection score)
--   info_gather_restaurants         (Supabase source while RDS migration pending)
--   info_gather_google_profiles     (Google source: rating, reviews, profile)

create table if not exists public.restaurant_diagnostic_score (
  -- identity
  id                      uuid primary key default gen_random_uuid(),
  restaurant_id           uuid not null,          -- FK to restaurant_info_gather / info_gather_restaurants
  camis                   text,
  place_id                text,

  -- raw inputs (snapshot at time of scoring)
  rating                  numeric(3, 2),
  review_count            integer not null default 0,
  latest_grade            text,                   -- A / B / C / Z / N / null
  latest_score            integer,                -- DOH inspection score (lower = better)

  -- ── 9 Dimension scores (0–100) ───────────────────────────────────────────

  -- D1 口碑星级  Rating Quality          weight 20%
  -- Source: Google rating (calibrated 3.5→0, 5.0→100 for restaurant band)
  dim_rating_score        numeric(5, 1) not null default 0,

  -- D2 评价量级  Review Volume           weight 15%
  -- Source: reviews_count, log-normalised, plateau ~2 000 (restaurant median 183)
  dim_volume_score        numeric(5, 1) not null default 0,

  -- D3 口碑情感  Review Sentiment        weight 15%
  -- Source: reviews_distribution histogram → weighted-average star → 0.45–0.98 → ×100
  dim_sentiment_score     numeric(5, 1) not null default 0,

  -- D4 食品安全  Food Safety             weight 15%
  -- Source: DOH latest_grade + latest_score  (restaurant-exclusive dimension)
  dim_food_safety_score   numeric(5, 1) not null default 0,

  -- D5 信息完整度 Profile Completeness   weight 12%
  -- Source: phone, website, menu_url, opening_hours, price, categories, image_url
  dim_profile_score       numeric(5, 1) not null default 0,

  -- D6 服务广度  Service Breadth         weight 10%
  -- Source: dine-in, delivery, takeout, table-service, reservation
  dim_service_score       numeric(5, 1) not null default 0,

  -- D7 价值定位  Price-Value Ratio       weight 8%
  -- Source: price tier + rating → value perception index
  dim_value_score         numeric(5, 1) not null default 0,

  -- D8 运营活跃  Operational Activity    weight 3%
  -- Source: not closed, has opening_hours, has popular_times data
  dim_ops_score           numeric(5, 1) not null default 0,

  -- D9 转化就绪  Conversion Readiness    weight 2%
  -- Source: phone + menu_url + reserve_table_url
  dim_conversion_score    numeric(5, 1) not null default 0,

  -- ── Composite ─────────────────────────────────────────────────────────────
  -- Bayesian-adjusted blend, prior=0.50, confidence = 1 − exp(−n/80)
  restaurant_score        numeric(5, 1) not null,     -- 0.0 – 100.0
  assessment_level        text not null default 'MODERATE',
  -- EXCELLENT | GOOD | MODERATE | LOW | RISKY

  -- data-quality gate
  match_confidence        numeric(4, 3),
  match_status            text,

  scored_at               timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint restaurant_diagnostic_score_level_chk
    check (assessment_level in ('EXCELLENT','GOOD','MODERATE','LOW','RISKY'))
);

create unique index if not exists restaurant_diagnostic_score_restaurant_id_uidx
  on public.restaurant_diagnostic_score (restaurant_id);

create index if not exists restaurant_diagnostic_score_score_idx
  on public.restaurant_diagnostic_score (restaurant_score desc);

create index if not exists restaurant_diagnostic_score_level_idx
  on public.restaurant_diagnostic_score (assessment_level);

create index if not exists restaurant_diagnostic_score_grade_idx
  on public.restaurant_diagnostic_score (latest_grade);
