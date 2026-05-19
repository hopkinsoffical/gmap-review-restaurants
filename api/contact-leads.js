const { getSupabaseAdmin } = require("../lib/server/supabase");
const { createAppError } = require("../lib/server/shared");
const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/server/http");

const LIMITS = {
  name: 200,
  email: 254,
  phone: 64,
  company: 200,
  service: 200,
  message: 12000,
};

const ALLOWED_SOURCES = new Set(["about_page", "contact_modal", "hero_brief"]);

function clip(value, max) {
  const s = String(value || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function isPostgrestContactLeadsNotVisibleError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  const raw = String(error.message || error.details || error.hint || "");
  const msg = raw.toLowerCase();
  if (msg.indexOf("contact_leads") < 0) return false;
  if (code === "PGRST205") return true;
  if (msg.indexOf("schema cache") >= 0) return true;
  return false;
}

function isContactLeadsTableMissingError(error) {
  if (!error || typeof error !== "object") return false;
  if (isPostgrestContactLeadsNotVisibleError(error)) return false;
  const code = String(error.code || "");
  const raw = String(error.message || error.details || "");
  const msg = raw.toLowerCase();
  if (msg.indexOf("contact_leads") < 0) return false;
  if (code === "42P01") return true;
  if (/relation\s+["']?public\.contact_leads["']?\s+does\s+not\s+exist/i.test(raw)) return true;
  if (/relation\s+["']?contact_leads["']?\s+does\s+not\s+exist/i.test(raw)) return true;
  return false;
}

function isContactLeadsPermissionError(error) {
  if (!error || typeof error !== "object") return false;
  const raw = String((error.message || error.details) || "").toLowerCase();
  if (raw.indexOf("contact_leads") < 0) return false;
  if (String(error.code) === "42501") return true;
  if (raw.indexOf("row-level security") >= 0 || raw.indexOf("violates row-level security") >= 0) return true;
  if (raw.indexOf("permission denied") >= 0) return true;
  return false;
}

function getClientIp(req) {
  const h = (req && req.headers) || {};
  const forwardedFor = String(h["x-forwarded-for"] || h["X-Forwarded-For"] || "").trim();
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0].trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = String(h["x-real-ip"] || h["X-Real-Ip"] || "").trim();
  if (realIp) return realIp.slice(0, 128);
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const body = await readJsonBody(req);
    const source = clip(body.source, 32);

    if (!ALLOWED_SOURCES.has(source)) {
      throw createAppError("INVALID_INPUT", "Invalid source.", 400);
    }

    const smsConsent = body.smsConsent === true;

    if (source === "hero_brief") {
      const name = clip(body.name, LIMITS.name);
      let email = clip(body.email, LIMITS.email);
      let phone = clip(body.phone, LIMITS.phone);
      const message =
        clip(body.message, LIMITS.message) || "Requested brief Google Maps visibility report (homepage).";
      const service = clip(body.service, LIMITS.service) || "Brief visibility report";

      if (!name) {
        throw createAppError("INVALID_INPUT", "Salon name is required.", 400);
      }

      const emailOk = email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const digits = String(phone || "").replace(/\D/g, "");
      const phoneOk = digits.length >= 7;

      if (!emailOk && !phoneOk) {
        throw createAppError("INVALID_INPUT", "Provide a valid email or phone number.", 400);
      }
      if (email.length > 0 && !emailOk) {
        throw createAppError("INVALID_INPUT", "Invalid email address.", 400);
      }

      if (phoneOk && !smsConsent) {
        throw createAppError(
          "INVALID_INPUT",
          "SMS consent is required when a phone number is provided.",
          400,
        );
      }

      if (!emailOk) {
        email = "";
      }
      if (!phoneOk) {
        phone = "";
      }

      const userAgent =
        req.headers && (req.headers["user-agent"] || req.headers["User-Agent"])
          ? String(req.headers["user-agent"] || req.headers["User-Agent"] || "").slice(0, 512)
          : null;

      const supabase = getSupabaseAdmin();
      const company = null;
      const consentAt = new Date().toISOString();
      const consentIp = phoneOk ? getClientIp(req) : null;

      const insertResult = await supabase.from("contact_leads").insert({
        name: name,
        email: email || "",
        phone: phone || "",
        company: company,
        service: service,
        message: message,
        source: source,
        user_agent: userAgent,
        sms_consent: phoneOk ? true : false,
        sms_consent_at: phoneOk ? consentAt : null,
        sms_consent_ip: phoneOk ? consentIp : null,
        sms_consent_user_agent: phoneOk ? userAgent : null,
      }).select("id");

      if (insertResult.error) {
        console.error("[contact-leads] insert error:", insertResult.error);
        const insertMsg = String(insertResult.error.message || insertResult.error.details || "");
        if (
          String(insertResult.error.code || "") === "42703" &&
          /sms_consent|sms_consent_at|sms_consent_ip|sms_consent_user_agent/i.test(insertMsg)
        ) {
          throw createAppError(
            "CONTACT_LEADS_SMS_COLUMNS_MISSING",
            "SMS consent columns are missing on public.contact_leads. Run sql/025_contact_leads_sms_consent_columns.sql in Supabase SQL Editor, then reload schema cache. [CONTACT_LEADS_SMS_COLUMNS_MISSING]",
            503,
          );
        }
        if (isPostgrestContactLeadsNotVisibleError(insertResult.error)) {
          throw createAppError(
            "CONTACT_LEADS_POSTGREST_NOT_VISIBLE",
            "PostgREST cannot see public.contact_leads yet (common right after creating the table). In Supabase: Project Settings → API → Reload schema cache. If you have not created the table, run sql/012_contact_leads.sql in the SQL Editor first, then reload the schema again. [CONTACT_LEADS_POSTGREST_NOT_VISIBLE]",
            503,
          );
        }
        if (isContactLeadsTableMissingError(insertResult.error)) {
          throw createAppError(
            "CONTACT_LEADS_TABLE_MISSING",
            "Postgres reports that public.contact_leads is missing. In Supabase SQL Editor, run sql/012_contact_leads.sql (or re-run sql/001_schema.sql on a new project). Then reload the API schema under Project Settings → API. [CONTACT_LEADS_TABLE_MISSING]",
            503,
          );
        }
        if (isContactLeadsPermissionError(insertResult.error)) {
          throw createAppError(
            "CONTACT_LEADS_PERMISSION_DENIED",
            "Insert was denied for public.contact_leads. Confirm Vercel uses SUPABASE_SERVICE_ROLE_KEY (the service_role secret from Project Settings → API), not the anon key. Re-run sql/012_contact_leads.sql so the table, policy, and GRANT exist. [CONTACT_LEADS_PERMISSION_DENIED]",
            403,
          );
        }
        const detail = insertResult.error.message || "Insert failed";
        throw createAppError("CONTACT_LEAD_SAVE_FAILED", detail, 500);
      }

      const rows = Array.isArray(insertResult.data) ? insertResult.data : [];
      const first = rows[0] || null;

      return sendJson(res, 201, {
        ok: true,
        id: first && first.id ? first.id : null,
      });
    }

    const name = clip(body.name, LIMITS.name);
    const email = clip(body.email, LIMITS.email);
    const phone = clip(body.phone, LIMITS.phone);
    const companyRaw = body.company != null ? clip(body.company, LIMITS.company) : "";
    const service = clip(body.service, LIMITS.service) || "Not specified";
    const message = clip(body.message, LIMITS.message);

    if (!name) {
      throw createAppError("INVALID_INPUT", "Name is required.", 400);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw createAppError("INVALID_INPUT", "A valid email is required.", 400);
    }
    if (!phone) {
      throw createAppError("INVALID_INPUT", "Phone is required.", 400);
    }
    if (!message) {
      throw createAppError("INVALID_INPUT", "Message is required.", 400);
    }
    if (!smsConsent) {
      throw createAppError("INVALID_INPUT", "Explicit SMS consent is required.", 400);
    }

    const userAgent =
      req.headers && (req.headers["user-agent"] || req.headers["User-Agent"])
        ? String(req.headers["user-agent"] || req.headers["User-Agent"] || "").slice(0, 512)
        : null;

    const supabase = getSupabaseAdmin();
    const company = companyRaw || null;
    const consentAt = new Date().toISOString();
    const consentIp = getClientIp(req);

    const insertResult = await supabase
      .from("contact_leads")
      .insert({
        name: name,
        email: email,
        phone: phone,
        company: company,
        service: service,
        message: message,
        source: source,
        user_agent: userAgent,
        sms_consent: true,
        sms_consent_at: consentAt,
        sms_consent_ip: consentIp,
        sms_consent_user_agent: userAgent,
      })
      .select("id");

    if (insertResult.error) {
      console.error("[contact-leads] insert error:", insertResult.error);
      const insertMsg = String(insertResult.error.message || insertResult.error.details || "");
      if (
        String(insertResult.error.code || "") === "42703" &&
        /sms_consent|sms_consent_at|sms_consent_ip|sms_consent_user_agent/i.test(insertMsg)
      ) {
        throw createAppError(
          "CONTACT_LEADS_SMS_COLUMNS_MISSING",
          "SMS consent columns are missing on public.contact_leads. Run sql/025_contact_leads_sms_consent_columns.sql in Supabase SQL Editor, then reload schema cache. [CONTACT_LEADS_SMS_COLUMNS_MISSING]",
          503,
        );
      }
      if (isPostgrestContactLeadsNotVisibleError(insertResult.error)) {
        throw createAppError(
          "CONTACT_LEADS_POSTGREST_NOT_VISIBLE",
          "PostgREST cannot see public.contact_leads yet (common right after creating the table). In Supabase: Project Settings → API → Reload schema cache. If you have not created the table, run sql/012_contact_leads.sql in the SQL Editor first, then reload the schema again. [CONTACT_LEADS_POSTGREST_NOT_VISIBLE]",
          503,
        );
      }
      if (isContactLeadsTableMissingError(insertResult.error)) {
        throw createAppError(
          "CONTACT_LEADS_TABLE_MISSING",
          "Postgres reports that public.contact_leads is missing. In Supabase SQL Editor, run sql/012_contact_leads.sql (or re-run sql/001_schema.sql on a new project). Then reload the API schema under Project Settings → API. [CONTACT_LEADS_TABLE_MISSING]",
          503,
        );
      }
      if (isContactLeadsPermissionError(insertResult.error)) {
        throw createAppError(
          "CONTACT_LEADS_PERMISSION_DENIED",
          "Insert was denied for public.contact_leads. Confirm Vercel uses SUPABASE_SERVICE_ROLE_KEY (the service_role secret from Project Settings → API), not the anon key. Re-run sql/012_contact_leads.sql so the table, policy, and GRANT exist. [CONTACT_LEADS_PERMISSION_DENIED]",
          403,
        );
      }
      const detail = insertResult.error.message || "Insert failed";
      throw createAppError("CONTACT_LEAD_SAVE_FAILED", detail, 500);
    }

    const rows = Array.isArray(insertResult.data) ? insertResult.data : [];
    const first = rows[0] || null;

    return sendJson(res, 201, {
      ok: true,
      id: first && first.id ? first.id : null,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
