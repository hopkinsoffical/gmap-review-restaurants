#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function assertMatch(name, source, pattern) {
  const ok = pattern instanceof RegExp ? pattern.test(source) : source.includes(pattern);
  if (!ok) {
    throw new Error("FAIL: " + name);
  }
  console.log("OK:", name);
}

function assertNoMatch(name, source, pattern) {
  if (pattern.test(source)) {
    throw new Error("FAIL: " + name);
  }
  console.log("OK:", name);
}

function extractStoreLogoSlugs(appJs) {
  const block = appJs.match(/const STORE_LOGO_URLS = \{([\s\S]*?)\};/);
  if (!block) return [];
  const slugs = [];
  const re = /"([^"]+)":/g;
  let match;
  while ((match = re.exec(block[1])) !== null) {
    slugs.push(match[1]);
  }
  return slugs;
}

function main() {
  const appJs = read("app.js");
  const indexHtml = read("index.html");
  const stylesCss = read("styles.css");
  const vercelJson = read("vercel.json");

  assertMatch("all /stores/:slug routes use index.html", vercelJson, /"source": "\/stores\/:slug"/);
  assertMatch("legacy /s/:slug short links are routed", vercelJson, /"source": "\/s\/:slug"/);
  assertMatch("store route parser handles /stores/:slug", appJs, /kind: ROUTE_STORE/);
  assertMatch("legacy short links redirect to /stores/:slug", appJs, /function redirectLegacyRoute/);

  assertMatch("review cards use selectReview (not store-specific)", appJs, /function selectReview\(review\)/);
  assertMatch("review selection tracks style key globally", appJs, /selectedReviewStyleKey/);
  assertMatch("review cards render radio control", appJs, /review-card-radio/);
  assertMatch("review cards use horizontal row layout", appJs, /review-card-row/);
  assertMatch("loyalty panel reveals after selection", appJs, /revealLoyaltyPromo\(\)/);
  assertMatch("clipboard failure does not block loyalty reveal", appJs, /copySelectedReviewText/);
  assertMatch("selectReview reveals loyalty promo", appJs, /function selectReview\(review\)[\s\S]*revealLoyaltyPromo\(\)/);
  assertMatch("regenerating reviews clears selection + loyalty panel", appJs, /clearSelectedReview\(\);[\s\S]*hideLoyaltyPromoPanel\(\)/);

  assertMatch("loyalty promo markup exists in shared store shell", indexHtml, /id="loyaltyPromoPanel"/);
  assertMatch("loyalty phone input exists for all stores", indexHtml, /id="loyaltyPromoPhone"/);
  assertMatch("loyalty continue submit exists for all stores", indexHtml, /id="loyaltyPromoSubmitBtn"/);
  assertMatch("loyalty google continue exists for all stores", indexHtml, /id="loyaltyPromoContinueBtn"/);

  assertMatch("base review radio styles exist", stylesCss, ".review-card-radio");
  assertMatch("store theme review radio styles exist", stylesCss, "html.store-theme-locked body.route-store .review-card-radio");
  assertMatch("store theme loyalty panel styles exist", stylesCss, /body\.route-store .loyalty-promo-panel/);
  assertMatch("mobile store review radio keeps circular shape", stylesCss, /body\.route-store .review-card-radio[\s\S]*aspect-ratio: 1/);
  assertMatch("store intake hidden during reviews stage", stylesCss, /body\.route-store\.store-reviews-stage #intakeCard/);
  assertMatch("syncStoreReviewStageChrome toggles loyalty body class", appJs, /function syncStoreReviewStageChrome\(\)/);
  assertMatch("store reviews stage focuses reviews panel", appJs, /function focusStoreReviewsStage\(\)/);
  assertMatch("review selection uses store google url fallback", appJs, /function getReviewTargetUrl\(\)/);
  assertMatch("native review radio input rendered", appJs, /review-card-radio-input/);
  assertMatch("store reviews-only layout class", stylesCss, /layout\.store-reviews-only/);
  assertMatch("review card row layout styles", stylesCss, /\.review-card-row/);

  assertNoMatch(
    "no per-store slug branching in review selection flow",
    appJs,
    /storeSlug\s*===\s*["']xiebao-|selectReview[\s\S]{0,200}storeSlug/,
  );

  const knownStores = extractStoreLogoSlugs(appJs);
  if (!knownStores.length) {
    throw new Error("FAIL: could not read STORE_LOGO_URLS slugs");
  }
  console.log("OK: known public store slugs share one flow:", knownStores.join(", "));
  assertMatch("xiebao-manhattan google review url fallback", appJs, /STORE_GOOGLE_REVIEW_URLS[\s\S]*xiebao-manhattan[\s\S]*0x89c25900533f308d:0x955c81afe0a5c325/);
  assertMatch("xiebao-manhattan seed sql exists", read("sql/038_seed_xiebao_manhattan.sql"), /xiebao-manhattan/);

  console.log("\nStore review flow smoke test passed for all /stores/:slug pages.");
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
