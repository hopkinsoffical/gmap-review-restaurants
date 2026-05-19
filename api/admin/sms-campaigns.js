const { requireAdmin } = require("../../lib/server/admin-guard");
const { getSupabaseAdmin } = require("../../lib/server/supabase");
const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../../lib/server/http");
const { createAppError } = require("../../lib/server/shared");
const { isSmsPipelineTableError } = require("../../lib/server/sms-pipeline");

function buildStatsForCampaign(messages, leadOptOut) {
  const stats = {
    queued: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    replied: 0,
    unsubscribedLeads: 0,
    totalMessages: messages.length,
  };

  const unsub = new Set();
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i];
    const st = String(m.status || "");
    if (st === "queued" || st === "sending") stats.queued += 1;
    if (m.twilio_sid) stats.sent += 1;
    if (st === "delivered") stats.delivered += 1;
    if (st === "failed" || st === "undelivered") stats.failed += 1;
    if (m.replied_at) stats.replied += 1;
    if (m.lead_id && leadOptOut.get(m.lead_id)) unsub.add(m.lead_id);
  }
  stats.unsubscribedLeads = unsub.size;
  return stats;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  try {
    await requireAdmin(req);
    const supabase = getSupabaseAdmin();

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const bodyTemplate = String(body.bodyTemplate || body.body_template || "").trim();
      const dailySendLimit = Number(body.dailySendLimit || body.daily_send_limit || 500);
      const status = String(body.status || "draft").trim();
      const messagingServiceSid = body.messagingServiceSid || body.messaging_service_sid || null;

      if (!name) {
        throw createAppError("INVALID_INPUT", "name is required.", 400);
      }
      if (!bodyTemplate) {
        throw createAppError("INVALID_INPUT", "bodyTemplate is required.", 400);
      }
      if (!Number.isFinite(dailySendLimit) || dailySendLimit < 1 || dailySendLimit > 100000) {
        throw createAppError("INVALID_INPUT", "dailySendLimit must be between 1 and 100000.", 400);
      }
      if (!["draft", "active", "paused", "completed"].includes(status)) {
        throw createAppError("INVALID_INPUT", "Invalid status.", 400);
      }

      const insert = await supabase
        .from("sms_campaigns")
        .insert({
          name: name,
          body_template: bodyTemplate,
          daily_send_limit: Math.floor(dailySendLimit),
          status: status,
          messaging_service_sid: messagingServiceSid ? String(messagingServiceSid).trim() : null,
        })
        .select("id, name, body_template, status, daily_send_limit, messaging_service_sid, created_at")
        .single();

      if (insert.error) {
        console.error("[admin/sms-campaigns] insert:", insert.error);
        if (isSmsPipelineTableError(insert.error, "sms_campaigns")) {
          throw createAppError(
            "SMS_TABLES_MISSING",
            "SMS tables are missing. Run sql/026_sms_campaign_pipeline.sql in Supabase.",
            503,
          );
        }
        throw createAppError("SMS_DB_ERROR", "Could not create campaign.", 500);
      }

      return sendJson(res, 201, { ok: true, campaign: insert.data });
    }

    const { data: campaigns, error: campErr } = await supabase
      .from("sms_campaigns")
      .select("id, name, body_template, status, daily_send_limit, messaging_service_sid, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (campErr) {
      console.error("[admin/sms-campaigns] list:", campErr);
      if (isSmsPipelineTableError(campErr, "sms_campaigns")) {
        throw createAppError(
          "SMS_TABLES_MISSING",
          "SMS tables are missing. Run sql/026_sms_campaign_pipeline.sql in Supabase.",
          503,
        );
      }
      throw createAppError("SMS_DB_ERROR", "Could not list campaigns.", 500);
    }

    const list = Array.isArray(campaigns) ? campaigns : [];
    const ids = list.map(function (c) {
      return c.id;
    });

    if (!ids.length) {
      return sendJson(res, 200, { ok: true, campaigns: [] });
    }

    const { data: messages, error: msgErr } = await supabase
      .from("sms_messages")
      .select("campaign_id, status, twilio_sid, replied_at, lead_id")
      .in("campaign_id", ids);

    if (msgErr) {
      console.error("[admin/sms-campaigns] messages:", msgErr);
      throw createAppError("SMS_DB_ERROR", "Could not load message stats.", 500);
    }

    const msgList = Array.isArray(messages) ? messages : [];
    const leadIds = Array.from(
      new Set(
        msgList.map(function (m) {
          return m.lead_id;
        }),
      ),
    ).filter(Boolean);

    const leadOptOut = new Map();
    if (leadIds.length) {
      const { data: leads, error: leadErr } = await supabase.from("sms_leads").select("id, opt_out").in("id", leadIds);
      if (leadErr) {
        console.error("[admin/sms-campaigns] leads:", leadErr);
        throw createAppError("SMS_DB_ERROR", "Could not load lead subscription state.", 500);
      }
      (Array.isArray(leads) ? leads : []).forEach(function (row) {
        if (row && row.id) leadOptOut.set(row.id, !!row.opt_out);
      });
    }

    const byCampaign = new Map();
    for (let i = 0; i < msgList.length; i += 1) {
      const m = msgList[i];
      const id = m.campaign_id;
      if (!byCampaign.has(id)) byCampaign.set(id, []);
      byCampaign.get(id).push(m);
    }

    const enriched = list.map(function (c) {
      const rows = byCampaign.get(c.id) || [];
      return {
        campaign: c,
        stats: buildStatsForCampaign(rows, leadOptOut),
      };
    });

    return sendJson(res, 200, { ok: true, campaigns: enriched });
  } catch (error) {
    return handleApiError(res, error);
  }
};
