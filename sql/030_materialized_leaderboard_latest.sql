-- 030: Materialize info_gather_google_profiles_latest + performance indexes
-- Replaces the regular view with a materialized view so Postgres
-- doesn't re-scan 70k+ history rows on every API request.
--
-- After running this, refresh with:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY public.info_gather_google_profiles_latest;
-- (the ingest pipeline does this automatically after each import)

-- ── 1. Indexes on the base table ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leaderboard_listed_score
  ON public.info_gather_google_profiles (is_listed, ai_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_leaderboard_state_score
  ON public.info_gather_google_profiles (state, is_listed, ai_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_leaderboard_county_score
  ON public.info_gather_google_profiles (county, is_listed, ai_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_leaderboard_zipcode
  ON public.info_gather_google_profiles (zipcode, is_listed);

CREATE INDEX IF NOT EXISTS idx_leaderboard_place_id
  ON public.info_gather_google_profiles (place_id) WHERE place_id IS NOT NULL;

-- ── 2. Drop regular view, create materialized view ───────────────────────────
DROP VIEW IF EXISTS public.info_gather_google_profiles_latest CASCADE;

CREATE MATERIALIZED VIEW public.info_gather_google_profiles_latest AS
  SELECT DISTINCT ON (slug) *
  FROM public.info_gather_google_profiles
  WHERE is_listed = true
  ORDER BY slug, updated_at DESC NULLS LAST, created_at DESC, id DESC;

-- ── 3. Indexes on the materialized view ─────────────────────────────────────
CREATE UNIQUE INDEX idx_mv_leaderboard_slug
  ON public.info_gather_google_profiles_latest (slug);

CREATE INDEX idx_mv_leaderboard_score
  ON public.info_gather_google_profiles_latest (ai_score DESC NULLS LAST);

CREATE INDEX idx_mv_leaderboard_state_score
  ON public.info_gather_google_profiles_latest (state, ai_score DESC NULLS LAST);

CREATE INDEX idx_mv_leaderboard_county_score
  ON public.info_gather_google_profiles_latest (county, ai_score DESC NULLS LAST);

CREATE INDEX idx_mv_leaderboard_zipcode
  ON public.info_gather_google_profiles_latest (zipcode);

CREATE INDEX idx_mv_leaderboard_id
  ON public.info_gather_google_profiles_latest (id);

-- ── 4. Permissions ───────────────────────────────────────────────────────────
GRANT SELECT ON public.info_gather_google_profiles_latest TO anon, authenticated, service_role;

-- ── 5. Re-create RLS-dependent functions that CASCADE dropped ────────────────
CREATE OR REPLACE FUNCTION public.leaderboard_latest_listed_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.info_gather_google_profiles_latest;
$$;

GRANT EXECUTE ON FUNCTION public.leaderboard_latest_listed_ids() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.leaderboard_top_slugs(p_limit integer DEFAULT 20)
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT slug::text
  FROM public.info_gather_google_profiles_latest
  ORDER BY ai_score DESC NULLS LAST, slug ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 100));
$$;

GRANT EXECUTE ON FUNCTION public.leaderboard_top_slugs(integer) TO anon, authenticated, service_role;

-- ── 6. Re-create RLS policy (dropped by CASCADE) ────────────────────────────
DROP POLICY IF EXISTS info_gather_google_profiles_select_public ON public.info_gather_google_profiles;

CREATE POLICY info_gather_google_profiles_select_public
  ON public.info_gather_google_profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    is_listed = true
    AND id IN (SELECT public.leaderboard_latest_listed_ids())
    AND (
      COALESCE(auth.jwt() ->> 'role', '') = 'authenticated'
      OR slug IN (SELECT public.leaderboard_top_slugs(20))
    )
  );
