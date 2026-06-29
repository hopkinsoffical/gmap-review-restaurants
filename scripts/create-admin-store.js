#!/usr/bin/env node
/**
 * Exercise the same createStoreForAdmin path as POST /api/admin/stores (portal Add store).
 *
 * Usage:
 *   node scripts/create-admin-store.js --slug xiebao-flushing --name-zh "蟹宝 Flushing" --name-en "Xiebao Flushing"
 *   node scripts/create-admin-store.js --dry-run --slug xiebao-flushing ...
 */
const fs = require("fs");
const path = require("path");
const { createStoreForAdmin } = require("../lib/server/store-repo");

function loadDotEnvFile(filename) {
  const envPath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  content.split(/\r?\n/).forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) return;

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key]) return;

    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
}

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) return "";
  return String(process.argv[index + 1] || "").trim();
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function main() {
  loadDotEnvFile(".env.local");

  const payload = {
    slug: readArg("--slug"),
    nameZh: readArg("--name-zh"),
    nameEn: readArg("--name-en"),
    googleReviewUrl: readArg("--google-review-url"),
    googleReviewFallbackUrl: readArg("--google-review-fallback-url"),
    googlePlaceId: readArg("--google-place-id"),
    isActive: !hasFlag("--inactive"),
  };

  if (!payload.slug || !payload.nameZh || !payload.nameEn) {
    console.error(
      "Usage: node scripts/create-admin-store.js --slug <slug> --name-zh <zh> --name-en <en> [--google-review-url URL] [--google-review-fallback-url URL] [--google-place-id ID] [--inactive] [--dry-run]",
    );
    process.exit(1);
  }

  if (hasFlag("--dry-run")) {
    console.log("[create-admin-store] dry run — payload validated, skipping insert");
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const store = await createStoreForAdmin(payload);
  console.log("[create-admin-store] created:", store.slug, store.id);
  console.log(JSON.stringify(store, null, 2));
}

main().catch(function (error) {
  const code = error && error.code ? error.code : "";
  const message = error && error.message ? error.message : String(error);
  console.error("[create-admin-store] failed:", code || message);
  if (code) console.error(message);
  process.exit(1);
});
