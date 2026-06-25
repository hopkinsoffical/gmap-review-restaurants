const { methodNotAllowed, sendJson } = require("../lib/server/http");
const { US_STATE_ABBR_FULL } = require("../lib/server/leaderboard-geo-variants");

function pickHeader(req, name) {
  const raw = req && req.headers ? req.headers[name] : "";
  return String(Array.isArray(raw) ? raw[0] : raw || "").trim();
}

function normalizeState(region) {
  const raw = String(region || "").trim();
  if (!raw) return "";
  if (raw.length === 2) return raw.toUpperCase();
  const lower = raw.toLowerCase();
  for (const ab of Object.keys(US_STATE_ABBR_FULL)) {
    const pair = US_STATE_ABBR_FULL[ab];
    if (pair[1].toLowerCase() === lower) return ab;
  }
  return raw;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const city =
    pickHeader(req, "x-vercel-ip-city") ||
    pickHeader(req, "cf-ipcity") ||
    pickHeader(req, "x-appengine-city");
  const region =
    pickHeader(req, "x-vercel-ip-country-region") ||
    pickHeader(req, "cf-region-code") ||
    pickHeader(req, "x-appengine-region");

  const state = normalizeState(region);
  const payload = {
    city: city || "",
    state: state || "",
    source: city || state ? "edge" : "unknown",
  };

  res.setHeader("Cache-Control", "private, max-age=3600");
  return sendJson(res, 200, payload);
};
