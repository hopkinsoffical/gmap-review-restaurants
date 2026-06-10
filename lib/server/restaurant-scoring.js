/**
 * Restaurant Diagnostic Score — 9-indicator model
 *
 * Composite restaurant_score: 0–100  (Bayesian-adjusted)
 * Assessment levels (cohort-relative percentile bands):
 *   EXCELLENT  top 10%   (frac < 0.10)
 *   GOOD       10–30%    (frac < 0.30)
 *   MODERATE   30–60%    (frac < 0.60)
 *   LOW        60–80%    (frac < 0.80)
 *   RISKY      bottom 20%
 *
 * Indicator weights  (must sum to 1.00):
 *   D1  口碑星级  Rating Quality       0.20
 *   D2  评价量级  Review Volume        0.15
 *   D3  口碑情感  Review Sentiment     0.15
 *   D4  食品安全  Food Safety          0.15  ← restaurant-exclusive (DOH grade)
 *   D5  信息完整度 Profile Completeness 0.12
 *   D6  服务广度  Service Breadth      0.10
 *   D7  价值定位  Price-Value Ratio    0.08
 *   D8  运营活跃  Operational Activity  0.03
 *   D9  转化就绪  Conversion Readiness  0.02
 */

"use strict";

// ─── helpers ──────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Number(v) || 0));
}

function round1(v) {
  return Math.round(clamp(v, 0, 100) * 10) / 10;
}

// ─── D1  口碑星级  Rating Quality (0–100) ─────────────────────────────────────
// Restaurant ratings cluster 3.5–5.0; map that band to 0–100.
// Below 3.5 → 0, 5.0 → 100.
function ratingScore(rating) {
  const r = clamp(rating, 1, 5);
  return round1(Math.max(0, (r - 3.5) / 1.5) * 100);
}

// ─── D2  评价量级  Review Volume (0–100) ──────────────────────────────────────
// Restaurants plateau higher than salons (~2 000 reviews).
// log10(n+1) / log10(2000) gives ~50 at 44 reviews, ~75 at 316, ~100 at 2000.
const VOLUME_PLATEAU = 2000;
function volumeScore(reviewCount) {
  const n = Math.max(0, Math.floor(Number(reviewCount) || 0));
  return round1((Math.log10(n + 1) / Math.log10(VOLUME_PLATEAU)) * 100);
}

// ─── D3  口碑情感  Review Sentiment (0–100) ───────────────────────────────────
// Uses star-histogram if available; falls back to headline rating.
// Red-alert: ≥1 one-star → cap at 60; ≥3 one-stars → cap at 45.
function sentimentScore(reviewsDistribution, rating) {
  const dist = reviewsDistribution && typeof reviewsDistribution === "object"
    ? reviewsDistribution : {};
  const one   = Number(dist.oneStar)   || 0;
  const two   = Number(dist.twoStar)   || 0;
  const three = Number(dist.threeStar) || 0;
  const four  = Number(dist.fourStar)  || 0;
  const five  = Number(dist.fiveStar)  || 0;
  const total = one + two + three + four + five;

  let raw;
  if (total > 0) {
    const avgStar = (one + two * 2 + three * 3 + four * 4 + five * 5) / total;
    raw = ((avgStar - 1) / 4) * 100;                // 1★→0, 5★→100
  } else {
    // fallback from headline rating
    const r = clamp(rating || 0, 1, 5);
    raw = ((r - 1) / 4) * 100;
  }

  // Red-alert caps
  if (one >= 3) raw = Math.min(raw, 45);
  else if (one >= 1) raw = Math.min(raw, 60);

  return round1(clamp(raw, 0, 100));
}

// ─── D4  食品安全  Food Safety (0–100) ────────────────────────────────────────
// Restaurant-exclusive: NYC DOH inspection grade + numeric score.
// Grade baseline: A=100, B=70, C=40, Z/N/pending=50
// Penalty: each point of DOH score above 13 (A threshold) deducts 0.8 pts.
// Null grade → neutral 50.
function foodSafetyScore(latestGrade, latestScore) {
  const gradeBase = { A: 100, B: 70, C: 40, Z: 50, N: 50 };
  const base = gradeBase[String(latestGrade || "").toUpperCase()] ?? 50;

  // Inspection score: 0–13 = A territory, 14–27 = B, 28+ = C
  // Reward scores below median (11) and penalise above A threshold (13).
  const doh = Number(latestScore);
  let penalty = 0;
  if (Number.isFinite(doh) && doh > 0) {
    penalty = Math.max(0, doh - 13) * 0.8;
  }
  return round1(clamp(base - penalty, 0, 100));
}

// ─── D5  信息完整度  Profile Completeness (0–100) ─────────────────────────────
// 7 signals with unequal weights (total 100).
//   menu_url   22   (diners decide on the menu)
//   phone      18   (direct contact)
//   website    16
//   opening_hours 16
//   price      14   (helps diners plan)
//   categories 8    (discovery)
//   image_url  6    (visual trust)
function profileScore(p) {
  const has = (v) => v !== null && v !== undefined && String(v).trim().length > 0;
  return round1(
    (has(p.bestMenuUrl || p.best_menu_url)  ? 22 : 0) +
    (has(p.phone)                           ? 18 : 0) +
    (has(p.website)                         ? 16 : 0) +
    (has(p.openingHours || p.opening_hours) ? 16 : 0) +
    (has(p.price)                           ? 14 : 0) +
    (has(p.categories) && (p.categories?.length || 0) > 0 ? 8 : 0) +
    (has(p.imageUrl || p.image_url)         ?  6 : 0)
  );
}

// ─── D6  服务广度  Service Breadth (0–100) ────────────────────────────────────
// 5 service options; each adds to score.
// Weights reflect diner importance: Delivery 25, Takeout 20, Dine-in 25,
// Table service 15, Reservation 15.
function serviceScore(additionalInfo) {
  const ai = additionalInfo && typeof additionalInfo === "object" ? additionalInfo : {};

  function flag(section, key) {
    const items = Array.isArray(ai[section]) ? ai[section] : [];
    for (const item of items) {
      if (item && typeof item === "object" && key in item) return item[key] === true;
    }
    return null; // not mentioned
  }

  const delivery    = flag("Service options", "Delivery");
  const takeout     = flag("Service options", "Takeout");
  const dineIn      = flag("Service options", "Dine-in");
  const tableSvc    = flag("Dining options",  "Table service");
  const reservation = flag("Planning",        "Accepts reservations") ??
                      flag("Planning",        "Reservations recommended");

  let score = 0;
  if (delivery    !== false) score += delivery    === true ? 25 : 12;  // absent = neutral half
  if (takeout     !== false) score += takeout     === true ? 20 : 10;
  if (dineIn      !== false) score += dineIn      === true ? 25 : 12;
  if (tableSvc    !== false) score += tableSvc    === true ? 15 :  7;
  if (reservation !== false) score += reservation === true ? 15 :  7;

  return round1(clamp(score, 0, 100));
}

// ─── D7  价值定位  Price-Value Ratio (0–100) ──────────────────────────────────
// Maps price tier + star rating to a "value perception" index.
// Formula: value = ratingScore × priceMultiplier
//   $     1.20  (cheap + high rating = great value)
//   $$    1.00
//   $$$   0.80  (premium needs justification)
//   $$$$  0.65
// Raw strings like "$10–20" → treated as $, "$20–60" → $$, "$30–100" → $$$ etc.
function valueScore(price, rating) {
  const rScore = ratingScore(rating) / 100;  // 0–1

  const p = String(price || "").trim();
  let mult = 1.0;
  if      (p === "$" || /^\$1/.test(p) || p === "$1–10") mult = 1.20;
  else if (p === "$$" || /^\$1[0-9]/.test(p))            mult = 1.00;
  else if (p === "$$$" || /^\$[23][0-9]/.test(p))        mult = 0.80;
  else if (p === "$$$$" || /^\$[4-9]/.test(p) || /^\$1[0-9]{2}/.test(p)) mult = 0.65;

  return round1(clamp(rScore * mult * 100, 0, 100));
}

// ─── D8  运营活跃  Operational Activity (0–100) ───────────────────────────────
// Checks the restaurant is still operating and discoverable.
//   Not permanently closed  40
//   Not temporarily closed  30
//   Has opening hours       20
//   Has popular times data  10
function opsScore(p) {
  if (p.permanentlyClosed || p.permanently_closed) return 0;
  let score = 40;
  if (!(p.temporarilyClosed || p.temporarily_closed)) score += 30;
  const hasHours = p.openingHours || p.opening_hours;
  if (hasHours && (Array.isArray(hasHours) ? hasHours.length > 0 : true)) score += 20;
  const pt = p.popularTimesHistogram || p.popular_times_histogram;
  if (pt && typeof pt === "object" && Object.keys(pt).length > 0) score += 10;
  return round1(clamp(score, 0, 100));
}

// ─── D9  转化就绪  Conversion Readiness (0–100) ───────────────────────────────
// Three direct-action signals: phone (50), menu (30), reservation (20).
function conversionScore(p) {
  const has = (v) => v !== null && v !== undefined && String(v).trim().length > 0;
  return round1(
    (has(p.phone)                                ? 50 : 0) +
    (has(p.bestMenuUrl || p.best_menu_url)       ? 30 : 0) +
    (has(p.reserveTableUrl || p.reserve_table_url) ? 20 : 0)
  );
}

// ─── Composite restaurant_score ───────────────────────────────────────────────
// Weights:  D1 0.20 · D2 0.15 · D3 0.15 · D4 0.15 · D5 0.12
//           D6 0.10 · D7 0.08 · D8 0.03 · D9 0.02
//
// Bayesian adjustment — same pattern as salon model:
//   conf  = 1 − exp(−reviewCount / 80)   # 50% at ~55 reviews, 90% at ~184
//   prior = 0.50
//   score = (prior + (blend/100 − prior) × (0.30 + 0.70 × conf)) × 100
const WEIGHTS = {
  D1: 0.20, D2: 0.15, D3: 0.15, D4: 0.15, D5: 0.12,
  D6: 0.10, D7: 0.08, D8: 0.03, D9: 0.02,
};

function calcRestaurantScore(dims, reviewCount) {
  const blend =
    dims.D1 * WEIGHTS.D1 + dims.D2 * WEIGHTS.D2 + dims.D3 * WEIGHTS.D3 +
    dims.D4 * WEIGHTS.D4 + dims.D5 * WEIGHTS.D5 + dims.D6 * WEIGHTS.D6 +
    dims.D7 * WEIGHTS.D7 + dims.D8 * WEIGHTS.D8 + dims.D9 * WEIGHTS.D9;

  const n    = Math.max(0, Math.floor(Number(reviewCount) || 0));
  const conf = 1 - Math.exp(-n / 80);
  const prior = 0.50;
  const adjusted = prior + (blend / 100 - prior) * (0.30 + 0.70 * conf);

  return Math.round(clamp(adjusted * 100, 0, 100) * 10) / 10;
}

// ─── Assessment level (cohort-relative) ───────────────────────────────────────
// frac = rank / total, sorted desc by restaurant_score.
function assessmentLevel(fracFromTop) {
  const f = Number(fracFromTop);
  if (!Number.isFinite(f) || f < 0) return "MODERATE";
  if (f < 0.10) return "EXCELLENT";
  if (f < 0.30) return "GOOD";
  if (f < 0.60) return "MODERATE";
  if (f < 0.80) return "LOW";
  return "RISKY";
}

// ─── Main entry: score one restaurant ─────────────────────────────────────────
/**
 * @param {object} restaurant  row from info_gather_restaurants / restaurant_info_gather
 * @param {object} profile     row from info_gather_google_profiles / restaurant_google_profiles
 * @returns {object} all dimension scores + restaurant_score (ready to upsert)
 */
function scoreRestaurant(restaurant, profile) {
  const p = profile || {};
  const r = restaurant || {};

  const D1 = ratingScore(p.rating);
  const D2 = volumeScore(p.reviews_count ?? p.reviewCount);
  const D3 = sentimentScore(p.reviews_distribution ?? p.reviewsDistribution, p.rating);
  const D4 = foodSafetyScore(r.latest_grade, r.latest_score);
  const D5 = profileScore(p);
  const D6 = serviceScore(p.additional_info ?? p.additionalInfo);
  const D7 = valueScore(p.price, p.rating);
  const D8 = opsScore(p);
  const D9 = conversionScore(p);

  const dims = { D1, D2, D3, D4, D5, D6, D7, D8, D9 };
  const restaurantScore = calcRestaurantScore(dims, p.reviews_count ?? p.reviewCount ?? 0);

  return {
    restaurant_id:       p.restaurant_id ?? r.id,
    camis:               p.camis ?? r.camis,
    place_id:            p.place_id,
    rating:              p.rating,
    review_count:        p.reviews_count ?? p.reviewCount ?? 0,
    latest_grade:        r.latest_grade,
    latest_score:        r.latest_score,
    dim_rating_score:    D1,
    dim_volume_score:    D2,
    dim_sentiment_score: D3,
    dim_food_safety_score: D4,
    dim_profile_score:   D5,
    dim_service_score:   D6,
    dim_value_score:     D7,
    dim_ops_score:       D8,
    dim_conversion_score: D9,
    restaurant_score:    restaurantScore,
    match_confidence:    p.match_confidence,
    match_status:        p.match_status,
    scored_at:           new Date().toISOString(),
  };
}

module.exports = {
  ratingScore, volumeScore, sentimentScore, foodSafetyScore,
  profileScore, serviceScore, valueScore, opsScore, conversionScore,
  calcRestaurantScore, assessmentLevel, scoreRestaurant,
  WEIGHTS,
};
