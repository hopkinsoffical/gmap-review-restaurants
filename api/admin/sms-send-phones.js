const { requireAdmin } = require("../../lib/server/admin-guard");
const { getSupabaseAdmin } = require("../../lib/server/supabase");
const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../../lib/server/http");
const { createAppError } = require("../../lib/server/shared");
const {
  ensureSmsLeadByPhone,
  isSmsPipelineTableError,
  parsePhonesFromInput,
  renderTemplate,
} = require("../../lib/server/sms-pipeline");
const { runSmsSendBatchCampaigns } = require("../../lib/server/sms-send-batch-run");
const { requireTwilioConfig } = require("../../lib/server/twilio-sms");

const MAX_PHONES = 200;
const MAX_MESSAGE_LEN = 1200;
const SEND_CHUNK = 50;
const MAX_SEND_ROUNDS = 80;

async function loadCampaignForSending(supabase, campaignId) {
  const { data, error } = await supabase
    .from("sms_campaigns")
    .select("id, name, status, daily_send_limit, messaging_service_sid, body_template")
    .eq("id", campaignId)
    .single();

  if (error || !data) {
    console.error("[admin/sms-send-phones] load campaign:", error);
    throw createAppError("SMS_DB_ERROR", "Could not load campaign for sending.", 500);
  }
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    await requireAdmin(req);
    const body = await readJsonBody(req);
    const message = String(body.message || body.body || "").trim();
    const sendImmediately = body.sendImmediately === true || body.send_immediately === true;
    const campaignNameRaw = String(body.campaignName || body.campaign_name || "").trim();

    const parsed = parsePhonesFromInput(body.phones != null ? body.phones : body.phoneNumbers || body.phone_numbers);
    const phones = parsed.phones;

    if (!message) {
      throw createAppError("INVALID_INPUT", "message is required.", 400);
    }
    if (message.length > MAX_MESSAGE_LEN) {
      throw createAppError("INVALID_INPUT", "message must be at most " + MAX_MESSAGE_LEN + " characters.", 400);
    }
    if (!phones.length) {
      throw createAppError(
        "INVALID_INPUT",
        "No valid E.164 phone numbers. Use +1… or 10-digit US numbers (one per line or comma-separated).",
        400,
      );
    }
    if (phones.length > MAX_PHONES) {
      throw createAppError("INVALID_INPUT", "At most " + MAX_PHONES + " numbers per request.", 400);
    }

    const supabase = getSupabaseAdmin();
    const iso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const campaignName = campaignNameRaw || "Internal · " + iso;
    const dailyLimit = Math.max(phones.length + 100, 500);

    const campaignInsert = await supabase
      .from("sms_campaigns")
      .insert({
        name: campaignName.slice(0, 200),
        body_template: message,
        status: "active",
        daily_send_limit: dailyLimit,
        messaging_service_sid: body.messagingServiceSid || body.messaging_service_sid || null,
      })
      .select("id, name, body_template, status, daily_send_limit, messaging_service_sid")
      .single();

    if (campaignInsert.error) {
      console.error("[admin/sms-send-phones] campaign insert:", campaignInsert.error);
      if (isSmsPipelineTableError(campaignInsert.error, "sms_campaigns")) {
        throw createAppError(
          "SMS_TABLES_MISSING",
          "SMS tables are missing. Run sql/026_sms_campaign_pipeline.sql in Supabase.",
          503,
        );
      }
      throw createAppError("SMS_DB_ERROR", "Could not create campaign.", 500);
    }

    const campaignId = campaignInsert.data.id;
    let queued = 0;
    let skippedOptOut = 0;
    let skippedDuplicate = 0;

    for (let i = 0; i < phones.length; i += 1) {
      const phoneE164 = phones[i];
      const lead = await ensureSmsLeadByPhone(phoneE164, "internal_ui");
      if (lead.opt_out) {
        skippedOptOut += 1;
        continue;
      }

      const { data: leadRow, error: leadLoadErr } = await supabase
        .from("sms_leads")
        .select("id, name, phone_e164, opt_out, metadata")
        .eq("id", lead.id)
        .maybeSingle();

      if (leadLoadErr || !leadRow) {
        console.error("[admin/sms-send-phones] lead reload:", leadLoadErr);
        throw createAppError("SMS_DB_ERROR", "Could not load lead for message body.", 500);
      }

      const text = renderTemplate(message, leadRow);
      const ins = await supabase.from("sms_messages").insert({
        campaign_id: campaignId,
        lead_id: lead.id,
        to_phone_e164: phoneE164,
        body: text,
        status: "queued",
      });

      if (ins.error) {
        const msg = String(ins.error.message || ins.error.details || "");
        if (msg.indexOf("sms_messages_campaign_lead_uidx") >= 0 || String(ins.error.code) === "23505") {
          skippedDuplicate += 1;
          continue;
        }
        console.error("[admin/sms-send-phones] message insert:", ins.error);
        if (isSmsPipelineTableError(ins.error, "sms_messages")) {
          throw createAppError(
            "SMS_TABLES_MISSING",
            "sms_messages table is missing. Run sql/026_sms_campaign_pipeline.sql.",
            503,
          );
        }
        throw createAppError("SMS_QUEUE_FAILED", "Could not queue message.", 500);
      }
      queued += 1;
    }

    const response = {
      ok: true,
      campaignId: campaignId,
      campaignName: campaignInsert.data.name,
      rawTokenCount: parsed.rawTokenCount,
      validNumbers: phones.length,
      invalidTokenCount: parsed.invalidCount,
      queued: queued,
      skippedOptOut: skippedOptOut,
      skippedDuplicate: skippedDuplicate,
      sendImmediately: sendImmediately,
      sendResult: null,
    };

    if (sendImmediately && queued > 0) {
      requireTwilioConfig();
      const campaignRow = await loadCampaignForSending(supabase, campaignId);
      if (campaignRow.status !== "active") {
        throw createAppError("CAMPAIGN_NOT_ACTIVE", "Campaign is not active.", 409);
      }

      let totalSent = 0;
      let totalErrors = 0;
      let totalSkippedOptOut = 0;
      let rounds = 0;

      while (rounds < MAX_SEND_ROUNDS) {
        const batch = await runSmsSendBatchCampaigns([campaignRow], SEND_CHUNK);
        totalSent += batch.sent;
        totalErrors += batch.errors;
        totalSkippedOptOut += batch.skippedOptOut;
        rounds += 1;
        if (batch.sent === 0) break;
      }

      response.sendResult = {
        sent: totalSent,
        errors: totalErrors,
        skippedOptOut: totalSkippedOptOut,
        rounds: rounds,
      };
    }

    return sendJson(res, 200, response);
  } catch (error) {
    return handleApiError(res, error);
  }
};
