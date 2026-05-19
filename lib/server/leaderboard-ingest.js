/**
 * Batch ingest for public.salon_ai_leaderboard from a JSON source file.
 *
 * Scoring v2 (lib/server/leaderboard-scoring.js, mirrored in pipelines/leaderboard_scoring.py):
 * - sentiment_p: histogram mean-star → 0.45–0.98; red-alert histograms capped ~0.58; empty hist uses rating fallback.
 * - freshness_f: review timestamps when ≥3 dated samples; else volume-only curve (slightly flatter than v1).
 * - ai_score: rating/volume/sentiment/freshness blend with review-count evidence shrink toward a neutral prior.
 * - assessment_level: global percentile on salon_ai_leaderboard_latest ∪ batch (by ai_score rank).
 */

const { createAppError } = require("./shared");
const { getSupabaseAdmin } = require("./supabase");
const {
  buildAssessment,
  calcAiScore,
  freshnessHeuristic,
  resolveAssessmentLevelForSlug,
  sentimentFromReviewHistogram,
} = require("./leaderboard-scoring");
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

function dimensionScoresFromSignals(signals) {
  const rating = Number(signals.rating) || 0;
  const reviewCount = Math.max(0, Math.floor(Number(signals.reviewCount) || 0));
  const sentimentP = clamp01(signals.sentimentP);
  const freshnessF = clamp01(signals.freshnessF);
  const hasPhone = String(signals.phone || "").trim().length > 0;
  const hasAddress = String(signals.address || "").trim().length > 0;
  const hasPlaceId = String(signals.placeId || "").trim().length > 0;
  const hasInstagram = String(signals.instagramHandle || signals.instagramUrl || "").trim().length > 0;
  const ratingScore = Math.round(Math.max(0, Math.min(100, ((rating - 3) / 2) * 100)) * 10) / 10;
  const reviewScore = Math.round(Math.max(0, Math.min(100, (Math.log10(reviewCount + 1) / Math.log10(900)) * 100)) * 10) / 10;
  const sentimentScore = Math.round(sentimentP * 1000) / 10;
  const recencyScore = Math.round(freshnessF * 1000) / 10;
  // Local SEO proxy from profile completeness + trust signals.
  const localSeoScore = Math.round((ratingScore * 0.42 + reviewScore * 0.26 + recencyScore * 0.12 + (hasAddress ? 10 : 0) + (hasPlaceId ? 10 : 0)) * 10) / 10;
  // Conversion proxy from direct-contact readiness + trust + social proof presence.
  const conversionScore = Math.round((ratingScore * 0.3 + reviewScore * 0.2 + (hasPhone ? 24 : 0) + (hasInstagram ? 12 : 0) + (hasPlaceId ? 14 : 0)) * 10) / 10;
  return {
    dim_reviews_score: reviewScore,
    dim_rating_score: ratingScore,
    dim_sentiment_score: sentimentScore,
    dim_recency_score: recencyScore,
    dim_local_seo_score: Math.max(0, Math.min(100, localSeoScore)),
    dim_conversion_score: Math.max(0, Math.min(100, conversionScore)),
  };
}

function histogramFromRecord(rec) {
  if (Array.isArray(rec.reviews)) {
    return countStarsFromReviewList(rec.reviews);
  }
  const normalized = normalizeHistogramInput(rec.star_histogram || rec.starHistogram || rec.histogram);
  return normalized || emptyHistogram();
}

/**
 * @param {{
 *   rating: number,
 *   review_count: number,
 *   reviews?: unknown[],
 *   star_histogram?: Record<string, number>,
 * }} rec
 */
function computeLeaderboardMetrics(rec) {
  const rating = Number(rec.rating) || 0;
  const reviewCount = Math.max(0, Math.floor(Number(rec.review_count) || 0));
  const hist = histogramFromRecord(rec);
  const histTotal = sumHistogram(hist);
  const incomplete = histTotal > 0 && reviewCount > 0 && histTotal < reviewCount;
  let sentimentP;
  if (histTotal > 0) {
    sentimentP = sentimentFromReviewHistogram(hist, reviewCount || histTotal);
    if (incomplete) {
      const blend = clamp01((sentimentP + sentimentFallbackFromRating(rating)) / 2);
      sentimentP = Math.round(blend * 1000) / 1000;
    }
  } else {
    sentimentP = sentimentFallbackFromRating(rating);
  }
  const reviewsArr = Array.isArray(rec.reviews) ? rec.reviews : [];
  const freshnessF = freshnessHeuristic(reviewCount, reviewsArr);
  const aiScore = calcAiScore(rating, reviewCount, sentimentP, freshnessF);
  const dims = dimensionScoresFromSignals({
    rating,
    reviewCount,
    sentimentP,
    freshnessF,
    phone: rec.phone,
    address: rec.address,
    placeId: rec.place_id || rec.google_place_id || rec.placeId || rec.googlePlaceId,
    instagramHandle: rec.instagram_handle || rec.instagramHandle,
    instagramUrl: rec.instagram_url || rec.instagramUrl,
  });
  const assessment = buildAssessment(rating, aiScore);
  return {
    sentiment_p: Math.round(sentimentP * 1000) / 1000,
    freshness_f: freshnessF,
    ai_score: aiScore,
    assessment_level: assessment.level,
    dim_reviews_score: dims.dim_reviews_score,
    dim_rating_score: dims.dim_rating_score,
    dim_sentiment_score: dims.dim_sentiment_score,
    dim_recency_score: dims.dim_recency_score,
    dim_local_seo_score: dims.dim_local_seo_score,
    dim_conversion_score: dims.dim_conversion_score,
  };
}

function ensureSlug(rawSlug, name, index) {
  const trimmed = String(rawSlug || "")
    .trim()
    .toLowerCase();
  if (trimmed && SLUG_RE.test(trimmed)) return trimmed;
  const base = String(name || "salon")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = String(index);
  const candidate = (base || "salon") + "-" + suffix;
  if (SLUG_RE.test(candidate)) return candidate;
  return "salon-" + suffix;
}

function normalizePlaceId(rec) {
  const a = String(rec.place_id || rec.placeId || "").trim();
  const b = String(rec.google_place_id || rec.googlePlaceId || "").trim();
  return a || b || "";
}

/**
 * Latest listed slug → ai_score from DB; empty map if view missing (new project).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @returns {Promise<Map<string, number>>}
 */
async function fetchLatestSlugAiScores(supabase) {
  const { data, error } = await supabase.from("salon_ai_leaderboard_latest").select("slug, ai_score");
  if (error) {
    throw createAppError(
      "LEADERBOARD_LATEST_READ_FAILED",
      error.message || "Could not read salon_ai_leaderboard_latest (run sql/021… if missing).",
      500,
    );
  }
  const map = new Map();
  const rows = data || [];
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const slug = String(r.slug || "").trim();
    if (!slug) continue;
    map.set(slug, Number(r.ai_score) || 0);
  }
  return map;
}

/**
 * Overwrite assessment_level on each insert row using cohort rank (latest ∪ this batch).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ slug?: string, ai_score?: number, assessment_level?: string }[]} rows
 */
async function applyGlobalPercentileAssessmentLevels(supabase, rows) {
  const merged = await fetchLatestSlugAiScores(supabase);
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const slug = String(r.slug || "").trim();
    if (!slug) continue;
    merged.set(slug, Number(r.ai_score) || 0);
  }
  for (let j = 0; j < rows.length; j += 1) {
    const r = rows[j];
    const slug = String(r.slug || "").trim();
    if (!slug) continue;
    r.assessment_level = resolveAssessmentLevelForSlug(merged, slug);
  }
}

/**
 * Map one source object to a row suitable for INSERT (no id).
 * @param {Record<string, unknown>} raw
 * @param {number} index
 */
function sourceRecordToInsertRow(raw, index) {
  const rec = raw && typeof raw === "object" ? raw : {};
  const name = String(rec.name || "").trim();
  if (!name) {
    throw createAppError("INGEST_INVALID_ROW", "Source row " + index + ": missing name", 400);
  }
  const slug = ensureSlug(rec.slug, name, index);
  const rating = Math.round(Math.min(5, Math.max(0, Number(rec.rating) || 0)) * 100) / 100;
  const reviewCount = Math.max(0, Math.floor(Number(rec.review_count ?? rec.reviewCount) || 0));
  const metrics = computeLeaderboardMetrics({
    rating,
    review_count: reviewCount,
    reviews: rec.reviews,
    star_histogram: rec.star_histogram || rec.starHistogram || rec.histogram,
  });
  const placeId = normalizePlaceId(rec);
  const now = new Date().toISOString();
  return {
    slug,
    name,
    address: String(rec.address || "").trim(),
    state: String(rec.state || "").trim(),
    county: String(rec.county || "").trim(),
    town: String(rec.town || "").trim(),
    zipcode: String(rec.zipcode || rec.zip || "").trim(),
    category: String(rec.category || "").trim(),
    rating,
    review_count: reviewCount,
    phone: String(rec.phone || "").trim(),
    sentiment_p: metrics.sentiment_p,
    freshness_f: metrics.freshness_f,
    ai_score: metrics.ai_score,
    assessment_level: metrics.assessment_level,
    dim_reviews_score: metrics.dim_reviews_score,
    dim_rating_score: metrics.dim_rating_score,
    dim_sentiment_score: metrics.dim_sentiment_score,
    dim_recency_score: metrics.dim_recency_score,
    dim_local_seo_score: metrics.dim_local_seo_score,
    dim_conversion_score: metrics.dim_conversion_score,
    place_id: placeId || null,
    google_place_id: placeId || null,
    is_listed: rec.is_listed === false || rec.isListed === false ? false : true,
    profile_updated_at: rec.profile_updated_at || rec.profileUpdatedAt || null,
    updated_at: now,
  };
}

/**
 * Insert new history rows (each run appends snapshots; latest per slug is read via view or RLS).
 * @param {Record<string, unknown>[]} records
 * @param {{ chunkSize?: number }} [options]
 */
async function ingestLeaderboardSourceRecords(records, options) {
  if (!Array.isArray(records) || records.length === 0) {
    throw createAppError("INGEST_EMPTY", "No records to ingest.", 400);
  }
  const chunkSize = options && options.chunkSize ? Math.min(500, Math.max(1, Math.floor(options.chunkSize))) : 100;
  const supabase = getSupabaseAdmin();
  const rows = records.map(function (raw, i) {
    return sourceRecordToInsertRow(raw, i);
  });
  await applyGlobalPercentileAssessmentLevels(supabase, rows);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("salon_ai_leaderboard").insert(chunk);
    if (error) {
      throw createAppError(
        "INGEST_INSERT_FAILED",
        error.message || "Insert failed (check slug format, run sql/021_leaderboard_slug_history_latest_view.sql if slug unique errors).",
        500,
      );
    }
    inserted += chunk.length;
  }
  return {
    inserted,
    slugs: rows.map(function (r) {
      return r.slug;
    }),
  };
}

module.exports = {
  applyGlobalPercentileAssessmentLevels,
  computeLeaderboardMetrics,
  ensureSlug,
  fetchLatestSlugAiScores,
  histogramFromRecord,
  ingestLeaderboardSourceRecords,
  sourceRecordToInsertRow,
};
