/**
 * Places API payload for brief reports — memory cache + DB fallback.
 */

const { getSupabaseAdmin } = require("./supabase");
const { fetchPlaceData, placeDataFromStoreRow } = require("./fetch-place-data");

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PLACES_FETCH_TIMEOUT_MS = 2800;
const memoryPlaceCache = new Map();

/**
 * Resolve ChIJ… place id from leaderboard/stores row.
 * @param {{ google_place_id?: string, place_id?: string, google_review_url?: string }} storeRow
 */
function resolvePlaceIdForStore(storeRow) {
  const fromColumn = String(storeRow.google_place_id || storeRow.place_id || "").trim();
  if (fromColumn) return fromColumn;

  const url = String(storeRow.google_review_url || storeRow.google_review_fallback_url || "").trim();
  if (!url) return "";

  const encoded = url.match(/!1s([^:!]+):0x/i);
  if (encoded && encoded[1]) return encoded[1];

  const pathMatch = url.match(/\/place\/([^/?]+)/i);
  if (pathMatch && pathMatch[1]) {
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch (e) {
      return pathMatch[1];
    }
  }

  return "";
}

function readCacheFromIntelReport(intelReport) {
  const report = intelReport && typeof intelReport === "object" && !Array.isArray(intelReport) ? intelReport : {};
  const cache = report.placeApiCache;
  const fetchedAt = report.placeApiFetchedAt;
  if (!cache || typeof cache !== "object" || !fetchedAt) return null;

  const age = Date.now() - new Date(fetchedAt).getTime();
  if (!Number.isFinite(age) || age > CACHE_TTL_MS) return null;
  return cache;
}

function readMemoryPlaceCache(placeId) {
  const key = String(placeId || "").trim();
  if (!key) return null;
  const entry = memoryPlaceCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    memoryPlaceCache.delete(key);
    return null;
  }
  return entry.data;
}

function writeMemoryPlaceCache(placeId, placeData) {
  const key = String(placeId || "").trim();
  if (!key || !placeData) return;
  memoryPlaceCache.set(key, { at: Date.now(), data: placeData });
}

async function writeCacheToStore(storeId, placeData) {
  const supabase = getSupabaseAdmin();
  const { data: row, error: readErr } = await supabase.from("stores").select("intel_report").eq("id", storeId).maybeSingle();
  if (readErr) throw readErr;

  const existing =
    row && row.intel_report && typeof row.intel_report === "object" && !Array.isArray(row.intel_report)
      ? row.intel_report
      : {};

  const nextReport = Object.assign({}, existing, {
    placeApiCache: placeData,
    placeApiFetchedAt: placeData.fetchedAt,
  });

  const { error: writeErr } = await supabase.from("stores").update({ intel_report: nextReport }).eq("id", storeId);
  if (writeErr) throw writeErr;
}

function fetchPlaceDataWithTimeout(placeId) {
  return Promise.race([
    fetchPlaceData(placeId),
    new Promise(function (_resolve, reject) {
      setTimeout(function () {
        reject(new Error("Places API timeout"));
      }, PLACES_FETCH_TIMEOUT_MS);
    }),
  ]);
}

/**
 * @param {{ id: string, google_place_id?: string, place_id?: string, intel_report?: object }} storeRow
 */
async function getPlaceDataCached(storeRow) {
  const placeId = resolvePlaceIdForStore(storeRow);
  const dbFallback = function () {
    return placeDataFromStoreRow(storeRow);
  };

  const cached = readCacheFromIntelReport(storeRow.intel_report);
  if (cached) return cached;

  if (!placeId) {
    return dbFallback();
  }

  const memCached = readMemoryPlaceCache(placeId);
  if (memCached) return memCached;

  try {
    const fresh = await fetchPlaceDataWithTimeout(placeId);
    writeMemoryPlaceCache(placeId, fresh);
    if (storeRow.id && Object.prototype.hasOwnProperty.call(storeRow, "intel_report")) {
      writeCacheToStore(storeRow.id, fresh).catch(function (err) {
        console.error("[Places] Failed to write intel_report cache:", err);
      });
    }
    return fresh;
  } catch (err) {
    console.warn("[Places] fetch failed, using DB fallback:", err && err.message ? err.message : err);
    return dbFallback();
  }
}

module.exports = {
  getPlaceDataCached,
  resolvePlaceIdForStore,
  CACHE_TTL_MS,
  PLACES_FETCH_TIMEOUT_MS,
};
