const fs = require("fs");
const path = require("path");

const { getSupabaseAdmin } = require("./supabase");
const { createAppError } = require("./shared");
const { buildReportData, rawSalonRowFromStore } = require("./build-report-data");
const { buildFullReportData } = require("./build-full-report-data");
const { filterPeersByCategory } = require("./restaurant-category");
const { getPlaceDataCached } = require("./get-place-data-cached");

const FULL_REPORT_TEMPLATE_SLUG = "new-hair-culture-and-beauty-c9ea5bea06";

function loadFullReportTemplate(slug) {
  if (String(slug || "").trim() !== FULL_REPORT_TEMPLATE_SLUG) return null;
  try {
    const filePath = path.join(
      __dirname,
      "full-report-templates",
      FULL_REPORT_TEMPLATE_SLUG + ".json",
    );
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    return null;
  }
}

const INTEL_READ_SOURCE = "salon_ai_leaderboard_latest";
const INTEL_LIST_SEARCH_MIN = 2;
const INTEL_LIST_DEFAULT_LIMIT = 100;
const INTEL_PEER_SAMPLE_LIMIT = 200;

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function average(nums) {
  const list = nums.filter(function (x) {
    return x != null && Number.isFinite(x);
  });
  if (!list.length) return null;
  return list.reduce(function (s, x) {
    return s + x;
  }, 0) / list.length;
}

function median(nums) {
  const list = nums
    .filter(function (x) {
      return x != null && Number.isFinite(x);
    })
    .slice()
    .sort(function (a, b) {
      return a - b;
    });
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}

function readIntelReport(row) {
  const raw = row && row.intel_report;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw;
}

function mapListRow(row) {
  return {
    slug: row.slug,
    name: String(row.name || row.name_en || row.name_zh || "").trim() || row.slug,
    address: String(row.address || "").trim(),
    city: String(row.town || row.city || "").trim(),
    township: String(row.town || row.township || "").trim(),
    googleRating: toNumber(row.rating || row.google_rating),
    googleReviewCount: toNumber(row.review_count || row.google_review_count),
    marketingScore: toNumber(row.ai_score || row.marketing_score),
  };
}

function applyIntelSearchOrFilter(query, searchRaw) {
  const inner = String(searchRaw || "")
    .trim()
    .replace(/,/g, " ")
    .replace(/[()]/g, " ")
    .slice(0, 96);
  if (!inner) return query;
  const esc = inner.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  const pat = `%${esc}%`;
  return query.or(
    `name.ilike.${pat},town.ilike.${pat},county.ilike.${pat},address.ilike.${pat},slug.ilike.${pat}`,
  );
}

function applyTownshipScope(query, town, county, state) {
  const townKey = String(town || "").trim();
  const countyKey = String(county || "").trim();
  const stateKey = String(state || "").trim();
  if (!townKey && !countyKey) return query;
  if (townKey) query = query.eq("town", townKey);
  else query = query.eq("county", countyKey);
  if (stateKey) query = query.eq("state", stateKey);
  return query;
}

/**
 * @param {{ search?: string, limit?: number }} [options]
 */
async function listIntelSalons(options) {
  const opts = options || {};
  const search = String(opts.search || "").trim();
  if (search.length < INTEL_LIST_SEARCH_MIN) {
    return [];
  }

  const limit = Math.min(Math.max(Number(opts.limit) || INTEL_LIST_DEFAULT_LIMIT, 1), 150);
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from(INTEL_READ_SOURCE)
    .select("slug,name,address,town,county,state,rating,review_count,ai_score,is_listed")
    .eq("is_listed", true)
    .order("ai_score", { ascending: false })
    .limit(limit);

  query = applyIntelSearchOrFilter(query, search);

  const result = await query;
  if (result.error) throw result.error;
  return (result.data || []).map(mapListRow);
}

async function getIntelStoreRowBySlug(slug) {
  const clean = String(slug || "").trim();
  if (!clean) return null;

  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from(INTEL_READ_SOURCE)
    .select(
      "id,slug,name,address,town,county,state,category,rating,review_count,ai_score,place_id,google_place_id,website,is_listed",
    )
    .eq("slug", clean)
    .maybeSingle();
  if (result.error) throw result.error;
  const row = result.data;
  if (!row || !row.is_listed) return null;
  return row;
}

async function countIntelSalonsInTownship(town, county, state) {
  const townKey = String(town || "").trim();
  const countyKey = String(county || "").trim();
  if (!townKey && !countyKey) return 0;

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from(INTEL_READ_SOURCE)
    .select("id", { count: "exact", head: true })
    .eq("is_listed", true);
  query = applyTownshipScope(query, town, county, state);

  const result = await query;
  if (result.error) throw result.error;
  return Number(result.count) || 0;
}

async function fetchLeaderboardPeers(query, cap) {
  const result = await query.limit(cap);
  if (result.error) throw result.error;
  return result.data || [];
}

/** Top salons in area (capped), filtered to same business category when possible. */
async function listIntelPeerSample(town, county, state, limit, category) {
  const townKey = String(town || "").trim();
  const countyKey = String(county || "").trim();
  if (!townKey && !countyKey) return [];

  const cap = Math.min(Math.max(Number(limit) || INTEL_PEER_SAMPLE_LIMIT, 5), INTEL_PEER_SAMPLE_LIMIT);
  const supabase = getSupabaseAdmin();
  const select =
    "id,slug,name,town,county,state,zipcode,category,rating,review_count,ai_score,website,is_listed";

  let query = supabase
    .from(INTEL_READ_SOURCE)
    .select(select)
    .eq("is_listed", true)
    .order("ai_score", { ascending: false });
  query = applyTownshipScope(query, town, county, state);
  let data = await fetchLeaderboardPeers(query, cap);

  let filtered = filterPeersByCategory(data, category);
  if (filtered.length < 5 && townKey && countyKey) {
    let countyQuery = supabase
      .from(INTEL_READ_SOURCE)
      .select(select)
      .eq("is_listed", true)
      .eq("county", countyKey)
      .order("ai_score", { ascending: false });
    const stateKey = String(state || "").trim();
    if (stateKey) countyQuery = countyQuery.eq("state", stateKey);
    const countyPeers = await fetchLeaderboardPeers(countyQuery, Math.min(cap * 2, INTEL_PEER_SAMPLE_LIMIT));
    filtered = filterPeersByCategory(countyPeers, category);
  }

  return filtered.slice(0, cap);
}

async function countPeersAheadInTownship(row, town, county, state) {
  const peers = await listIntelPeerSample(
    town,
    county,
    state,
    INTEL_PEER_SAMPLE_LIMIT,
    row.category,
  );
  const myScore = toNumber(row.ai_score || row.marketing_score) || 0;
  const ahead = peers.filter(function (p) {
    return p.slug !== row.slug && toNumber(p.ai_score || p.marketing_score) > myScore;
  }).length;
  return ahead + 1;
}

function ensureSalonInPeerList(peers, row) {
  const list = Array.isArray(peers) ? peers.slice() : [];
  if (!row || !row.slug) return list;
  if (list.some(function (p) {
    return p.slug === row.slug;
  })) {
    return list;
  }
  list.push({
    slug: row.slug,
    name: row.name,
    town: row.town,
    county: row.county,
    state: row.state,
    category: row.category,
    rating: row.rating,
    review_count: row.review_count,
    ai_score: row.ai_score,
    website: row.website,
  });
  return list;
}

function buildTopFive(peers) {
  return peers
    .slice()
    .sort(function (a, b) {
      const sa = toNumber(a.ai_score || a.marketing_score) || 0;
      const sb = toNumber(b.ai_score || b.marketing_score) || 0;
      if (sb !== sa) return sb - sa;
      return (toNumber(b.rating || b.google_rating) || 0) - (toNumber(a.rating || a.google_rating) || 0);
    })
    .slice(0, 5)
    .map(function (p, index) {
      return {
        rank: index + 1,
        slug: p.slug,
        name: p.name || p.name_en || p.name_zh || p.slug,
        googleRating: toNumber(p.rating || p.google_rating),
        googleReviewCount: toNumber(p.review_count || p.google_review_count),
        marketingScore: toNumber(p.ai_score || p.marketing_score),
      };
    });
}

function townshipLabel(row) {
  const t = String(row.town || row.township || "").trim();
  if (t) return t;
  const c = String(row.city || row.county || "").trim();
  return c || "Local area";
}

async function getIntelSalonDetail(slug) {
  const row = await getIntelStoreRowBySlug(slug);
  if (!row) {
    throw createAppError("INTEL_STORE_NOT_FOUND", "Salon report not found", 404);
  }

  const town = row.town || row.township;
  const county = row.county;
  const state = row.state;

  const [rankInTownship, peerSample, salonCount, placeData] = await Promise.all([
    countPeersAheadInTownship(row, town, county, state),
    listIntelPeerSample(town, county, state, INTEL_PEER_SAMPLE_LIMIT, row.category),
    countIntelSalonsInTownship(town, county, state),
    getPlaceDataCached(row),
  ]);

  const peers = ensureSalonInPeerList(peerSample, row);
  const ratings = peers.map(function (p) {
    return toNumber(p.rating || p.google_rating);
  });
  const counts = peers.map(function (p) {
    return toNumber(p.review_count || p.google_review_count);
  });
  const scores = peers.map(function (p) {
    return toNumber(p.ai_score || p.marketing_score);
  });

  const report = readIntelReport(row);
  const sentimentBenchmark = report.sentimentBenchmark && typeof report.sentimentBenchmark === "object" ? report.sentimentBenchmark : {};
  const reviewSentiment = report.reviewSentiment && typeof report.reviewSentiment === "object" ? report.reviewSentiment : {};

  const whyGood = Array.isArray(report.whyGood) ? report.whyGood.map(String) : [];
  const toImprove = Array.isArray(report.toImprove) ? report.toImprove.map(String) : [];
  const salonReviews = Array.isArray(report.salonReviews) ? report.salonReviews : [];
  const topTownshipReviews = Array.isArray(report.topTownshipReviews) ? report.topTownshipReviews : [];

  const rawSalon = rawSalonRowFromStore(row, rankInTownship);
  const briefReport = buildReportData(rawSalon, placeData);

  const topFive = buildTopFive(peers);
  const detailForFull = {
    briefReport: briefReport,
    salon: {
      slug: row.slug,
      name: String(row.name || row.name_en || row.name_zh || "").trim() || row.slug,
      city: String(row.town || row.city || "").trim(),
      townshipLabel: townshipLabel(row),
      category: String(row.category || "").trim(),
      county: String(row.county || "").trim(),
      state: String(row.state || "").trim(),
      town: String(row.town || row.township || "").trim(),
    },
    topFive: topFive,
    areaPeers: peers,
    peerCategory: String(row.category || "").trim(),
    rankInTownship: rankInTownship,
    salonReviews: salonReviews,
    townshipStats: {
      avgGoogleRating: average(ratings),
    },
  };
  const fullReport = buildFullReportData(detailForFull, placeData, loadFullReportTemplate(row.slug));

  return {
    briefReport: briefReport,
    fullReport: fullReport,
    salon: {
      slug: row.slug,
      name: String(row.name || row.name_en || row.name_zh || "").trim() || row.slug,
      address: String(row.address || "").trim(),
      city: String(row.town || row.city || "").trim(),
      township: String(row.town || row.township || "").trim(),
      townshipLabel: townshipLabel(row),
      googleRating: toNumber(row.rating || row.google_rating),
      googleReviewCount: toNumber(row.review_count || row.google_review_count),
      marketingScore: toNumber(row.ai_score || row.marketing_score),
      googleReviewUrl: row.google_review_url || "",
    },
    townshipStats: {
      townshipKey: String(row.town || row.township || "").trim(),
      label: townshipLabel(row),
      salonCount: salonCount || peers.length,
      avgGoogleRating: average(ratings),
      medianGoogleRating: median(ratings),
      avgGoogleReviewCount: average(counts),
      medianGoogleReviewCount: median(counts),
      avgMarketingScore: average(scores),
      medianMarketingScore: median(scores),
    },
    rankInTownship: rankInTownship,
    topFive: topFive,
    reviewSentiment: {
      positivePct: toNumber(reviewSentiment.positivePct),
      neutralPct: toNumber(reviewSentiment.neutralPct),
      negativePct: toNumber(reviewSentiment.negativePct),
    },
    sentimentBenchmark: {
      townshipPositivePct: toNumber(sentimentBenchmark.townshipPositivePct),
      salonPositivePct: toNumber(reviewSentiment.positivePct),
      note: String(sentimentBenchmark.note || "").trim(),
    },
    salonReviews: salonReviews
      .filter(function (x) {
        return x && typeof x === "object";
      })
      .map(function (x) {
        return {
          date: String(x.date || "").trim(),
          rating: toNumber(x.rating),
          text: String(x.text || "").trim(),
        };
      }),
    topTownshipReviews: topTownshipReviews
      .filter(function (x) {
        return x && typeof x === "object";
      })
      .map(function (x) {
        return {
          salonName: String(x.salonName || "").trim(),
          date: String(x.date || "").trim(),
          rating: toNumber(x.rating),
          text: String(x.text || "").trim(),
        };
      }),
    whyGood: whyGood,
    toImprove: toImprove,
  };
}

module.exports = {
  listIntelSalons,
  getIntelSalonDetail,
};
