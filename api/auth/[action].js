const {
  bootstrapPhoneUserProfile,
  registerUser,
  resolveIdentifierToEmail,
  extractBearerToken,
  verifyAccessToken,
} = require("../../lib/server/auth");
const { createAppError } = require("../../lib/server/shared");
const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../../lib/server/http");

function getActionParam(req) {
  const raw = req && req.query ? req.query.action : "";
  return Array.isArray(raw) ? String(raw[0] || "").trim() : String(raw || "").trim();
}

module.exports = async function handler(req, res) {
  const action = getActionParam(req);

  try {
    if (action === "register") {
      if (req.method !== "POST") {
        return methodNotAllowed(res, ["POST"]);
      }

      const body = await readJsonBody(req);
      const profile = await registerUser(body);
      return sendJson(res, 201, {
        user: profile,
      });
    }

    if (action === "resolve-identifier") {
      if (req.method !== "POST") {
        return methodNotAllowed(res, ["POST"]);
      }

      const body = await readJsonBody(req);
      const email = await resolveIdentifierToEmail(body && body.identifier);
      return sendJson(res, 200, {
        email: email,
      });
    }

    if (action === "session") {
      if (req.method !== "GET") {
        return methodNotAllowed(res, ["GET"]);
      }

      const accessToken = extractBearerToken(req);
      if (!accessToken) {
        return sendJson(res, 200, {
          authenticated: false,
          user: null,
        });
      }

      const session = await verifyAccessToken(accessToken);
      return sendJson(res, 200, {
        authenticated: true,
        user: {
          id: session.profile.id,
          email: session.profile.email,
          phone: session.profile.phone || "",
          username: session.profile.username,
          globalRole: session.profile.globalRole,
          status: session.profile.status,
          fullName: session.profile.fullName,
        },
      });
    }

    if (action === "bootstrap-phone-profile") {
      if (req.method !== "POST") {
        return methodNotAllowed(res, ["POST"]);
      }

      const accessToken = extractBearerToken(req);
      const body = await readJsonBody(req);
      const profile = await bootstrapPhoneUserProfile(accessToken, body);
      return sendJson(res, 200, {
        user: profile,
      });
    }

    throw createAppError("NOT_FOUND", "Auth route not found", 404);
  } catch (error) {
    return handleApiError(res, error);
  }
};
