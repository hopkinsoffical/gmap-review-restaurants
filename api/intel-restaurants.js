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
    const salons = await listIntelSalons({ search: search });
    return sendJson(res, 200, { salons: salons, requiresSearch: search.length < 2 });
  } catch (error) {
    return handleApiError(res, error);
  }
};
