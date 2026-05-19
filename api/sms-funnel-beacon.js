const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/server/http");
const { handleBeacon } = require("../lib/server/sms-funnel-orchestrator");

function verifyBeaconToken(req) {
  const expected = String(process.env.SMS_FUNNEL_BEACON_RUNTIME_TOKEN || "").trim();
  if (!expected) return true;
  const got = String(req.headers["x-sms-beacon-token"] || req.headers["X-Sms-Beacon-Token"] || "").trim();
  return got === expected;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    if (!verifyBeaconToken(req)) {
      return sendJson(res, 403, { ok: false, error: "invalid_beacon_token" });
    }

    const body = await readJsonBody(req);
    const slug = String(body.slug || "").trim();
    const salonName = String(body.salonName || body.name || "").trim();
    const event = String(body.event || "report_view").trim();
    if (event !== "report_view") {
      return sendJson(res, 400, { ok: false, error: "unsupported_event" });
    }

    const out = await handleBeacon({ slug, salonName });
    return sendJson(res, 200, out);
  } catch (error) {
    return handleApiError(res, error);
  }
};
