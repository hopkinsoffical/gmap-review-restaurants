const { getSupabaseAdmin } = require("../../lib/server/supabase");
const { readFormBody, methodNotAllowed } = require("../../lib/server/http");
const { validateTwilioSignature } = require("../../lib/server/twilio-sms");

function allowUnvalidatedWebhooks() {
  return String(process.env.TWILIO_SKIP_WEBHOOK_VALIDATION || "").trim() === "1";
}

function mapTwilioStatus(messageStatus) {
  const s = String(messageStatus || "").toLowerCase().trim();
  if (!s) return null;
  if (s === "delivered") return { status: "delivered", delivered: true, failed: false };
  if (s === "undelivered") return { status: "undelivered", delivered: false, failed: true };
  if (s === "failed") return { status: "failed", delivered: false, failed: true };
  if (s === "sent" || s === "sending" || s === "queued" || s === "accepted") {
    return { status: "sent", delivered: false, failed: false };
  }
  return { status: null, delivered: false, failed: false };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const params = await readFormBody(req);
    if (!allowUnvalidatedWebhooks() && !validateTwilioSignature(req, params)) {
      console.error("[twilio/status-callback] invalid Twilio signature");
      res.statusCode = 403;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Forbidden");
      return;
    }

    const sid = String(params.MessageSid || params.SmsSid || "").trim();
    if (!sid) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Missing MessageSid");
      return;
    }

    const rawStatus = params.MessageStatus || params.SmsStatus || "";
    const mapped = mapTwilioStatus(rawStatus);
    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();

    const patch = {
      last_twilio_status: String(rawStatus || "").slice(0, 64),
      updated_at: now,
    };

    if (mapped.status === "delivered") {
      patch.status = "delivered";
      patch.delivered_at = now;
    } else if (mapped.status === "undelivered") {
      patch.status = "undelivered";
      patch.failed_at = now;
    } else if (mapped.status === "failed") {
      patch.status = "failed";
      patch.failed_at = now;
    } else if (mapped.status === "sent") {
      patch.status = "sent";
    }

    if (params.ErrorCode) {
      patch.twilio_error_code = String(params.ErrorCode).slice(0, 64);
    }
    if (params.ErrorMessage) {
      patch.twilio_error_message = String(params.ErrorMessage).slice(0, 2000);
    }

    const { data: rows, error } = await supabase.from("sms_messages").update(patch).eq("twilio_sid", sid).select("id");

    if (error) {
      console.error("[twilio/status-callback] update failed:", error);
    } else if (!rows || !rows.length) {
      console.warn("[twilio/status-callback] no row for Twilio sid", sid);
    }

    res.statusCode = 204;
    res.end();
  } catch (error) {
    console.error("[twilio/status-callback]", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Error");
  }
};
