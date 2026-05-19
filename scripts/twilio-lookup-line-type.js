/**
 * Twilio Lookups v2 + Line Type Intelligence (same idea as Python leaderboard_phone_sms_lookup).
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (from .env.local — same loader as ingest-salon-ai-leaderboard.js)
 *
 * Usage:
 *   npm run twilio:lookup -- +15551234567
 *   node scripts/twilio-lookup-line-type.js +15551234567
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

(function loadEnvLocal() {
  [".env.local", ".env"].forEach(function (name) {
    var p = path.join(root, name);
    if (!fs.existsSync(p)) return;
    fs.readFileSync(p, "utf8")
      .split(/\r?\n/)
      .forEach(function (line) {
        line = String(line || "").trim();
        if (!line || line.charAt(0) === "#") return;
        if (line.indexOf("export ") === 0) line = line.slice(7).trim();
        var eq = line.indexOf("=");
        if (eq <= 0) return;
        var key = line.slice(0, eq).trim();
        var v = line.slice(eq + 1).trim();
        if (
          (v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') ||
          (v.charAt(0) === "'" && v.charAt(v.length - 1) === "'")
        ) {
          v = v.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = v;
      });
  });
})();

const client = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function checkNumber(phone) {
  try {
    const result = await client.lookups.v2.phoneNumbers(phone).fetch({ fields: "line_type_intelligence" });

    const lt = result.lineTypeIntelligence;
    const type = lt && lt.type ? lt.type : "";
    console.log(type || "(no lineTypeIntelligence.type)");
    return type;
  } catch (e) {
    console.error(e && e.message ? e.message : e);
    return "invalid";
  }
}

async function main() {
  var sid = process.env.TWILIO_ACCOUNT_SID;
  var tok = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !tok) {
    console.error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in environment.");
    process.exit(1);
  }
  var phone = process.argv[2];
  if (!phone) {
    console.error("Usage: node scripts/twilio-lookup-line-type.js +15551234567");
    process.exit(1);
  }
  await checkNumber(phone);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
