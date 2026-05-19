/**
 * Google Places API (New) — nearby search + place details.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/op-overview
 */

const { createAppError } = require("./shared");

const PLACES_BASE = "https://places.googleapis.com/v1";

function normalizePlaceIdForPath(placeId) {
  let id = String(placeId || "").trim();
  if (!id) return "";
  if (id.startsWith("places/")) {
    id = id.slice("places/".length);
  }
  return id;
}

async function placesFetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (data && data.error && data.error.message) ||
      (data && data.message) ||
      text ||
      "Places API error";
    const err = createAppError("PLACES_API_ERROR", msg, res.status >= 400 && res.status < 600 ? res.status : 502);
    err.placesStatus = res.status;
    err.placesBody = data;
    throw err;
  }
  return data;
}

/**
 * @param {string} placeId - ChIJ... or places/ChIJ...
 * @param {string} apiKey
 * @param {string[]} fieldMask - e.g. ['id','displayName','rating','userRatingCount','reviews','location']
 */
async function getPlaceDetails(placeId, apiKey, fieldMask) {
  const id = normalizePlaceIdForPath(placeId);
  if (!id) {
    throw createAppError("INVALID_PLACE_ID", "subjectPlaceId is required", 400);
  }
  const pathId = encodeURIComponent(id);
  const url = `${PLACES_BASE}/places/${pathId}`;
  const mask = Array.isArray(fieldMask) && fieldMask.length ? fieldMask.join(",") : "id,displayName";
  return placesFetchJson(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": mask,
    },
  });
}

/**
 * Nearby search (same category competitors).
 * @param {{ latitude: number, longitude: number, radiusMeters: number, includedTypes: string[], maxResultCount?: number }} params
 */
async function searchNearby(params, apiKey) {
  const lat = Number(params.latitude);
  const lng = Number(params.longitude);
  const radius = Number(params.radiusMeters);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw createAppError("INVALID_LOCATION", "latitude and longitude must be numbers", 400);
  }
  if (!Number.isFinite(radius) || radius <= 0 || radius > 50000) {
    throw createAppError("INVALID_RADIUS", "radiusMeters must be between 1 and 50000", 400);
  }

  const includedTypes = Array.isArray(params.includedTypes) ? params.includedTypes : ["beauty_salon"];
  const maxResultCount = Math.min(20, Math.max(1, Number(params.maxResultCount) || 20));

  const body = {
    includedTypes: includedTypes,
    maxResultCount: maxResultCount,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radius,
      },
    },
  };

  return placesFetchJson(`${PLACES_BASE}/places:searchNearby`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.name,places.displayName,places.rating,places.userRatingCount,places.location",
    },
    body: JSON.stringify(body),
  });
}

function extractPlaceIdFromResource(nameOrId) {
  const s = String(nameOrId || "").trim();
  if (!s) return "";
  if (s.startsWith("places/")) return s.replace(/^places\//, "");
  return s;
}

module.exports = {
  extractPlaceIdFromResource,
  getPlaceDetails,
  normalizePlaceIdForPath,
  searchNearby,
};
