const { extractBearerToken, verifyAccessToken } = require("../lib/server/auth");
const { createAppError } = require("../lib/server/shared");
const { getServerEnv } = require("../lib/server/env");
const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/server/http");
const { refreshLeaderboardSalonFromPlaces } = require("../lib/server/leaderboard-refresh");

async function assertRefreshAuthorized(req) {
  const env = getServerEnv();
  const secret = String(env.leaderboardRefreshSecret || "").trim();
  const headerSecret = String((req.headers && req.headers["x-leaderboard-refresh-secret"]) || "").trim();
  if (secret && headerSecret === secret) {
    return { kind: "secret" };
  }

  const token = extractBearerToken(req);
  if (!token) {
    throw createAppError("UNAUTHORIZED", "Bearer token or x-leaderboard-refresh-secret required.", 401);
  }

  const session = await verifyAccessToken(token);
  if (String(session.profile.globalRole || "").toLowerCase() !== "admin") {
    throw createAppError("FORBIDDEN", "Only admins can refresh leaderboard profiles.", 403);
  }
  return { kind: "admin" };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    await assertRefreshAuthorized(req);
    const body = await readJsonBody(req);
    const slug = String((body && body.slug) || "")
      .trim()
      .toLowerCase();
    if (!slug) {
      throw createAppError("INVALID_INPUT", "slug is required in JSON body.", 400);
    }
    const placeId = body.placeId != null ? String(body.placeId).trim() : "";

    const summary = await refreshLeaderboardSalonFromPlaces({
      slug: slug,
      placeId: placeId || undefined,
    });

    return sendJson(res, 200, { ok: true, summary: summary });
  } catch (error) {
    return handleApiError(res, error);
  }
};
