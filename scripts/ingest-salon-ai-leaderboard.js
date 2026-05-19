/**
 * Ingest AI leaderboard source JSON into public.salon_ai_leaderboard (append-only history).
 * Uses the same scoring as the live app (lib/server/leaderboard-scoring.js).
 *
 * Prerequisites:
 * - sql/013 … sql/021_leaderboard_slug_history_latest_view.sql
 * - .env with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/ingest-salon-ai-leaderboard.js [path/to/source.json]
 *   AI_LEADERBOARD_SOURCE_PATH=data/ai-leaderboard-source.json node scripts/ingest-salon-ai-leaderboard.js
 *
 * Python alternative (same JSON shape): npm run ingest:leaderboard:py
 */
const fs = require("fs");
const path = require("path");

const { ingestLeaderboardSourceRecords } = require("../lib/server/leaderboard-ingest");

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

function readJsonArray(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  if (!fs.existsSync(abs)) {
    console.error("File not found:", abs);
    process.exit(1);
  }
  const text = fs.readFileSync(abs, "utf8");
  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    console.error("Expected a JSON array of salon objects.");
    process.exit(1);
  }
  return data;
}

async function main() {
  const fromArg = process.argv[2];
  const fromEnv = process.env.AI_LEADERBOARD_SOURCE_PATH;
  const defaultPath = path.join("data", "ai-leaderboard-source.json");
  const rel = fromArg || fromEnv || defaultPath;
  const records = readJsonArray(rel);
  const result = await ingestLeaderboardSourceRecords(records);
  console.log("Ingested", result.inserted, "row(s). Slugs:", result.slugs.join(", "));
}

main().catch(function (err) {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
