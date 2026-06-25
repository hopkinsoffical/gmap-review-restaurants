/**
 * Restaurant AI leaderboard scoring (restr_ai_leaderboard).
 *
 * Based on salon leaderboard-scoring.js with restaurant-specific Google Visibility
 * customer-acquisition emphasis:
 * - Rating band 3.5–5★ (restaurants cluster higher than salons)
 * - Review volume plateaus ~2,000 (vs ~900 for salons)
 * - Composite ai_score adds a visibility blend (local SEO + conversion dims) at 22%
 * - dim_local_seo_score: menu, hours, photos, categories, price, place_id
 * - dim_conversion_score: phone, reservations, delivery/takeout, menu URL
 *
 * Keep in sync: pipelines/restr_leaderboard_scoring.py
 */

const {
  assessmentLevelFromFractionFromTop,
  assignAssessmentLevelsByAiScorePercentile,
  freshnessHeuristic,
  resolveAssessmentLevelForSlug,
  sentimentFromReviewHistogram,
} = require("./leaderboard-scoring");

const VOLUME_PLATEAU = 2000;
const RATING_FLOOR = 3.5;

function clamp01(x, fallback) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function round1(v) {
  return Math.round(Math.min(100, Math.max(0, Number(v) || 0)) * 10) / 10;
}

/**
 * Restaurant Google Visibility composite 0–100.
 * @param {number} rating
 * @param {number} reviewCount
 * @param {number} sentimentP
 * @param {number} freshnessF
 * @param {number} [localSeoScore] 0–100
 * @param {number} [conversionScore] 0–100
 */
function calcRestrAiScore(rating, reviewCount, sentimentP, freshnessF, localSeoScore, conversionScore) {
  const r = Math.min(5, Math.max(1, Number(rating) || 0));
  const n = Math.max(0, Math.floor(Number(reviewCount) || 0));
  const pn = clamp01(sentimentP, 0.72);
  const fn = clamp01(freshnessF, 0.7);
  const localSeo = Math.min(100, Math.max(0, Number(localSeoScore) || 0));
  const conversion = Math.min(100, Math.max(0, Number(conversionScore) || 0));

  const ratingNorm = Math.min(1, Math.max(0, (r - RATING_FLOOR) / (5 - RATING_FLOOR)));
  const volumeNorm = Math.min(1, Math.log10(n + 1) / Math.log10(VOLUME_PLATEAU));
  const visibilityNorm = (localSeo * 0.55 + conversion * 0.45) / 100;

  const blend =
    ratingNorm * 0.24 +
    volumeNorm * 0.22 +
    pn * 0.16 +
    fn * 0.1 +
    visibilityNorm * 0.28;

  const conf = 1 - Math.exp(-n / 65);
  const prior = 0.5;
  const adjusted = prior + (blend - prior) * (0.34 + 0.66 * conf);
  const out = adjusted * 100;
  return Math.round(Math.min(100, Math.max(0, out)) * 10) / 10;
}

/**
 * Six dimension scores for restaurant Google Visibility.
 * @param {{
 *   rating?: number,
 *   reviewCount?: number,
 *   sentimentP?: number,
 *   freshnessF?: number,
 *   phone?: string,
 *   website?: string,
 *   address?: string,
 *   placeId?: string,
 *   menuUrl?: string,
 *   openingHours?: unknown,
 *   imageUrl?: string,
 *   categories?: unknown,
 *   price?: string,
 *   delivery?: boolean,
 *   takeout?: boolean,
 *   dineIn?: boolean,
 *   reservable?: boolean,
 * }} signals
 */
function restrDimensionScoresFromSignals(signals) {
  const s = signals || {};
  const rating = Number(s.rating) || 0;
  const reviewCount = Math.max(0, Math.floor(Number(s.reviewCount) || 0));
  const sentimentP = clamp01(s.sentimentP, 0.8);
  const freshnessF = clamp01(s.freshnessF, 0.75);
  const has = (v) => v !== null && v !== undefined && String(v).trim().length > 0;
  const hasHours =
    (Array.isArray(s.openingHours) && s.openingHours.length > 0) ||
    (s.openingHours && typeof s.openingHours === "object" && Object.keys(s.openingHours).length > 0);
  const hasCategories = Array.isArray(s.categories) ? s.categories.length > 0 : has(s.categories);

  const ratingScore = round1(Math.max(0, ((rating - RATING_FLOOR) / (5 - RATING_FLOOR)) * 100));
  const reviewScore = round1((Math.log10(reviewCount + 1) / Math.log10(VOLUME_PLATEAU)) * 100);
  const sentimentScore = round1(sentimentP * 100);
  const recencyScore = round1(freshnessF * 100);

  const localSeoScore = round1(
    (has(s.website) ? 14 : 0) +
      (has(s.menuUrl) ? 22 : 0) +
      (hasHours ? 16 : 0) +
      (has(s.imageUrl) ? 10 : 0) +
      (hasCategories ? 8 : 0) +
      (has(s.price) ? 10 : 0) +
      (has(s.address) ? 8 : 0) +
      (has(s.placeId) ? 12 : 0),
  );

  const conversionScore = round1(
    ratingScore * 0.18 +
      reviewScore * 0.14 +
      (has(s.phone) ? 22 : 0) +
      (has(s.menuUrl) ? 18 : 0) +
      (s.reservable ? 12 : 0) +
      (s.delivery || s.takeout ? 10 : 0) +
      (s.dineIn ? 6 : 0) +
      (has(s.placeId) ? 10 : 0),
  );

  return {
    dim_reviews_score: reviewScore,
    dim_rating_score: ratingScore,
    dim_sentiment_score: sentimentScore,
    dim_recency_score: recencyScore,
    dim_local_seo_score: localSeoScore,
    dim_conversion_score: conversionScore,
  };
}

module.exports = {
  RATING_FLOOR,
  VOLUME_PLATEAU,
  assessmentLevelFromFractionFromTop,
  assignAssessmentLevelsByAiScorePercentile,
  calcRestrAiScore,
  freshnessHeuristic,
  resolveAssessmentLevelForSlug,
  restrDimensionScoresFromSignals,
  sentimentFromReviewHistogram,
};
