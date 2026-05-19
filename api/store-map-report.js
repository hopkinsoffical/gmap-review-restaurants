/**
 * POST /api/store-map-report
 * Real-time Google Maps (Places API) competitor snapshot + reputation signals for a subject salon.
 *
 * Body JSON:
 * - subjectPlaceId (required): Google place id (ChIJ...) for this caller's store
 * - radiusMeters (optional): default 2500
 * - includedTypes (optional): default ["beauty_salon","hair_care","spa"]
 * - maxCompetitors (optional): default 5
 * - starHistogramOverride (optional): { "1":0,"2":0,... } when you have full GBP counts
 *
 * Env:
 * - GOOGLE_PLACES_API_KEY (required)
 * - STORE_MAP_REPORT_SECRET (optional; if set, require Authorization: Bearer <secret> or x-tool-secret)
 */

const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/server/http");
const { createAppError } = require("../lib/server/shared");
const { getServerEnv } = require("../lib/server/env");
const { extractPlaceIdFromResource, getPlaceDetails, searchNearby } = require("../lib/server/google-places-client");
const {
  assertSecret,
  classifyStoreSignals,
  computeRankScore,
  countStarsFromReviewList,
  normalizeHistogramInput,
} = require("../lib/server/store-map-report");

const DEFAULT_TYPES = ["beauty_salon", "hair_care", "spa"];

const SUBJECT_FIELD_MASK = [
  "id",
  "name",
  "displayName",
  "rating",
  "userRatingCount",
  "reviews",
  "location",
  "formattedAddress",
].join(",");

function displayNameOf(place) {
  const dn = place && place.displayName;
  if (dn && typeof dn === "object" && dn.text) return String(dn.text);
  if (typeof dn === "string") return dn;
  return "";
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-tool-secret");
    return res.end();
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST", "OPTIONS"]);
  }

  try {
    const env = getServerEnv();
    assertSecret(req, env.storeMapReportSecret);

    const apiKey = env.googlePlacesApiKey;
    if (!apiKey) {
      throw createAppError("ENV_MISSING", "GOOGLE_PLACES_API_KEY is not configured", 500);
    }

    const body = await readJsonBody(req);
    const subjectPlaceId = String(body.subjectPlaceId || "").trim();
    if (!subjectPlaceId) {
      throw createAppError("INVALID_BODY", "subjectPlaceId is required", 400);
    }

    const radiusMeters = Number(body.radiusMeters);
    const radius = Number.isFinite(radiusMeters) ? Math.min(50000, Math.max(100, radiusMeters)) : 2500;
    const includedTypes = Array.isArray(body.includedTypes) && body.includedTypes.length
      ? body.includedTypes.map(function (t) {
          return String(t || "").trim();
        }).filter(Boolean)
      : DEFAULT_TYPES;
    const maxCompetitors = Math.min(20, Math.max(1, Number(body.maxCompetitors) || 5));

    const subject = await getPlaceDetails(subjectPlaceId, apiKey, SUBJECT_FIELD_MASK.split(","));
    const subjectResourceId = extractPlaceIdFromResource(subject.name || subject.id);

    const loc = subject.location || {};
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw createAppError(
        "PLACE_NO_LOCATION",
        "Subject place has no coordinates; cannot search nearby.",
        422,
      );
    }

    const overrideHist = normalizeHistogramInput(body.starHistogramOverride);
    let starHistogram;
    let histogramSource;
    if (overrideHist) {
      starHistogram = overrideHist;
      histogramSource = "request_override";
    } else {
      starHistogram = countStarsFromReviewList(subject.reviews);
      histogramSource = "places_reviews_sample";
    }

    const reviewSampleSize = Array.isArray(subject.reviews) ? subject.reviews.length : 0;
    const userRatingTotal = Number(subject.userRatingCount) || 0;
    const histogramIncomplete =
      histogramSource === "places_reviews_sample" &&
      userRatingTotal > 0 &&
      reviewSampleSize < userRatingTotal;

    const signals = classifyStoreSignals(starHistogram, {
      userRatingTotal: userRatingTotal,
      histogramIncomplete: histogramIncomplete,
    });

    const nearbyResult = await searchNearby(
      {
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
        includedTypes: includedTypes,
        maxResultCount: 20,
      },
      apiKey,
    );

    const places = Array.isArray(nearbyResult.places) ? nearbyResult.places : [];
    const rows = [];

    for (let i = 0; i < places.length; i += 1) {
      const p = places[i];
      const pid = extractPlaceIdFromResource(p.name || p.id);
      if (pid && subjectResourceId && pid === subjectResourceId) {
        continue;
      }
      const rating = Number(p.rating) || 0;
      const urc = Number(p.userRatingCount) || 0;
      rows.push({
        rankScore: computeRankScore(rating, urc),
        placeId: pid,
        displayName: displayNameOf(p),
        rating: rating,
        userRatingCount: urc,
      });
    }

    rows.sort(function (a, b) {
      return b.rankScore - a.rankScore;
    });

    const top = rows.slice(0, maxCompetitors).map(function (row, index) {
      return {
        rank: index + 1,
        placeId: row.placeId,
        displayName: row.displayName,
        rating: row.rating,
        userRatingCount: row.userRatingCount,
        rankScore: row.rankScore,
      };
    });

    const rankingFormula = "rankScore = round( rating * log1p(userRatingCount) * 1000 ) / 1000";

    res.setHeader("Access-Control-Allow-Origin", "*");
    return sendJson(res, 200, {
      generatedAt: new Date().toISOString(),
      subject: {
        placeId: subjectResourceId,
        displayName: displayNameOf(subject),
        formattedAddress: subject.formattedAddress || null,
        location: { latitude: lat, longitude: lng },
        rating: Number(subject.rating) || null,
        userRatingCount: userRatingTotal,
        oneStarCount: starHistogram[1],
        twoStarCount: starHistogram[2],
        starHistogram: starHistogram,
        histogramSource: histogramSource,
        reviewSampleSize: reviewSampleSize,
        signals: signals,
      },
      nearbyTop: top,
      search: {
        radiusMeters: radius,
        includedTypes: includedTypes,
        competitorPoolSize: rows.length,
      },
      rankingFormula: rankingFormula,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
