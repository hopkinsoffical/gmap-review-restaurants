/**
 * Recompute sentiment_p, freshness_f, ai_score, assessment_level for every **latest listed**
 * row in public.salon_ai_leaderboard (view salon_ai_leaderboard_latest) using current scoring.
 *
 * assessment_level is cohort-relative: rank by ai_score among latest listed slugs
 * (see lib/server/leaderboard-scoring.js — percentile bands on ai_score rank).
 *
 * Usage (repo root, .env.local with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   node scripts/recompute-leaderboard-scores.js --dry-run
 *   node scripts/recompute-leaderboard-scores.js
 *
 * Options:
 *   --dry-run   Log counts and a few samples, no writes
 *   --limit N   Process at most N rows (testing)
 */

const path = require("path");

const root = path.resolve(__dirname, "..");
process.chdir(root);

const { getSupabaseAdmin } = require("../lib/server/supabase");
const { computeLeaderboardMetrics } = require("../lib/server/leaderboard-ingest");
const { assignAssessmentLevelsByAiScorePercentile } = require("../lib/server/leaderboard-scoring");

const PAGE = 500;

function approxEq(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.001;
}

function parseArgs(argv) {
  const out = { dryRun: false, limit: 0, offset: 0 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") out.dryRun = true;
    if (argv[i] === "--limit") {
      out.limit = Math.max(0, parseInt(argv[i + 1], 10) || 0);
      i += 1;
    }
    if (argv[i] === "--offset") {
      out.offset = Math.max(0, parseInt(argv[i + 1], 10) || 0);
      i += 1;
    }
  }
  return out;
}

async function fetchLatestPage(supabase, from, to) {
  const { data, error } = await supabase
    .from("salon_ai_leaderboard")
    .select(
      "id, slug, is_listed, updated_at, created_at, rating, review_count, phone, address, place_id, google_place_id, instagram_handle, instagram_url, sentiment_p, freshness_f, ai_score, assessment_level, dim_reviews_score, dim_rating_score, dim_sentiment_score, dim_recency_score, dim_local_seo_score, dim_conversion_score",
    )
    .order("id", { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message || "select latest failed");
  return data || [];
}

async function fetchAllLatestRows(supabase, limit, offsetRows) {
  const all = [];
  let offset = 0;
  while (true) {
    const rows = await fetchLatestPage(supabase, offset, offset + PAGE - 1);
    for (let i = 0; i < rows.length; i += 1) {
      all.push(rows[i]);
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  all.sort(function (a, b) {
    const sa = String(a.slug || "");
    const sb = String(b.slug || "");
    if (sa !== sb) return sa.localeCompare(sb);
    const ua = Date.parse(String(a.updated_at || a.created_at || "")) || 0;
    const ub = Date.parse(String(b.updated_at || b.created_at || "")) || 0;
    if (ub !== ua) return ub - ua;
    return String(b.id || "").localeCompare(String(a.id || ""));
  });
  const latest = [];
  const seen = new Set();
  for (let i = 0; i < all.length; i += 1) {
    const r = all[i];
    const slug = String(r.slug || "").trim();
    if (!slug || seen.has(slug) || r.is_listed === false) continue;
    seen.add(slug);
    latest.push(r);
    if (limit && latest.length >= limit) break;
  }
  const start = Math.max(0, Math.floor(Number(offsetRows) || 0));
  if (limit && limit > 0) return latest.slice(start, start + limit);
  return latest.slice(start);
}

async function main() {
  const opts = parseArgs(process.argv);
  const supabase = getSupabaseAdmin();

  const latestRows = await fetchAllLatestRows(supabase, opts.limit, opts.offset);
  const work = latestRows.map(function (row) {
    const rating = Number(row.rating) || 0;
    const reviewCount = Math.max(0, Math.floor(Number(row.review_count) || 0));
    const metrics = computeLeaderboardMetrics({
      rating,
      review_count: reviewCount,
      reviews: undefined,
      star_histogram: undefined,
      phone: row.phone,
      address: row.address,
      place_id: row.place_id || row.google_place_id,
      instagram_handle: row.instagram_handle,
      instagram_url: row.instagram_url,
    });
    return {
      id: row.id,
      slug: row.slug,
      sentiment_p: metrics.sentiment_p,
      freshness_f: metrics.freshness_f,
      ai_score: metrics.ai_score,
      assessment_level: metrics.assessment_level,
      dim_reviews_score: metrics.dim_reviews_score,
      dim_rating_score: metrics.dim_rating_score,
      dim_sentiment_score: metrics.dim_sentiment_score,
      dim_recency_score: metrics.dim_recency_score,
      dim_local_seo_score: metrics.dim_local_seo_score,
      dim_conversion_score: metrics.dim_conversion_score,
      _old: {
        sentiment_p: row.sentiment_p,
        freshness_f: row.freshness_f,
        ai_score: row.ai_score,
        assessment_level: row.assessment_level,
        dim_reviews_score: row.dim_reviews_score,
        dim_rating_score: row.dim_rating_score,
        dim_sentiment_score: row.dim_sentiment_score,
        dim_recency_score: row.dim_recency_score,
        dim_local_seo_score: row.dim_local_seo_score,
        dim_conversion_score: row.dim_conversion_score,
      },
    };
  });

  assignAssessmentLevelsByAiScorePercentile(work);

  let changed = 0;
  const samples = [];

  for (let i = 0; i < work.length; i += 1) {
    const row = work[i];
    const same =
      approxEq(row._old.sentiment_p, row.sentiment_p) &&
      approxEq(row._old.freshness_f, row.freshness_f) &&
      approxEq(row._old.ai_score, row.ai_score) &&
      String(row._old.assessment_level || "").toUpperCase() === String(row.assessment_level || "").toUpperCase() &&
      approxEq(row._old.dim_reviews_score, row.dim_reviews_score) &&
      approxEq(row._old.dim_rating_score, row.dim_rating_score) &&
      approxEq(row._old.dim_sentiment_score, row.dim_sentiment_score) &&
      approxEq(row._old.dim_recency_score, row.dim_recency_score) &&
      approxEq(row._old.dim_local_seo_score, row.dim_local_seo_score) &&
      approxEq(row._old.dim_conversion_score, row.dim_conversion_score);

    if (!same) changed += 1;

    if (samples.length < 5 && !same) {
      samples.push({
        slug: row.slug,
        old: row._old,
        new: {
          sentiment_p: row.sentiment_p,
          freshness_f: row.freshness_f,
          ai_score: row.ai_score,
          assessment_level: row.assessment_level,
          dim_reviews_score: row.dim_reviews_score,
          dim_rating_score: row.dim_rating_score,
          dim_sentiment_score: row.dim_sentiment_score,
          dim_recency_score: row.dim_recency_score,
          dim_local_seo_score: row.dim_local_seo_score,
          dim_conversion_score: row.dim_conversion_score,
        },
      });
    }

    if (!opts.dryRun) {
      const { error: upErr } = await supabase
        .from("salon_ai_leaderboard")
        .update({
          sentiment_p: row.sentiment_p,
          freshness_f: row.freshness_f,
          ai_score: row.ai_score,
          assessment_level: row.assessment_level,
          dim_reviews_score: row.dim_reviews_score,
          dim_rating_score: row.dim_rating_score,
          dim_sentiment_score: row.dim_sentiment_score,
          dim_recency_score: row.dim_recency_score,
          dim_local_seo_score: row.dim_local_seo_score,
          dim_conversion_score: row.dim_conversion_score,
        })
        .eq("id", row.id);

      if (upErr) {
        throw new Error(upErr.message || "update failed for id " + row.id);
      }
    }
  }

  console.log(opts.dryRun ? "DRY-RUN — no writes." : "Updated", work.length, "latest-listed row(s) by id.");
  if (opts.offset > 0 || opts.limit > 0) {
    console.log("Window:", "offset=" + opts.offset, "limit=" + (opts.limit || "all"));
  }
  console.log("Rows with any score field change (vs old row):", changed);
  if (samples.length) {
    console.log("Sample changes (first", samples.length, "):");
    console.log(JSON.stringify(samples, null, 2));
  }
}

main().catch(function (err) {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
