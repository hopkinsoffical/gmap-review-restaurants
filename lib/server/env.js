const fs = require("fs");
const path = require("path");

const { createAppError } = require("./shared");

let cachedEnv = null;
let localEnvLoaded = false;

function parseEnvValue(value) {
  const trimmed = String(value || "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(filename) {
  const envPath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  content.split(/\r?\n/).forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) return;

    process.env[key] = parseEnvValue(trimmed.slice(separatorIndex + 1));
  });
}

function ensureLocalEnvLoaded() {
  if (localEnvLoaded) return;
  localEnvLoaded = true;

  loadEnvFile(".env.local");
  loadEnvFile(".env");
}

function readEnv(name, options) {
  ensureLocalEnvLoaded();

  const settings = Object.assign(
    {
      defaultValue: "",
      required: false,
    },
    options || {},
  );

  const value = process.env[name];
  if (value == null || value === "") {
    if (settings.required) {
      throw createAppError("ENV_MISSING", "Missing required environment variable: " + name, 500);
    }
    return settings.defaultValue;
  }
  return String(value);
}

function readEnvAny(names, options) {
  ensureLocalEnvLoaded();

  // Useful for migrations where variable names changed across environments.
  const keys = Array.isArray(names) ? names : [names];
  for (let index = 0; index < keys.length; index += 1) {
    const key = String(keys[index] || "").trim();
    if (!key) continue;
    const value = process.env[key];
    if (value != null && value !== "") {
      return String(value);
    }
  }

  const settings = Object.assign(
    {
      defaultValue: "",
      required: false,
    },
    options || {},
  );

  if (settings.required) {
    throw createAppError(
      "ENV_MISSING",
      "Missing required environment variable. Tried: " + keys.filter(Boolean).join(", "),
      500,
    );
  }
  return settings.defaultValue;
}

function getServerEnv() {
  if (cachedEnv) return cachedEnv;

  cachedEnv = {
    appBaseUrl: readEnv("APP_BASE_URL"),
    googlePlacesApiKey: readEnv("GOOGLE_PLACES_API_KEY"),
    storeMapReportSecret: readEnv("STORE_MAP_REPORT_SECRET"),
    leaderboardRefreshSecret: readEnv("LEADERBOARD_REFRESH_SECRET"),
    openaiApiKey: readEnv("OPENAI_API_KEY"),
    openaiBaseUrl: readEnv("OPENAI_BASE_URL", { defaultValue: "https://api.openai.com/v1" }),
    openaiModel: readEnv("OPENAI_MODEL", { defaultValue: "gpt-4.1-mini" }),
    // Prefer canonical key; keep Vercel-prefixed alias for backward compatibility.
    shopifyStorefrontAccessToken: readEnvAny(
      ["SHOPIFY_STOREFRONT_ACCESS_TOKEN", "VERCEL_SHOPIFY_STOREFRONT_ACCESS_TOKEN"],
      { defaultValue: "" },
    ),
    supabaseAnonKey: readEnv("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseUrl: readEnv("SUPABASE_URL", { required: true }),
    twilioAccountSid: readEnv("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: readEnv("TWILIO_AUTH_TOKEN"),
    twilioMessagingServiceSid: readEnv("TWILIO_MESSAGING_SERVICE_SID"),
    /** Vercel Cron and/or manual triggers may send this Bearer token for /api/sms/send-batch. */
    cronSecret: readEnv("CRON_SECRET", { defaultValue: "" }),
  };

  return cachedEnv;
}

module.exports = {
  ensureLocalEnvLoaded,
  getServerEnv,
};
