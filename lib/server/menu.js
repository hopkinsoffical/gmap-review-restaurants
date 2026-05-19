const { normalizeStringList, normalizeText, simplifyText } = require("./shared");

function parseMenu(raw) {
  const top = raw && raw.results && raw.results[0] && raw.results[0].result;
  if (!top || typeof top !== "object") return [];

  const categories = [];

  Object.keys(top).forEach(function (categoryName) {
    if (!Array.isArray(top[categoryName])) return;

    categories.push({
      categoryName: categoryName,
      items: top[categoryName]
        .filter(function (item) {
          return item && typeof item === "object" && item.uqid;
        })
        .map(function (item) {
          return Object.assign({}, item, {
            uqid: Number(item.uqid),
            zh: item.zh || "",
            en: item.n || "",
            ingr: item.ingr || "",
            categoryName: categoryName,
            aliases: normalizeStringList(item.aliases),
            dish_type: String(item.dish_type || "").trim(),
            dish_subtype: String(item.dish_subtype || "").trim(),
            primary_proteins: normalizeStringList(item.primary_proteins),
            primary_carbs: normalizeStringList(item.primary_carbs),
            cooking_methods: normalizeStringList(item.cooking_methods),
            serving_vessel: String(item.serving_vessel || "").trim(),
            visual_tags: normalizeStringList(item.visual_tags),
            texture_tags: normalizeStringList(item.texture_tags),
            presentation_tags: normalizeStringList(item.presentation_tags),
            match_hints: normalizeStringList(item.match_hints),
            negative_hints: normalizeStringList(item.negative_hints),
            confidence_priority: Number.isFinite(Number(item.confidence_priority))
              ? Number(item.confidence_priority)
              : 0,
          });
        }),
    });
  });

  return categories;
}

function registerDishAliases(aliasMap, item) {
  [item.zh, item.en, simplifyText(item.zh), simplifyText(item.en), String(item.uqid)]
    .concat(item.aliases || [])
    .forEach(function (alias) {
      const normalized = normalizeText(alias);
      if (normalized && !aliasMap.has(normalized)) {
        aliasMap.set(normalized, item.uqid);
      }
    });
}

function buildMenuContext(menuJson) {
  const categories = parseMenu(menuJson);
  const flatDishes = [];
  const dishMap = new Map();
  const dishAliasMap = new Map();

  categories.forEach(function (category) {
    category.items.forEach(function (item) {
      flatDishes.push(item);
      dishMap.set(item.uqid, item);
      registerDishAliases(dishAliasMap, item);
    });
  });

  return {
    categories: categories,
    dishAliasMap: dishAliasMap,
    dishMap: dishMap,
    flatDishes: flatDishes,
    menuJson: menuJson,
  };
}

module.exports = {
  buildMenuContext,
  parseMenu,
};
