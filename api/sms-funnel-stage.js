const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/server/http");
const { setFunnelStage } = require("../lib/server/sms-funnel-orchestrator");

function verifySecret(req) {
  const expected = String(process.env.SMS_FUNNEL_REGISTER_SECRET || "").trim();
  if (!expected) return false;
  const got = String(req.headers["x-sms-funnel-secret"] || "").trim();
  return got === expected;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    if (!verifySecret(req)) {
      return sendJson(res, 403, { ok: false, error: "forbidden" });
    }

    const body = await readJsonBody(req);
    const sessionId = String(body.session_id || "").trim();
    const stage = String(body.stage || "").trim();
    if (!sessionId || !stage) {
      return sendJson(res, 400, { ok: false, error: "missing_session_or_stage" });
    }

    const out = await setFunnelStage(sessionId, stage, body.meta || {});
    if (!out.ok) {
      return sendJson(res, 400, out);
    }
    return sendJson(res, 200, out);
  } catch (error) {
    return handleApiError(res, error);
  }
};
