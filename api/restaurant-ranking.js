/**
 * GET /api/restaurant-ranking?slug=katz-s-delicatessen-1ae1fb7076
 * GET /api/restaurant-ranking?placeId=ChIJCar0f49ZwokR6ozLV-dHNTE
 * GET /api/restaurant-ranking?camis=50062888
 *
 * Returns full leaderboard row + google profile + DOH data merged.
 */

const { getSupabaseAdmin } = require("../lib/server/supabase");
const { handleApiError, sendJson } = require("../lib/server/http");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }

  try {
    const q = req.query || {};
    const slug    = String(q.slug    || "").trim();
    const placeId = String(q.placeId || "").trim();
    const camis   = String(q.camis   || "").trim();

    if (!slug && !placeId && !camis) {
      return sendJson(res, 400, { error: "slug, placeId, or camis required" });
    }

    const supabase = getSupabaseAdmin();

    // 1. Try restaurant_leaderboard first (has pre-computed scores)
    let lbRow = null;
    if (slug) {
      const { data } = await supabase.from("restaurant_leaderboard").select("*").eq("slug", slug).maybeSingle();
      lbRow = data;
    } else if (placeId) {
      const { data } = await supabase.from("restaurant_leaderboard").select("*").eq("place_id", placeId).maybeSingle();
      lbRow = data;
    } else if (camis) {
      const { data } = await supabase.from("restaurant_leaderboard").select("*").eq("camis", camis).maybeSingle();
      lbRow = data;
    }

    // 2. Fallback: look up from google profiles directly
    let profile = null;
    if (!lbRow) {
      const profileQ = supabase.from("info_gather_google_profiles").select("*").limit(1);
      if (placeId)      profileQ.eq("place_id", placeId);
      else if (camis)   profileQ.eq("camis", camis);
      else return sendJson(res, 404, { error: "Restaurant not found in leaderboard. Run ingest_restaurant_leaderboard.py first." });
      const { data } = await profileQ.maybeSingle();
      profile = data;
      if (!profile) return sendJson(res, 404, { error: "No Google profile found." });
    }

    // 3. Get full Google profile (for the report page's rich data)
    if (!profile && lbRow) {
      const pid = lbRow.place_id;
      const { data } = await supabase.from("info_gather_google_profiles")
        .select("*").eq("place_id", pid).limit(1).maybeSingle();
      profile = data;
    }

    // 4. Get DOH data
    const camisKey = (lbRow && lbRow.camis) || (profile && profile.camis);
    let restaurant = null;
    if (camisKey) {
      const { data } = await supabase.from("info_gather_restaurants")
        .select("id,camis,latest_grade,latest_score,cuisine_description,boro")
        .eq("camis", camisKey).limit(1).maybeSingle();
      restaurant = data;
    }

    return sendJson(res, 200, {
      leaderboard: lbRow,
      profile:     profile,
      restaurant:  restaurant,
    });
  } catch (err) {
    return handleApiError(res, err);
  }
};
