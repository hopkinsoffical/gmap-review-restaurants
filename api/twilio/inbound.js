const twilio = require("twilio");
const { getSupabaseAdmin } = require("../../lib/server/supabase");
const { readFormBody, methodNotAllowed } = require("../../lib/server/http");
const { validateTwilioSignature } = require("../../lib/server/twilio-sms");
const { isSmsPipelineTableError, normalizePhoneE164 } = require("../../lib/server/sms-pipeline");

function allowUnvalidatedWebhooks() {
  return String(process.env.TWILIO_SKIP_WEBHOOK_VALIDATION || "").trim() === "1";
}

const STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);

function normalizeKeywordBody(body) {
  return String(body || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function sendTwiml(res, twiml) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.end(twiml.toString());
}

function normalizeInboundPhone(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  return normalizePhoneE164(value) || normalizePhoneE164("+" + value.replace(/\D/g, ""));
}

async function findLatestMessageIdForLead(supabase, leadId) {
  const { data: latest, error: findErr } = await supabase
    .from("sms_messages")
    .select("id")
    .eq("lead_id", leadId)
    .not("twilio_sid", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) {
    console.error("[twilio/inbound] latest message lookup:", findErr);
    return null;
  }
  return latest && latest.id ? latest.id : null;
}

async function attachReplyToMessage(supabase, messageId, snippet, now) {
  if (!messageId) return;
  await supabase
    .from("sms_messages")
    .update({
      replied_at: now,
      reply_snippet: String(snippet || "").slice(0, 320),
      updated_at: now,
    })
    .eq("id", messageId);
}

async function recordInboundMessage(supabase, params, info) {
  const row = {
    lead_id: info.leadId || null,
    sms_message_id: info.messageId || null,
    from_phone_raw: String(info.fromRaw || ""),
    from_phone_e164: info.fromPhoneE164 || null,
    to_phone_raw: String(info.toRaw || ""),
    to_phone_e164: info.toPhoneE164 || null,
    body: String(info.bodyRaw || ""),
    twilio_message_sid: String(params.MessageSid || params.SmsSid || "").trim() || null,
    twilio_account_sid: String(params.AccountSid || "").trim() || null,
    twilio_messaging_service_sid: String(params.MessagingServiceSid || "").trim() || null,
    twilio_status: String(params.MessageStatus || params.SmsStatus || "").trim() || null,
    keyword: info.keyword || null,
    is_opt_out: !!info.isOptOut,
    is_help: !!info.isHelp,
    is_confirm: !!info.isConfirm,
    payload: params,
  };

  const result = await supabase.from("sms_inbound_messages").upsert(row, {
    onConflict: "twilio_message_sid",
  });

  if (!result.error) {
    return;
  }

  if (isSmsPipelineTableError(result.error, "sms_inbound_messages")) {
    console.error("[twilio/inbound] sms_inbound_messages missing; run sql/028_sms_inbound_messages.sql");
    return;
  }

  console.error("[twilio/inbound] inbound message insert:", result.error);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  const twiml = new twilio.twiml.MessagingResponse();

  try {
    const params = await readFormBody(req);
    if (!allowUnvalidatedWebhooks() && !validateTwilioSignature(req, params)) {
      console.error("[twilio/inbound] invalid Twilio signature");
      res.statusCode = 403;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Forbidden");
      return;
    }

    const fromRaw = String(params.From || "").trim();
    const toRaw = String(params.To || "").trim();
    const bodyRaw = String(params.Body || "").trim();
    const phoneE164 = normalizeInboundPhone(fromRaw);
    const toPhoneE164 = normalizeInboundPhone(toRaw);

    const supabase = getSupabaseAdmin();
    let lead = null;

    if (phoneE164) {
      const { data, error: leadErr } = await supabase
        .from("sms_leads")
        .select("id, opt_out")
        .eq("phone_e164", phoneE164)
        .maybeSingle();

      if (leadErr) {
        console.error("[twilio/inbound] lead lookup:", leadErr);
        sendTwiml(res, twiml);
        return;
      }

      lead = data || null;
    }

    const now = new Date().toISOString();
    const keyword = normalizeKeywordBody(bodyRaw);
    const isOptOut = STOP_KEYWORDS.has(keyword);
    const isHelp = keyword === "HELP" || keyword === "INFO";
    const isConfirm = keyword === "YES" || keyword === "Y";
    const latestMessageId = lead && lead.id ? await findLatestMessageIdForLead(supabase, lead.id) : null;

    await recordInboundMessage(supabase, params, {
      leadId: lead && lead.id ? lead.id : null,
      messageId: latestMessageId,
      fromRaw: fromRaw,
      fromPhoneE164: phoneE164,
      toRaw: toRaw,
      toPhoneE164: toPhoneE164,
      bodyRaw: bodyRaw,
      keyword: keyword || null,
      isOptOut: isOptOut,
      isHelp: isHelp,
      isConfirm: isConfirm,
    });

    if (!phoneE164) {
      sendTwiml(res, twiml);
      return;
    }

    if (isOptOut) {
      if (lead && lead.id) {
        await supabase
          .from("sms_leads")
          .update({
            opt_out: true,
            opt_out_reason: "keyword:" + keyword,
            opt_out_at: now,
            last_reply_at: now,
            last_reply_body: bodyRaw.slice(0, 2000),
            updated_at: now,
          })
          .eq("id", lead.id);
        await attachReplyToMessage(supabase, latestMessageId, bodyRaw, now);
      }
      twiml.message(
        "You have been unsubscribed from RankMySalon SMS and will not receive further marketing texts. Reply HELP for info.",
      );
      sendTwiml(res, twiml);
      return;
    }

    if (isHelp) {
      twiml.message(
        "RankMySalon: salon marketing & review tools. Msg frequency varies. Msg&data rates may apply. Reply STOP to opt out.",
      );
      sendTwiml(res, twiml);
      return;
    }

    if (isConfirm) {
      if (lead && lead.id) {
        await supabase
          .from("sms_leads")
          .update({
            last_reply_at: now,
            last_reply_body: bodyRaw.slice(0, 2000),
            updated_at: now,
          })
          .eq("id", lead.id);
        await attachReplyToMessage(supabase, latestMessageId, bodyRaw, now);
      }
      twiml.message("Thanks — we received your reply and will follow up if needed.");
      sendTwiml(res, twiml);
      return;
    }

    if (lead && lead.id && bodyRaw) {
      await supabase
        .from("sms_leads")
        .update({
          last_reply_at: now,
          last_reply_body: bodyRaw.slice(0, 2000),
          updated_at: now,
        })
        .eq("id", lead.id);
      await attachReplyToMessage(supabase, latestMessageId, bodyRaw, now);
    }

    sendTwiml(res, twiml);
  } catch (error) {
    console.error("[twilio/inbound]", error);
    sendTwiml(res, twiml);
  }
};
