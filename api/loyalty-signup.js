// Loyalty signup — the step after a customer posts a Google review.
// Customer leaves a phone number to get a promo code for their next visit.
//
// Primary path: forward to the vForce backend (portal public proxy -> core-api),
// which writes to the vForce RDS (public.loyalty_clients) for stores registered
// in identity.accounts (e.g. xiebao-edison).
//
// Fallback: when vForce has no org for the store slug (e.g. xiebao-flushing),
// save to Supabase public.loyalty_clients (sql/032_loyalty_clients.sql).
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

function generatePromoCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i += 1) code += alphabet[bytes[i] % alphabet.length];
  return "NV-" + code;
}

function upstreamMessage(data) {
  if (!data) return "";
  if (typeof data.error === "string") return data.error;
  if (data.error && typeof data.error.message === "string") return data.error.message;
  if (typeof data.detail === "string") return data.detail;
  return "";
}

function shouldFallbackToSupabase(upstream, data) {
  const msg = upstreamMessage(data).toLowerCase();
  if (upstream && upstream.status === 404) return true;
  return (
    msg.indexOf("org not found") >= 0 ||
    msg.indexOf("organization not found") >= 0 ||
    msg.indexOf("store not found") >= 0 ||
    msg.indexOf("account not found") >= 0
  );
}

function isTableMissing(error) {
  const code = String((error && error.code) || "");
  const raw = String((error && (error.message || error.details)) || "");
  if (raw.toLowerCase().indexOf("loyalty_clients") < 0) return false;
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /does\s+not\s+exist/i.test(raw) ||
    raw.toLowerCase().indexOf("schema cache") >= 0
  );
}

function isPermissionDenied(error) {
  const code = String((error && error.code) || "");
  const raw = String((error && (error.message || error.details)) || "").toLowerCase();
  if (raw.indexOf("loyalty_clients") < 0 && raw.indexOf("row-level security") < 0) return false;
  return (
    code === "42501" ||
    raw.indexOf("permission denied") >= 0 ||
    raw.indexOf("row-level security") >= 0
  );
}

function loyaltyTableError(error) {
  if (isTableMissing(error)) {
    return createAppError(
      "LOYALTY_CLIENTS_TABLE_MISSING",
      "public.loyalty_clients is missing or not visible. Run sql/032_loyalty_clients.sql in the Supabase SQL Editor, then reload the API schema cache. [LOYALTY_CLIENTS_TABLE_MISSING]",
      503,
    );
  }
  return createAppError(
    "LOYALTY_CLIENTS_PERMISSION_DENIED",
    "Insert denied for public.loyalty_clients. Confirm Vercel uses SUPABASE_SERVICE_ROLE_KEY and re-run sql/032_loyalty_clients.sql. [LOYALTY_CLIENTS_PERMISSION_DENIED]",
    403,
  );
}

function loyaltySaveError(error) {
  console.error("[loyalty-signup] supabase save error:", error);
  if (isTableMissing(error) || isPermissionDenied(error)) return loyaltyTableError(error);
  return createAppError("LOYALTY_SIGNUP_SAVE_FAILED", String(error.message || "Insert failed"), 500);
}

async function saveLoyaltySignupToSupabase(payload) {
  const {
    phone,
    phoneDigits,
    storeSlug,
    placeId,
    consentIp,
    userAgent,
  } = payload;
  const nowIso = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const slugKey = storeSlug || "";

  const existing = await supabase
    .from("loyalty_clients")
    .select("id, promo_code")
    .eq("store_slug", slugKey)
    .eq("phone_digits", phoneDigits)
    .limit(1);

  if (existing.error && (isTableMissing(existing.error) || isPermissionDenied(existing.error))) {
    throw loyaltyTableError(existing.error);
  }
  if (existing.error) throw loyaltySaveError(existing.error);

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
    if (upd.error) throw loyaltySaveError(upd.error);
    const code =
      (Array.isArray(upd.data) && upd.data[0] && upd.data[0].promo_code) || priorRow.promo_code;
    return { promoCode: code, visitStatus: "returning", status: 200 };
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

  if (ins.error) throw loyaltySaveError(ins.error);
  const code =
    (Array.isArray(ins.data) && ins.data[0] && ins.data[0].promo_code) || promoCode;
  return { promoCode: code, visitStatus: "new", status: 201 };
}

async function saveLoyaltySignupToVforce(payload) {
  const base = String(process.env.VFORCE_PUBLIC_URL || "https://52.207.187.219")
    .trim()
    .replace(/\/+$/, "");
  if (!base) {
    throw createAppError(
      "VFORCE_PUBLIC_URL_MISSING",
      "VFORCE_PUBLIC_URL is not configured. [VFORCE_PUBLIC_URL_MISSING]",
      503,
    );
  }

  const upstream = await fetch(base + "/api/portal/loyalty-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: payload.phone,
      smsConsent: true,
      storeSlug: payload.storeSlug,
      placeId: payload.placeId,
      consentIp: payload.consentIp,
      userAgent: payload.userAgent,
      lang: payload.lang || null,
    }),
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !data || data.ok !== true) {
    if (shouldFallbackToSupabase(upstream, data)) {
      return { fallback: true, upstream, data };
    }
    const msg = upstreamMessage(data) || "Could not save right now.";
    throw createAppError("LOYALTY_SIGNUP_SAVE_FAILED", String(msg), upstream.status || 502);
  }

  return {
    fallback: false,
    promoCode: data.promoCode,
    visitStatus: data.visitStatus,
    status: upstream.status === 201 ? 201 : 200,
  };
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
      throw createAppError("INVALID_INPUT", "SMS consent is required to text you a promo code.", 400);
    }
    if (!storeSlug) {
      throw createAppError("INVALID_INPUT", "Missing store.", 400);
    }

    const userAgent =
      req.headers && (req.headers["user-agent"] || req.headers["User-Agent"])
        ? String(req.headers["user-agent"] || req.headers["User-Agent"] || "").slice(0, 512)
        : null;
    const consentIp = getClientIp(req);

    const payload = {
      phone,
      phoneDigits,
      storeSlug,
      placeId,
      consentIp,
      userAgent,
      lang: body.lang || null,
    };

    const vforceResult = await saveLoyaltySignupToVforce(payload);
    if (vforceResult.fallback) {
      console.warn(
        "[loyalty-signup] vForce unavailable for store slug; falling back to Supabase:",
        storeSlug,
        upstreamMessage(vforceResult.data) || vforceResult.upstream.status,
      );
      const saved = await saveLoyaltySignupToSupabase(payload);
      return sendJson(res, saved.status, {
        ok: true,
        promoCode: saved.promoCode,
        visitStatus: saved.visitStatus,
      });
    }

    return sendJson(res, vforceResult.status, {
      ok: true,
      promoCode: vforceResult.promoCode,
      visitStatus: vforceResult.visitStatus,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
