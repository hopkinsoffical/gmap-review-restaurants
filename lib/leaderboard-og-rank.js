const PAIRS = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
];

function rowMatchesState(rowState, filterState) {
  const f = String(filterState || "").trim();
  if (f === "All States") return true;
  const r = String(rowState || "").trim();
  if (r === f) return true;
  for (let i = 0; i < PAIRS.length; i += 1) {
    const ab = PAIRS[i][0];
    const full = PAIRS[i][1];
    if ((f === ab || f === full) && (r === ab || r === full)) return true;
    if (f.toLowerCase() === full.toLowerCase() && (r === ab || r === full)) return true;
  }
  return false;
}

function rowMatchesCounty(rowCounty, filterCounty) {
  const f = String(filterCounty || "").trim();
  if (f === "All Counties") return true;
  const r = String(rowCounty || "").trim();
  if (r === f) return true;
  const rBase = r.replace(/\s+County$/i, "").trim();
  const fBase = f.replace(/\s+County$/i, "").trim();
  return rBase !== "" && fBase !== "" && rBase === fBase;
}

/**
 * Same idea as app.js `rankSalonInCounty` for OG cards.
 * @param {{ id: * }} salon
 * @param {any[]} allSalons
 */
function rankSalonInCounty(salon, allSalons) {
  const all = Array.isArray(allSalons) ? allSalons : [];
  const pool = all.filter(
    (s) => s && s.id !== salon.id && rowMatchesState(s.state, salon.state) && rowMatchesCounty(s.county, salon.county),
  );
  const group = pool.concat([salon]).sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  let rank = 0;
  for (let i = 0; i < group.length; i += 1) {
    if (group[i].id === salon.id) {
      rank = i + 1;
      break;
    }
  }
  const rankLabel = rank <= 5 && rank > 0 ? "#" + rank : "5+";
  return { rank, rankLabel, total: group.length, top5: group.slice(0, 5) };
}

module.exports = {
  rankSalonInCounty,
};
