-- Add Instagram enrichment fields for leaderboard rows.
-- Run in Supabase SQL Editor before running scripts/leaderboard_instagram_enrichment.py.

alter table public.salon_ai_leaderboard
  add column if not exists instagram_url text not null default '';

alter table public.salon_ai_leaderboard
  add column if not exists instagram_handle text not null default '';

alter table public.salon_ai_leaderboard
  add column if not exists instagram_source text not null default '';

alter table public.salon_ai_leaderboard
  add column if not exists instagram_checked_at timestamptz;

create index if not exists salon_ai_leaderboard_instagram_handle_idx
  on public.salon_ai_leaderboard (instagram_handle);

comment on column public.salon_ai_leaderboard.instagram_url is
  'Detected Instagram profile URL for this salon (best-effort enrichment).';

comment on column public.salon_ai_leaderboard.instagram_handle is
  'Parsed Instagram account handle without @ (best-effort enrichment).';

comment on column public.salon_ai_leaderboard.instagram_source is
  'Source used for Instagram detection: website or places_website.';

comment on column public.salon_ai_leaderboard.instagram_checked_at is
  'Timestamp of last Instagram enrichment attempt.';
