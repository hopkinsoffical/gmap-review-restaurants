"use strict";

const RESTAURANT_CATEGORIES = [
  "Chinese Restaurant",
  "Restaurant",
  "Takeout Restaurant",
  "Asian Restaurant",
  "Fast Food",
  "Cafe",
  "Sushi Restaurant",
  "Bubble Tea",
  "Food Delivery",
];

/**
 * Match restaurants by cuisine type (Chinese vs Asian vs Cafe, etc.) for
 * fair local comparisons. Ports salon-category logic for the restaurant
 * vertical.
 */
function categoryMatchKey(category) {
  const c = String(category || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .trim();
  if (!c) return "restaurant";
  if (/chinese|dim sum|cantonese|szechuan|sichuan|mandarin|hunan|shanghai/.test(c)) return "chinese";
  if (/sushi|japanese|ramen|izakaya/.test(c)) return "sushi";
  if (/bubble tea|boba|tea house|coffee shop|espresso|matcha/.test(c) && !/bubble/.test(c)) {
    return /bubble/.test(c) ? "bubble" : "cafe";
  }
  if (/boba|pearl tea|milk tea/.test(c)) return "bubble";
  if (/thai|vietnamese|pho|korean|asian|pan asian|pan-asian|malaysian|indonesian|filipino/.test(c)) return "asian";
  if (/fast food|quick service|qsr|pizza|burger|wing|sandwich|chicken|hot dog|taco|burrito/.test(c)) return "fastfood";
  if (/cafe|coffee|breakfast|brunch|bakery|donut|dessert|ice cream|juice|smoothie/.test(c)) return "cafe";
  if (/takeout|delivery|ghost kitchen|cloud kitchen/.test(c)) return "takeout";
  if (/bar|pub|tavern|brewery|wine|cocktail|lounge|nightclub/.test(c)) return "bar";
  if (/fine dining|steakhouse|seafood|grill|bistro|french|italian|mexican|indian|mediterranean|greek|american|brasserie|fondue/.test(c)) return "restaurant";
  if (/restaurant|eatery|diner|grill|kitchen|house/.test(c)) return "restaurant";
  return c.split(/\s+/)[0] || "restaurant";
}

function categoriesMatch(a, b) {
  const ca = String(a || "").trim();
  const cb = String(b || "").trim();
  if (!ca || !cb) return true;
  if (categoryMatchKey(ca) === categoryMatchKey(cb)) return true;
  const la = ca.toLowerCase();
  const lb = cb.toLowerCase();
  if (la.includes(lb) || lb.includes(la)) return true;
  return false;
}

function filterPeersByCategory(peers, category) {
  const list = Array.isArray(peers) ? peers : [];
  const cat = String(category || "").trim();
  if (!cat) return list;
  const filtered = list.filter(function (p) {
    return categoriesMatch(p.category, cat);
  });
  return filtered.length >= 3 ? filtered : list;
}

function categoryPluralLabel(category) {
  const key = categoryMatchKey(category);
  const raw = String(category || "").trim();
  if (raw) {
    const lowered = raw.toLowerCase();
    if (lowered.indexOf("restaurant") >= 0) return raw;
    return raw + " restaurants";
  }
  const map = {
    chinese: "Chinese restaurants",
    sushi: "sushi restaurants",
    asian: "Asian restaurants",
    fastfood: "fast food restaurants",
    cafe: "cafes",
    bubble: "bubble tea shops",
    takeout: "takeout restaurants",
    bar: "bars and lounges",
    restaurant: "local restaurants",
  };
  return map[key] || "local restaurants";
}

module.exports = {
  RESTAURANT_CATEGORIES,
  categoryMatchKey,
  categoriesMatch,
  filterPeersByCategory,
  categoryPluralLabel,
};
