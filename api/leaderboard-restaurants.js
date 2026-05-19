const { handleApiError, methodNotAllowed, sendJson } = require("../lib/server/http");
const { getLeaderboardSalonBySlug, listLeaderboardSalons } = require("../lib/server/leaderboard-repo");

function querySlug(req) {
  const raw = req && req.query ? req.query.slug : "";
  if (Array.isArray(raw)) return String(raw[0] || "").trim();
  return String(raw || "").trim();
}

function queryGeo(req) {
  const q = req && req.query ? req.query : {};
  const pick = function (key) {
    const raw = q[key];
    const s = Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
    return s.trim();
  };
  return {
    state: pick("state"),
    county: pick("county"),
    town: pick("town"),
  };
}

function querySearchText(req) {
  const q = req && req.query ? req.query : {};
  const raw = q.q != null ? q.q : q.search;
  const s = Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
  return s.trim();
}

function queryPagination(req) {
  const q = req && req.query ? req.query : {};
  const raw = (v) => (Array.isArray(q[v]) ? q[v][0] : q[v]) || "";
  const limit = Math.min(Math.max(parseInt(raw("limit")) || 50, 1), 200);
  const offset = Math.max(parseInt(raw("offset")) || 0, 0);
  return { limit, offset };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  try {
    const slug = querySlug(req);

    if (slug) {
      const salon = await getLeaderboardSalonBySlug(slug);
      return sendJson(res, 200, {
        salon: salon,
        visibility: "full",
        scorecardRequiresAuth: false,
      });
    }

    const searchText = querySearchText(req);
    if (searchText) {
      const salons = await listLeaderboardSalons({
        search: searchText,
      });
      return sendJson(res, 200, {
        salons: salons,
        visibility: "full",
        previewScope: "global",
        scorecardRequiresAuth: false,
      });
    }

    const geo = queryGeo(req);
    const { limit, offset } = queryPagination(req);
    const geoActive = !!(geo.state && geo.county);
    const salons = await listLeaderboardSalons({
      limit,
      offset,
      state: geo.state || undefined,
      county: geo.county || undefined,
      town: geo.town || undefined,
    });

    // Cache at Vercel edge: 5 min fresh, 30 min stale-while-revalidate
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
    res.setHeader("Vary", "Accept-Encoding");

    return sendJson(res, 200, {
      salons: salons,
      limit,
      offset,
      visibility: "full",
      previewScope: geoActive ? "county" : "global",
      scorecardRequiresAuth: false,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
