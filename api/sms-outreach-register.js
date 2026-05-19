const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/server/http");
const { handleRegister } = require("../lib/server/sms-funnel-orchestrator");

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
    const slug = String(body.slug || "").trim();
    const to_e164 = String(body.to_e164 || body.to || "").trim();
    const initial_message_sid = String(body.initial_message_sid || body.message_sid || "").trim();
    if (!slug || !to_e164 || !initial_message_sid) {
      return sendJson(res, 400, { ok: false, error: "missing_slug_to_or_sid" });
    }

    const out = await handleRegister({ slug, to_e164, initial_message_sid });
    return sendJson(res, 200, out);
  } catch (error) {
    return handleApiError(res, error);
  }
};
