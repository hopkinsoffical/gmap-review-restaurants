const { requireAdmin } = require("../../lib/server/admin-guard");
const { extractBearerToken } = require("../../lib/server/auth");
const { getServerEnv } = require("../../lib/server/env");
const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../../lib/server/http");
const { createAppError } = require("../../lib/server/shared");
const { getSupabaseAdmin } = require("../../lib/server/supabase");
const { listActiveCampaigns } = require("../../lib/server/sms-pipeline");
const { runSmsSendBatchCampaigns, statusCallbackUrl } = require("../../lib/server/sms-send-batch-run");
const { requireTwilioConfig } = require("../../lib/server/twilio-sms");

const DEFAULT_BATCH = 20;
const MAX_BATCH = 50;

async function authorizeCronOrAdmin(req) {
  const env = getServerEnv();
  const token = extractBearerToken(req);
  if (env.cronSecret && token && token === env.cronSecret) {
    return "cron";
  }
  await requireAdmin(req);
  return "admin";
}

module.exports = async function handler(req, res) {
  // Vercel Cron invokes the path with GET by default; admins may POST from tooling.
  if (req.method !== "POST" && req.method !== "GET") {
    return methodNotAllowed(res, ["POST", "GET"]);
  }

  try {
    await authorizeCronOrAdmin(req);
    requireTwilioConfig();

    const body = await readJsonBody(req);
    const batchSizeRaw = Number(body.batchSize || body.batch_size || DEFAULT_BATCH);
    const batchSize = Math.min(MAX_BATCH, Math.max(1, Number.isFinite(batchSizeRaw) ? batchSizeRaw : DEFAULT_BATCH));
    const singleCampaignId = String(body.campaignId || body.campaign_id || "").trim();

    if (!statusCallbackUrl()) {
      console.error("[sms/send-batch] APP_BASE_URL is missing; Twilio status callbacks will not fire.");
    }

    let campaigns = [];
    if (singleCampaignId) {
      const supabase = getSupabaseAdmin();
      const { data: one, error } = await supabase
        .from("sms_campaigns")
        .select("id, name, status, daily_send_limit, messaging_service_sid, body_template")
        .eq("id", singleCampaignId)
        .maybeSingle();

      if (error) {
        console.error("[sms/send-batch] load campaign:", error);
        throw createAppError("SMS_DB_ERROR", "Could not load campaign.", 500);
      }
      if (!one) {
        throw createAppError("NOT_FOUND", "Campaign not found.", 404);
      }
      if (one.status !== "active") {
        throw createAppError("CAMPAIGN_NOT_ACTIVE", "Campaign must be active to send messages.", 409);
      }
      campaigns = [one];
    } else {
      campaigns = await listActiveCampaigns();
    }

    if (!campaigns.length) {
      return sendJson(res, 200, {
        ok: true,
        sent: 0,
        campaignsOverDailyLimit: 0,
        skippedOptOut: 0,
        errors: 0,
        campaignsTouched: [],
        message: "No active campaigns to process.",
      });
    }

    const result = await runSmsSendBatchCampaigns(campaigns, batchSize);

    return sendJson(res, 200, {
      ok: true,
      sent: result.sent,
      campaignsOverDailyLimit: result.campaignsOverDailyLimit,
      skippedOptOut: result.skippedOptOut,
      errors: result.errors,
      campaignsTouched: result.campaignsTouched,
      detail: result.detail,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
