const { getSupabasePublic } = require("./supabase");
const { createAppError } = require("./shared");
const { applyColumnInOrEq, countyQueryValues, stateQueryValues, townQueryValues } = require("./leaderboard-geo-variants");

const DEFAULT_PREVIEW_LIMIT = 20;
/** Latest listed snapshot per slug (see sql/021_leaderboard_slug_history_latest_view.sql). */
const LEADERBOARD_READ_SOURCE = "info_gather_google_profiles_latest";
const SELECT_WITH_DIMS =
  "id, slug, name, address, state, county, town, zipcode, category, rating, review_count, phone, sentiment_p, freshness_f, ai_score, dim_reviews_score, dim_rating_score, dim_sentiment_score, dim_recency_score, dim_local_seo_score, dim_conversion_score, assessment_level, place_id, google_place_id, profile_updated_at";
const SELECT_LEGACY =
  "id, slug, name, address, state, county, town, zipcode, category, rating, review_count, phone, sentiment_p, freshness_f, ai_score, assessment_level, place_id, google_place_id, profile_updated_at";

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: row.address,
    state: row.state,
    county: row.county,
    town: row.town,
    zipcode: row.zipcode != null ? String(row.zipcode).trim() : "",
    category: row.category,
    rating: row.rating != null ? Number(row.rating) : 0,
    reviews: row.review_count != null ? Number(row.review_count) : 0,
    phone: row.phone || "",
    p: row.sentiment_p != null ? Number(row.sentiment_p) : 0.8,
    f: row.freshness_f != null ? Number(row.freshness_f) : 0.75,
    score: row.ai_score != null ? Number(row.ai_score) : 0,
    dimReviewsScore: row.dim_reviews_score != null ? Number(row.dim_reviews_score) : 0,
    dimRatingScore: row.dim_rating_score != null ? Number(row.dim_rating_score) : 0,
    dimSentimentScore: row.dim_sentiment_score != null ? Number(row.dim_sentiment_score) : 0,
    dimRecencyScore: row.dim_recency_score != null ? Number(row.dim_recency_score) : 0,
    dimLocalSeoScore: row.dim_local_seo_score != null ? Number(row.dim_local_seo_score) : 0,
    dimConversionScore: row.dim_conversion_score != null ? Number(row.dim_conversion_score) : 0,
    assessmentLevel: String(row.assessment_level || "MODERATE").toUpperCase(),
    placeId: String(row.place_id || row.google_place_id || "").trim(),
    googlePlaceId: String(row.place_id || row.google_place_id || "").trim(),
    profileUpdatedAt: row.profile_updated_at || null,
  };
}

function isLeaderboardTableMissingError(error) {
  if (!error || typeof error !== "object") return false;
  const raw = String(error.message || error.details || "");
  const lower = raw.toLowerCase();
  if (lower.indexOf("info_gather_google_profiles") < 0) return false;
  // Missing *column* errors still name the table (e.g. "column place_id of relation … does not exist").
  if (String(error.code) === "42703") return false;
  if (/\bcolumn\b/.test(lower) && /does not exist/.test(lower)) return false;
  if (String(error.code) === "42P01") return true;
  if (/relation\s+[\s\S]*info_gather_google_profiles[\s\S]*does not exist/i.test(raw)) return true;
  if (/could not find the table/i.test(lower)) return true;
  return false;
}

function isLeaderboardLatestViewMissingError(error) {
  if (!error || typeof error !== "object") return false;
  const raw = String(error.message || error.details || "").toLowerCase();
  if (raw.indexOf("info_gather_google_profiles_latest") < 0) return false;
  if (String(error.code) === "42P01") return true;
  if (/does not exist/i.test(raw)) return true;
  return false;
}

function isMissingColumnError(error, columnName) {
  if (!error || typeof error !== "object") return false;
  const raw = String(error.message || error.details || "").toLowerCase();
  if (raw.indexOf(String(columnName || "").toLowerCase()) < 0) return false;
  return String(error.code) === "42703" || raw.indexOf("does not exist") >= 0;
}

/** Build PostgREST OR filter for name / town / address / county / slug (case-insensitive). */
function applyLeaderboardSearchOrFilter(query, searchRaw) {
  const inner = String(searchRaw || "")
    .trim()
    .replace(/,/g, " ")
    .replace(/[()]/g, " ")
    .slice(0, 96);
  if (!inner) return query;
  const esc = inner.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  const pat = `%${esc}%`;
  return query.or(
    `name.ilike.${pat},town.ilike.${pat},county.ilike.${pat},address.ilike.${pat},slug.ilike.${pat},phone.ilike.${pat}`,
  );
}

/**
 * @param {{
 *   limit?: number|null,
 *   offset?: number,
 *   state?: string,
 *   county?: string,
 *   town?: string,
 * }} options
 */
async function listLeaderboardSalons(options) {
  const opts = options || {};
  const limit = opts.limit != null ? Math.min(Number(opts.limit), 200) : 50;
  const offset = opts.offset != null ? Math.max(Number(opts.offset), 0) : 0;
  const state = String(opts.state || "").trim();
  const county = String(opts.county || "").trim();
  const town = String(opts.town || "").trim();
  const supabase = getSupabasePublic();
  let query = supabase
    .from(LEADERBOARD_READ_SOURCE)
    .select(SELECT_WITH_DIMS)
    .eq("is_listed", true)
    .order("ai_score", { ascending: false })
    .range(offset, offset + limit - 1);

  const stateVals = stateQueryValues(state);
  if (stateVals) query = applyColumnInOrEq(query, "state", stateVals);
  const countyVals = countyQueryValues(county);
  if (countyVals) query = applyColumnInOrEq(query, "county", countyVals);
  const townVals = townQueryValues(town);
  if (townVals) query = applyColumnInOrEq(query, "town", townVals);

  let { data, error } = await query;
  if (error && isMissingColumnError(error, "dim_reviews_score")) {
    let fallback = supabase.from(LEADERBOARD_READ_SOURCE).select(SELECT_LEGACY).eq("is_listed", true).order("ai_score", { ascending: false }).range(offset, offset + limit - 1);
    if (stateVals) fallback = applyColumnInOrEq(fallback, "state", stateVals);
    if (countyVals) fallback = applyColumnInOrEq(fallback, "county", countyVals);
    if (townVals) fallback = applyColumnInOrEq(fallback, "town", townVals);
    const retry = await fallback;
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (isLeaderboardLatestViewMissingError(error)) {
      throw createAppError(
        "LEADERBOARD_SCHEMA_STALE",
        "Run sql/021_leaderboard_slug_history_latest_view.sql in Supabase (latest-row view + RLS).",
        503,
      );
    }
    if (isMissingColumnError(error, "google_place_id")) {
      throw createAppError(
        "LEADERBOARD_SCHEMA_STALE",
        "Run sql/015_leaderboard_preview_rls.sql in Supabase (adds google_place_id and preview RLS).",
        503,
      );
    }
    if (isMissingColumnError(error, "zipcode")) {
      throw createAppError(
        "LEADERBOARD_SCHEMA_STALE",
        "Run sql/017_info_gather_google_profiles_zipcode.sql in Supabase.",
        503,
      );
    }
    if (isMissingColumnError(error, "place_id")) {
      throw createAppError(
        "LEADERBOARD_SCHEMA_STALE",
        "Run sql/019_info_gather_google_profiles_place_id.sql in Supabase.",
        503,
      );
    }
    if (isMissingColumnError(error, "profile_updated_at")) {
      throw createAppError(
        "LEADERBOARD_SCHEMA_STALE",
        "Run sql/015_leaderboard_preview_rls.sql in Supabase (adds profile_updated_at and preview RLS).",
        503,
      );
    }
    if (isLeaderboardTableMissingError(error)) {
      throw createAppError(
        "LEADERBOARD_NOT_CONFIGURED",
        "Leaderboard table missing. Run sql/013_info_gather_google_profiles.sql and sql/014_seed_info_gather_google_profiles.sql in Supabase.",
        503,
      );
    }
    throw createAppError("LEADERBOARD_QUERY_FAILED", error.message || "Could not load leaderboard.", 500);
  }

  return (data || []).map(mapRow);
}

async function isSlugInTopPublicPreview(slug, previewLimit) {
  const clean = String(slug || "")
    .trim()
    .toLowerCase();
  if (!clean) return false;
  const lim = Number(previewLimit) > 0 ? Math.floor(Number(previewLimit)) : DEFAULT_PREVIEW_LIMIT;
  const rows = await listLeaderboardSalons({ limit: lim });
  return rows.some(function (r) {
    return r.slug === clean;
  });
}

/** Anon may open scorecard if salon is in the top N within its own state+county (same cap as global preview). */
async function isSlugInCountyPublicPreview(slug, previewLimit) {
  const clean = String(slug || "")
    .trim()
    .toLowerCase();
  if (!clean) return false;
  const lim = Number(previewLimit) > 0 ? Math.floor(Number(previewLimit)) : DEFAULT_PREVIEW_LIMIT;
  let salon;
  try {
    salon = await getLeaderboardSalonBySlug(clean);
  } catch (e) {
    return false;
  }
  const st = String(salon.state || "").trim();
  const co = String(salon.county || "").trim();
  if (!st || !co) return false;
  const rows = await listLeaderboardSalons({
    limit: lim,
    state: st,
    county: co,
  });
  return rows.some(function (r) {
    return r.slug === clean;
  });
}

async function getLeaderboardSalonBySlug(slug) {
  const clean = String(slug || "")
    .trim()
    .toLowerCase();
  if (!clean) {
    throw createAppError("INVALID_INPUT", "Missing salon slug.", 400);
  }

  const supabase = getSupabasePublic();
  let { data, error } = await supabase
    .from(LEADERBOARD_READ_SOURCE)
    .select(SELECT_WITH_DIMS)
    .eq("is_listed", true)
    .eq("slug", clean)
    .maybeSingle();
  if (error && isMissingColumnError(error, "dim_reviews_score")) {
    const retry = await supabase.from(LEADERBOARD_READ_SOURCE).select(SELECT_LEGACY).eq("is_listed", true).eq("slug", clean).maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (isLeaderboardLatestViewMissingError(error)) {
      throw createAppError(
        "LEADERBOARD_SCHEMA_STALE",
        "Run sql/021_leaderboard_slug_history_latest_view.sql in Supabase (latest-row view + RLS).",
        503,
      );
    }
    if (isMissingColumnError(error, "google_place_id")) {
      throw createAppError(
        "LEADERBOARD_SCHEMA_STALE",
        "Run sql/015_leaderboard_preview_rls.sql in Supabase.",
        503,
      );
    }
    if (isMissingColumnError(error, "zipcode")) {
      throw createAppError(
        "LEADERBOARD_SCHEMA_STALE",
        "Run sql/017_info_gather_google_profiles_zipcode.sql in Supabase.",
        503,
      );
    }
    if (isMissingColumnError(error, "place_id")) {
      throw createAppError(
        "LEADERBOARD_SCHEMA_STALE",
        "Run sql/019_info_gather_google_profiles_place_id.sql in Supabase.",
        503,
      );
    }
    if (isMissingColumnError(error, "profile_updated_at")) {
      throw createAppError(
        "LEADERBOARD_SCHEMA_STALE",
        "Run sql/015_leaderboard_preview_rls.sql in Supabase.",
        503,
      );
    }
    if (isLeaderboardTableMissingError(error)) {
      throw createAppError(
        "LEADERBOARD_NOT_CONFIGURED",
        "Leaderboard table missing. Run sql/013_info_gather_google_profiles.sql in Supabase.",
        503,
      );
    }
    throw createAppError("LEADERBOARD_QUERY_FAILED", error.message || "Could not load salon.", 500);
  }

  if (!data) {
    throw createAppError("SALON_NOT_FOUND", "Salon not found on the leaderboard.", 404);
  }

  return mapRow(data);
}

module.exports = {
  DEFAULT_PREVIEW_LIMIT,
  LEADERBOARD_READ_SOURCE,
  getLeaderboardSalonBySlug,
  isSlugInCountyPublicPreview,
  isSlugInTopPublicPreview,
  listLeaderboardSalons,
  mapRow,
};
