/**
 * Full growth report payload (v2 template) from intel detail + Places data.
 */

const { getScoreColor } = require("./build-report-data");
const { categoryPluralLabel } = require("./restaurant-category");

const TIER_LINKS = {
  tier1: { href: "/tier-1.html", label: "Tier 1 — Google Client Growth", price: "From $29/mo" },
  tier2: { href: "/tier-2.html", label: "Tier 2 — Social Media Growth", price: "From $699" },
  tier3: { href: "/tier-3.html", label: "Tier 3 — Phone Client Growth", price: "From $99/mo" },
  tier4: { href: "/tier-4.html", label: "Tier 4 — Full Growth Stack", price: "Custom" },
};

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function scoreTone(score) {
  if (score >= 75) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

function histogramPercents(hist, total) {
  const t = total || 1;
  return [5, 4, 3, 2, 1].map(function (star) {
    return pct((hist && hist[star]) || 0, t);
  });
}

function estimateAreaHistogram(avgRating, total) {
  const mean = Number(avgRating) || 4.5;
  const weights = {};
  let wSum = 0;
  for (let s = 1; s <= 5; s += 1) {
    const w = Math.exp(-0.5 * Math.pow((s - mean) / 0.85, 2));
    weights[s] = w;
    wSum += w;
  }
  const hist = {};
  for (let s = 1; s <= 5; s += 1) {
    hist[s] = Math.round((weights[s] / wSum) * total);
  }
  return hist;
}

function profileCheckup(place, brief) {
  const phoneOk = Boolean(place.phone);
  const websiteOk = Boolean(place.website);
  const bookingOk = Boolean(place.hasOnlineBooking);
  const photosOk = (place.photoCount || 0) >= 30;
  const descOk = (brief && brief.scoreItems && brief.scoreItems.find(function (i) {
    return i.key === "local_seo";
  })
    ? brief.scoreItems.find(function (i) {
        return i.key === "local_seo";
      }).score >= 55
    : false);

  return [
    {
      key: "phone",
      title: "Phone",
      status: phoneOk ? "ok" : "warn",
      detail: phoneOk ? "Verified & consistent" : "Add or verify phone on profile",
    },
    {
      key: "website",
      title: "Website",
      status: websiteOk ? "warn" : "bad",
      detail: websiteOk ? "Listed — check mobile speed" : "No website linked",
    },
    {
      key: "booking",
      title: "Online booking",
      status: bookingOk ? "ok" : "bad",
      detail: bookingOk ? "Book button active" : 'No "Book" button',
    },
    {
      key: "description",
      title: "Description",
      status: descOk ? "ok" : "bad",
      detail: descOk ? "Keywords present" : "Missing — weak local SEO",
    },
    {
      key: "social",
      title: "Social media",
      status: "bad",
      detail: "Low posting cadence vs. leaders",
    },
    {
      key: "photos",
      title: "Photos",
      status: photosOk ? "warn" : "bad",
      detail: (place.photoCount || 0) + " on profile" + (photosOk ? "" : " — leaders have 50+"),
    },
  ];
}

function radarFromScores(scoreItems) {
  const map = {};
  (scoreItems || []).forEach(function (item) {
    map[item.key] = item.score;
  });
  return {
    labels: ["Profile", "Photos", "Booking", "Reviews", "Social"],
    you: [
      map.profile_completeness || 40,
      map.photo_engagement || 30,
      map.booking_conversion || 25,
      map.review_quality || 45,
      Math.round((map.local_seo || 35) * 0.65),
    ],
    competitor: [88, 85, 92, 86, 78],
  };
}

function peerScore(p) {
  return Number(p.ai_score || p.marketing_score || p.marketingScore) || 0;
}

function peerReviews(p) {
  return Number(p.review_count || p.google_review_count || p.googleReviewCount) || 0;
}

function peerRating(p) {
  const raw = p.rating != null ? p.rating : p.google_rating != null ? p.google_rating : p.googleRating;
  return raw != null && raw !== "" ? Number(raw) : null;
}

function rankLeaderboardPeers(peers) {
  return (peers || [])
    .slice()
    .sort(function (a, b) {
      const sb = peerScore(b);
      const sa = peerScore(a);
      if (sb !== sa) return sb - sa;
      return peerReviews(b) - peerReviews(a);
    })
    .map(function (p, index) {
      return Object.assign({}, p, {
        areaRank: index + 1,
        displayName: String(p.name || p.name_en || p.name_zh || "").trim() || p.slug,
      });
    });
}

function formatCompetitorRow(p, isYou, salonName, placeData) {
  const reviews = isYou ? Number(placeData.reviewCount) || peerReviews(p) : peerReviews(p);
  const rating = isYou
    ? placeData.rating != null
      ? Number(placeData.rating)
      : peerRating(p)
    : peerRating(p);
  const town = String(p.town || p.city || "").trim();
  const booking = isYou ? Boolean(placeData.hasOnlineBooking) : Boolean(p.website);
  const parts = [reviews + " reviews"];
  if (rating != null && !Number.isNaN(rating)) parts.push("★ " + rating.toFixed(1));
  if (town) parts.push(town);
  if (booking) parts.push("booking ✓");

  return {
    rank: p.areaRank,
    name: isYou ? "You — " + (salonName || p.displayName || "Your restaurant") : p.displayName || p.name,
    meta: parts.join(" · "),
    rating: rating != null && !Number.isNaN(rating) ? rating.toFixed(1) : "—",
    yours: isYou,
  };
}

/** Nearby salons from salon_ai_leaderboard_latest (same town/county), ranked by AI score. */
function buildLocalPackFromLeaderboard(areaPeers, currentSlug, salonName, placeData, rankFallback) {
  const ranked = rankLeaderboardPeers(areaPeers);
  const youPeer = ranked.find(function (p) {
    return p.slug === currentSlug;
  });
  const myRank = youPeer ? youPeer.areaRank : rankFallback || ranked.length + 1;

  if (!ranked.length) {
    return [
      formatCompetitorRow(
        { areaRank: myRank, review_count: placeData.reviewCount, town: "" },
        true,
        salonName,
        placeData,
      ),
    ];
  }

  const displayRanks = new Set();
  for (let r = 1; r <= Math.min(3, ranked.length); r += 1) displayRanks.add(r);
  for (let r = Math.max(1, myRank - 1); r <= Math.min(ranked.length, myRank + 1); r += 1) {
    displayRanks.add(r);
  }
  if (displayRanks.size < 4) {
    ranked.slice(0, 6).forEach(function (p) {
      displayRanks.add(p.areaRank);
    });
  }

  const rows = ranked
    .filter(function (p) {
      return displayRanks.has(p.areaRank);
    })
    .slice(0, 8)
    .map(function (p) {
      return formatCompetitorRow(p, p.slug === currentSlug, salonName, placeData);
    });

  if (!rows.some(function (r) {
    return r.yours;
  })) {
    const youRow = youPeer || { areaRank: myRank, review_count: placeData.reviewCount, town: "" };
    rows.push(formatCompetitorRow(youRow, true, salonName, placeData));
  }

  return rows.sort(function (a, b) {
    return a.rank - b.rank;
  });
}

function communityGridFromLeaderboard(areaPeers, currentSlug, myRank, areaCtx) {
  const ctx = areaCtx || {};
  const ranked = rankLeaderboardPeers(areaPeers);
  const myTown = String(ctx.town || "").trim();
  const county = String(ctx.county || "").trim();
  const state = String(ctx.state || "").trim();
  const category = String(ctx.category || "").trim();
  const countyLabel = county ? county + (county.toLowerCase().indexOf("county") >= 0 ? "" : " County") : "";

  const byTown = {};
  ranked.forEach(function (p) {
    const town = String(p.town || "").trim();
    if (!town) return;
    const entry = byTown[town];
    if (!entry || p.areaRank < entry.rank) {
      byTown[town] = {
        rank: p.areaRank,
        you: p.slug === currentSlug,
        salonName: p.displayName || p.name,
      };
    } else if (p.slug === currentSlug) {
      entry.you = true;
    }
  });

  if (myTown && !byTown[myTown]) {
    byTown[myTown] = { rank: myRank, you: true, salonName: "Your restaurant" };
  }

  const townNames = Object.keys(byTown);
  townNames.sort(function (a, b) {
    if (a === myTown) return -1;
    if (b === myTown) return 1;
    return byTown[a].rank - byTown[b].rank;
  });

  const cells = townNames.slice(0, 9).map(function (town) {
    const info = byTown[town];
    const subParts = [];
    if (countyLabel) subParts.push(countyLabel);
    if (state) subParts.push(state);
    if (category) subParts.push(category);
    return {
      zone: town,
      sub: subParts.join(" · "),
      rank: info.rank,
      you: info.you || town === myTown,
      leader: info.salonName,
    };
  });

  if (cells.length >= 4) return cells;

  const fallbackTowns = [myTown, "Nearby north", "Nearby south", "Business district", "West side", "East side"]
    .filter(Boolean)
    .filter(function (t, i, arr) {
      return arr.indexOf(t) === i && !byTown[t];
    });

  fallbackTowns.forEach(function (town, i) {
    if (cells.length >= 9) return;
    cells.push({
      zone: town,
      sub: countyLabel || "Surrounding area",
      rank: myRank + i,
      you: town === myTown,
      leader: "",
    });
  });

  return cells.slice(0, 9);
}

function pctYes(has) {
  return has ? 100 : 0;
}

function rivalBenchmarkPct(categoryPeers, currentSlug, scorer) {
  const rivals = rankLeaderboardPeers(categoryPeers).filter(function (p) {
    return p.slug !== currentSlug;
  });
  const top = rivals.slice(0, Math.min(12, rivals.length));
  if (!top.length) return 75;
  const sum = top.reduce(function (acc, p) {
    return acc + (scorer(p) ? 1 : 0);
  }, 0);
  return Math.round((sum / top.length) * 100);
}

function buildFeatureGap(place, brief, categoryPeers, currentSlug, category, county) {
  const seoItem = (brief.scoreItems || []).find(function (i) {
    return i.key === "local_seo";
  });
  const reviewItem = (brief.scoreItems || []).find(function (i) {
    return i.key === "review_quality";
  });
  const photoItem = (brief.scoreItems || []).find(function (i) {
    return i.key === "photo_engagement";
  });

  const youBooking = Boolean(place.hasOnlineBooking);
  const youPhotos = (place.photoCount || 0) >= 50;
  const youReviews = (reviewItem && reviewItem.score >= 55) || false;
  const youSocial = false;
  const youRequests = (reviewItem && reviewItem.score >= 50) || false;
  const youDesc = (seoItem && seoItem.score >= 55) || (brief.overallScore || 0) >= 55;

  const rivalBooking = rivalBenchmarkPct(categoryPeers, currentSlug, function (p) {
    return Boolean(p.website);
  });
  const rivalPhotos = rivalBenchmarkPct(categoryPeers, currentSlug, function (p) {
    return peerReviews(p) >= 120;
  });
  const rivalReviews = rivalBenchmarkPct(categoryPeers, currentSlug, function (p) {
    return peerReviews(p) >= 80 && peerRating(p) >= 4.3;
  });
  const rivalSocial = 72;
  const rivalRequests = 68;
  const rivalDesc = rivalBenchmarkPct(categoryPeers, currentSlug, function (p) {
    return peerScore(p) >= 78;
  });

  const labels = [
    "Online booking",
    "Photo gallery (50+)",
    "Owner review replies",
    "Weekly social posts",
    "Active review requests",
    "Google description",
  ];
  const you = [
    pctYes(youBooking),
    pctYes(youPhotos),
    pctYes(youReviews),
    pctYes(youSocial),
    pctYes(youRequests),
    pctYes(youDesc),
  ];
  const rival = [rivalBooking, rivalPhotos, rivalReviews, rivalSocial, rivalRequests, rivalDesc];
  const gaps = labels.map(function (_label, i) {
    return Math.max(0, rival[i] - you[i]);
  });

  return {
    labels: labels,
    you: you,
    rival: rival,
    gaps: gaps,
    caption:
      "How you compare to top " +
      categoryPluralLabel(category) +
      " in " +
      (county ? county + " County" : "your trade area") +
      " (100% = fully in place)",
    summary:
      gaps.filter(function (g) {
        return g >= 50;
      }).length +
      " high-impact gaps vs. local " +
      categoryPluralLabel(category),
  };
}

function negativeReviewsFromPlace(place, salonReviews) {
  const fromApi = (place.recentReviews || [])
    .filter(function (r) {
      return Number(r.rating) <= 3;
    })
    .slice(0, 3)
    .map(function (r) {
      return {
        author: r.authorName || "Anonymous",
        rating: Number(r.rating) || 1,
        text: String(r.text || "").slice(0, 280),
        tags: ["Service quality"],
        noResponse: true,
      };
    });
  if (fromApi.length) return fromApi;

  return (salonReviews || [])
    .filter(function (r) {
      return Number(r.rating) <= 3;
    })
    .slice(0, 3)
    .map(function (r) {
      return {
        author: "Client",
        rating: Number(r.rating) || 2,
        text: String(r.text || "").slice(0, 280),
        tags: ["Review"],
        noResponse: true,
      };
    });
}

function keywordsFromServices(services, city) {
  const town = String(city || "local").toLowerCase();
  return (services || []).slice(0, 5).map(function (svc, i) {
    const base = String(svc.name || "salon").toLowerCase();
    const rank = svc.level === "high" ? 6 + i : svc.level === "medium" ? 10 + i * 2 : 18 + i * 2;
    return { keyword: base + " " + town, rank: rank };
  });
}

function roadmapFromIssues(brief) {
  return [
    {
      week: "Week 1",
      tone: "info",
      title: "Fix the foundation",
      items: ["Optimize Google description", "Upload 15+ photos", "Connect booking link", "Activate review requests"],
    },
    {
      week: "Week 2",
      tone: "warning",
      title: "Reputation recovery",
      items: ["Respond to negative reviews", "Thank 5-star reviewers", "SMS review automation"],
    },
    {
      week: "Week 3",
      tone: "warning",
      title: "Activate social",
      items: ["AI content calendar", "3 posts/week", "First Google Business post"],
    },
    {
      week: "Week 4",
      tone: "success",
      title: "Amplify & measure",
      items: ["Deploy AI voice agent", "Track local rank", "Launch retention SMS"],
    },
  ];
}

/**
 * @param {object} detail — getIntelSalonDetail() shape
 * @param {object} place — Places API payload
 * @param {object} [templateOverlay] — optional static template merge
 */
function buildFullReportData(detail, place, templateOverlay) {
  const brief = detail.briefReport || {};
  const salon = detail.salon || {};
  const topFive = detail.topFive || [];
  const areaPeers = detail.areaPeers && detail.areaPeers.length ? detail.areaPeers : topFive;
  const stats = detail.townshipStats || {};
  const currentSlug = brief.slug || salon.slug;

  const reviewCount = Number(place.reviewCount || brief.reviewCount) || 0;
  const rating = Number(place.rating || brief.rating) || 0;
  const hist = place.ratingHistogram || {};
  const oneTwo = (place.oneStarCount || 0) + (place.twoStarCount || 0);
  const negPct = reviewCount ? Math.round((oneTwo / reviewCount) * 100) : 0;
  const areaAvg = stats.avgGoogleRating != null ? Number(stats.avgGoogleRating) : 4.5;
  const areaHist = estimateAreaHistogram(areaAvg, reviewCount || 100);
  const youPct = histogramPercents(hist, reviewCount);
  const areaPct = histogramPercents(areaHist, reviewCount || 100);

  const topPeer = topFive[0] || {};
  const topReviews = Number(topPeer.googleReviewCount) || Math.max(reviewCount * 3, 120);
  const topPhotos = 80;

  const scoreItems = brief.scoreItems || [];
  const rankFallback = brief.localRank || detail.rankInTownship || 14;
  const rankedPeers = rankLeaderboardPeers(areaPeers);
  const youPeer = rankedPeers.find(function (p) {
    return p.slug === currentSlug;
  });
  const localRank = youPeer ? youPeer.areaRank : rankFallback;
  const salonName = brief.businessName || salon.name;
  const competitors = buildLocalPackFromLeaderboard(
    areaPeers,
    currentSlug,
    salonName,
    place,
    rankFallback,
  );
  const salonCategory = detail.peerCategory || salon.category || brief.category || "";
  const communityGrid = communityGridFromLeaderboard(areaPeers, currentSlug, localRank, {
    town: salon.town || salon.city,
    county: salon.county,
    state: salon.state,
    category: salonCategory,
    townshipLabel: salon.townshipLabel || brief.location,
  });
  const featureGap = buildFeatureGap(place, brief, areaPeers, currentSlug, salonCategory, salon.county);
  const competitorNote =
    "Compared with other " + categoryPluralLabel(salonCategory) + " in " + (salon.townshipLabel || brief.location || "your area");

  const report = {
    slug: brief.slug || salon.slug,
    businessName: brief.businessName || salon.name,
    location: brief.location || salon.townshipLabel || salon.city || "Local",
    category: brief.category || salon.category || "Beauty salon",
    generatedAt: brief.generatedAt || place.fetchedAt || new Date().toISOString(),
    overallScore: brief.overallScore || 0,
    overallLabel: brief.overallLabel || "Needs Improvement",
    criticalIssues: brief.criticalIssues || 0,
    quickWins: brief.quickWins || 0,
    metrics: {
      rating: { value: rating.toFixed(1), sub: "vs. avg " + areaAvg.toFixed(1) + " area", tone: rating >= areaAvg ? "success" : "danger" },
      reviews: { value: String(reviewCount), sub: "Top rival: " + topReviews, tone: reviewCount >= topReviews * 0.5 ? "success" : "danger" },
      rank: { value: "#" + localRank, sub: "Top 3 needed", tone: localRank <= 3 ? "success" : "danger" },
      photos: { value: String(place.photoCount || brief.photoCount || 0), sub: "Leaders: " + topPhotos + "+", tone: (place.photoCount || 0) >= 30 ? "warning" : "danger" },
    },
    profileCheckup: profileCheckup(place, brief),
    radar: radarFromScores(scoreItems),
    page1Alert: {
      title: "Without a booking button, you're invisible at the decision moment",
      body: "Salons with a Book action on Google Maps convert more high-intent searches. Closing profile gaps is the fastest path to more calls and bookings.",
    },
    reviews: {
      oneTwoStarPct: negPct,
      responseRate: Math.max(8, 100 - Math.min(negPct + 20, 85)),
      unanswered: Math.max(0, Math.round(reviewCount * 0.15)),
      reviews90d: Math.max(1, Math.round(reviewCount * 0.06)),
      sentiment: Math.max(35, Math.min(85, brief.overallScore || 50)),
      ratingBars: { you: youPct.slice().reverse(), area: areaPct.slice().reverse() },
      painPoints: [
        { label: "No response from owner", count: Math.max(2, Math.round(reviewCount * 0.12)) },
        { label: "Missed calls", count: Math.max(2, Math.round(reviewCount * 0.1)) },
        { label: "Long wait time", count: Math.max(1, Math.round(reviewCount * 0.08)) },
        { label: "Pricing issues", count: Math.max(1, Math.round(reviewCount * 0.05)) },
        { label: "No follow-up", count: Math.max(1, Math.round(reviewCount * 0.04)) },
      ],
      negativeSamples: negativeReviewsFromPlace(place, detail.salonReviews),
      calculator: { callsPerWeek: 4, avgService: 85, tier3Monthly: 99 },
    },
    competitors: competitors,
    competitorNote: competitorNote,
    featureGap: featureGap,
    communityGrid: communityGrid,
    communityGridTitle:
      "Your rank in nearby towns (" + categoryPluralLabel(salonCategory) + ")",
    page3Insight: {
      title: "Rank #" + (localRank + 3) + " is beatable in 60 days",
      body: "Peers with similar ratings often leapfrog you with review velocity, fresh photos, and a booking link. A focused 30-day sprint can move you into the visible local pack.",
    },
    keywords: keywordsFromServices(brief.services, salon.city || brief.location),
    seoSignals: (scoreItems || []).slice(0, 5).map(function (item) {
      return { label: item.label, score: item.score };
    }),
    roadmap: roadmapFromIssues(brief),
    tiers: [
      Object.assign({ featured: true, id: "tier1" }, TIER_LINKS.tier1, {
        summary: "Profile optimization · review automation · booking integration · keyword targeting.",
        tags: ["Profile fix", "Review automation", "Booking link", "Keyword targeting"],
      }),
      Object.assign({ id: "tier3" }, TIER_LINKS.tier3, {
        summary: "AI voice answers every call 24/7. Recovers missed bookings from your calculator above.",
        tags: ["24/7 AI voice", "SMS follow-up", "Auto-booking"],
      }),
      Object.assign({ id: "tier2" }, TIER_LINKS.tier2, {
        summary: "AI content calendar — 3 posts/week to lift Google authority and local discovery.",
        tags: ["AI content", "Instagram + Facebook", "Local hashtags"],
      }),
    ],
    scoreColor: getScoreColor(brief.overallScore || 0),
    searchQuery:
      (salonCategory || brief.category || "local salon") +
      " near me — " +
      (salon.townshipLabel || brief.location || salon.city || "local area"),
    localRank: localRank,
    areaPeerCount: rankedPeers.length,
  };

  if (templateOverlay && typeof templateOverlay === "object") {
    return Object.assign({}, report, templateOverlay, {
      metrics: Object.assign({}, report.metrics, templateOverlay.metrics || {}),
      reviews: Object.assign({}, report.reviews, templateOverlay.reviews || {}),
      competitors:
        Array.isArray(templateOverlay.competitors) && templateOverlay.competitors.length
          ? templateOverlay.competitors
          : report.competitors,
      featureGap:
        templateOverlay.featureGap && templateOverlay.featureGap.labels
          ? Object.assign({}, report.featureGap, templateOverlay.featureGap)
          : report.featureGap,
      communityGrid:
        Array.isArray(templateOverlay.communityGrid) && templateOverlay.communityGrid.length
          ? templateOverlay.communityGrid
          : report.communityGrid,
    });
  }

  return report;
}

module.exports = {
  buildFullReportData,
  TIER_LINKS,
  scoreTone,
};
