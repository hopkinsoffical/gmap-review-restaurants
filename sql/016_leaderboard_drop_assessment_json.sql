-- UI tokens (emoji, colors) live in the app; DB keeps assessment_level only.
alter table public.salon_ai_leaderboard
  drop column if exists assessment_json;
