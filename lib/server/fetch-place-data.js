/**
 * Places API payload for salon brief reports (field mask aligned with report template).
 */

const { getServerEnv } = require("./env");
const { getPlaceDetails } = require("./google-places-client");
const { countStarsFromReviewList } = require("./store-map-report");

const BRIEF_REPORT_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "rating",
  "userRatingCount",
  "reviews",
  "regularOpeningHours",
  "currentOpeningHours",
  "businessStatus",
  "websiteUri",
  "reservations",
  "photos",
].join(",");

function estimateHistogram(rating, total, reviews) {
  const mean = Number(rating) || 0;
  const weights = {};
  let wSum = 0;
  for (let s = 1; s <= 5; s += 1) {
    const w = Math.exp(-0.5 * Math.pow((s - mean) / 0.9, 2));
    weights[s] = w;
    wSum += w;
  }

  const hist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (let s = 1; s <= 5; s += 1) {
    hist[s] = Math.round((weights[s] / wSum) * total);
  }
  const diff = total - Object.values(hist).reduce(function (a, b) {
    return a + b;
  }, 0);
  hist[5] += diff;

  const sample = countStarsFromReviewList(reviews);
  const sampleTotal = Object.values(sample).reduce(function (a, b) {
    return a + b;
  }, 0);
  if (sampleTotal > 0 && total > 0) {
    for (let s = 1; s <= 5; s += 1) {
      if (sample[s] > 0) {
        hist[s] = Math.max(hist[s], sample[s]);
      }
    }
  }

  return hist;
}

function displayNameText(place) {
  const dn = place && place.displayName;
  if (dn && typeof dn === "object" && dn.text) return String(dn.text).trim();
  if (typeof dn === "string") return dn.trim();
  return "";
}

function parsePlaceApiResponse(raw) {
  const reviews = (raw.reviews || []).map(function (r) {
    return {
      authorName: (r.authorAttribution && r.authorAttribution.displayName) || "Anonymous",
      rating: Number(r.rating) || 0,
      text: (r.text && r.text.text) || "",
      relativeTimeDescription: r.relativePublishTimeDescription || "",
      publishTime: r.publishTime || new Date().toISOString(),
    };
  });

  const rating = Number(raw.rating) || 0;
  const reviewCount = Number(raw.userRatingCount) || 0;
  const histogram = estimateHistogram(rating, reviewCount, raw.reviews || []);

  let isOpen = null;
  if (raw.currentOpeningHours && raw.currentOpeningHours.openNow !== undefined) {
    isOpen = Boolean(raw.currentOpeningHours.openNow);
  } else if (raw.regularOpeningHours && raw.regularOpeningHours.openNow !== undefined) {
    isOpen = Boolean(raw.regularOpeningHours.openNow);
  }

  const bookingUrl = raw.reservations || null;
  const website = raw.websiteUri || null;

  return {
    placeId: String(raw.id || "").replace(/^places\//, ""),
    name: displayNameText(raw),
    rating: rating,
    reviewCount: reviewCount,
    ratingHistogram: histogram,
    oneStarCount: histogram[1],
    twoStarCount: histogram[2],
    threeStarCount: histogram[3],
    fourStarCount: histogram[4],
    fiveStarCount: histogram[5],
    website: website,
    bookingUrl: bookingUrl,
    hasOnlineBooking: bookingUrl != null,
    isOpen: isOpen,
    businessStatus: raw.businessStatus || "OPERATIONAL",
    phone: raw.nationalPhoneNumber || null,
    address: raw.formattedAddress || null,
    photoCount: Array.isArray(raw.photos) ? raw.photos.length : 0,
    recentReviews: reviews,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * @param {string} placeId
 * @returns {Promise<import('./build-report-data').PlaceApiData>}
 */
async function fetchPlaceData(placeId) {
  const env = getServerEnv();
  const apiKey = env.googlePlacesApiKey;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is not set");
  }

  const raw = await getPlaceDetails(placeId, apiKey, BRIEF_REPORT_FIELD_MASK.split(","));
  return parsePlaceApiResponse(raw);
}

/**
 * Build PlaceApiData from stored DB columns when Places API is unavailable.
 */
function placeDataFromStoreRow(row) {
  const rating = Number(row.google_rating != null ? row.google_rating : row.rating) || 0;
  const reviewCount = Number(row.google_review_count != null ? row.google_review_count : row.review_count) || 0;
  const histogram = estimateHistogram(rating, reviewCount, []);

  return {
    placeId: String(row.google_place_id || row.place_id || "").trim(),
    name: String(row.name || row.name_en || row.name_zh || row.slug || "").trim(),
    rating: rating,
    reviewCount: reviewCount,
    ratingHistogram: histogram,
    oneStarCount: histogram[1],
    twoStarCount: histogram[2],
    threeStarCount: histogram[3],
    fourStarCount: histogram[4],
    fiveStarCount: histogram[5],
    website: row.website || null,
    bookingUrl: null,
    hasOnlineBooking: false,
    isOpen: null,
    businessStatus: "OPERATIONAL",
    phone: row.phone || null,
    address: String(row.address || "").trim() || null,
    photoCount: 0,
    recentReviews: [],
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = {
  fetchPlaceData,
  parsePlaceApiResponse,
  placeDataFromStoreRow,
};
