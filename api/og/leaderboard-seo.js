const { getServerEnv } = require("../../lib/server/env");
const { methodNotAllowed, sendError } = require("../../lib/server/http");
const { getLeaderboardSalonBySlug } = require("../../lib/server/leaderboard-repo");

const SITE = "RankMySalon.AI";

/**
 * Public absolute origin for og:url and og:image. Prefer request Host; if missing (some proxies),
 * fall back to APP_BASE_URL or VERCEL_URL so share crawlers get 200 + valid meta, not 500 NO_HOST.
 */
function getBaseFromReq(req) {
  const h = (req && req.headers) || {};
  const host = h["x-forwarded-host"] || h.host;
  if (!host) {
    const app = (getServerEnv().appBaseUrl || "").trim();
    if (app) {
      try {
        return new URL(app).origin;
      } catch (_e) {}
    }
    const v = process.env.VERCEL_URL;
    if (v) {
      return "https://" + String(v).split(",")[0].trim();
    }
    return "";
  }
  const forwardProto = h["x-forwarded-proto"] || h["x-vercel-proto"] || h["X-Forwarded-Proto"];
  const isLocal = /^(localhost|127\.\d+\.\d+\.\d+)(:\d+)?$/i.test(String(host).split(",")[0].trim());
  const httpsOnly = h["x-forwarded-ssl"] === "on" || h["x-vercel-ssl"] === "1" || h["X-Forwarded-Ssl"] === "on";
  const proto = forwardProto
    ? String(Array.isArray(forwardProto) ? forwardProto[0] : forwardProto)
        .split(",")[0]
        .trim() || (httpsOnly || isLocal ? (isLocal ? "http" : "https") : "https")
    : isLocal
      ? "http"
      : "https";
  return proto + "://" + String(host).split(",")[0].trim();
}

/** iMessage and others refuse http og:image; upgrade public hosts to https. */
function ensureHttpsOrigin(origin) {
  const o = String(origin || "").trim();
  if (!o) return o;
  try {
    const u = new URL(o);
    const h = u.hostname.toLowerCase();
    const isLoopback = h === "localhost" || /^127\.\d+\.\d+\.\d+$/.test(h);
    if (u.protocol === "http:" && !isLoopback) {
      u.protocol = "https:";
      return u.origin;
    }
    return u.origin;
  } catch (_e) {
    return o;
  }
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Serves a minimal HTML shell with Open Graph + Twitter large-card tags
 * for share crawlers. Normal users are forwarded through middleware, not
 * (usually) this route, but a noscript/refresh links back to the SPA.
 */
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }
  // No User-Agent filter: the Edge rewrite must always return 200, or in-app
  // link previews and some crawlers (missing/changed UA on internal rewrites) break.
  getServerEnv();
  const base = ensureHttpsOrigin(getBaseFromReq(req));
  if (!base) {
    return sendError(res, 500, "NO_HOST", "Missing host headers.");
  }

  const u = new URL("http://local" + String(req.url || ""));
  const enc = (u.searchParams.get("og") || "").trim();
  let a;
  try {
    a = !enc
      ? new URL("/leaderboard", "https://og.local")
      : new URL("https://og.local" + (enc[0] === "/" ? enc : `/${enc}`));
  } catch (_e) {
    return sendError(res, 400, "BAD_OG", "Invalid `og` parameter.");
  }
  const pathQ = a.pathname;
  if (!pathQ || !pathQ.startsWith("/leaderboard")) {
    return sendError(res, 400, "BAD_OG", "Path must be under /leaderboard.");
  }
  const qStr = a.search || "";

  const isDetail = /^\/leaderboard\/[^/]+$/i.test(pathQ);
  const slug = isDetail ? pathQ.replace(/^\/leaderboard\//i, "").split("/").pop() : "";
  const searchParams = a.searchParams;

  const state = (searchParams.get("state") || "").trim();
  const county = (searchParams.get("county") || "").trim();
  const town = (searchParams.get("town") || "").trim();
  const locPref = (searchParams.get("locale") || searchParams.get("lang") || "").toLowerCase() === "zh" ? "zh" : "en";

  const can = base + pathQ + (qStr || "");
  const imgB = new URLSearchParams();
  if (isDetail) {
    imgB.set("slug", slug);
    if (locPref === "zh") {
      imgB.set("locale", "zh");
    }
  } else {
    if (state) {
      imgB.set("state", state);
    }
    if (county) {
      imgB.set("county", county);
    }
    if (town) {
      imgB.set("town", town);
    }
    if (locPref === "zh") {
      imgB.set("locale", "zh");
    }
  }
  const imageUrl = base + "/api/og/leaderboard-image" + (imgB.toString() ? "?" + imgB.toString() : "");

  let title = escapeAttr(SITE + (locPref === "zh" ? " · 排行榜" : " · AI leaderboard"));
  let desc = escapeAttr(locPref === "zh" ? "浏览美沙龙 AI 评分榜。" : "Live salon AI scores on Google — browse the board.");
  if (isDetail) {
    try {
      const salon = await getLeaderboardSalonBySlug(slug);
      title = escapeAttr(
        (salon.name || slug) + (locPref === "zh" ? " | " : " | ") + SITE + (locPref === "zh" ? " 排行榜" : " scorecard"),
      );
      const loc = [salon.town, salon.state].filter(Boolean).join(", ");
      desc = escapeAttr(
        (loc ? loc + " · " : "") +
          (locPref === "zh" ? "评论与 AI 分 · 榜单小卡片" : "Rating & AI score · list-style card preview"),
      );
    } catch (e) {
      if (e && e.code === "SALON_NOT_FOUND") {
        title = escapeAttr(locPref === "zh" ? "未找到 | " + SITE : "Not found | " + SITE);
        desc = escapeAttr(
          locPref === "zh" ? "该沙龙的榜单预览不可用。" : "This salon is not on the public leaderboard view.",
        );
      } else {
        // DB/schema errors must not return 5xx here — Facebook/X report "bad response" for the page.
        // Still emit og tags; og:image route renders a fallback image on error.
        const code = e && e.code ? String(e.code) : "";
        console.error("[leaderboard-seo] detail slug", slug, code, e && e.message);
        const label = String(slug || "salon")
          .replace(/-/g, " ")
          .replace(/\b\w/g, function (c) {
            return c.toUpperCase();
          });
        title = escapeAttr(label + " | " + SITE + (locPref === "zh" ? " 排行榜" : " scorecard"));
        desc = escapeAttr(
          locPref === "zh"
            ? "打开链接查看该沙龙的 AI 分与评价摘要。"
            : "Open the link to load this salon’s AI score and reviews on RankMySalon.",
        );
      }
    }
  }

  const html = `<!doctype html>
<html lang="${locPref === "zh" ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<link rel="canonical" href="${escapeAttr(can)}" />
<meta name="description" content="${desc}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${escapeAttr(SITE)}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${escapeAttr(can)}" />
<meta property="og:image" content="${escapeAttr(imageUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${escapeAttr(imageUrl)}" />
</head>
<body>
<p><a href="${escapeAttr(can)}">RankMySalon</a></p>
<noscript>
<meta http-equiv="refresh" content="0;url=${escapeAttr(can)}" />
</noscript>
</body>
</html>`;
  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "public, s-maxage=120, stale-while-revalidate=60");
  res.end(html);
};
