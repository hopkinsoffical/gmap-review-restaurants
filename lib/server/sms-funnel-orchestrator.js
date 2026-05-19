const twilio = require("twilio");
const { getSupabaseAdmin } = require("./supabase");
const {
  insertEvent,
  insertWebsiteEngagementEvent,
  findSessionByMessageSid,
  findSessionForBeacon,
  upsertSessionFromRegister,
  updateSessionStage,
  forceSetStage,
  markNurtureSent,
} = require("./sms-funnel-store");
const { generateNurtureSmsBody } = require("./sms-followup-agent");
const { postSalesAlert } = require("./sms-alert");

function slugFromAnalysisUrl(link) {
  const raw = String(link || "");
  const m = raw.match(/analysis-reports\/([^/?#]+)/i);
  if (!m) return "";
  try {
    return decodeURIComponent(String(m[1] || "").trim());
  } catch (e) {
    return String(m[1] || "").trim();
  }
}

function getTwilioClient() {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || "").replace(/\s+/g, "");
  const token = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  if (!sid || !token) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
  }
  return twilio(sid, token);
}

async function sendOutboundSms(toE164, body) {
  const client = getTwilioClient();
  const from = String(process.env.TWILIO_SMS_FROM || "").trim();
  const msSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
  const shorten = String(process.env.TWILIO_SHORTEN_URLS || "").toLowerCase() === "true";

  const opts = {
    to: toE164,
    body,
  };
  if (msSid) {
    opts.messagingServiceSid = msSid;
    if (shorten) opts.shortenUrls = true;
  } else {
    if (!from) throw new Error("Set TWILIO_SMS_FROM or TWILIO_MESSAGING_SERVICE_SID");
    opts.from = from;
  }
  return client.messages.create(opts);
}

async function ensureSessionForTwilioClick(payload) {
  const supabase = getSupabaseAdmin();
  const smsSid = String(payload.sms_sid || payload.SmsSid || "").trim();
  const to = String(payload.to || payload.To || "").trim();
  const link = String(payload.link || payload.Link || "").trim();
  const slug = slugFromAnalysisUrl(link);
  if (!smsSid || !to || !slug) {
    return { error: "missing_sms_sid_to_or_slug", smsSid, to, slug, link: link.slice(0, 120) };
  }

  let session = await findSessionByMessageSid(supabase, smsSid);
  if (!session) {
    const { data: ins, error } = await supabase
      .from("sms_outreach_session")
      .insert({
        slug,
        to_e164: to,
        initial_message_sid: smsSid,
        funnel_stage: "link_click",
        last_event_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    session = { id: ins.id, funnel_stage: "link_click", slug, to_e164: to, nurture_sent_at: null };
    await insertEvent(supabase, ins.id, "twilio_link_click", "twilio", payload);
  } else {
    await updateSessionStage(supabase, session.id, "link_click", {});
    await insertEvent(supabase, session.id, "twilio_link_click", "twilio", payload);
  }
  return { sessionId: session.id, slug, to };
}

async function handleTwilioLinkClick(payload) {
  const out = await ensureSessionForTwilioClick(payload);
  if (out.error) return out;
  await postSalesAlert({
    alert: "link_click",
    slug: out.slug,
    to: out.to,
    event_type: payload.event_type || payload.EventType,
  }).catch(function () {});
  return { ok: true, sessionId: out.sessionId };
}

async function handleRegister({ slug, to_e164, initial_message_sid }) {
  const supabase = getSupabaseAdmin();
  const id = await upsertSessionFromRegister(supabase, { slug, to_e164, initial_message_sid });
  await insertEvent(supabase, id, "outbound_sent", "register", {
    slug,
    to_e164,
    initial_message_sid,
  });
  return { ok: true, sessionId: id };
}

const SITE_EVENT_TYPES = new Set([
  "report_view",
  "report_ping",
  "report_scroll",
  "report_cta_click",
  "report_visibility_hidden",
]);

async function processReportView(slug, salonName) {
  const supabase = getSupabaseAdmin();
  const s = String(slug || "").trim();

  const session = await findSessionForBeacon(supabase, s);
  if (!session) {
    await insertEvent(supabase, null, "report_view", "website", {
      slug: s,
      salonName: String(salonName || "").trim(),
      orphan: true,
    });
    await postSalesAlert({ alert: "report_view_orphan", slug: s }).catch(function () {});
    return { ok: true, sessionId: null, orphan: true, nurture: "no_session" };
  }

  await updateSessionStage(supabase, session.id, "report_view", {});
  await insertEvent(supabase, session.id, "report_view", "website", {
    slug: s,
    salonName: String(salonName || "").trim(),
  });

  await postSalesAlert({
    alert: "report_view",
    slug: s,
    session_id: session.id,
    to: session.to_e164,
  }).catch(function () {});

  if (session.nurture_sent_at) {
    return { ok: true, sessionId: session.id, nurture: "already_sent" };
  }

  const { data: again, error: againErr } = await supabase
    .from("sms_outreach_session")
    .select("nurture_sent_at")
    .eq("id", session.id)
    .single();
  if (!againErr && again && again.nurture_sent_at) {
    return { ok: true, sessionId: session.id, nurture: "already_sent_race" };
  }

  const body = await generateNurtureSmsBody({
    slug: s,
    salonName: salonName || (session.metadata && session.metadata.name) || "",
  });
  const msg = await sendOutboundSms(session.to_e164, body);
  const sid = msg && msg.sid ? String(msg.sid) : "";
  await markNurtureSent(supabase, session.id, sid);
  await insertEvent(supabase, session.id, "nurture_sent", "agent", {
    message_sid: sid,
    body_len: body.length,
  });

  await postSalesAlert({
    alert: "nurture_sent",
    slug: s,
    session_id: session.id,
    nurture_message_sid: sid,
  }).catch(function () {});

  return { ok: true, sessionId: session.id, nurture_message_sid: sid };
}

async function handleSiteEvents({ slug, salonName, events }) {
  const supabase = getSupabaseAdmin();
  const s = String(slug || "").trim();
  if (!s) return { ok: false, error: "missing_slug" };

  const list = Array.isArray(events) ? events : [];
  if (list.length > 24) {
    return { ok: false, error: "too_many_events" };
  }

  let sawReportView = false;
  for (let i = 0; i < list.length; i += 1) {
    const ev = list[i] || {};
    const typ = String(ev.type || "").trim();
    if (!typ || !SITE_EVENT_TYPES.has(typ)) continue;
    if (typ === "report_view") {
      sawReportView = true;
      continue;
    }
    const rest = Object.assign({}, ev);
    delete rest.type;
    await insertWebsiteEngagementEvent(supabase, s, typ, rest);
  }

  if (sawReportView) {
    return await processReportView(s, salonName);
  }

  return { ok: true, sessionId: null, recorded: list.length };
}

async function handleBeacon({ slug, salonName }) {
  return handleSiteEvents({ slug, salonName, events: [{ type: "report_view" }] });
}

async function setFunnelStage(sessionId, stage, meta) {
  const allowed = new Set(["engaged", "closed_won", "closed_lost"]);
  if (!allowed.has(String(stage))) {
    return { ok: false, error: "invalid_stage" };
  }
  const supabase = getSupabaseAdmin();
  await forceSetStage(supabase, sessionId, stage, {});
  await insertEvent(supabase, sessionId, "manual_stage", "sales", Object.assign({ stage }, meta || {}));
  await postSalesAlert({ alert: "stage", session_id: sessionId, stage }).catch(function () {});
  return { ok: true };
}

module.exports = {
  slugFromAnalysisUrl,
  handleTwilioLinkClick,
  handleRegister,
  handleBeacon,
  handleSiteEvents,
  processReportView,
  setFunnelStage,
  sendOutboundSms,
};
