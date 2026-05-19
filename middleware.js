// Link preview: crawlers get HTML with og:*; normal browsers get the SPA. Do NOT use fban/fbav/FB* —
// those substrings match Facebook/Instagram in-app WebViews and would serve SEO HTML to real users.
// Meta link scrapers use facebookexternalhit / facebot, not the same as FBAN in-app.
const SHARE = new RegExp(
  [
    "facebookexternalhit|facebot|Facebot|fbexternalhit|facebookcatalog|favicon",
    "Meta-WebIndexer|Meta-External|Meta-ExternalAgent|meta-externalagent",
    "WhatsApp|Whatsapp|Slack-ImgProxy|Slackbot|Slack-URL",
    "Twitterbot|LinkedinBot|Telegram|Discord|Pinterest|reddit|Redditbot|Embedly|Iframely|Oembed|iframely|microlink|outbrain|taboola",
    "Bing-Preview|BingPreview|BingURL-Preview|SkypeUriPreview|skype|vk(Share|)|KAKAO|kakao|Line\\/|Naver|Daum|weibo|Bytespider|Bytedance|Tiktok|TikTok|Snapchat|Instagram|Threads|thread\\.net",
    "Applebot|Google-Structured-Data-Testing-Tool|Google-Inspection|Google-Read|Google-HTTP-Java-Client|Google-URL-Shortener|Google-Producer",
    // WeChat / QQ / work chat (link unfurl often not covered by “Facebook” style UAs)
    "MicroMessenger|WeChat|QQ\\/|DingTalk|Lark|Feishu|AliApp|Alipay",
    // Search / generic crawlers used for previews or snippets
    "Googlebot|bingbot|Yandex|Slurp|DuckDuckBot|Baiduspider|Sogou",
  ].join("|"),
  "i",
);

function next() {
  return new Response(null, { headers: { "x-middleware-next": "1" } });
}

/**
 * Vercel: `x-middleware-rewrite` should be a same-origin *path* (e.g. `/api/og/...?og=...`), not a full `https://` URL.
 */
function rewriteToPath(pathAndQuery) {
  const p = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  return new Response(null, { headers: { "x-middleware-rewrite": p } });
}

// Run on all non-static paths; some Vercel setups are picky about `matcher` and miss `/leaderboard` alone.
export const config = { matcher: "/:path*" };

export default function middleware(request) {
  const url = new URL(request.url);
  const p = url.pathname;
  if (/\.(js|mjs|css|ico|png|jpe?g|svg|woff2?|map|webmanifest|txt|xml|json|gz)$/i.test(p)) {
    return next();
  }
  if (!p.startsWith("/leaderboard")) {
    return next();
  }
  if (!SHARE.test(request.headers.get("user-agent") || "")) {
    return next();
  }
  const full = `${url.pathname}${url.search || ""}`;
  return rewriteToPath("/api/og/leaderboard-seo?og=" + encodeURIComponent(full));
}
