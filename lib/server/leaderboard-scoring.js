/**
 * AI leaderboard scoring (salon_ai_leaderboard).
 *
 * Design goals (v2, 2026):
 * - Spread salons in the typical 4.2–4.9★ / tens–hundreds of reviews band instead of clustering near 90+.
 * - Treat review volume as evidence: few reviews → score pulled toward a neutral prior (Bayesian-style shrink).
 * - Sentiment_p from star histogram uses the sample mean star (continuous), not only coarse tiers.
 * - Freshness still rewards recent review timestamps when present; without dates, volume-only curve is slightly flatter.
 * - assessment_level is cohort-relative on latest listed rows: rank by ai_score
 *   (desc); fraction from the top → EXCELLENT (top 10%), GOOD (10–30%),
 *   MODERATE / “fair” (30–60%), LOW / “poor” (60–80%), RISKY / “critical” (80–100%).
 * - buildAssessment(rating, score) remains for legacy / tooling; live ingest & refresh use percentiles.
 *
 * Keep in sync: pipelines/leaderboard_scoring.py
 */

const { classifyStoreSignals, sumHistogram } = require("./store-map-report");

function clamp01(x, fallback) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

/**
 * Composite 0–100 AI index from Google-style signals.
 * @param {number} rating       Average stars (1–5)
 * @param {number} reviewCount  userRatingCount-style total
 * @param {number} sentimentP   0–1 reputation from reviews/histogram
 * @param {number} freshnessF   0–1 recency heuristic
 */
function calcAiScore(rating, reviewCount, sentimentP, freshnessF) {
  const r = Math.min(5, Math.max(1, Number(rating) || 0));
  const n = Math.max(0, Math.floor(Number(reviewCount) || 0));
  const pn = clamp01(sentimentP, 0.72);
  const fn = clamp01(freshnessF, 0.7);

  // 3★ → 0, 5★ → 1 (typical salons sit mid-band, not automatically ~0.9+)
  const ratingNorm = Math.min(1, Math.max(0, (r - 3) / 2));
  // Volume plateaus around ~900 reviews (log dampening)
  const volumeNorm = Math.min(1, Math.log10(n + 1) / Math.log10(900));

  const blend =
    ratingNorm * 0.31 + volumeNorm * 0.33 + pn * 0.22 + fn * 0.14;

  // Evidence: asymptotic confidence from count (~half weight at ~40 reviews, ~90% at ~120)
  const conf = 1 - Math.exp(-n / 52);
  const prior = 0.52;
  const adjusted = prior + (blend - prior) * (0.36 + 0.64 * conf);
  const out = adjusted * 100;
  return Math.round(Math.min(100, Math.max(0, out)) * 10) / 10;
}

/**
 * @param {number} frac 0 = best salon in cohort, 1 = worst (exclusive upper bands use k/n).
 * @returns {"EXCELLENT"|"GOOD"|"MODERATE"|"LOW"|"RISKY"}
 */
function assessmentLevelFromFractionFromTop(frac) {
  const f = Number(frac);
  if (!Number.isFinite(f) || f < 0) return "MODERATE";
  if (f < 0.1) return "EXCELLENT";
  if (f < 0.3) return "GOOD";
  if (f < 0.6) return "MODERATE";
  if (f < 0.8) return "LOW";
  return "RISKY";
}

/**
 * Assign assessment_level from ai_score rank within this array (best score first).
 * Mutates each row.assessment_level; rows need slug + ai_score (number).
 * @param {{ slug?: string, ai_score?: number, assessment_level?: string }[]} rows
 */
function assignAssessmentLevelsByAiScorePercentile(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const list = rows
    .map(function (r, i) {
      return {
        i,
        slug: String((r && r.slug) || ""),
        score: Number(r && r.ai_score) || 0,
      };
    })
    .filter(function (x) {
      return x.slug;
    });
  list.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.slug.localeCompare(b.slug);
  });
  const n = list.length;
  for (let k = 0; k < n; k += 1) {
    const frac = n === 1 ? 0 : k / n;
    rows[list[k].i].assessment_level = assessmentLevelFromFractionFromTop(frac);
  }
}

/**
 * mergedSlugToScore: slug -> ai_score (incoming row should overwrite same slug).
 * @param {Map<string, number>} mergedSlugToScore
 * @param {string} slug
 */
function resolveAssessmentLevelForSlug(mergedSlugToScore, slug) {
  const key = String(slug || "").trim();
  if (!key || !(mergedSlugToScore instanceof Map)) return "MODERATE";
  const entries = Array.from(mergedSlugToScore.entries()).sort(function (a, b) {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  const n = entries.length;
  for (let k = 0; k < n; k += 1) {
    if (entries[k][0] === key) {
      const frac = n === 1 ? 0 : k / n;
      return assessmentLevelFromFractionFromTop(frac);
    }
  }
  return "MODERATE";
}

/**
 * Risk / quality band from headline rating + composite score (v2 thresholds).
 * Prefer assessmentLevelFromFractionFromTop / assignAssessmentLevelsByAiScorePercentile for DB rows.
 */
function buildAssessment(rating, score) {
  const r = Number(rating) || 0;
  const s = Number(score) || 0;
  if (s >= 86 && r >= 4.71) {
    return {
      level: "EXCELLENT",
      emoji: "⭐",
      color: "#1A365D",
      light: "#EBF8FF",
      mid: "#4299E1",
      border: "#63B3ED",
    };
  }
  if (s >= 70 && r >= 4.36) {
    return {
      level: "GOOD",
      emoji: "🟢",
      color: "#276749",
      light: "#F0FFF4",
      mid: "#68D391",
      border: "#68D391",
    };
  }
  if (s >= 53 && r >= 3.98) {
    return {
      level: "MODERATE",
      emoji: "🟡",
      color: "#975A16",
      light: "#FFFFF0",
      mid: "#F6E05E",
      border: "#ECC94B",
    };
  }
  if (r < 4.0) {
    return {
      level: "LOW",
      emoji: "🟠",
      color: "#C05621",
      light: "#FFFAF0",
      mid: "#F6AD55",
      border: "#F6AD55",
    };
  }
  return {
    level: "RISKY",
    emoji: "🔴",
    color: "#C53030",
    light: "#FFF5F5",
    mid: "#FC8181",
    border: "#FC8181",
  };
}

/**
 * 0–1 sentiment from per-star histogram (or red-alert cap).
 */
function sentimentFromReviewHistogram(histogram, userRatingTotal) {
  const meta = { userRatingTotal: userRatingTotal, histogramIncomplete: true };
  const sig = classifyStoreSignals(histogram, meta);
  if (sig.redAlert) return 0.58;

  const hist = histogram && typeof histogram === "object" ? histogram : {};
  let total = 0;
  let wsum = 0;
  for (let star = 1; star <= 5; star += 1) {
    const c = Number(hist[star]) || 0;
    total += c;
    wsum += star * c;
  }
  if (total <= 0) return 0.8;

  const avgStar = wsum / total;
  const linear = (avgStar - 1) / 4;
  return Math.round(Math.min(0.98, Math.max(0.45, linear)) * 1000) / 1000;
}

function freshnessHeuristic(reviewCount, reviewsArray) {
  const n = Math.max(0, Number(reviewCount) || 0);
  let recent = 0;
  let total = 0;
  if (Array.isArray(reviewsArray)) {
    const now = Date.now();
    const maxAgeMs = 120 * 24 * 60 * 60 * 1000;
    reviewsArray.forEach(function (rv) {
      const pt = rv && (rv.publishTime || rv.publish_time);
      if (!pt) return;
      total += 1;
      const t = Date.parse(String(pt));
      if (Number.isFinite(t) && now - t <= maxAgeMs) recent += 1;
    });
  }
  if (total >= 3) {
    const ratio = recent / total;
    return Math.round((0.64 + ratio * 0.34) * 1000) / 1000;
  }
  return Math.round((0.58 + Math.min(1, n / 500) * 0.36) * 1000) / 1000;
}

module.exports = {
  assessmentLevelFromFractionFromTop,
  assignAssessmentLevelsByAiScorePercentile,
  buildAssessment,
  calcAiScore,
  freshnessHeuristic,
  resolveAssessmentLevelForSlug,
  sentimentFromReviewHistogram,
};
