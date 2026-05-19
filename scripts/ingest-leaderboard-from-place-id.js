/**
 * Fetch one Google Place (Places API New) by place_id and ingest into salon_ai_leaderboard.
 *
 * Env (repo root .env / .env.local loaded when present):
 *   GOOGLE_PLACES_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/ingest-leaderboard-from-place-id.js ChIJq6pG06IAw4kRU_aYxvk51n4
 *   node scripts/ingest-leaderboard-from-place-id.js ChIJ... --dry-run
 *
 * Optional fallbacks when addressComponents omit locality/county:
 *   --town "West Caldwell"
 *   --county "Essex"
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function loadEnvFiles() {
  [".env.local", ".env"].forEach(function (name) {
    var p = path.join(root, name);
    if (!fs.existsSync(p)) return;
    var text = fs.readFileSync(p, "utf8");
    text.split(/\r?\n/).forEach(function (line) {
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
}

const STATE_LONG_TO_ABBR = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

function canonicalState(raw) {
  var s = String(raw || "").trim();
  if (!s) return "";
  if (s.length === 2 && /^[a-z]{2}$/i.test(s)) return s.toUpperCase();
  var k = s.toLowerCase();
  return STATE_LONG_TO_ABBR[k] || s;
}

function addressParts(components) {
  var out = { state: "", county: "", town: "", zipcode: "" };
  if (!Array.isArray(components)) return out;
  for (var i = 0; i < components.length; i++) {
    var c = components[i];
    if (!c || !Array.isArray(c.types)) continue;
    var longText = String(c.longText || c.shortText || "").trim();
    var types = c.types;
    if (types.indexOf("administrative_area_level_1") >= 0) out.state = longText;
    else if (types.indexOf("administrative_area_level_2") >= 0)
      out.county = longText.replace(/\s+County$/i, "");
    else if (types.indexOf("locality") >= 0) out.town = longText;
    else if (types.indexOf("postal_code") >= 0) out.zipcode = longText;
  }
  return out;
}

function stableSlug(name, placeId) {
  var h = crypto.createHash("sha256").update(String(placeId), "utf8").digest("hex").slice(0, 10);
  var base = String(name || "salon")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  if (!base) base = "salon";
  var cand = base + "-" + h;
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cand)) return cand;
  return "salon-" + h;
}

function displayName(place) {
  var dn = place && place.displayName;
  if (dn && typeof dn === "object" && dn.text) return String(dn.text).trim();
  if (typeof dn === "string") return dn.trim();
  return String((place && place.name) || "").trim();
}

function reviewsForIngest(place) {
  var revs = place && place.reviews;
  if (!Array.isArray(revs) || !revs.length) return undefined;
  var out = [];
  for (var i = 0; i < revs.length; i++) {
    var r = revs[i];
    if (!r || typeof r !== "object") continue;
    var item = {};
    if (r.rating != null) item.rating = r.rating;
    var pt = r.publishTime || r.publish_time;
    if (typeof pt === "string") item.publishTime = pt;
    else if (pt && typeof pt === "object" && pt.seconds != null)
      item.publishTime = new Date(Number(pt.seconds) * 1000).toISOString();
    if (Object.keys(item).length) out.push(item);
  }
  return out.length ? out : undefined;
}

function placeToSourceRow(place, fallbacks) {
  fallbacks = fallbacks || {};
  var pid = String(place.id || "")
    .trim()
    .replace(/^places\//, "");
  var name = displayName(place);
  var parts = addressParts(place.addressComponents);
  var rating = Number(place.rating) || 0;
  var nrev = Math.max(0, Math.floor(Number(place.userRatingCount) || 0));
  var primary = place.primaryType;
  var types = place.types;
  var category = "";
  if (typeof primary === "string" && primary.trim()) category = primary.replace(/_/g, " ").trim();
  else if (Array.isArray(types) && types.length) category = String(types[0]).replace(/_/g, " ").trim();

  var town = parts.town || fallbacks.town || "";
  var county = parts.county || fallbacks.county || "";
  var state = canonicalState(parts.state) || fallbacks.state || "NJ";

  return {
    slug: stableSlug(name, pid),
    place_id: pid,
    google_place_id: pid,
    name: name,
    address: String(place.formattedAddress || "").trim(),
    state: state,
    county: county,
    town: town,
    zipcode: parts.zipcode || "",
    category: category,
    rating: rating,
    review_count: nrev,
    phone: String(place.nationalPhoneNumber || "").trim(),
    reviews: reviewsForIngest(place),
    is_listed: true,
  };
}

const PLACE_DETAIL_MASK =
  "id,name,displayName,rating,userRatingCount,reviews,formattedAddress," +
  "nationalPhoneNumber,addressComponents,types,primaryType";

async function fetchPlace(placeId, apiKey) {
  const { getPlaceDetails } = require("../lib/server/google-places-client");
  return getPlaceDetails(placeId, apiKey, PLACE_DETAIL_MASK.split(","));
}

async function main() {
  loadEnvFiles();
  var argv = process.argv.slice(2);
  var dryRun = argv.indexOf("--dry-run") >= 0;
  argv = argv.filter(function (a) {
    return a !== "--dry-run";
  });

  var townFb = "";
  var countyFb = "";
  for (var ai = 0; ai < argv.length; ai++) {
    if (argv[ai] === "--town" && argv[ai + 1]) {
      townFb = argv[ai + 1];
      ai++;
    } else if (argv[ai] === "--county" && argv[ai + 1]) {
      countyFb = argv[ai + 1];
      ai++;
    }
  }
  argv = argv.filter(function (a, idx, arr) {
    if (a === "--town" || a === "--county") return false;
    if (idx > 0 && (arr[idx - 1] === "--town" || arr[idx - 1] === "--county")) return false;
    return true;
  });

  var placeId = (argv[0] || "").trim();
  if (!placeId) {
    console.error("Usage: node scripts/ingest-leaderboard-from-place-id.js <ChIJ...> [--town ...] [--county ...] [--dry-run]");
    process.exit(1);
  }

  var apiKey = String(process.env.GOOGLE_PLACES_API_KEY || "").trim();
  if (!apiKey) {
    console.error("GOOGLE_PLACES_API_KEY is not set (.env or environment).");
    process.exit(1);
  }

  console.log("Fetching place details…", placeId);
  var place = await fetchPlace(placeId, apiKey);
  var row = placeToSourceRow(place, { town: townFb, county: countyFb, state: "NJ" });

  var outPath = path.join(root, "data", "mennie-nails-west-caldwell-fetched.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify([row], null, 2), "utf8");
  console.log("Wrote", outPath);
  console.log(JSON.stringify(row, null, 2));

  if (dryRun) {
    console.log("Dry run: skip Supabase ingest.");
    return;
  }

  var supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  var serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for ingest (skipped dry-run).");
    process.exit(1);
  }

  const { ingestLeaderboardSourceRecords } = require("../lib/server/leaderboard-ingest");
  var result = await ingestLeaderboardSourceRecords([row]);
  console.log("Ingested", result.inserted, "row(s). Slugs:", result.slugs.join(", "));
}

main().catch(function (err) {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
