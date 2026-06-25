/**
 * Batch ingest for public.restr_ai_leaderboard from Google profile source rows.
 */

const { createAppError } = require("./shared");
const { getSupabaseAdmin } = require("./supabase");
const {
  calcRestrAiScore,
  freshnessHeuristic,
  resolveAssessmentLevelForSlug,
  restrDimensionScoresFromSignals,
  sentimentFromReviewHistogram,
} = require("./restr-leaderboard-scoring");
const { countStarsFromReviewList, emptyHistogram, normalizeHistogramInput, sumHistogram } = require("./store-map-report");

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0.8;
  return Math.min(1, Math.max(0, n));
}

function sentimentFallbackFromRating(rating) {
  const r = Number(rating) || 0;
  if (r >= 4.8) return 0.95;
  if (r >= 4.6) return 0.9;
  if (r >= 4.4) return 0.85;
  if (r >= 4.1) return 0.8;
  if (r >= 3.8) return 0.72;
  return 0.66;
}

function histogramFromRecord(rec) {
  if (Array.isArray(rec.reviews)) return countStarsFromReviewList(rec.reviews);
  const normalized = normalizeHistogramInput(
    rec.reviews_distribution || rec.star_histogram || rec.starHistogram || rec.histogram,
  );
  return normalized || emptyHistogram();
}

function computeRestrLeaderboardMetrics(rec) {
  const rating = Number(rec.rating) || 0;
  const reviewCount = Math.max(0, Math.floor(Number(rec.review_count || rec.reviewCount) || 0));
  const hist = histogramFromRecord(rec);
  const histTotal = sumHistogram(hist);
  const incomplete = histTotal > 0 && reviewCount > 0 && histTotal < reviewCount;
  let sentimentP;
  if (histTotal > 0) {
    sentimentP = sentimentFromReviewHistogram(hist, reviewCount || histTotal);
    if (incomplete) {
      sentimentP = Math.round(clamp01((sentimentP + sentimentFallbackFromRating(rating)) / 2) * 1000) / 1000;
    }
  } else {
    sentimentP = sentimentFallbackFromRating(rating);
  }
  const reviewsArr = Array.isArray(rec.reviews) ? rec.reviews : [];
  const freshnessF = freshnessHeuristic(reviewCount, reviewsArr);

  const dimSignals = {
    rating,
    reviewCount,
    sentimentP,
    freshnessF,
    phone: rec.phone,
    website: rec.website,
    address: rec.address,
    placeId: rec.place_id || rec.google_place_id || rec.placeId,
    menuUrl: rec.best_menu_url || rec.menu_url || rec.menuUrl,
    openingHours: rec.opening_hours || rec.openingHours,
    imageUrl: rec.image_url || rec.imageUrl,
    categories: rec.categories,
    price: rec.price,
    delivery: rec.delivery,
    takeout: rec.takeout,
    dineIn: rec.dine_in ?? rec.dineIn,
    reservable: rec.reservable,
  };
  const dims = restrDimensionScoresFromSignals(dimSignals);
  const aiScore = calcRestrAiScore(
    rating,
    reviewCount,
    sentimentP,
    freshnessF,
    dims.dim_local_seo_score,
    dims.dim_conversion_score,
  );

  return {
    sentiment_p: sentimentP,
    freshness_f: freshnessF,
    ai_score: aiScore,
    ...dims,
  };
}

function normalizeSlug(slug) {
  const s = String(slug || "")
    .trim()
    .toLowerCase();
  return SLUG_RE.test(s) ? s : "";
}

async function fetchExistingSlugScores() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("restr_ai_leaderboard_latest").select("slug, ai_score");
  if (error) {
    throw createAppError(
      "RESTR_LEADERBOARD_SCHEMA_STALE",
      error.message || "Could not read restr_ai_leaderboard_latest (run sql/034… if missing).",
      503,
    );
  }
  const map = new Map();
  (data || []).forEach(function (row) {
    map.set(String(row.slug), Number(row.ai_score) || 0);
  });
  return map;
}

function buildInsertRow(rec, metrics, mergedSlugToScore) {
  const slug = normalizeSlug(rec.slug);
  if (!slug) return null;
  const assessmentLevel = resolveAssessmentLevelForSlug(mergedSlugToScore, slug);
  return {
    slug,
    name: String(rec.name || slug).trim(),
    address: String(rec.address || "").trim(),
    state: String(rec.state || "").trim(),
    county: String(rec.county || rec.city || "").trim(),
    town: String(rec.town || rec.city || "").trim(),
    zipcode: String(rec.zipcode || "").trim(),
    category: String(rec.category || rec.categories?.[0] || "").trim(),
    rating: Number(rec.rating) || 0,
    review_count: Math.max(0, Math.floor(Number(rec.review_count || rec.reviewCount) || 0)),
    phone: String(rec.phone || "").trim(),
    website: String(rec.website || "").trim(),
    sentiment_p: metrics.sentiment_p,
    freshness_f: metrics.freshness_f,
    ai_score: metrics.ai_score,
    assessment_level: assessmentLevel,
    place_id: String(rec.place_id || rec.google_place_id || "").trim() || null,
    google_place_id: String(rec.google_place_id || rec.place_id || "").trim() || null,
    profile_updated_at: rec.profile_updated_at || rec.updated_at || null,
    dim_reviews_score: metrics.dim_reviews_score,
    dim_rating_score: metrics.dim_rating_score,
    dim_sentiment_score: metrics.dim_sentiment_score,
    dim_recency_score: metrics.dim_recency_score,
    dim_local_seo_score: metrics.dim_local_seo_score,
    dim_conversion_score: metrics.dim_conversion_score,
    is_listed: rec.is_listed !== false,
  };
}

/**
 * @param {object[]} records
 * @param {{ dryRun?: boolean }} [options]
 */
async function ingestRestrLeaderboardRecords(records, options) {
  const opts = options || {};
  const list = Array.isArray(records) ? records : [];
  if (!list.length) return { inserted: 0 };

  const existing = await fetchExistingSlugScores();
  const batchScores = new Map(existing);
  const prepared = [];

  list.forEach(function (rec) {
    const metrics = computeRestrLeaderboardMetrics(rec);
    const slug = normalizeSlug(rec.slug);
    if (!slug) return;
    batchScores.set(slug, metrics.ai_score);
    prepared.push({ rec, metrics });
  });

  const rows = prepared
    .map(function (item) {
      return buildInsertRow(item.rec, item.metrics, batchScores);
    })
    .filter(Boolean);

  if (opts.dryRun) return { inserted: rows.length, dryRun: true };

  const supabase = getSupabaseAdmin();
  const chunkSize = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("restr_ai_leaderboard").insert(chunk);
    if (error) {
      throw createAppError("RESTR_LEADERBOARD_INGEST_FAILED", error.message || "Insert failed.", 500);
    }
    inserted += chunk.length;
  }
  return { inserted };
}

module.exports = {
  computeRestrLeaderboardMetrics,
  ingestRestrLeaderboardRecords,
};
