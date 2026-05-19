const { createAppError } = require("../lib/server/shared");
const { getSlugParam, handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/server/http");
const { getActiveStoreBySlug, insertStorePrivateFeedback } = require("../lib/server/store-repo");

function clip(value, max) {
  const s = String(value || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
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
    const slug = getSlugParam(req);
    if (!slug) {
      throw createAppError("INVALID_SLUG", "Store slug is required", 400);
    }

    const store = await getActiveStoreBySlug(slug);
    if (!store) {
      throw createAppError("STORE_NOT_FOUND", "Store not found or inactive", 404);
    }

    const body = await readJsonBody(req);
    const name = clip(body && body.name, 200);
    const phoneRaw = clip(body && body.phone, 64);
    const googleAccount = clip(body && body.googleAccount, 254);
    const message = clip(body && body.message, 12000);
    const lang = clip(body && body.lang, 8);

    if (!name) {
      throw createAppError("INVALID_INPUT", "Name is required.", 400);
    }
    if (!message || message.length < 4) {
      throw createAppError("INVALID_INPUT", "Please add a few words about your visit.", 400);
    }

    if (googleAccount) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(googleAccount)) {
        throw createAppError("INVALID_INPUT", "Google / Gmail must be a valid email if provided.", 400);
      }
    }

    const phoneDigits = digitsOnly(phoneRaw);
    if (phoneRaw && phoneDigits.length > 0 && phoneDigits.length < 7) {
      throw createAppError("INVALID_INPUT", "Phone number looks too short.", 400);
    }

    const userAgent =
      req.headers && (req.headers["user-agent"] || req.headers["User-Agent"])
        ? String(req.headers["user-agent"] || req.headers["User-Agent"] || "").slice(0, 512)
        : null;

    const row = await insertStorePrivateFeedback({
      storeId: store.id,
      name: name,
      phone: phoneDigits.length >= 7 ? clip(phoneRaw, 64) : null,
      googleAccount: googleAccount || "",
      body: message,
      lang: lang || null,
      userAgent: userAgent,
      clientIp: getClientIp(req),
    });

    return sendJson(res, 201, {
      ok: true,
      id: row && row.id ? row.id : null,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
