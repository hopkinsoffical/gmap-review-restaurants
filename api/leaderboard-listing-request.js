const { getSupabaseAdmin } = require("../lib/server/supabase");
const { createAppError } = require("../lib/server/shared");
const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/server/http");

const LIMITS = {
  salon_name: 300,
  contact_name: 200,
  email: 254,
  phone: 64,
  address: 500,
  message: 4000,
};

function clip(value, max) {
  const s = String(value || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function isListingRequestsTableMissingError(error) {
  if (!error || typeof error !== "object") return false;
  const raw = String(error.message || error.details || "");
  if (raw.toLowerCase().indexOf("leaderboard_listing_requests") < 0) return false;
  if (String(error.code) === "42P01") return true;
  return /does not exist/i.test(raw);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const body = await readJsonBody(req);
    const salon_name = clip(body.salon_name, LIMITS.salon_name);
    const contact_name = clip(body.contact_name, LIMITS.contact_name);
    const email = clip(body.email, LIMITS.email);
    const phone = clip(body.phone, LIMITS.phone);
    const address = clip(body.address, LIMITS.address);
    const message = clip(body.message, LIMITS.message);
    const request_kind = clip(body.request_kind, 32) || "add_store";

    if (!salon_name) {
      throw createAppError("INVALID_INPUT", "Salon name is required.", 400);
    }
    if (!contact_name) {
      throw createAppError("INVALID_INPUT", "Your name is required.", 400);
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw createAppError("INVALID_INPUT", "A valid email is required.", 400);
    }
    if (request_kind !== "add_store" && request_kind !== "more_coverage") {
      throw createAppError("INVALID_INPUT", "Invalid request type.", 400);
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("leaderboard_listing_requests").insert({
      salon_name: salon_name,
      contact_name: contact_name,
      email: email,
      phone: phone,
      address: address,
      message: message || "(none)",
      request_kind: request_kind,
      user_agent: String((req.headers && req.headers["user-agent"]) || "").slice(0, 2000),
    });

    if (error) {
      if (isListingRequestsTableMissingError(error)) {
        throw createAppError(
          "LEADERBOARD_REQUESTS_NOT_CONFIGURED",
          "Run sql/013_salon_ai_leaderboard.sql in Supabase (includes listing requests table).",
          503,
        );
      }
      throw createAppError("LEADERBOARD_REQUEST_FAILED", error.message || "Could not save request.", 500);
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return handleApiError(res, error);
  }
};
