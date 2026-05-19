const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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

function readRequiredEnv(name) {
  const value = process.env[name];
  if (value == null || value === "") {
    throw new Error("Missing required environment variable: " + name);
  }
  return String(value);
}

async function main() {
  loadDotEnvFile(".env.local");

  const slug = String(process.env.STORE_SLUG || "").trim();
  const version = Number(process.env.MENU_VERSION || "1");
  const sourceNote = String(process.env.SOURCE_NOTE || "Seeded from local menu.json").trim();
  const menuFile = path.resolve(process.cwd(), process.env.MENU_FILE || "./menu.json");
  const supabaseUrl = readRequiredEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!slug) {
    throw new Error("STORE_SLUG is required");
  }
  if (!Number.isFinite(version) || version <= 0) {
    throw new Error("MENU_VERSION must be a positive integer");
  }
  if (!fs.existsSync(menuFile)) {
    throw new Error("Menu file not found: " + menuFile);
  }

  const menuJson = JSON.parse(fs.readFileSync(menuFile, "utf8"));
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const storeResult = await supabase
    .from("stores")
    .select("id, slug")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (storeResult.error) throw storeResult.error;
  if (!storeResult.data) {
    throw new Error("Store not found for slug: " + slug);
  }

  const storeId = storeResult.data.id;

  const unpublishResult = await supabase
    .from("store_menu_snapshots")
    .update({
      is_published: false,
      published_at: null,
    })
    .eq("store_id", storeId)
    .eq("is_published", true);

  if (unpublishResult.error) throw unpublishResult.error;

  const upsertResult = await supabase
    .from("store_menu_snapshots")
    .upsert(
      {
        store_id: storeId,
        version: version,
        menu_json: menuJson,
        source_type: "local_seed",
        source_note: sourceNote,
        is_published: true,
        published_at: new Date().toISOString(),
      },
      {
        onConflict: "store_id,version",
      },
    )
    .select("id, version")
    .single();

  if (upsertResult.error) throw upsertResult.error;

  console.log(
    JSON.stringify(
      {
        menuSnapshotId: upsertResult.data.id,
        slug: slug,
        version: upsertResult.data.version,
      },
      null,
      2,
    ),
  );
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});
