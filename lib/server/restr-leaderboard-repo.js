const { getSupabasePublic } = require("./supabase");
const { createAppError } = require("./shared");
const { applyColumnInOrEq, countyQueryValues, stateQueryValues, townQueryValues } = require("./leaderboard-geo-variants");

const DEFAULT_PREVIEW_LIMIT = 20;
// Public read source: dedup-by-name view (sql/036). One row per brand name
// instead of one per slug, with location_count + cohort-recomputed
// assessment_level. Backed by 24.4% chain-store duplicates in
// restr_ai_leaderboard (Dunkin' 565, McDonald's 413, ...).
const RESTR_READ_SOURCE = "restr_ai_leaderboard_dedup_by_name";
const SELECT_WITH_DIMS =
  "id, slug, name, address, state, county, town, zipcode, category, rating, review_count, phone, website, sentiment_p, freshness_f, ai_score, dim_reviews_score, dim_rating_score, dim_sentiment_score, dim_recency_score, dim_local_seo_score, dim_conversion_score, assessment_level, place_id, google_place_id, profile_updated_at, location_count";

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
    city: row.town,
    zipcode: row.zipcode != null ? String(row.zipcode).trim() : "",
    category: row.category,
    rating: row.rating != null ? Number(row.rating) : 0,
    reviews: row.review_count != null ? Number(row.review_count) : 0,
    reviewCount: row.review_count != null ? Number(row.review_count) : 0,
    phone: row.phone || "",
    website: row.website || "",
    p: row.sentiment_p != null ? Number(row.sentiment_p) : 0.8,
    f: row.freshness_f != null ? Number(row.freshness_f) : 0.75,
    score: row.ai_score != null ? Number(row.ai_score) : 0,
    aiScore: row.ai_score != null ? Number(row.ai_score) : 0,
    marketingScore: row.ai_score != null ? Number(row.ai_score) : 0,
    googleRating: row.rating != null ? Number(row.rating) : 0,
    googleReviewCount: row.review_count != null ? Number(row.review_count) : 0,
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
    locationCount: row.location_count != null ? Number(row.location_count) : 1,
  };
}

function mapListRow(row) {
  const mapped = mapRow(row);
  if (!mapped) return null;
  return {
    slug: mapped.slug,
    name: mapped.name,
    address: mapped.address,
    city: mapped.town,
    township: mapped.town,
    state: mapped.state,
    county: mapped.county,
    googleRating: mapped.googleRating,
    googleReviewCount: mapped.googleReviewCount,
    marketingScore: mapped.marketingScore,
    visibilityScore: mapped.marketingScore,
    dimLocalSeoScore: mapped.dimLocalSeoScore,
    dimConversionScore: mapped.dimConversionScore,
    locationCount: mapped.locationCount,
  };
}

function isTableMissingError(error) {
  if (!error || typeof error !== "object") return false;
  const raw = String(error.message || error.details || "").toLowerCase();
  if (raw.indexOf("restr_ai_leaderboard") < 0) return false;
  if (String(error.code) === "42703") return false;
  if (/\bcolumn\b/.test(raw) && /does not exist/.test(raw)) return false;
  if (String(error.code) === "42P01") return true;
  if (/does not exist/i.test(raw)) return true;
  return false;
}

function applySearchOrFilter(query, searchRaw) {
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

function applyGeoFilters(query, geo) {
  const stateVals = stateQueryValues(geo && geo.state);
  const countyVals = countyQueryValues(geo && geo.county);
  const cityRaw = String((geo && (geo.city || geo.town)) || "").trim();
  const townVals = townQueryValues(cityRaw);
  if (stateVals) query = applyColumnInOrEq(query, "state", stateVals);
  if (countyVals) query = applyColumnInOrEq(query, "county", countyVals);
  if (townVals) query = applyColumnInOrEq(query, "town", townVals);
  return query;
}

/**
 * @param {{
 *   limit?: number,
 *   offset?: number,
 *   state?: string,
 *   county?: string,
 *   city?: string,
 *   town?: string,
 *   search?: string,
 * }} [options]
 */
async function listRestrLeaderboard(options) {
  const opts = options || {};
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 200);
  const offset = Math.max(Number(opts.offset) || 0, 0);
  const search = String(opts.search || "").trim();
  const supabase = getSupabasePublic();

  let countQuery = supabase
    .from(RESTR_READ_SOURCE)
    .select("id", { count: "exact", head: true })
    .eq("is_listed", true);
  countQuery = applyGeoFilters(countQuery, opts);
  if (search.length >= 2) countQuery = applySearchOrFilter(countQuery, search);

  let dataQuery = supabase
    .from(RESTR_READ_SOURCE)
    .select(SELECT_WITH_DIMS)
    .eq("is_listed", true)
    .order("ai_score", { ascending: false })
    .range(offset, offset + limit - 1);
  dataQuery = applyGeoFilters(dataQuery, opts);
  if (search.length >= 2) dataQuery = applySearchOrFilter(dataQuery, search);

  const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);
  const error = countResult.error || dataResult.error;
  if (error) {
    if (isTableMissingError(error)) {
      throw createAppError(
        "RESTR_LEADERBOARD_NOT_CONFIGURED",
        "Restaurant leaderboard table missing. Run sql/034_restr_ai_leaderboard.sql in Supabase.",
        503,
      );
    }
    throw createAppError("RESTR_LEADERBOARD_QUERY_FAILED", error.message || "Could not load restaurants.", 500);
  }

  return {
    rows: (dataResult.data || []).map(mapListRow).filter(Boolean),
    total: Number(countResult.count) || 0,
    limit,
    offset,
  };
}

async function getRestrLeaderboardBySlug(slug) {
  const clean = String(slug || "")
    .trim()
    .toLowerCase();
  if (!clean) {
    throw createAppError("INVALID_INPUT", "Missing restaurant slug.", 400);
  }

  const supabase = getSupabasePublic();
  const { data, error } = await supabase
    .from(RESTR_READ_SOURCE)
    .select(SELECT_WITH_DIMS)
    .eq("is_listed", true)
    .eq("slug", clean)
    .maybeSingle();

  if (error) {
    if (isTableMissingError(error)) {
      throw createAppError(
        "RESTR_LEADERBOARD_NOT_CONFIGURED",
        "Restaurant leaderboard table missing. Run sql/034_restr_ai_leaderboard.sql in Supabase.",
        503,
      );
    }
    throw createAppError("RESTR_LEADERBOARD_QUERY_FAILED", error.message || "Could not load restaurant.", 500);
  }
  if (!data) {
    throw createAppError("RESTR_NOT_FOUND", "Restaurant not found on the leaderboard.", 404);
  }
  return mapRow(data);
}

module.exports = {
  DEFAULT_PREVIEW_LIMIT,
  RESTR_READ_SOURCE,
  getRestrLeaderboardBySlug,
  listRestrLeaderboard,
  mapListRow,
  mapRow,
};
