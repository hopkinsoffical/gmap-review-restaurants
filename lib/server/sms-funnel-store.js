const { getSupabaseAdmin } = require("./supabase");

const STAGE_ORDER = {
  sent: 0,
  link_click: 1,
  report_view: 2,
  nurture_sent: 3,
  engaged: 4,
  closed_won: 5,
  closed_lost: 5,
};

function stageRank(stage) {
  return STAGE_ORDER[String(stage || "").trim()] ?? -1;
}

async function insertEvent(supabase, sessionId, eventType, source, payload) {
  const { error } = await supabase.from("sms_outreach_event").insert({
    session_id: sessionId || null,
    event_type: String(eventType || "").slice(0, 64),
    source: String(source || "").slice(0, 64),
    payload: payload && typeof payload === "object" ? payload : {},
  });
  if (error) throw error;
}

async function findSessionByMessageSid(supabase, messageSid) {
  const sid = String(messageSid || "").trim();
  if (!sid) return null;
  const { data, error } = await supabase
    .from("sms_outreach_session")
    .select("*")
    .eq("initial_message_sid", sid)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function findLatestSessionBySlug(supabase, slug) {
  const s = String(slug || "").trim();
  if (!s) return null;
  const { data, error } = await supabase
    .from("sms_outreach_session")
    .select("*")
    .eq("slug", s)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

async function findSessionForBeacon(supabase, slug) {
  const s = String(slug || "").trim();
  if (!s) return null;
  const { data, error } = await supabase
    .from("sms_outreach_session")
    .select("*")
    .eq("slug", s)
    .is("nurture_sent_at", null)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

async function upsertSessionFromRegister(supabase, { slug, to_e164, initial_message_sid }) {
  const { data: existing, error: e1 } = await supabase
    .from("sms_outreach_session")
    .select("id")
    .eq("initial_message_sid", initial_message_sid)
    .maybeSingle();
  if (e1) throw e1;
  if (existing && existing.id) {
    const { error: e2 } = await supabase
      .from("sms_outreach_session")
      .update({
        slug,
        to_e164,
        last_event_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (e2) throw e2;
    return existing.id;
  }
  const { data: ins, error: e3 } = await supabase
    .from("sms_outreach_session")
    .insert({
      slug,
      to_e164,
      initial_message_sid,
      funnel_stage: "sent",
      last_event_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (e3) throw e3;
  return ins.id;
}

async function updateSessionStage(supabase, sessionId, newStage, patch) {
  const { data: row, error: g } = await supabase
    .from("sms_outreach_session")
    .select("funnel_stage")
    .eq("id", sessionId)
    .single();
  if (g) throw g;
  const cur = row.funnel_stage;
  if (stageRank(newStage) < stageRank(cur)) {
    return { advanced: false, stage: cur };
  }
  const { error: u } = await supabase
    .from("sms_outreach_session")
    .update(
      Object.assign(
        {
          funnel_stage: newStage,
          last_event_at: new Date().toISOString(),
        },
        patch || {},
      ),
    )
    .eq("id", sessionId);
  if (u) throw u;
  return { advanced: true, stage: newStage };
}

async function forceSetStage(supabase, sessionId, newStage, patch) {
  const { error } = await supabase
    .from("sms_outreach_session")
    .update(
      Object.assign(
        {
          funnel_stage: newStage,
          last_event_at: new Date().toISOString(),
        },
        patch || {},
      ),
    )
    .eq("id", sessionId);
  if (error) throw error;
  return { advanced: true, stage: newStage };
}

async function markNurtureSent(supabase, sessionId, nurtureMessageSid) {
  const { error } = await supabase
    .from("sms_outreach_session")
    .update({
      funnel_stage: "nurture_sent",
      nurture_message_sid: nurtureMessageSid,
      nurture_sent_at: new Date().toISOString(),
      last_event_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (error) throw error;
}

async function insertWebsiteEngagementEvent(supabase, slug, eventType, payload) {
  const s = String(slug || "").trim();
  const sess = await findLatestSessionBySlug(supabase, s);
  const sid = sess ? sess.id : null;
  const base = payload && typeof payload === "object" ? payload : {};
  await insertEvent(supabase, sid, eventType, "website", Object.assign({ slug: s }, base));
}

module.exports = {
  insertEvent,
  insertWebsiteEngagementEvent,
  findSessionByMessageSid,
  findLatestSessionBySlug,
  findSessionForBeacon,
  upsertSessionFromRegister,
  updateSessionStage,
  forceSetStage,
  markNurtureSent,
  stageRank,
};
