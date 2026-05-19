const React = require("react");
const { finished } = require("stream/promises");
const { getLeaderboardSalonBySlug, listLeaderboardSalons } = require("../../lib/server/leaderboard-repo");
const { getLeaderboardAssessmentVisual, getLevelLabel } = require("../../lib/leaderboard-og-assessment");
const { rankSalonInCounty } = require("../../lib/leaderboard-og-rank");
const { methodNotAllowed } = require("../../lib/server/http");

const SITE = "RankMySalon.AI";
const W = 1200;
const H = 630;

let cachedFont;

async function loadFonts() {
  if (cachedFont) return cachedFont;
  const out = [];
  const manr = await fetch(
    "https://cdn.jsdelivr.net/npm/@fontsource/manrope@5.0.20/files/manrope-latin-600-normal.woff2",
  );
  if (manr.ok) {
    out.push({
      name: "Manrope",
      data: await manr.arrayBuffer(),
      style: "normal",
      weight: 600,
    });
  }
  const noto = await fetch(
    "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.0.20/files/noto-sans-sc-chinese-simplified-500-normal.woff2",
  );
  if (noto.ok) {
    out.push({
      name: "Noto Sans SC",
      data: await noto.arrayBuffer(),
      style: "normal",
      weight: 500,
    });
  }
  cachedFont = out;
  return out;
}

function pick(q, k) {
  if (!q || !q[k]) return "";
  const v = q[k];
  return Array.isArray(v) ? String(v[0] || "").trim() : String(v || "").trim();
}

function truncate(s, n) {
  const t = String(s || "");
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

function buildCard(React, salon, ranked, locale, size) {
  const isZh = locale === "zh";
  const a = getLeaderboardAssessmentVisual(salon);
  const ac = a.color || "#1A365D";
  const al = a.light || "#F0F4F8";
  const abr = a.border || "#CBD5E0";
  const rankTone = String(ranked.rankLabel) === "5+" ? "#DC2626" : "#276749";
  const rankBg = String(ranked.rankLabel) === "5+" ? "#FEF2F2" : "#F0FFF4";
  const fam = "Manrope, 'Noto Sans SC'";
  const fs = {
    kicker: size,
    name: size + 4,
    meta: Math.max(12, size - 2),
    metricVal: size + 2,
    metricLbl: size - 2,
    cta: size,
    badge: size - 1,
  };

  return React.createElement(
    "div",
    {
      key: String(salon.id),
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        borderRadius: 14,
        overflow: "hidden",
        border: `1px solid ${abr}40`,
        background: "#fff",
        boxShadow: "0 2px 10px rgba(0,0,0,.04)",
      },
    },
    React.createElement("div", {
      style: {
        height: 4,
        width: "100%",
        background: `linear-gradient(90deg, ${ac} 0%, ${abr} 100%)`,
      },
    }),
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: size,
          gap: 6,
        },
      },
      React.createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 } },
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 } },
          React.createElement(
            "p",
            {
              style: {
                margin: 0,
                fontSize: fs.kicker,
                fontWeight: 600,
                color: ac,
                fontFamily: fam,
                lineHeight: 1.2,
              },
            },
            truncate(salon.category, isZh ? 14 : 20),
          ),
          React.createElement(
            "p",
            {
              style: {
                margin: 0,
                fontSize: fs.name,
                fontWeight: 700,
                color: "#0f172a",
                fontFamily: fam,
                lineHeight: 1.15,
                whiteSpace: "pre-wrap",
              },
            },
            truncate(salon.name, isZh ? 22 : 32),
          ),
          React.createElement(
            "p",
            {
              style: { margin: 0, fontSize: fs.meta, color: "#64748b", fontFamily: fam, lineHeight: 1.2 },
            },
            "📍 " +
              truncate(
                (String(salon.town || "") ? String(salon.town || "") + ", " : "") +
                  (String(salon.county || "") + " County, " + String(salon.state || "")) +
                  (salon.zipcode ? " · " + String(salon.zipcode) : ""),
                50,
              ),
          ),
        ),
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 8,
              padding: "4px 8px",
              background: al,
              border: "1px solid " + abr,
              whiteSpace: "nowrap",
            },
          },
          React.createElement("span", { style: { fontSize: fs.badge, marginRight: 4 } }, a.emoji),
          React.createElement(
            "span",
            { style: { fontSize: fs.badge, color: ac, fontWeight: 600, fontFamily: fam } },
            getLevelLabel(a, isZh ? "zh" : "en"),
          ),
        ),
      ),
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "row", gap: 8, marginTop: 2 } },
        React.createElement(
          "div",
          {
            style: {
              flex: 1,
              borderRadius: 8,
              background: al,
              padding: "4px 6px",
            },
          },
          React.createElement(
            "div",
            { style: { color: ac, fontWeight: 700, fontSize: fs.metricVal, fontFamily: fam } },
            (Number(salon.rating) || 0).toFixed(1) + "★",
          ),
          React.createElement(
            "div",
            { style: { color: "#64748b", fontSize: fs.metricLbl, fontFamily: fam } },
            (isZh ? "评论 " : "reviews ") + String(salon.reviews),
          ),
        ),
        React.createElement(
          "div",
          {
            style: {
              flex: 1,
              borderRadius: 8,
              background: "#f1f5f9",
              padding: "4px 6px",
            },
          },
          React.createElement("div", { style: { fontWeight: 700, fontSize: fs.metricVal, fontFamily: fam } }, String(Math.round(Number(salon.score) || 0))),
          React.createElement("div", { style: { color: "#64748b", fontSize: fs.metricLbl, fontFamily: fam } }, isZh ? "AI 分" : "AI score"),
        ),
        React.createElement(
          "div",
          {
            style: {
              flex: 1,
              borderRadius: 8,
              background: rankBg,
              padding: "4px 6px",
            },
          },
          React.createElement(
            "div",
            { style: { fontWeight: 700, color: rankTone, fontSize: fs.metricVal, fontFamily: fam } },
            String(ranked.rankLabel),
          ),
          React.createElement(
            "div",
            { style: { color: "#64748b", fontSize: fs.metricLbl, fontFamily: fam } },
            isZh ? "共 " + ranked.total : "of " + ranked.total,
          ),
        ),
      ),
    ),
  );
}

function errTree(React, msg) {
  return React.createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",
        color: "#e2e8f0",
        fontFamily: "Manrope",
        fontSize: 32,
        padding: 40,
        textAlign: "center",
      },
    },
    React.createElement("p", { style: { fontSize: 20, color: "#94a3b8" } }, SITE),
    React.createElement("p", { style: { fontSize: 24, fontWeight: 600, marginTop: 16 } }, truncate(String(msg), 80)),
  );
}

async function makeImageStream(React, element, createNodejsStream) {
  const fonts = await loadFonts();
  return createNodejsStream(element, {
    width: W,
    height: H,
    fonts,
  });
}

/**
 * Wait for the PNG read stream to finish piping into `res`. Without this,
 * Vercel/serverless can end the invocation before bytes are fully written,
 * which breaks link-preview crawlers (truncated or empty og:image).
 */
async function pipeOgPngStream(stream, res) {
  stream.pipe(res);
  await finished(stream);
}

async function leaderboardOgImageHandler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }
  const { unstable_createNodejsStream } = await import("@vercel/og");

  const q = req.query || {};
  const locale = (pick(q, "locale") || "en") === "zh" ? "zh" : "en";
  const slug = pick(q, "slug");
  const stateQ = pick(q, "state");
  const countyQ = pick(q, "county");
  const townQ = pick(q, "town");

  res.setHeader("content-type", "image/png");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");

  try {
    if (slug) {
      const salon = await getLeaderboardSalonBySlug(slug);
      const inCounty = await listLeaderboardSalons({
        limit: null,
        state: String(salon.state || ""),
        county: String(salon.county || ""),
        town: undefined,
      });
      const ranked = rankSalonInCounty(salon, inCounty);
      const el = React.createElement(
        "div",
        {
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(180deg, #e8f1fc 0%, #f0f4f8 32%, #e5ecf5 100%)",
            position: "relative",
          },
        },
        React.createElement(
          "div",
          {
            style: {
              padding: "20px 40px 8px",
            },
          },
          React.createElement(
            "p",
            { style: { margin: 0, color: "#64748b", fontSize: 18, fontFamily: "Manrope, 'Noto Sans SC'" } },
            SITE,
          ),
          React.createElement(
            "p",
            {
              style: {
                margin: "4px 0 0 0",
                color: "#0f172a",
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "Manrope, 'Noto Sans SC'",
              },
            },
            locale === "zh" ? "沙龙排行榜 · 单店" : "Salon scorecard (preview card)",
          ),
        ),
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flex: 1,
              padding: "12px 48px 40px",
              alignItems: "center",
              justifyContent: "center",
            },
          },
          React.createElement(
            "div",
            {
              style: {
                width: 1000,
                minHeight: 400,
                maxWidth: "100%",
              },
            },
            buildCard(React, salon, ranked, locale, 20),
          ),
        ),
      );
      const stream = await makeImageStream(React, el, unstable_createNodejsStream);
      await pipeOgPngStream(stream, res);
      return;
    }

    const all = await listLeaderboardSalons({
      limit: null,
      state: stateQ || undefined,
      county: countyQ || undefined,
      town: townQ || undefined,
    });
    const first = all.slice(0, 6);
    if (!first.length) {
      const st = await makeImageStream(React, errTree(React, locale === "zh" ? "暂无数据" : "No salons in this view."), unstable_createNodejsStream);
      await pipeOgPngStream(st, res);
      return;
    }

    const el = React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(180deg, #e8f1fc 0%, #f0f4f8 32%, #e5ecf5 100%)",
        },
      },
      React.createElement(
        "div",
        {
          style: { padding: "20px 40px 0" },
        },
        React.createElement(
          "p",
          { style: { margin: 0, color: "#64748b", fontSize: 18, fontFamily: "Manrope, 'Noto Sans SC'" } },
          SITE,
        ),
        React.createElement(
          "p",
          {
            style: {
              margin: "4px 0 0 0",
              color: "#0f172a",
              fontSize: 24,
              fontWeight: 700,
              fontFamily: "Manrope, 'Noto Sans SC'",
            },
          },
          locale === "zh" ? "排行榜 · 门店卡片" : "AI leaderboard (preview cards)",
        ),
      ),
      ...[0, 1].map(function (row) {
        const rowSalons = first.slice(row * 3, row * 3 + 3);
        return React.createElement(
          "div",
          {
            key: "r" + row,
            style: {
              display: "flex",
              flexDirection: "row",
              width: "100%",
              padding: "8px 24px",
              gap: 14,
              boxSizing: "border-box",
              justifyContent: "center",
            },
          },
          rowSalons.map((salon) => {
            const r = rankSalonInCounty(salon, all);
            return React.createElement(
              "div",
              {
                key: salon.id,
                style: {
                  width: 360,
                  height: 250,
                },
              },
              buildCard(React, salon, r, locale, 10),
            );
          }),
        );
      }),
    );

    const stream = await makeImageStream(React, el, unstable_createNodejsStream);
    await pipeOgPngStream(stream, res);
    return;
  } catch (error) {
    const code = error && error.code ? String(error.code) : "";
    const msg = error && error.message ? String(error.message) : "Error";
    console.error("[og/leaderboard-image]", code, msg);
    res.statusCode = 200;
    const text =
      code === "SALON_NOT_FOUND"
        ? locale === "zh"
          ? "未找到该门店"
          : "Salon not on leaderboard"
        : String(msg);
    const st = await makeImageStream(React, errTree(React, text), unstable_createNodejsStream);
    await pipeOgPngStream(st, res);
  }
}

module.exports = leaderboardOgImageHandler;
/** Allow font fetch + @vercel/og render on cold start (Hobby caps per plan). */
module.exports.config = {
  maxDuration: 60,
};
