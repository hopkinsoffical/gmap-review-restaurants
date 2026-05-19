const { requireAdmin } = require("../../lib/server/admin-guard");
const { getSupabaseAdmin } = require("../../lib/server/supabase");
const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../../lib/server/http");
const { createAppError } = require("../../lib/server/shared");
const {
  isSmsPipelineTableError,
  normalizePhoneE164,
  renderTemplate,
} = require("../../lib/server/sms-pipeline");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    await requireAdmin(req);
    const body = await readJsonBody(req);
    const campaignId = String(body.campaignId || body.campaign_id || "").trim();
    const importFromContactLeads = body.importFromContactLeads === true;
    const leadIds = Array.isArray(body.leadIds) ? body.leadIds : Array.isArray(body.lead_ids) ? body.lead_ids : null;

    if (!campaignId) {
      throw createAppError("INVALID_INPUT", "campaignId is required.", 400);
    }

    const supabase = getSupabaseAdmin();

    const { data: campaign, error: campaignError } = await supabase
      .from("sms_campaigns")
      .select("id, body_template, status")
      .eq("id", campaignId)
      .maybeSingle();

    if (campaignError) {
      console.error("[sms/create-campaign] campaign load:", campaignError);
      if (isSmsPipelineTableError(campaignError, "sms_campaigns")) {
        throw createAppError(
          "SMS_TABLES_MISSING",
          "SMS tables are missing. Run sql/026_sms_campaign_pipeline.sql in Supabase.",
          503,
        );
      }
      throw createAppError("SMS_DB_ERROR", "Could not load campaign.", 500);
    }
    if (!campaign || !campaign.id) {
      throw createAppError("NOT_FOUND", "Campaign not found.", 404);
    }

    if (importFromContactLeads) {
      const { data: contacts, error: contactsError } = await supabase
        .from("contact_leads")
        .select("id, phone, name, email")
        .eq("sms_consent", true);

      if (contactsError) {
        console.error("[sms/create-campaign] contact_leads:", contactsError);
        throw createAppError(
          "SMS_IMPORT_FAILED",
          "Could not read contact_leads. Ensure table exists and service role can read it.",
          500,
        );
      }

      const rows = Array.isArray(contacts) ? contacts : [];
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const phoneE164 = normalizePhoneE164(row.phone);
        if (!phoneE164) continue;

        const existing = await supabase.from("sms_leads").select("id").eq("phone_e164", phoneE164).maybeSingle();

        if (existing.error) {
          console.error("[sms/create-campaign] lead lookup:", existing.error);
          if (isSmsPipelineTableError(existing.error, "sms_leads")) {
            throw createAppError(
              "SMS_TABLES_MISSING",
              "sms_leads table is missing. Run sql/026_sms_campaign_pipeline.sql.",
              503,
            );
          }
          throw createAppError("SMS_IMPORT_FAILED", "Could not read SMS leads.", 500);
        }

        const patch = {
          name: row.name || null,
          email: row.email || null,
          source: "contact_lead",
          external_id: row.id ? String(row.id) : null,
        };

        if (existing.data && existing.data.id) {
          const up = await supabase.from("sms_leads").update(patch).eq("id", existing.data.id);
          if (up.error) {
            console.error("[sms/create-campaign] lead update:", up.error);
            throw createAppError("SMS_IMPORT_FAILED", "Could not update SMS lead.", 500);
          }
        } else {
          const ins = await supabase
            .from("sms_leads")
            .insert(
              Object.assign({}, patch, {
                phone_e164: phoneE164,
                opt_out: false,
              }),
            );
          if (ins.error) {
            console.error("[sms/create-campaign] lead insert:", ins.error);
            if (isSmsPipelineTableError(ins.error, "sms_leads")) {
              throw createAppError(
                "SMS_TABLES_MISSING",
                "sms_leads table is missing. Run sql/026_sms_campaign_pipeline.sql.",
                503,
              );
            }
            throw createAppError("SMS_IMPORT_FAILED", "Could not insert SMS lead.", 500);
          }
        }
      }
    }

    let targetLeadIds = [];
    if (leadIds && leadIds.length) {
      targetLeadIds = leadIds.map(function (id) {
        return String(id || "").trim();
      }).filter(Boolean);
    } else {
      const { data: leads, error: leadsError } = await supabase
        .from("sms_leads")
        .select("id")
        .eq("opt_out", false);

      if (leadsError) {
        console.error("[sms/create-campaign] list leads:", leadsError);
        throw createAppError("SMS_DB_ERROR", "Could not list SMS leads.", 500);
      }
      targetLeadIds = (Array.isArray(leads) ? leads : []).map(function (r) {
        return r.id;
      });
    }

    const template = campaign.body_template;
    let created = 0;
    let skippedOptOut = 0;
    let skippedDuplicate = 0;

    const batchSize = 40;
    for (let offset = 0; offset < targetLeadIds.length; offset += batchSize) {
      const slice = targetLeadIds.slice(offset, offset + batchSize);
      const { data: leadRows, error: leadErr } = await supabase
        .from("sms_leads")
        .select("id, phone_e164, name, opt_out, metadata")
        .in("id", slice);

      if (leadErr) {
        console.error("[sms/create-campaign] load lead batch:", leadErr);
        throw createAppError("SMS_DB_ERROR", "Could not load leads.", 500);
      }

      const list = Array.isArray(leadRows) ? leadRows : [];
      for (let j = 0; j < list.length; j += 1) {
        const lead = list[j];
        if (lead.opt_out) {
          skippedOptOut += 1;
          continue;
        }
        const text = renderTemplate(template, lead);
        const insert = await supabase.from("sms_messages").insert({
          campaign_id: campaignId,
          lead_id: lead.id,
          to_phone_e164: lead.phone_e164,
          body: text,
          status: "queued",
        });

        if (insert.error) {
          const msg = String(insert.error.message || insert.error.details || "");
          if (msg.indexOf("sms_messages_campaign_lead_uidx") >= 0 || String(insert.error.code) === "23505") {
            skippedDuplicate += 1;
            continue;
          }
          console.error("[sms/create-campaign] insert message:", insert.error);
          if (isSmsPipelineTableError(insert.error, "sms_messages")) {
            throw createAppError(
              "SMS_TABLES_MISSING",
              "sms_messages table is missing. Run sql/026_sms_campaign_pipeline.sql.",
              503,
            );
          }
          throw createAppError("SMS_QUEUE_FAILED", "Could not queue messages.", 500);
        }
        created += 1;
      }
    }

    return sendJson(res, 200, {
      ok: true,
      campaignId: campaignId,
      queuedMessagesCreated: created,
      skippedOptOut: skippedOptOut,
      skippedDuplicate: skippedDuplicate,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
