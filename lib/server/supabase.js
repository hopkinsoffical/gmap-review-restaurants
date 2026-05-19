const { createClient } = require("@supabase/supabase-js");
const { getServerEnv } = require("./env");

let cachedClient = null;
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
  if (cachedClient) return cachedClient;

  const env = getServerEnv();
  const jwtRole = readJwtRole(env.supabaseServiceRoleKey);
  if (!warnedServiceRoleKeyMismatch && jwtRole && jwtRole !== "service_role") {
    warnedServiceRoleKeyMismatch = true;
    console.error(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY JWT role is \"" +
        jwtRole +
        '" (expected "service_role"). Admin writes to store_service_items will fail. Copy the service_role key from Supabase → Project Settings → API.',
    );
  }
  cachedClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

module.exports = {
  getSupabaseAdmin,
};
