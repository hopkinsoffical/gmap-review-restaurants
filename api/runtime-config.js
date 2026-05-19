const { ensureLocalEnvLoaded, getServerEnv } = require("../lib/server/env");
const { createAppError } = require("../lib/server/shared");
const { handleApiError, methodNotAllowed, sendJson } = require("../lib/server/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  try {
    const env = getServerEnv();
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      throw createAppError(
        "RUNTIME_CONFIG_MISSING",
        "Supabase browser auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY.",
        500,
      );
    }

    ensureLocalEnvLoaded();
    const smsFunnelBeaconToken = String(process.env.SMS_FUNNEL_BEACON_RUNTIME_TOKEN || "").trim();

    return sendJson(res, 200, {
      supabaseUrl: env.supabaseUrl,
      supabaseAnonKey: env.supabaseAnonKey,
      smsFunnelBeaconToken: smsFunnelBeaconToken,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
