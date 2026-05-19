#!/usr/bin/env node
/**
 * Queue and send SMS to leaderboard rows labeled mobile in data/leaderboard_phone_mobile.csv,
 * skipping any E.164 that already appears in sms_messages (any status).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *      TWILIO_SMS_FROM and/or TWILIO_MESSAGING_SERVICE_SID, optional APP_BASE_URL (status callback).
 *
 * Usage (repo root):
 *   node scripts/sms-blast-leaderboard-mobile.js --limit 100
 *   node scripts/sms-blast-leaderboard-mobile.js --limit 100 --csv data/leaderboard_phone_mobile.csv --dry-run
 */

const path = require("path");
const { execFileSync } = require("child_process");
const twilio = require("twilio");

const ROOT = path.resolve(__dirname, "..");
process.chdir(ROOT);

const { getSupabaseAdmin } = require("../lib/server/supabase");
const { getServerEnv } = require("../lib/server/env");
const {
  ensureSmsLeadByPhone,
  renderTemplate,
  isSmsPipelineTableError,
  updateMessageSent,
  updateMessageSendFailed,
} = require("../lib/server/sms-pipeline");

const DEFAULT_CSV = path.join(ROOT, "data", "leaderboard_phone_mobile.csv");

const BODY_TEMPLATE =
  "Hi {{salon_name}}, this is Ryan. Your Google Ranking FREE Advisor!\n" +
  "Your salon looks really solid but it seems your Google reviews may not be showing that clearly enough.\n" +
  "I made a quick local Google report for you. And it's free! Join us and grow your business now!\n" +
  'Get your FREE report by sending "YES".\n' +
  "{{report_url}}\n" +
  "Reply STOP to opt out.";

function loadCsvRows(csvPath) {
  const py = [
    "import csv, json, sys",
    "with open(sys.argv[1], newline='', encoding='utf-8') as f:",
    "    print(json.dumps(list(csv.DictReader(f))))",
  ].join("\n");
  const out = execFileSync("python3", ["-c", py, csvPath], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

function parseArgs(argv) {
  let limit = 100;
  let csvPath = DEFAULT_CSV;
  let dryRun = false;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--limit" && argv[i + 1]) {
      limit = Math.max(1, parseInt(argv[i + 1], 10) || 100);
      i += 1;
    } else if (argv[i] === "--csv" && argv[i + 1]) {
      csvPath = path.resolve(ROOT, argv[i + 1]);
      i += 1;
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    }
  }
  return { limit, csvPath, dryRun };
}

async function fetchAllMessagedPhones(supabase) {
  const phones = new Set();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("sms_messages")
      .select("to_phone_e164")
      .range(from, from + pageSize - 1);

    if (error) {
      const raw = String(error.message || error.code || "");
      if (raw.indexOf("sms_messages") >= 0 && (raw.indexOf("schema cache") >= 0 || raw.indexOf("Could not find") >= 0)) {
        console.error(
          "Supabase has no sms_messages table (or schema cache stale). " +
            "Run sql/026_sms_campaign_pipeline.sql in the SQL Editor, then Settings → API → Reload schema.",
        );
        process.exit(1);
      }
      if (isSmsPipelineTableError(error, "sms_messages")) {
        console.error("sms_messages missing; run sql/026_sms_campaign_pipeline.sql");
        process.exit(1);
      }
      throw error;
    }
    const rows = Array.isArray(data) ? data : [];
    rows.forEach(function (r) {
      if (r && r.to_phone_e164) phones.add(String(r.to_phone_e164).trim());
    });
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return phones;
}

function reportUrlForSlug(slug) {
  const base = String(process.env.RANKMYSALON_ANALYSIS_REPORTS_BASE_URL || "https://www.rankmysalon.ai/analysis-reports").replace(
    /\/+$/,
    "",
  );
  const seg = encodeURIComponent(String(slug || "").trim());
  return base + "/" + seg;
}

async function main() {
  const { limit, csvPath, dryRun } = parseArgs(process.argv);
  getServerEnv();
  const supabase = getSupabaseAdmin();

  const rows = loadCsvRows(csvPath);
  const messaged = await fetchAllMessagedPhones(supabase);

  /** @type {Map<string, object>} */
  const byPhone = new Map();
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    if (String(r.is_mobile_like || "").trim().toLowerCase() !== "true") continue;
    const phone = String(r.phone_e164 || "").trim();
    if (!phone || !phone.startsWith("+")) continue;
    if (messaged.has(phone)) continue;
    if (!byPhone.has(phone)) byPhone.set(phone, r);
  }

  const picked = Array.from(byPhone.values()).slice(0, limit);
  if (!picked.length) {
    console.log("No eligible mobile leads (check CSV, is_mobile_like, or all already in sms_messages).");
    return;
  }

  console.log("Selected", picked.length, "of limit", limit, dryRun ? "(dry-run)" : "");

  const iso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const campaignName = "Leaderboard mobile · " + iso;

  const { data: campaignRow, error: campErr } = await supabase
    .from("sms_campaigns")
    .insert({
      name: campaignName.slice(0, 200),
      body_template: BODY_TEMPLATE,
      status: "active",
      daily_send_limit: Math.max(limit + 50, 500),
      messaging_service_sid: process.env.TWILIO_MESSAGING_SERVICE_SID
        ? String(process.env.TWILIO_MESSAGING_SERVICE_SID).trim()
        : null,
    })
    .select("id, name, daily_send_limit, messaging_service_sid")
    .single();

  if (campErr) {
    console.error("campaign insert:", campErr);
    if (isSmsPipelineTableError(campErr, "sms_campaigns")) {
      console.error("Run sql/026_sms_campaign_pipeline.sql");
    }
    process.exit(1);
  }

  const campaignId = campaignRow.id;
  const queued = [];

  for (let j = 0; j < picked.length; j += 1) {
    const r = picked[j];
    const phone = String(r.phone_e164).trim();
    const salonName = String(r.name || "").trim() || "there";
    const slug = String(r.slug || "").trim();
    const reportUrl = reportUrlForSlug(slug);

    let lead;
    try {
      lead = await ensureSmsLeadByPhone(phone, "leaderboard_mobile_csv");
    } catch (e) {
      console.error("lead ensure", phone, e && e.message ? e.message : e);
      continue;
    }
    if (lead.opt_out) {
      console.log("skip opt_out", phone);
      continue;
    }

    const meta = { report_url: reportUrl, report_slug: slug };
    const { error: upErr } = await supabase
      .from("sms_leads")
      .update({
        name: salonName,
        metadata: meta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (upErr) {
      console.error("lead update", phone, upErr);
      continue;
    }

    const { data: leadRow, error: loadErr } = await supabase
      .from("sms_leads")
      .select("id, name, phone_e164, opt_out, metadata")
      .eq("id", lead.id)
      .maybeSingle();

    if (loadErr || !leadRow) {
      console.error("lead reload", phone, loadErr);
      continue;
    }

    const body = renderTemplate(BODY_TEMPLATE, leadRow);
    const ins = await supabase
      .from("sms_messages")
      .insert({
        campaign_id: campaignId,
        lead_id: lead.id,
        to_phone_e164: phone,
        body: body,
        status: "queued",
      })
      .select("id")
      .single();

    if (ins.error) {
      const msg = String(ins.error.message || ins.error.details || "");
      if (msg.indexOf("sms_messages_campaign_lead_uidx") >= 0 || String(ins.error.code) === "23505") {
        console.log("skip duplicate campaign+lead", phone);
        continue;
      }
      console.error("queue insert", phone, ins.error);
      continue;
    }

    const msgId = ins.data && ins.data.id ? ins.data.id : null;
    if (msgId) queued.push({ id: msgId, to: phone, body: body });
  }

  console.log("Queued", queued.length, "messages; campaign", campaignId);

  if (dryRun || !queued.length) return;

  const env = getServerEnv();
  const accountSid = env.twilioAccountSid;
  const authToken = env.twilioAuthToken;
  const fromNum = String(process.env.TWILIO_SMS_FROM || "").trim();
  const msSid = String(env.twilioMessagingServiceSid || "").trim();
  if (!accountSid || !authToken) {
    console.error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required to send.");
    process.exit(1);
  }
  if (!msSid && !fromNum) {
    console.error("Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_SMS_FROM to send.");
    process.exit(1);
  }

  const client = twilio(accountSid, authToken);
  const baseUrl = String(env.appBaseUrl || "").replace(/\/+$/, "");
  const statusCallback = baseUrl ? baseUrl + "/api/twilio/status-callback" : undefined;

  let sent = 0;
  let failed = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  for (let k = 0; k < queued.length; k += 1) {
    const row = queued[k];
    const payload = {
      to: row.to,
      body: row.body,
    };
    if (statusCallback) payload.statusCallback = statusCallback;
    if (msSid) {
      payload.messagingServiceSid = msSid;
    } else {
      payload.from = fromNum;
    }

    try {
      const msg = await client.messages.create(payload);
      await updateMessageSent(row.id, msg.sid);
      sent += 1;
    } catch (e) {
      failed += 1;
      const code = e && e.code ? e.code : "";
      const message = e && e.message ? String(e.message) : String(e);
      console.error("twilio", row.to, code, message);
      await updateMessageSendFailed(row.id, code, message);
    }
    await sleep(130);
  }

  console.log("Done. Sent:", sent, "Failed:", failed);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
