const { createAppError } = require("./shared");
const { getServerEnv } = require("./env");
const { getPlaceDetails, normalizePlaceIdForPath } = require("./google-places-client");
const { resolveAssessmentLevelForSlug } = require("./leaderboard-scoring");
const { computeLeaderboardMetrics, fetchLatestSlugAiScores } = require("./leaderboard-ingest");
const { getSupabaseAdmin } = require("./supabase");

const PLACE_FIELD_MASK = [
  "id",
  "name",
  "displayName",
  "rating",
  "userRatingCount",
  "reviews",
  "formattedAddress",
  "nationalPhoneNumber",
  "addressComponents",
].join(",");

function displayNameText(place) {
  const dn = place && place.displayName;
  if (dn && typeof dn === "object" && dn.text) return String(dn.text).trim();
  if (typeof dn === "string") return dn.trim();
  return "";
}

function postalCodeFromPlace(place) {
  const comps = place && place.addressComponents;
  if (!Array.isArray(comps)) return "";
  for (let i = 0; i < comps.length; i += 1) {
    const c = comps[i];
    if (!c || !Array.isArray(c.types)) continue;
    if (c.types.indexOf("postal_code") >= 0) {
      return String(c.longText || c.shortText || "").trim();
    }
  }
  return "";
}

function postalCodeFromFormattedAddress(addr) {
  const all = String(addr || "").match(/\b\d{5}(?:-\d{4})?\b/g);
  return all && all.length ? String(all[all.length - 1]).trim() : "";
}

/**
 * Fetch Google Places details, recompute AI score from live signals, upsert profile columns.
 * @param {{ slug: string, placeId?: string }} params
 */
async function refreshLeaderboardSalonFromPlaces(params) {
  const slug = String((params && params.slug) || "")
    .trim()
    .toLowerCase();
  if (!slug) {
    throw createAppError("INVALID_INPUT", "slug is required", 400);
  }

  const env = getServerEnv();
  const apiKey = env.googlePlacesApiKey;
  if (!apiKey) {
    throw createAppError("ENV_MISSING", "GOOGLE_PLACES_API_KEY is not configured", 500);
  }

  const supabase = getSupabaseAdmin();
  const { data: rows, error: rowErr } = await supabase
    .from("salon_ai_leaderboard")
    .select("id, slug, place_id, google_place_id, state, county, town, category, rating, address, review_count, zipcode")
    .eq("slug", slug)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (rowErr) throw createAppError("LEADERBOARD_QUERY_FAILED", rowErr.message || "Lookup failed", 500);
  const row = rows && rows[0];
  if (!row) {
    throw createAppError("SALON_NOT_FOUND", "Unknown leaderboard slug.", 404);
  }

  const bodyPlaceId = String((params && params.placeId) || "").trim();
  const placeId =
    bodyPlaceId ||
    String(row.place_id != null ? row.place_id : "").trim() ||
    String(row.google_place_id != null ? row.google_place_id : "").trim();
  if (!placeId) {
    throw createAppError(
      "PLACE_ID_REQUIRED",
      "No place_id / google_place_id on file. Pass placeId in the request body (ChIJ… or places/…).",
      400,
    );
  }

  const place = await getPlaceDetails(placeId, apiKey, PLACE_FIELD_MASK.split(","));
  const name = displayNameText(place) || slug;
  const rating = Number(place.rating);
  const reviewCountFromPlace = Math.max(0, Math.floor(Number(place.userRatingCount) || 0));
  const address = String(place.formattedAddress || "").trim();
  const phone = String(place.nationalPhoneNumber || "").trim();
  const zipcode =
    postalCodeFromPlace(place) || postalCodeFromFormattedAddress(address) || String(row.zipcode || "").trim();
  const reviews = Array.isArray(place.reviews) ? place.reviews : [];
  const rValid = Number.isFinite(rating) ? rating : Number(row.rating) || 0;
  const nValid =
    reviewCountFromPlace > 0 ? reviewCountFromPlace : Math.max(0, Math.floor(Number(row.review_count) || 0));
  const metrics = computeLeaderboardMetrics({
    rating: rValid,
    review_count: nValid,
    reviews: reviews,
    address: address || row.address || "",
    phone: phone,
    place_id: place.id || place.name || placeId,
  });
  const aiScore = metrics.ai_score;
  const merged = await fetchLatestSlugAiScores(supabase);
  merged.set(slug, aiScore);
  const assessmentLevel = resolveAssessmentLevelForSlug(merged, slug);
  const normalizedPlaceId = normalizePlaceIdForPath(place.id || place.name || placeId);

  const { error: upErr } = await supabase
    .from("salon_ai_leaderboard")
    .update({
      name: name,
      address: address || row.address || "",
      zipcode: zipcode,
      rating: rValid,
      review_count: nValid,
      phone: phone,
      sentiment_p: metrics.sentiment_p,
      freshness_f: metrics.freshness_f,
      ai_score: aiScore,
      assessment_level: assessmentLevel,
      dim_reviews_score: metrics.dim_reviews_score,
      dim_rating_score: metrics.dim_rating_score,
      dim_sentiment_score: metrics.dim_sentiment_score,
      dim_recency_score: metrics.dim_recency_score,
      dim_local_seo_score: metrics.dim_local_seo_score,
      dim_conversion_score: metrics.dim_conversion_score,
      place_id: normalizedPlaceId,
      google_place_id: normalizedPlaceId,
      profile_updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (upErr) {
    throw createAppError("LEADERBOARD_UPDATE_FAILED", upErr.message || "Could not save profile.", 500);
  }

  return {
    slug: slug,
    placeId: normalizedPlaceId,
    googlePlaceId: normalizedPlaceId,
    name: name,
    rating: rValid,
    reviewCount: nValid,
    aiScore: aiScore,
    assessmentLevel: assessmentLevel,
    zipcode: zipcode,
    profileUpdatedAt: new Date().toISOString(),
  };
}

module.exports = {
  refreshLeaderboardSalonFromPlaces,
};
