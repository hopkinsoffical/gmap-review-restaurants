/**
 * Align leaderboard geo filters with mixed DB values (e.g. Google Places longText "New Jersey" vs "NJ").
 */

/** @type {Record<string, [string, string]>} */
const US_STATE_ABBR_FULL = {
  AL: ["AL", "Alabama"],
  AK: ["AK", "Alaska"],
  AZ: ["AZ", "Arizona"],
  AR: ["AR", "Arkansas"],
  CA: ["CA", "California"],
  CO: ["CO", "Colorado"],
  CT: ["CT", "Connecticut"],
  DE: ["DE", "Delaware"],
  FL: ["FL", "Florida"],
  GA: ["GA", "Georgia"],
  HI: ["HI", "Hawaii"],
  ID: ["ID", "Idaho"],
  IL: ["IL", "Illinois"],
  IN: ["IN", "Indiana"],
  IA: ["IA", "Iowa"],
  KS: ["KS", "Kansas"],
  KY: ["KY", "Kentucky"],
  LA: ["LA", "Louisiana"],
  ME: ["ME", "Maine"],
  MD: ["MD", "Maryland"],
  MA: ["MA", "Massachusetts"],
  MI: ["MI", "Michigan"],
  MN: ["MN", "Minnesota"],
  MS: ["MS", "Mississippi"],
  MO: ["MO", "Missouri"],
  MT: ["MT", "Montana"],
  NE: ["NE", "Nebraska"],
  NV: ["NV", "Nevada"],
  NH: ["NH", "New Hampshire"],
  NJ: ["NJ", "New Jersey"],
  NM: ["NM", "New Mexico"],
  NY: ["NY", "New York"],
  NC: ["NC", "North Carolina"],
  ND: ["ND", "North Dakota"],
  OH: ["OH", "Ohio"],
  OK: ["OK", "Oklahoma"],
  OR: ["OR", "Oregon"],
  PA: ["PA", "Pennsylvania"],
  RI: ["RI", "Rhode Island"],
  SC: ["SC", "South Carolina"],
  SD: ["SD", "South Dakota"],
  TN: ["TN", "Tennessee"],
  TX: ["TX", "Texas"],
  UT: ["UT", "Utah"],
  VT: ["VT", "Vermont"],
  VA: ["VA", "Virginia"],
  WA: ["WA", "Washington"],
  WV: ["WV", "West Virginia"],
  WI: ["WI", "Wisconsin"],
  WY: ["WY", "Wyoming"],
  DC: ["DC", "District of Columbia"],
};

/**
 * @returns {string[]|null} distinct values for Supabase .in / .eq
 */
function stateQueryValues(state) {
  const raw = String(state || "").trim();
  if (!raw) return null;
  if (raw.length === 2) {
    const ab = raw.toUpperCase();
    return US_STATE_ABBR_FULL[ab] ? [...US_STATE_ABBR_FULL[ab]] : [ab];
  }
  const lower = raw.toLowerCase();
  for (const ab of Object.keys(US_STATE_ABBR_FULL)) {
    const pair = US_STATE_ABBR_FULL[ab];
    if (pair[1].toLowerCase() === lower) return [...pair];
  }
  return [raw];
}

/**
 * @returns {string[]|null}
 */
function countyQueryValues(county) {
  const c = String(county || "").trim();
  if (!c) return null;
  const base = c.replace(/\s+County$/i, "").trim();
  const withCounty = base + " County";
  const set = new Set([c, base, withCounty].filter(Boolean));
  return Array.from(set);
}

/**
 * @returns {string[]|null}
 */
function townQueryValues(town) {
  const t = String(town || "").trim();
  if (!t) return null;
  const set = new Set([t]);
  if (!/\s+Township$/i.test(t)) set.add(`${t} Township`);
  else {
    const bare = t.replace(/\s+Township$/i, "").trim();
    if (bare) set.add(bare);
  }
  return Array.from(set);
}

/** Apply .eq or .in on a PostgREST filter chain. */
function applyColumnInOrEq(query, column, values) {
  if (!values || !values.length) return query;
  if (values.length === 1) return query.eq(column, values[0]);
  return query.in(column, values);
}

module.exports = {
  US_STATE_ABBR_FULL,
  applyColumnInOrEq,
  countyQueryValues,
  stateQueryValues,
  townQueryValues,
};
