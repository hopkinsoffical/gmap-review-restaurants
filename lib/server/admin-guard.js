const { createAppError } = require("./shared");
const { extractBearerToken, verifyAccessToken } = require("./auth");

async function requireAuthenticated(req) {
  const accessToken = extractBearerToken(req);
  return verifyAccessToken(accessToken);
}

async function requireAdmin(req) {
  const session = await requireAuthenticated(req);
  if (!session.profile || session.profile.globalRole !== "admin") {
    throw createAppError("FORBIDDEN", "Admin access is required", 403);
  }
  return session;
}

module.exports = {
  requireAdmin,
  requireAuthenticated,
};
