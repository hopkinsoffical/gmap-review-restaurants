/**
 * Restaurant Service Prescription Engine
 *
 * Sits on top of restaurant-scoring.js.
 * Takes a scored restaurant → returns prioritised service recommendations
 * with score-lift estimates and sales copy.
 *
 * Services:
 *   review_booster    AI Review Booster (NFC / QR / AI assist)
 *   sms_booster       SMS Review Booster (post-visit SMS follow-up)
 *   front_desk        AI Front-Desk Agent (24/7 phone / lead capture)
 *   profile_opt       Google Profile Optimisation
 *   website           Website Design & Conversion
 *   social_media      Social Media Operation
 */

"use strict";

const { assessmentLevel } = require("./restaurant-scoring");

// ─── Service catalogue ────────────────────────────────────────────────────────
// Each service declares:
//   id, name, tagline
//   impacts: { dimKey: maxLift }   — max points this service can add to that dim (0-100 scale)
//   tier / pricingHint
//   ctaLabel, ctaPath

const SERVICES = {
  review_booster: {
    id:       "review_booster",
    name:     "AI Review Booster",
    tagline:  "Turn happy diners into 5-star Google reviews — automatically.",
    impacts:  { D2: 40, D1: 20, D3: 20 },   // volume, rating, sentiment
    tier:     1,
    pricing:  "Starting $29/yr",
    cta:      "Start getting more reviews →",
    path:     "/ai-review-generator.html",
    whyLine:  (dims) => {
      if (dims.D2 < 50) return `Only ${Math.round(dims.D2)}% review volume score — more reviews directly boost your ranking.`;
      if (dims.D1 < 55) return `${Math.round(dims.D1)}% rating score — fresh 5-star reviews lift your Google position.`;
      return "Consistent new reviews keep your profile algorithm-fresh.";
    },
  },

  sms_booster: {
    id:       "sms_booster",
    name:     "SMS Review Booster",
    tagline:  "Automated post-visit texts that turn diners into reviewers.",
    impacts:  { D3: 25, D2: 25, D9: 10 },   // sentiment, volume, conversion
    tier:     1,
    pricing:  "Starting $49/mo",
    cta:      "Automate your review follow-up →",
    path:     "/ai-sms-review-booster.html",
    whyLine:  (dims) => {
      if (dims.D3 < 60) return `Sentiment score ${Math.round(dims.D3)}% — negative reviews dominate; SMS follow-up captures positives before they slip away.`;
      return "High SMS open rates (98%) make it the fastest way to build review velocity.";
    },
  },

  front_desk: {
    id:       "front_desk",
    name:     "AI Front-Desk Agent",
    tagline:  "24/7 AI phone agent — capture every reservation, never miss a lead.",
    impacts:  { D9: 45, D6: 20 },            // conversion, service breadth
    tier:     3,
    pricing:  "Starting $99/yr",
    cta:      "Add a 24/7 AI receptionist →",
    path:     "/ai-front-desk.html",
    whyLine:  (dims) => {
      if (dims.D9 < 50) return `Conversion readiness only ${Math.round(dims.D9)}% — missed calls = missed revenue. AI Front-Desk answers every time.`;
      if (dims.D6 < 60) return "Limited service breadth; AI Front-Desk adds reservation-taking to your offerings instantly.";
      return "Turn every unanswered call into a confirmed booking.";
    },
  },

  profile_opt: {
    id:       "profile_opt",
    name:     "Google Profile Optimisation",
    tagline:  "Fully optimised Google Business Profile — be found before competitors.",
    impacts:  { D5: 35, D6: 20, D8: 15 },   // profile completeness, service breadth, ops
    tier:     1,
    pricing:  "One-time setup",
    cta:      "Optimise your Google profile →",
    path:     "/services.html#profile",
    whyLine:  (dims) => {
      if (dims.D5 < 70) return `Profile completeness ${Math.round(dims.D5)}% — missing menu, hours, or photos cost you clicks every day.`;
      if (dims.D8 < 80) return "Incomplete operational info makes Google rank you lower in local results.";
      return "A complete, keyword-rich profile is the #1 factor in local map pack ranking.";
    },
  },

  website: {
    id:       "website",
    name:     "Website Design & Conversion",
    tagline:  "A high-converting restaurant website that turns visitors into diners.",
    impacts:  { D5: 20, D9: 35, D7: 20 },   // profile, conversion, value perception
    tier:     4,
    pricing:  "Custom quote",
    cta:      "Get a conversion-optimised website →",
    path:     "/conversion-accelerator.html",
    whyLine:  (dims) => {
      if (dims.D9 < 55) return `Conversion score ${Math.round(dims.D9)}% — no website means diners can't book online. You're losing to competitors who have one.`;
      if (dims.D7 < 50) return "A strong website justifies your pricing and positions you as the premium choice in the area.";
      return "Restaurants with optimised websites convert 3× more online visitors into reservations.";
    },
  },

  social_media: {
    id:       "social_media",
    name:     "Social Media Operation",
    tagline:  "Consistent content that builds a loyal local audience and drives walk-ins.",
    impacts:  { D1: 12, D2: 18, D7: 25 },   // rating (brand trust), volume (discovery), value
    tier:     2,
    pricing:  "$699–$1,499/mo",
    cta:      "Grow your social presence →",
    path:     "/social-media-growth-engine.html",
    whyLine:  (dims) => {
      if (dims.D7 < 50) return `Value score ${Math.round(dims.D7)}% — social proof on Instagram/TikTok directly raises perceived value and justifies premium pricing.`;
      if (dims.D1 < 55) return "Active social content drives new customers who leave first-time reviews.";
      return "Restaurants with active social accounts see 20-35% more new-customer foot traffic.";
    },
  },
};

// Dimension labels for human-readable output
const DIM_LABELS = {
  D1: "星级口碑", D2: "评价量级", D3: "情感评分",
  D4: "食品安全", D5: "资料完整度", D6: "服务广度",
  D7: "价值定位", D8: "运营活跃", D9: "转化就绪",
};

const WEIGHTS = {
  D1: 0.20, D2: 0.15, D3: 0.15, D4: 0.15, D5: 0.12,
  D6: 0.10, D7: 0.08, D8: 0.03, D9: 0.02,
};

// ─── Prescription engine ──────────────────────────────────────────────────────

/**
 * For a scored restaurant, return prioritised service recommendations.
 *
 * @param {object} scored   output of scoreRestaurant()  (includes dim_* fields)
 * @param {number} maxRecs  max recommendations to return (default 3)
 * @returns {object}  { score, level, gap, recommendations[] }
 */
function prescribe(scored, maxRecs = 3) {
  // normalise dim keys
  const dims = {
    D1: scored.dim_rating_score,
    D2: scored.dim_volume_score,
    D3: scored.dim_sentiment_score,
    D4: scored.dim_food_safety_score,
    D5: scored.dim_profile_score,
    D6: scored.dim_service_score,
    D7: scored.dim_value_score,
    D8: scored.dim_ops_score,
    D9: scored.dim_conversion_score,
  };

  // ── 1. Score each service by "impact × gap" priority ──────────────────────
  const ranked = Object.values(SERVICES).map((svc) => {
    // weighted lift: for each dim the service improves, how much gap exists?
    let liftScore = 0;
    let totalLift = 0;          // raw composite-score points we could add

    for (const [dimKey, maxLift] of Object.entries(svc.impacts)) {
      const current   = dims[dimKey] ?? 50;
      const gap       = Math.max(0, 100 - current);       // headroom
      const achievable = Math.min(maxLift, gap);           // can't exceed gap
      const w         = WEIGHTS[dimKey] ?? 0;

      liftScore  += achievable * w;                        // weighted priority
      totalLift  += achievable * w;
    }

    // composite score improvement estimate (same Bayesian formula, approximated)
    const currentBlend = scored.restaurant_score;
    const n    = scored.review_count ?? 0;
    const conf = 1 - Math.exp(-n / 80);
    const factor = 0.30 + 0.70 * conf;
    const scoreLift = Math.round(totalLift * factor * 10) / 10;

    return {
      ...svc,
      liftScore,
      scoreLift,             // estimated composite score gain
      affectedDims: Object.entries(svc.impacts)
        .filter(([k]) => (dims[k] ?? 50) < 80)            // only mention weak dims
        .map(([k, lift]) => ({
          key:     k,
          label:   DIM_LABELS[k],
          current: Math.round(dims[k] ?? 50),
          lift:    Math.min(lift, Math.max(0, 100 - (dims[k] ?? 50))),
        }))
        .sort((a, b) => b.lift - a.lift),
      whyLine: svc.whyLine(dims),
    };
  });

  // Sort: skip food-safety D4 (not addressable by our services)
  ranked.sort((a, b) => b.liftScore - a.liftScore);

  const recommendations = ranked.slice(0, maxRecs).map((svc, idx) => ({
    rank:          idx + 1,
    id:            svc.id,
    name:          svc.name,
    tagline:       svc.tagline,
    whyLine:       svc.whyLine,
    pricing:       svc.pricing,
    cta:           svc.cta,
    path:          svc.path,
    scoreLift:     svc.scoreLift,
    affectedDims:  svc.affectedDims,
  }));

  // ── 2. Identify the single weakest addressable dimension ─────────────────
  const weakest = Object.entries(dims)
    .filter(([k]) => k !== "D4")                           // food safety = external
    .sort(([, a], [, b]) => a - b)[0];

  const [weakKey, weakVal] = weakest;

  return {
    restaurant_score: scored.restaurant_score,
    assessment_level: scored.assessment_level,
    rating:           scored.rating,
    review_count:     scored.review_count,
    // biggest single gap
    primary_gap: {
      dim:     weakKey,
      label:   DIM_LABELS[weakKey],
      score:   Math.round(weakVal),
    },
    // max potential score if all recommended services applied
    score_ceiling: Math.min(100,
      Math.round(scored.restaurant_score +
        ranked.slice(0, maxRecs).reduce((s, r) => s + r.scoreLift, 0))),
    recommendations,
  };
}

// ─── Batch prescription for leaderboard enrichment ───────────────────────────

function enrichLeaderboard(scoredRows) {
  return scoredRows.map((row) => ({
    ...row,
    prescription: prescribe(row, 3),
  }));
}

module.exports = { prescribe, enrichLeaderboard, SERVICES, DIM_LABELS };
