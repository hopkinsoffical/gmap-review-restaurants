const { handleApiError, methodNotAllowed, sendJson } = require("../lib/server/http");
const { listIntelSalons, getIntelSalonDetail } = require("../lib/server/intel-repo");

function querySlug(req) {
  const raw = req && req.query ? req.query.slug : "";
  if (Array.isArray(raw)) return String(raw[0] || "").trim();
  return String(raw || "").trim();
}

function querySearch(req) {
  const q = req && req.query ? req.query : {};
  const raw = q.q != null ? q.q : q.search;
  const s = Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
  return s.trim();
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
    city: pick("city") || pick("town"),
    town: pick("town") || pick("city"),
  };
}

function queryPagination(req) {
  const q = req && req.query ? req.query : {};
  const raw = (v) => (Array.isArray(q[v]) ? q[v][0] : q[v]) || "";
  const limit = Math.min(Math.max(parseInt(raw("limit"), 10) || 20, 1), 200);
  const offset = Math.max(parseInt(raw("offset"), 10) || 0, 0);
  return { limit, offset };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  try {
    const slug = querySlug(req);
    if (slug) {
      const detail = await getIntelSalonDetail(slug);
      res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
      res.setHeader("Vary", "Accept-Encoding");
      return sendJson(res, 200, detail);
    }

    const search = querySearch(req);
    const geo = queryGeo(req);
    const { limit, offset } = queryPagination(req);
    const result = await listIntelSalons({
      search: search,
      limit,
      offset,
      state: geo.state || undefined,
      county: geo.county || undefined,
      city: geo.city || undefined,
      town: geo.town || undefined,
    });

    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    res.setHeader("Vary", "Accept-Encoding");

    return sendJson(res, 200, {
      salons: result.salons,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      geo: geo.state || geo.city ? geo : null,
      requiresSearch: search.length < 2 && !(geo.state || geo.city),
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
