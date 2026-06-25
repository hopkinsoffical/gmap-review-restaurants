/**
 * Restaurant brief report scoring — ported from report_update_files/buildReportData.ts
 */

const DEFAULT_SERVICES = [
  { name: "Dine-in service", search_volume: 72, competition: 48 },
  { name: "Takeout & pickup", search_volume: 65, competition: 55 },
  { name: "Food delivery", search_volume: 58, competition: 52 },
  { name: "Catering & events", search_volume: 44, competition: 38 },
  { name: "Lunch specials", search_volume: 36, competition: 42 },
];

function scoreReviewQuality(place) {
  const ratingScore = Math.min((place.rating / 5) * 100, 100);
  const velocity = Math.min((place.reviewCount / 200) * 100, 100);
  const negCount = (place.oneStarCount || 0) + (place.twoStarCount || 0);
  const negRatio = place.reviewCount > 0 ? negCount / place.reviewCount : 0;
  const negPenalty = negRatio * 40;
  return Math.round(Math.max(0, ratingScore * 0.5 + velocity * 0.3 - negPenalty + 20));
}

function scoreProfileCompleteness(place) {
  let score = 0;
  if (place.website) score += 25;
  if (place.hasOnlineBooking) score += 25;
  if (place.phone) score += 15;
  if (place.address) score += 10;
  if (place.businessStatus === "OPERATIONAL") score += 10;
  score += Math.min((place.photoCount / 20) * 15, 15);
  return Math.min(Math.round(score), 100);
}

function scorePhotoEngagement(place) {
  return Math.round(Math.min((place.photoCount / 50) * 100, 100));
}

function scoreLocalSEO(row, place) {
  const websiteBonus = place.website ? 10 : 0;
  return Math.min(Math.round(row.keyword_match_score * 0.6 + row.citation_score * 0.4 + websiteBonus), 100);
}

function scoreBookingConversion(place) {
  let score = 55;
  if (place.hasOnlineBooking) score += 30;
  if (place.website) score += 15;
  return Math.min(score, 100);
}

function computeOverallScore(items) {
  const weights = {
    review_quality: 0.3,
    profile_completeness: 0.2,
    photo_engagement: 0.15,
    local_seo: 0.25,
    booking_conversion: 0.1,
  };
  return Math.round(
    items.reduce(function (sum, item) {
      return sum + item.score * (weights[item.key] || 0);
    }, 0),
  );
}

function overallLabel(score) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "Urgent Action Needed";
}

function overallSummary(score, name) {
  if (score >= 80) return name + " is performing well — a few more optimizations could push you to #1.";
  if (score >= 65) return name + " has a solid presence but is leaving new clients on the table every month.";
  if (score >= 50) return name + "'s Google Maps presence has significant gaps costing you new clients every month.";
  return name + " is nearly invisible on Google Maps. Urgent action is needed to compete locally.";
}

function countIssues(items) {
  return {
    critical: items.filter(function (i) {
      return i.score < 50;
    }).length,
    quickWins: items.filter(function (i) {
      return i.score >= 50 && i.score < 75;
    }).length,
  };
}

function mapServicePotential(services) {
  return services.slice(0, 5).map(function (svc) {
    const score = svc.search_volume / Math.max(svc.competition, 1);
    const level = score > 70 ? "high" : score > 30 ? "medium" : "low";
    return { name: svc.name, level: level };
  });
}

function getScoreLabel(score) {
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  return "Weak";
}

function getScoreColor(score) {
  if (score >= 75) return "#0F6E56";
  if (score >= 50) return "#BA7517";
  return "#A32D2D";
}

function getPotentialLabel(level) {
  if (level === "high") return "High potential";
  if (level === "medium") return "Medium potential";
  return "Competitive";
}

/**
 * @param {object} row — store DB row + computed fields
 * @param {object} place — PlaceApiData from fetch-place-data
 */
function buildReportData(row, place) {
  const scoreItems = [
    {
      key: "review_quality",
      label: "Review quality & velocity",
      icon: "star",
      score: scoreReviewQuality(place),
    },
    {
      key: "profile_completeness",
      label: "Profile completeness",
      icon: "list-check",
      score: scoreProfileCompleteness(place),
    },
    {
      key: "photo_engagement",
      label: "Photo engagement",
      icon: "photo",
      score: scorePhotoEngagement(place),
    },
    {
      key: "local_seo",
      label: "Local SEO signals",
      icon: "map-2",
      score: scoreLocalSEO(row, place),
    },
    {
      key: "booking_conversion",
      label: "Booking conversion",
      icon: "device-mobile",
      score: scoreBookingConversion(place),
    },
  ];

  const overallScore = computeOverallScore(scoreItems);
  const issues = countIssues(scoreItems);
  const businessName = String(row.name || place.name || row.slug || "").trim();
  const locationCity = String(row.city || "").trim() || "Local";
  const locationState = String(row.state || "").trim();

  return {
    id: String(row.id),
    slug: row.slug,
    businessName: businessName,
    location: locationState ? locationCity + ", " + locationState : locationCity,
    category: row.category,
    generatedAt: place.fetchedAt,
    rating: place.rating,
    reviewCount: place.reviewCount,
    photoCount: place.photoCount,
    website: place.website,
    bookingUrl: place.bookingUrl,
    hasOnlineBooking: place.hasOnlineBooking,
    oneStarCount: place.oneStarCount,
    twoStarCount: place.twoStarCount,
    localRank: row.local_rank,
    overallScore: overallScore,
    overallLabel: overallLabel(overallScore),
    overallSummary: overallSummary(overallScore, businessName),
    criticalIssues: issues.critical,
    quickWins: issues.quickWins,
    scoreItems: scoreItems,
    services: mapServicePotential(row.services),
  };
}

/**
 * Map salon_ai_leaderboard_latest (or stores) row into RawSalonRow shape.
 */
function rawSalonRowFromStore(row, localRank) {
  const report = row.intel_report && typeof row.intel_report === "object" && !Array.isArray(row.intel_report) ? row.intel_report : {};
  const marketing = Number(row.marketing_score != null ? row.marketing_score : row.ai_score);
  const keywordDefault = Number.isFinite(marketing) ? Math.min(100, Math.max(0, marketing)) : 65;
  const services = Array.isArray(report.services) && report.services.length ? report.services : DEFAULT_SERVICES;

  const city = String(row.city || row.town || "").trim();
  const state = String(report.state || row.state || "").trim() || (function () {
    const stateMatch = String(row.address || "").match(/\b([A-Z]{2})\b(?:\s+\d{5})?/);
    return stateMatch && stateMatch[1] ? stateMatch[1] : "NJ";
  })();

  return {
    id: row.id,
    slug: row.slug,
    google_place_id: String(row.google_place_id || row.place_id || "").trim(),
    name: String(row.name || row.name_en || row.name_zh || row.slug || "").trim(),
    city: city || "Local",
    state: state,
    category: String(report.category || row.category || "Restaurant").trim(),
    local_rank: localRank != null ? localRank : 99,
    keyword_match_score: Number(report.keywordMatchScore) || keywordDefault,
    citation_score: Number(report.citationScore) || Math.round(keywordDefault * 0.85),
    services: services.map(function (s) {
      return {
        name: String(s.name || "").trim(),
        search_volume: Number(s.search_volume) || 50,
        competition: Number(s.competition) || 50,
      };
    }),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

module.exports = {
  buildReportData,
  rawSalonRowFromStore,
  getScoreLabel,
  getScoreColor,
  getPotentialLabel,
  DEFAULT_SERVICES,
};
