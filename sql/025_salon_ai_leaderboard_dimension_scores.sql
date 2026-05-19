-- Add explicit six-dimension scores so each report dimension is backed by stored data.
-- Run in Supabase SQL Editor after prior leaderboard migrations.

alter table public.salon_ai_leaderboard
  add column if not exists dim_reviews_score numeric(5, 1) not null default 0;

alter table public.salon_ai_leaderboard
  add column if not exists dim_rating_score numeric(5, 1) not null default 0;

alter table public.salon_ai_leaderboard
  add column if not exists dim_sentiment_score numeric(5, 1) not null default 0;

alter table public.salon_ai_leaderboard
  add column if not exists dim_recency_score numeric(5, 1) not null default 0;

alter table public.salon_ai_leaderboard
  add column if not exists dim_local_seo_score numeric(5, 1) not null default 0;

alter table public.salon_ai_leaderboard
  add column if not exists dim_conversion_score numeric(5, 1) not null default 0;

comment on column public.salon_ai_leaderboard.dim_reviews_score is
  '0-100 score for review-volume dimension (log normalized).';

comment on column public.salon_ai_leaderboard.dim_rating_score is
  '0-100 score for rating dimension from star average.';

comment on column public.salon_ai_leaderboard.dim_sentiment_score is
  '0-100 score for sentiment dimension from sentiment_p.';

comment on column public.salon_ai_leaderboard.dim_recency_score is
  '0-100 score for recency dimension from freshness_f.';

comment on column public.salon_ai_leaderboard.dim_local_seo_score is
  '0-100 proxy score for local SEO strength from trust + profile completeness signals.';

comment on column public.salon_ai_leaderboard.dim_conversion_score is
  '0-100 proxy score for conversion readiness from contactability and trust signals.';
