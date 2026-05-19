const twilio = require("twilio");
const { getServerEnv } = require("./env");
const { createAppError } = require("./shared");

function requireTwilioConfig() {
  const env = getServerEnv();
  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    throw createAppError("ENV_MISSING", "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set.", 500);
  }
  if (!env.twilioMessagingServiceSid) {
    throw createAppError("ENV_MISSING", "TWILIO_MESSAGING_SERVICE_SID must be set.", 500);
  }
  return env;
}

function getTwilioClient() {
  const env = requireTwilioConfig();
  return twilio(env.twilioAccountSid, env.twilioAuthToken);
}

function buildTwilioWebhookUrl(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim() || "https";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  const rawUrl = String(req.url || "/");
  if (!host) return "";

  if (rawUrl.indexOf("://") >= 0) {
    try {
      const u = new URL(rawUrl);
      return proto + "://" + host + u.pathname + (u.search || "");
    } catch (e) {
      /* fall through */
    }
  }

  const path = rawUrl.charAt(0) === "/" ? rawUrl : "/" + rawUrl;
  return proto + "://" + host + path;
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {Record<string, string>} params Body fields Twilio POSTed (must include all keys for signature).
 */
function validateTwilioSignature(req, params) {
  const env = getServerEnv();
  if (!env.twilioAuthToken) return false;
  const signature = req.headers["x-twilio-signature"];
  if (!signature || typeof signature !== "string") return false;
  const url = buildTwilioWebhookUrl(req);
  if (!url) return false;
  try {
    return twilio.validateRequest(env.twilioAuthToken, signature, url, params);
  } catch (e) {
    console.error("[twilio-sms] validateRequest error:", e);
    return false;
  }
}

async function sendCampaignSms(options) {
  const env = requireTwilioConfig();
  const client = getTwilioClient();
  const messagingServiceSid = options.messagingServiceSid || env.twilioMessagingServiceSid;
  const payload = {
    to: options.to,
    body: options.body,
    messagingServiceSid: messagingServiceSid,
  };
  if (options.statusCallback) {
    payload.statusCallback = options.statusCallback;
  }
  return client.messages.create(payload);
}

module.exports = {
  buildTwilioWebhookUrl,
  getTwilioClient,
  requireTwilioConfig,
  sendCampaignSms,
  validateTwilioSignature,
};
