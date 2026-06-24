const { createClient } = require("@supabase/supabase-js");
const { getServerEnv } = require("./env");
const { createAppError } = require("./shared");

let cachedAdminClient = null;
let cachedPublicClient = null;
let warnedServiceRoleKeyMismatch = false;

function readJwtRole(jwt) {
  try {
    const parts = String(jwt || "").split(".");
    if (parts.length < 2) return "";
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return String(payload && payload.role ? payload.role : "").trim();
  } catch (e) {
    return "";
  }
}

function getSupabaseAdmin() {
  if (cachedAdminClient) return cachedAdminClient;

  const env = getServerEnv();
  if (!env.supabaseUrl) {
    throw createAppError("ENV_MISSING", "Missing required environment variable: SUPABASE_URL", 500);
  }
  if (!env.supabaseServiceRoleKey) {
    throw createAppError("ENV_MISSING", "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY", 500);
  }

  const jwtRole = readJwtRole(env.supabaseServiceRoleKey);
  if (!warnedServiceRoleKeyMismatch && jwtRole && jwtRole !== "service_role") {
    warnedServiceRoleKeyMismatch = true;
    console.error(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY JWT role is \"" +
        jwtRole +
        '" (expected "service_role"). Admin writes to store_service_items will fail. Copy the service_role key from Supabase → Project Settings → API.',
    );
  }
  cachedAdminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedAdminClient;
}

/** Public read client (anon key + RLS). Use for leaderboard / intel list endpoints. */
function getSupabasePublic() {
  if (cachedPublicClient) return cachedPublicClient;

  const env = getServerEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw createAppError(
      "ENV_MISSING",
      "Missing required environment variable. Set SUPABASE_URL and SUPABASE_ANON_KEY for public leaderboard reads.",
      500,
    );
  }

  cachedPublicClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedPublicClient;
}

module.exports = {
  getSupabaseAdmin,
  getSupabasePublic,
};
