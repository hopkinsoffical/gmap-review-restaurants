/**
 * Competitor ranking and reputation signals for Google Maps salon reports.
 * Ranking formula and alert rules are centralized here for reuse (HTTP tool, voice agent, etc.).
 */

const { createAppError } = require("./shared");

/** Default: balances average rating with review volume (log dampens huge counts). */
function computeRankScore(rating, userRatingCount) {
  const r = Number(rating) || 0;
  const n = Math.max(0, Number(userRatingCount) || 0);
  return Math.round(r * Math.log1p(n) * 1000) / 1000;
}

function emptyHistogram() {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

function sumHistogram(h) {
  const hist = h && typeof h === "object" ? h : emptyHistogram();
  let s = 0;
  for (let star = 1; star <= 5; star += 1) {
    s += Number(hist[star]) || 0;
  }
  return s;
}

function countStarsFromReviewList(reviews) {
  const hist = emptyHistogram();
  if (!Array.isArray(reviews)) {
    return hist;
  }
  for (let i = 0; i < reviews.length; i += 1) {
    const rating = Number(reviews[i] && reviews[i].rating);
    if (!Number.isFinite(rating)) continue;
    const rounded = Math.round(rating);
    if (rounded >= 1 && rounded <= 5) {
      hist[rounded] += 1;
    }
  }
  return hist;
}

/**
 * Classify reputation using star histogram (full or sample).
 * Alert priority (highest first):
 * - 3+ one-star → high_risk (红色 alert level 3)
 * - 2 one-star → risky
 * - 1 one-star → one_star_warning (红色 alert level 2)
 * - any two-star (when no one-star) → low
 * - otherwise quality: excellent / good / moderate from minimum star present
 */
function classifyStoreSignals(histogram, meta) {
  const hist = Object.assign(emptyHistogram(), histogram || {});
  const c1 = Number(hist[1]) || 0;
  const c2 = Number(hist[2]) || 0;
  const total = sumHistogram(hist);
  const incomplete = Boolean(meta && meta.histogramIncomplete);
  const totalOnGoogle =
    meta && meta.userRatingTotal != null ? Number(meta.userRatingTotal) : null;

  const base = {
    starHistogram: hist,
    totalStarsInHistogram: total,
    userRatingTotalOnGoogle: Number.isFinite(totalOnGoogle) ? totalOnGoogle : null,
    histogramIncomplete: incomplete,
    qualityTier: null,
    redAlert: false,
    alert: null,
    alertLevel: 0,
  };

  if (total === 0) {
    base.qualityTier = "unknown";
    base.summaryZh = "暂无可用星级分布数据";
    base.notes =
      "No per-star data in this histogram. Provide starHistogramOverride or ensure Places returns reviews.";
    return base;
  }

  if (c1 >= 3) {
    return Object.assign(base, {
      redAlert: true,
      alert: "high_risk",
      alertLevel: 3,
      qualityTier: "alert",
      summaryZh: "高风险：存在三个或以上一星评价（红色告警三级）",
    });
  }
  if (c1 === 2) {
    return Object.assign(base, {
      redAlert: true,
      alert: "risky",
      alertLevel: 2,
      qualityTier: "alert",
      summaryZh: "风险：存在两个一星评价（红色告警）",
    });
  }
  if (c1 === 1) {
    return Object.assign(base, {
      redAlert: true,
      alert: "one_star_warning",
      alertLevel: 2,
      qualityTier: "alert",
      summaryZh: "预警：存在一个一星评价（红色告警二级）",
    });
  }
  if (c2 >= 1) {
    return Object.assign(base, {
      redAlert: true,
      alert: "low",
      alertLevel: 1,
      qualityTier: "alert",
      summaryZh: "偏低：存在二星评价（红色告警一级）",
    });
  }

  const present = [];
  for (let s = 1; s <= 5; s += 1) {
    if ((Number(hist[s]) || 0) > 0) present.push(s);
  }
  const minStar = Math.min.apply(null, present);
  const maxStar = Math.max.apply(null, present);

  let qualityTier = "mixed";
  if (minStar === 5 && maxStar === 5) qualityTier = "excellent";
  else if (minStar >= 4) qualityTier = "good";
  else if (minStar >= 3) qualityTier = "moderate";

  const out = Object.assign(base, {
    qualityTier: qualityTier,
    redAlert: false,
    alert: null,
    alertLevel: 0,
  });

  out.summaryZh = qualityTierZh(qualityTier);

  if (incomplete && totalOnGoogle != null && totalOnGoogle > total) {
    out.notes =
      "Quality tier reflects only the star histogram you supplied (often a sample). " +
      "Total reviews on Google is higher; connect GBP or pass starHistogramOverride for full counts.";
  }

  return out;
}

function qualityTierZh(tier) {
  const map = {
    excellent: "全部为五星评价",
    good: "全部四星及以上",
    moderate: "全部三星及以上",
    mixed: "星级分布较混合（已排除一二星告警后仍非纯好评结构）",
    unknown: "暂无足够星级分布数据",
    alert: null,
  };
  return map[tier] != null ? map[tier] : tier;
}

function normalizeHistogramInput(raw) {
  if (!raw || typeof raw !== "object") return null;
  const hist = emptyHistogram();
  let any = false;
  for (let s = 1; s <= 5; s += 1) {
    const k = String(s);
    const v = raw[k] != null ? raw[k] : raw[s];
    if (v != null && v !== "") {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) {
        hist[s] = Math.floor(n);
        any = true;
      }
    }
  }
  return any ? hist : null;
}

function assertSecret(req, secret) {
  if (!secret) return;
  const auth = req && req.headers ? req.headers.authorization : "";
  const header = req && req.headers ? req.headers["x-tool-secret"] : "";
  const bearer = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const got = bearer || (typeof header === "string" ? header.trim() : "");
  if (got !== secret) {
    throw createAppError("UNAUTHORIZED", "Invalid or missing tool secret", 401);
  }
}

module.exports = {
  assertSecret,
  classifyStoreSignals,
  computeRankScore,
  countStarsFromReviewList,
  emptyHistogram,
  normalizeHistogramInput,
  sumHistogram,
};
