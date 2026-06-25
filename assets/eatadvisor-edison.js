/* ============================================================================
 * EatAdvisor — Edison, NJ demo town dataset
 * ----------------------------------------------------------------------------
 * Seeded demo data that powers the Rankings tab (/rankings) and the
 * TripAdvisor-style town ranking page (/town/edison-nj) until the live
 * restaurant_leaderboard (RDS) is ingested for this market.
 *
 * Each restaurant carries a precomputed EatAdvisor score (0–100) and the
 * 6 customer-facing dimensions used across the EatAdvisor scorecards
 * (reputation, reviewPower, health, visibility, appeal, booking).
 *
 * Scores are illustrative. When the live API returns rows for this town,
 * the pages prefer live data and fall back to this seed.
 * ========================================================================== */
(function () {
  "use strict";

  var TOWN = {
    slug: "edison-nj",
    name: "Edison",
    state: "New Jersey",
    stateAbbr: "NJ",
    geoId: "g46410", // mirrors TripAdvisor's town geo id in the mocked URL
    blurb:
      "EatAdvisor ranks every restaurant in Edison and nearby towns by a single 0–100 score — built from real Google ratings, review volume, sentiment, health grades, profile completeness, and booking readiness. Higher score, higher rank.",
  };

  // cuisine taxonomy → label + emoji used by filter pills
  var CUISINES = [
    { key: "indian", label: "Indian", icon: "🍛" },
    { key: "chinese", label: "Chinese", icon: "🥟" },
    { key: "japanese", label: "Sushi & Japanese", icon: "🍣" },
    { key: "korean", label: "Korean", icon: "🍲" },
    { key: "thai", label: "Thai", icon: "🍜" },
    { key: "italian", label: "Italian", icon: "🍝" },
    { key: "american", label: "American", icon: "🍔" },
  ];

  function r(o) {
    // tiny helper to keep rows terse + consistent
    return {
      slug: o.s,
      name: o.n,
      cuisine: o.c,
      category: o.cat,
      price: o.p,
      rating: o.rt,
      reviews: o.rv,
      town: o.tw || "Edison",
      nearby: !!o.nb,
      address: o.ad,
      grade: o.g || "A",
      score: o.sc,
      dims: {
        reputation: o.d[0],
        reviewPower: o.d[1],
        health: o.d[2],
        visibility: o.d[3],
        appeal: o.d[4],
        booking: o.d[5],
      },
    };
  }

  var RESTAURANTS = [
    // ── Indian ──────────────────────────────────────────────────────────────
    r({ s: "moghul-edison", n: "Moghul", c: "indian", cat: "Indian Restaurant", p: "$$$", rt: 4.6, rv: 3120, ad: "1655 Oak Tree Rd, Edison, NJ", sc: 94, d: [96, 92, 100, 90, 95, 88] }),
    r({ s: "rasoi-edison", n: "Rasoi Restaurant", c: "indian", cat: "Indian Restaurant", p: "$$", rt: 4.5, rv: 2180, ad: "1303 Oak Tree Rd, Edison, NJ", sc: 90, d: [92, 88, 100, 86, 90, 82] }),
    r({ s: "chand-palace-edison", n: "Chand Palace", c: "indian", cat: "Vegetarian Indian", p: "$$", rt: 4.4, rv: 1960, ad: "1296 Centennial Ave, Piscataway, NJ", tw: "Piscataway", nb: true, sc: 86, d: [88, 85, 100, 80, 87, 78] }),
    r({ s: "dosa-hut-edison", n: "Dosa Hut", c: "indian", cat: "South Indian", p: "$", rt: 4.3, rv: 1440, ad: "1665 Oak Tree Rd, Edison, NJ", sc: 82, d: [84, 80, 100, 76, 82, 70] }),
    r({ s: "spice-grill-iselin", n: "Spice Grill", c: "indian", cat: "Indian Restaurant", p: "$$", rt: 4.2, rv: 980, ad: "1199 Oak Tree Rd, Iselin, NJ", tw: "Iselin", nb: true, sc: 78, d: [80, 72, 100, 72, 80, 66] }),
    r({ s: "mithaas-edison", n: "Mithaas", c: "indian", cat: "Indian Sweets & Cafe", p: "$", rt: 4.1, rv: 1230, ad: "1655 Oak Tree Rd, Edison, NJ", sc: 74, d: [76, 78, 90, 70, 72, 60] }),

    // ── Chinese ─────────────────────────────────────────────────────────────
    r({ s: "xiebao-edison", n: "Xiebao Crab House", c: "chinese", cat: "Chinese Restaurant", p: "$$$", rt: 4.6, rv: 860, ad: "561 US-1, Edison, NJ", sc: 91, d: [93, 78, 100, 88, 94, 90] }),
    r({ s: "shanghai-bun-edison", n: "Shanghai Bun", c: "chinese", cat: "Shanghainese", p: "$$", rt: 4.4, rv: 1510, ad: "561 Old Post Rd, Edison, NJ", sc: 85, d: [88, 84, 100, 80, 84, 74] }),
    r({ s: "hot-pot-king-edison", n: "Hot Pot King", c: "chinese", cat: "Hot Pot", p: "$$$", rt: 4.3, rv: 1190, ad: "1199 Amboy Ave, Edison, NJ", sc: 81, d: [84, 80, 100, 76, 84, 70] }),
    r({ s: "golden-dynasty-edison", n: "Golden Dynasty", c: "chinese", cat: "Cantonese", p: "$$", rt: 4.2, rv: 740, ad: "2960 Woodbridge Ave, Edison, NJ", sc: 76, d: [80, 70, 100, 72, 78, 64] }),
    r({ s: "sichuan-house-metuchen", n: "Sichuan House", c: "chinese", cat: "Sichuan", p: "$$", rt: 4.1, rv: 620, ad: "420 Main St, Metuchen, NJ", tw: "Metuchen", nb: true, sc: 72, d: [78, 66, 95, 68, 76, 58] }),

    // ── Sushi & Japanese ──────────────────────────────────────────────────────
    r({ s: "sapporo-edison", n: "Sapporo Sushi & Ramen", c: "japanese", cat: "Japanese Restaurant", p: "$$$", rt: 4.5, rv: 1320, ad: "1199 Amboy Ave, Edison, NJ", sc: 88, d: [90, 82, 100, 84, 90, 80] }),
    r({ s: "wasabi-edison", n: "Wasabi House", c: "japanese", cat: "Sushi Restaurant", p: "$$", rt: 4.4, rv: 980, ad: "2105 Oak Tree Rd, Edison, NJ", sc: 84, d: [86, 78, 100, 80, 84, 74] }),
    r({ s: "ramen-bar-metuchen", n: "Ramen Bar", c: "japanese", cat: "Ramen", p: "$$", rt: 4.3, rv: 1110, ad: "433 Main St, Metuchen, NJ", tw: "Metuchen", nb: true, sc: 80, d: [84, 80, 100, 74, 80, 66] }),
    r({ s: "tokyo-grill-edison", n: "Tokyo Hibachi & Grill", c: "japanese", cat: "Hibachi", p: "$$$", rt: 4.1, rv: 690, ad: "1932 Lincoln Hwy, Edison, NJ", sc: 75, d: [78, 70, 100, 70, 80, 64] }),
    r({ s: "sushi-zen-highland-park", n: "Sushi Zen", c: "japanese", cat: "Sushi Restaurant", p: "$$", rt: 4.0, rv: 540, ad: "12 Raritan Ave, Highland Park, NJ", tw: "Highland Park", nb: true, sc: 71, d: [74, 64, 95, 68, 76, 60] }),

    // ── Korean ────────────────────────────────────────────────────────────────
    r({ s: "seoul-bbq-edison", n: "Seoul BBQ House", c: "korean", cat: "Korean BBQ", p: "$$$", rt: 4.4, rv: 1020, ad: "1734 Oak Tree Rd, Edison, NJ", sc: 83, d: [86, 80, 100, 78, 86, 70] }),
    r({ s: "kimchi-kitchen-edison", n: "Kimchi Kitchen", c: "korean", cat: "Korean Restaurant", p: "$$", rt: 4.1, rv: 480, ad: "561 US-1, Edison, NJ", sc: 73, d: [76, 62, 100, 70, 78, 60] }),

    // ── Thai ────────────────────────────────────────────────────────────────
    r({ s: "thai-orchid-edison", n: "Thai Orchid", c: "thai", cat: "Thai Restaurant", p: "$$", rt: 4.3, rv: 870, ad: "1199 Amboy Ave, Edison, NJ", sc: 79, d: [82, 74, 100, 74, 80, 66] }),

    // ── Italian ───────────────────────────────────────────────────────────────
    r({ s: "tavola-edison", n: "Tavola Trattoria", c: "italian", cat: "Italian Restaurant", p: "$$$", rt: 4.4, rv: 1280, ad: "2105 Lincoln Hwy, Edison, NJ", sc: 84, d: [88, 82, 100, 78, 84, 76] }),
    r({ s: "nonnas-metuchen", n: "Nonna's Kitchen", c: "italian", cat: "Italian Restaurant", p: "$$", rt: 4.2, rv: 760, ad: "501 Main St, Metuchen, NJ", tw: "Metuchen", nb: true, sc: 77, d: [80, 72, 100, 72, 80, 64] }),

    // ── American ──────────────────────────────────────────────────────────────
    r({ s: "the-vine-edison", n: "The Vine American Grill", c: "american", cat: "American Restaurant", p: "$$", rt: 4.2, rv: 640, ad: "2245 Woodbridge Ave, Edison, NJ", sc: 76, d: [80, 68, 100, 74, 80, 66] }),
    r({ s: "harvest-table-edison", n: "Harvest Table", c: "american", cat: "New American", p: "$$$", rt: 4.0, rv: 410, ad: "1199 Amboy Ave, Edison, NJ", sc: 70, d: [74, 60, 95, 70, 78, 60] }),
  ];

  // ── 3 default "Best X in {town} or nearby" leaderboards (5 each) ────────────
  // Picked for Edison's strongest food scenes. Each links to the town page
  // filtered by its cuisine.
  var LEADERBOARDS = [
    {
      key: "indian",
      title: "Best Indian in Edison or nearby",
      subtitle: "Oak Tree Road's finest, ranked by EatAdvisor score",
      icon: "🍛",
      cuisine: "indian",
    },
    {
      key: "chinese",
      title: "Best Chinese in Edison or nearby",
      subtitle: "Top Chinese kitchens within and around Edison",
      icon: "🥟",
      cuisine: "chinese",
    },
    {
      key: "japanese",
      title: "Best Sushi & Japanese in Edison or nearby",
      subtitle: "Sushi, ramen & hibachi ranked high to low",
      icon: "🍣",
      cuisine: "japanese",
    },
  ];

  window.EATADVISOR_DATASET = {
    town: TOWN,
    cuisines: CUISINES,
    restaurants: RESTAURANTS,
    leaderboards: LEADERBOARDS,
    isDemo: true,
  };
})();
