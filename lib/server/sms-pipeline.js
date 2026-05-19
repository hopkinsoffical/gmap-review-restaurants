const { ensureLocalEnvLoaded } = require("./env");
const { getSupabaseAdmin } = require("./supabase");
const { createAppError } = require("./shared");

const DEFAULT_ANALYSIS_REPORTS_BASE = "https://www.rankmysalon.ai/analysis-reports";

function leadMetadataObject(lead) {
  const raw = lead && lead.metadata;
  if (!raw || typeof raw !== "object") return {};
  return raw;
}

/**
 * Replace placeholders in outbound SMS bodies.
 * {{name}} and {{salon_name}} both use sms_leads.name (salon / business display name).
 * Per-lead link: metadata.report_url or metadata.report_slug; optional metadata.slug.
 */
function renderTemplate(template, lead) {
  ensureLocalEnvLoaded();
  const meta = leadMetadataObject(lead);
  const salonName = lead && lead.name ? String(lead.name).trim() : "";
  const slug = meta.slug != null ? String(meta.slug).trim() : "";
  const reportSlug = meta.report_slug != null ? String(meta.report_slug).trim() : "";
  let reportUrl = meta.report_url != null ? String(meta.report_url).trim() : "";
  if (!reportUrl && reportSlug) {
    const base = String(process.env.RANKMYSALON_ANALYSIS_REPORTS_BASE_URL || DEFAULT_ANALYSIS_REPORTS_BASE).replace(
      /\/+$/,
      "",
    );
    reportUrl = base + "/" + reportSlug;
  }

  const greetingName = salonName || "there";
  let out = String(template || "");
  out = out.replace(/\{\{\s*salon_name\s*\}\}/gi, greetingName);
  out = out.replace(/\{\{\s*name\s*\}\}/gi, greetingName);
  out = out.replace(/\{\{\s*slug\s*\}\}/gi, slug);
  out = out.replace(/\{\{\s*report_slug\s*\}\}/gi, reportSlug);
  out = out.replace(/\{\{\s*report_url\s*\}\}/gi, reportUrl);
  return out;
}

function utcDayStartIso() {
  const d = new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return start.toISOString();
}

/**
 * Best-effort US-centric E.164 normalization for salon marketing lists.
 */
function normalizePhoneE164(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;

  const digits = s.replace(/\D/g, "");
  if (!digits) return null;

  if (s.startsWith("+")) {
    if (digits.length >= 10) return "+" + digits;
    return null;
  }

  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.charAt(0) === "1") return "+" + digits;

  return null;
}

/**
 * Split pasted lists (newlines, commas, semicolons). Dedupe by E.164.
 * @returns {{ phones: string[], invalidCount: number, rawTokenCount: number }}
 */
function parsePhonesFromInput(input) {
  const list = Array.isArray(input)
    ? input.map(function (x) {
        return String(x || "").trim();
      })
    : String(input || "")
        .split(/[\r\n,;]+/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);

  const rawTokenCount = list.length;
  const seen = new Set();
  const phones = [];
  let invalidCount = 0;

  for (let i = 0; i < list.length; i += 1) {
    const e164 = normalizePhoneE164(list[i]);
    if (!e164) {
      invalidCount += 1;
      continue;
    }
    if (seen.has(e164)) continue;
    seen.add(e164);
    phones.push(e164);
  }

  return { phones: phones, invalidCount: invalidCount, rawTokenCount: rawTokenCount };
}

async function ensureSmsLeadByPhone(phoneE164, sourceTag) {
  const supabase = getSupabaseAdmin();
  const tag = String(sourceTag || "internal_ui").slice(0, 64);

  const existing = await supabase.from("sms_leads").select("id, opt_out").eq("phone_e164", phoneE164).maybeSingle();

  if (existing.error) {
    console.error("[sms-pipeline] ensureSmsLeadByPhone lookup:", existing.error);
    throw createAppError("SMS_DB_ERROR", "Could not load SMS lead.", 500);
  }

  if (existing.data && existing.data.id) {
    return { id: existing.data.id, opt_out: !!existing.data.opt_out };
  }

  const ins = await supabase
    .from("sms_leads")
    .insert({
      phone_e164: phoneE164,
      source: tag,
      opt_out: false,
    })
    .select("id")
    .single();

  if (ins.error) {
    if (String(ins.error.code) === "23505") {
      const again = await supabase.from("sms_leads").select("id, opt_out").eq("phone_e164", phoneE164).maybeSingle();
      if (again.data && again.data.id) {
        return { id: again.data.id, opt_out: !!again.data.opt_out };
      }
    }
    console.error("[sms-pipeline] ensureSmsLeadByPhone insert:", ins.error);
    if (isSmsPipelineTableError(ins.error, "sms_leads")) {
      throw createAppError(
        "SMS_TABLES_MISSING",
        "sms_leads table is missing. Run sql/026_sms_campaign_pipeline.sql.",
        503,
      );
    }
    throw createAppError("SMS_DB_ERROR", "Could not create SMS lead.", 500);
  }

  return { id: ins.data.id, opt_out: false };
}

function isSmsPipelineTableError(error, tableName) {
  if (!error || typeof error !== "object") return false;
  const raw = String(error.message || error.details || "").toLowerCase();
  if (raw.indexOf(String(tableName || "").toLowerCase()) < 0) return false;
  if (String(error.code || "") === "42P01") return true;
  if (raw.indexOf("does not exist") >= 0) return true;
  return false;
}

async function countSentTodayForCampaign(campaignId) {
  const supabase = getSupabaseAdmin();
  const since = utcDayStartIso();
  const { count, error } = await supabase
    .from("sms_messages")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .not("twilio_sid", "is", null)
    .gte("sent_at", since);

  if (error) {
    console.error("[sms-pipeline] countSentTodayForCampaign:", error);
    throw createAppError("SMS_DB_ERROR", "Could not load send counts for campaign.", 500);
  }
  return Number(count) || 0;
}

async function listActiveCampaigns() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sms_campaigns")
    .select("id, name, status, daily_send_limit, messaging_service_sid, body_template")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[sms-pipeline] listActiveCampaigns:", error);
    if (isSmsPipelineTableError(error, "sms_campaigns")) {
      throw createAppError(
        "SMS_TABLES_MISSING",
        "SMS tables are missing. Run sql/026_sms_campaign_pipeline.sql in Supabase, then reload the API schema cache.",
        503,
      );
    }
    throw createAppError("SMS_DB_ERROR", "Could not load campaigns.", 500);
  }
  return Array.isArray(data) ? data : [];
}

async function fetchQueuedBatch(campaignId, limit) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sms_messages")
    .select("id, campaign_id, lead_id, to_phone_e164, body, status")
    .eq("campaign_id", campaignId)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[sms-pipeline] fetchQueuedBatch:", error);
    throw createAppError("SMS_DB_ERROR", "Could not load queued messages.", 500);
  }
  return Array.isArray(data) ? data : [];
}

async function markMessagesSending(ids) {
  if (!ids.length) return;
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase.from("sms_messages").update({ status: "sending", updated_at: now }).in("id", ids);

  if (error) {
    console.error("[sms-pipeline] markMessagesSending:", error);
    throw createAppError("SMS_DB_ERROR", "Could not claim messages for sending.", 500);
  }
}

async function loadLeadsOptOut(leadIds) {
  const uniq = Array.from(new Set(leadIds.filter(Boolean)));
  if (!uniq.length) return new Map();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("sms_leads").select("id, opt_out").in("id", uniq);

  if (error) {
    console.error("[sms-pipeline] loadLeadsOptOut:", error);
    throw createAppError("SMS_DB_ERROR", "Could not load lead subscription state.", 500);
  }

  const map = new Map();
  (Array.isArray(data) ? data : []).forEach(function (row) {
    if (row && row.id) map.set(row.id, !!row.opt_out);
  });
  return map;
}

async function updateMessageSent(rowId, twilioSid) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("sms_messages")
    .update({
      status: "sent",
      twilio_sid: twilioSid,
      sent_at: now,
      last_twilio_status: "sent",
      updated_at: now,
    })
    .eq("id", rowId);

  if (error) {
    console.error("[sms-pipeline] updateMessageSent:", error);
  }
}

async function updateMessageSendFailed(rowId, code, message) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("sms_messages")
    .update({
      status: "failed",
      twilio_error_code: code ? String(code) : null,
      twilio_error_message: message ? String(message).slice(0, 2000) : null,
      failed_at: now,
      updated_at: now,
    })
    .eq("id", rowId);

  if (error) {
    console.error("[sms-pipeline] updateMessageSendFailed:", error);
  }
}

async function cancelMessageOptOut(rowId) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  await supabase
    .from("sms_messages")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", rowId);
}

module.exports = {
  cancelMessageOptOut,
  ensureSmsLeadByPhone,
  fetchQueuedBatch,
  isSmsPipelineTableError,
  listActiveCampaigns,
  loadLeadsOptOut,
  markMessagesSending,
  normalizePhoneE164,
  parsePhonesFromInput,
  renderTemplate,
  countSentTodayForCampaign,
  updateMessageSendFailed,
  updateMessageSent,
  utcDayStartIso,
};
