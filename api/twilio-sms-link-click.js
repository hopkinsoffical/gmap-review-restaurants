const twilio = require("twilio");
const { handleApiError, methodNotAllowed, readRawBody, sendJson } = require("../lib/server/http");
const { handleTwilioLinkClick } = require("../lib/server/sms-funnel-orchestrator");

function parseTwilioBody(raw) {
  const text = String(raw || "").trim();
  if (!text) return {};
  if (text.charAt(0) === "{") {
    try {
      return JSON.parse(text);
    } catch (e) {
      return {};
    }
  }
  const params = new URLSearchParams(text);
  return Object.fromEntries(params.entries());
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const raw = await readRawBody(req);
    const body = parseTwilioBody(raw);
    const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
    const skip = String(process.env.TWILIO_SKIP_LINK_CLICK_SIGNATURE || "").toLowerCase() === "true";

    if (!skip) {
      if (!authToken) {
        return sendJson(res, 500, { ok: false, error: "TWILIO_AUTH_TOKEN missing" });
      }
      const signature = String(req.headers["x-twilio-signature"] || "");
      const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim() || "https";
      const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
      const pathOnly = String(req.url || "").split("?")[0];
      const url = `${proto}://${host}${pathOnly}`;
      const valid = twilio.validateRequest(authToken, signature, url, body);
      if (!valid) {
        return sendJson(res, 403, { ok: false, error: "invalid_signature" });
      }
    }

    const out = await handleTwilioLinkClick(body);
    if (out && out.error) {
      return sendJson(res, 400, { ok: false, error: out.error });
    }
    return sendJson(res, 200, out);
  } catch (error) {
    return handleApiError(res, error);
  }
};
