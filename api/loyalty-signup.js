// Loyalty signup — the step after a customer posts a Google review.
// Customer leaves a phone number to get a promo code for their next visit.
//
// This no longer writes to Supabase. It forwards to the vForce backend
// (portal public proxy -> core-api), which writes directly to the vForce RDS
// (public.loyalty_clients) and propagates to the member-tier model. We capture
// the client's IP + user-agent here at the edge and forward them so vForce can
// store a defensible SMS-consent record.
//
// Requires env VFORCE_PUBLIC_URL, e.g. https://52-207-187-219.nip.io
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const base = String(process.env.VFORCE_PUBLIC_URL || "https://52.207.187.219").trim().replace(/\/+$/, "");
    if (!base) {
      throw createAppError(
        "VFORCE_PUBLIC_URL_MISSING",
        "VFORCE_PUBLIC_URL is not configured. [VFORCE_PUBLIC_URL_MISSING]",
        503,
      );
    }

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

    const upstream = await fetch(base + "/api/portal/loyalty-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        smsConsent: true,
        storeSlug,
        placeId,
        consentIp: getClientIp(req),
        userAgent,
        lang: body.lang || null,
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || !data || data.ok !== true) {
      const msg = (data && (data.error || data.detail)) || "Could not save right now.";
      throw createAppError("LOYALTY_SIGNUP_SAVE_FAILED", String(msg), upstream.status || 502);
    }
    return sendJson(res, upstream.status === 201 ? 201 : 200, {
      ok: true,
      promoCode: data.promoCode,
      visitStatus: data.visitStatus,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
