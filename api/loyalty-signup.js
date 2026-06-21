// Loyalty signup — the step after a client posts a Google review.
// Client leaves a phone number to get a promo code for their next visit.
// Inserts into public.loyalty_clients (service role) and returns the promo code.
const crypto = require("crypto");
const { getSupabaseAdmin } = require("../lib/server/supabase");
const { createAppError } = require("../lib/server/shared");
const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/server/http");

const LIMITS = { phone: 64, storeSlug: 200, placeId: 256 };

function clip(value, max) {
  const s = String(value || "").trim();
  return s.length <= max ? s : s.slice(0, max);
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function getClientIp(req) {
  const h = (req && req.headers) || {};
  const fwd = String(h["x-forwarded-for"] || h["X-Forwarded-For"] || "").trim();
  if (fwd) {
    const first = fwd.split(",")[0].trim();
    if (first) return first.slice(0, 128);
  }
  const real = String(h["x-real-ip"] || h["X-Real-Ip"] || "").trim();
  return real ? real.slice(0, 128) : null;
}

// Human-friendly promo code, e.g. NV-7Q4K2P (NV = next visit). No ambiguous chars.
function generatePromoCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i += 1) code += alphabet[bytes[i] % alphabet.length];
  return "NV-" + code;
}

function isTableMissing(error) {
  const code = String((error && error.code) || "");
  const raw = String((error && (error.message || error.details)) || "");
  if (raw.toLowerCase().indexOf("loyalty_clients") < 0) return false;
  return code === "42P01" || code === "PGRST205" || /does\s+not\s+exist/i.test(raw)
    || raw.toLowerCase().indexOf("schema cache") >= 0;
}

function isPermissionDenied(error) {
  const code = String((error && error.code) || "");
  const raw = String((error && (error.message || error.details)) || "").toLowerCase();
  if (raw.indexOf("loyalty_clients") < 0 && raw.indexOf("row-level security") < 0) return false;
  return code === "42501" || raw.indexOf("permission denied") >= 0
    || raw.indexOf("row-level security") >= 0;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const body = await readJsonBody(req);
    const phone = clip(body.phone, LIMITS.phone);
    const phoneDigits = digitsOnly(phone);
    const smsConsent = body.smsConsent === true;
    const storeSlug = clip(body.storeSlug, LIMITS.storeSlug);
    const placeId = clip(body.placeId, LIMITS.placeId) || null;

    if (phoneDigits.length < 7) {
      throw createAppError("INVALID_INPUT", "Enter a phone number with at least 7 digits.", 400);
    }
    if (!smsConsent) {
      throw createAppError(
        "INVALID_INPUT",
        "SMS consent is required to text you a promo code.",
        400,
      );
    }

    const userAgent =
      req.headers && (req.headers["user-agent"] || req.headers["User-Agent"])
        ? String(req.headers["user-agent"] || req.headers["User-Agent"] || "").slice(0, 512)
        : null;
    const consentIp = getClientIp(req);
    const nowIso = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const slugKey = storeSlug || "";

    // Returning client = this (store, phone) is already on the loyalty list.
    // Reuse their existing code so they don't collect a fresh one each visit.
    const existing = await supabase
      .from("loyalty_clients")
      .select("id, promo_code")
      .eq("store_slug", slugKey)
      .eq("phone_digits", phoneDigits)
      .limit(1);

    if (existing.error && (isTableMissing(existing.error) || isPermissionDenied(existing.error))) {
      throw tableError(existing.error);
    }

    const priorRow = Array.isArray(existing.data) && existing.data[0] ? existing.data[0] : null;

    if (priorRow) {
      const upd = await supabase
        .from("loyalty_clients")
        .update({
          visit_status: "returning",
          phone: phone,
          place_id: placeId,
          sms_consent: true,
          sms_consent_at: nowIso,
          sms_consent_ip: consentIp,
          sms_consent_user_agent: userAgent,
          user_agent: userAgent,
          updated_at: nowIso,
        })
        .eq("id", priorRow.id)
        .select("promo_code");
      if (upd.error) throw saveError(upd.error);
      const code = (Array.isArray(upd.data) && upd.data[0] && upd.data[0].promo_code) || priorRow.promo_code;
      return sendJson(res, 200, { ok: true, promoCode: code, visitStatus: "returning" });
    }

    const promoCode = generatePromoCode();
    const ins = await supabase
      .from("loyalty_clients")
      .insert({
        store_slug: slugKey,
        place_id: placeId,
        phone: phone,
        phone_digits: phoneDigits,
        promo_code: promoCode,
        visit_status: "new",
        source: "review_booster",
        sms_consent: true,
        sms_consent_at: nowIso,
        sms_consent_ip: consentIp,
        sms_consent_user_agent: userAgent,
        user_agent: userAgent,
      })
      .select("promo_code");

    if (ins.error) throw saveError(ins.error);
    const code = (Array.isArray(ins.data) && ins.data[0] && ins.data[0].promo_code) || promoCode;
    return sendJson(res, 201, { ok: true, promoCode: code, visitStatus: "new" });
  } catch (error) {
    return handleApiError(res, error);
  }

  function tableError(error) {
    if (isTableMissing(error)) {
      return createAppError(
        "LOYALTY_CLIENTS_TABLE_MISSING",
        "public.loyalty_clients is missing or not visible. Run sql/037_loyalty_clients.sql in the Supabase SQL Editor, then reload the API schema cache. [LOYALTY_CLIENTS_TABLE_MISSING]",
        503,
      );
    }
    return createAppError(
      "LOYALTY_CLIENTS_PERMISSION_DENIED",
      "Insert denied for public.loyalty_clients. Confirm Vercel uses SUPABASE_SERVICE_ROLE_KEY and re-run sql/037_loyalty_clients.sql. [LOYALTY_CLIENTS_PERMISSION_DENIED]",
      403,
    );
  }

  function saveError(error) {
    console.error("[loyalty-signup] save error:", error);
    if (isTableMissing(error) || isPermissionDenied(error)) return tableError(error);
    return createAppError("LOYALTY_SIGNUP_SAVE_FAILED", String(error.message || "Insert failed"), 500);
  }
};
