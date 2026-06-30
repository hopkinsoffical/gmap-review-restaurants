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

function main() {
  const appJs = read("app.js");
  const indexHtml = read("index.html");
  const landingCss = read("landing-page.css");

  assertMatch("index.html links landing-page.css", indexHtml, /landing-page\.css/);
  assertMatch("app.js defines hero section helper", appJs, /function getLandingHeroSectionHtml/);
  assertMatch("app.js defines stats section helper", appJs, /function getLandingStatsSectionHtml/);
  assertMatch("app.js defines trust section helper", appJs, /function getLandingTrustSectionHtml/);
  assertMatch("app.js defines Ryan section helper", appJs, /function getLandingRyanSectionHtml/);
  assertMatch("app.js defines scroll reveal init", appJs, /function initLandingPageMotion/);
  assertMatch("app.js keeps lead form class handler", appJs, /marketing-hero-brief-form/);
  assertMatch("app.js keeps Ryan section anchor", appJs, /id="landing-ryan"/);
  assertMatch("landing-page.css has hero styles", landingCss, ".landing-hero");
  assertMatch("landing-page.css has stats styles", landingCss, ".landing-stats-card");
  assertMatch("landing-page.css has phone mockup", landingCss, ".landing-phone-device");
  assertMatch("overview page omits landing lead form section", appJs, /getLandingStatsSectionHtml\(\)[\s\S]*getLandingTrustSectionHtml\(\)/);
  assertNoMatch("overview page has no landing lead section", appJs, /getLandingLeadSectionHtml/);

  console.log("\nLanding page smoke test passed.");
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
