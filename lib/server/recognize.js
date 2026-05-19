const { buildMenuContext } = require("./menu");
const { callOpenAIChat, parseChatCompletionJson } = require("./openai");
const { createAppError, normalizeStringList, normalizeText, uniqueArray } = require("./shared");

const RECEIPT_SCHEMA_NAME = "receipt_detection";
const IMAGE_ANALYSIS_SCHEMA_NAME = "upload_image_analysis";
const PHOTO_RESOLUTION_SCHEMA_NAME = "dish_photo_resolution";

function getRestaurantLabel(store) {
  return [store.nameZh, store.nameEn].filter(Boolean).join(" / ");
}

function inferFirstMatch(blob, rules, fallback) {
  for (let i = 0; i < rules.length; i += 1) {
    if (rules[i].pattern.test(blob)) return rules[i].value;
  }
  return fallback || "";
}

function collectMatches(blob, rules, limit) {
  const matches = [];
  rules.forEach(function (rule) {
    if (rule.pattern.test(blob)) matches.push(rule.value);
  });
  return uniqueArray(matches).slice(0, limit || matches.length || 99);
}

function buildDishSignalBlob(item) {
  return [item.zh, item.en, item.ingr, item.categoryName].concat(item.aliases || []).join(" ").toLowerCase();
}

function inferDishTypeFromBlob(blob) {
  return inferFirstMatch(
    blob,
    [
      { pattern: /饮品|drink|soda|tea|lemon|kumquat|passion fruit/i, value: "drink" },
      { pattern: /甜点|dessert|杨枝甘露|red bean|pineapple rice|lotus root/i, value: "dessert" },
      { pattern: /馄饨|wonton/i, value: "wonton" },
      { pattern: /面|noodle/i, value: "noodle" },
      { pattern: /饭|rice|炒饭|泡饭|盖饭/i, value: "rice" },
      { pattern: /包|bun|月饼/i, value: "bun" },
      { pattern: /饺|dumpling|锅贴/i, value: "dumpling" },
      { pattern: /煲|casserole|pot/i, value: "casserole" },
      { pattern: /豆腐|tofu/i, value: "tofu" },
      { pattern: /海鲜|seafood boil|combo/i, value: "seafood_boil" },
      { pattern: /汤|soup|broth/i, value: "soup" },
      { pattern: /红烧|braised/i, value: "braised" },
      { pattern: /炒|fried|stir-fried/i, value: "stir_fry" },
    ],
    "unknown",
  );
}

function inferDishSubtypeFromBlob(blob, dishType) {
  if (/fried rice|炒饭/i.test(blob)) return "fried_rice";
  if (/泡饭|soup rice/i.test(blob)) return "soup_rice";
  if (/捞面|拌面|dry noodle|over noodle/i.test(blob)) return "dry_mixed";
  if (/broth|汤面|鱼汤面|noodle soup/i.test(blob) && dishType === "noodle") return "broth_noodle";
  if (/汤馄饨|wonton soup/i.test(blob)) return "wonton_soup";
  if (/煎包|pan-fried bun|生煎/i.test(blob)) return "pan_fried_bun";
  if (/锅贴|pan-fried dumpling/i.test(blob)) return "pan_fried_dumpling";
  if (/盖饭|over rice|rice bowl/i.test(blob)) return "rice_bowl";
  if (/糯米|sticky rice/i.test(blob)) return "sticky_rice";
  if (/豆腐|tofu/i.test(blob) && /蟹黄|crab roe|sauce|braised/i.test(blob)) return "sauced_tofu";
  if (/杨枝甘露|mango pomelo/i.test(blob)) return "cold_sweet_soup";
  return dishType === "unknown" ? "" : dishType;
}

function inferProteinTagsFromBlob(blob) {
  return collectMatches(
    blob,
    [
      { pattern: /蟹黄|crab roe/i, value: "crab roe" },
      { pattern: /蓝蟹|blue crab/i, value: "blue crab" },
      { pattern: /帝王蟹|king crab/i, value: "king crab" },
      { pattern: /温哥华蟹|dungeness|vancouver crab/i, value: "dungeness crab" },
      { pattern: /虾|shrimp|prawn/i, value: "shrimp" },
      { pattern: /龙虾|lobster/i, value: "lobster" },
      { pattern: /干贝|scallop/i, value: "scallop" },
      { pattern: /墨鱼|cuttlefish/i, value: "cuttlefish" },
      { pattern: /黄鱼|croaker|yellow fish/i, value: "yellow fish" },
      { pattern: /鱼|fish|halibut|flounder|grass carp/i, value: "fish" },
      { pattern: /鳗鱼|eel/i, value: "eel" },
      { pattern: /排骨|rib/i, value: "pork ribs" },
      { pattern: /猪|pork|meatball/i, value: "pork" },
      { pattern: /牛|beef/i, value: "beef" },
      { pattern: /鸡|chicken/i, value: "chicken" },
      { pattern: /鸭|duck/i, value: "duck" },
      { pattern: /豆腐|tofu/i, value: "tofu" },
    ],
    4,
  );
}

function inferCarbTagsFromBlob(blob) {
  return collectMatches(
    blob,
    [
      { pattern: /糯米|sticky rice|glutinous rice/i, value: "glutinous rice" },
      { pattern: /饭|rice/i, value: "rice" },
      { pattern: /粉丝|vermicelli|glass noodles/i, value: "glass noodles" },
      { pattern: /面|noodle/i, value: "noodle" },
      { pattern: /馄饨|wonton/i, value: "wonton wrapper" },
      { pattern: /包|饺|月饼|dough|bun|dumpling/i, value: "dough" },
    ],
    3,
  );
}

function inferCookingMethodsFromBlob(blob) {
  return collectMatches(
    blob,
    [
      { pattern: /汤|soup|broth/i, value: "broth" },
      { pattern: /炸|fried/i, value: "fried" },
      { pattern: /煎|pan-fried/i, value: "pan_fried" },
      { pattern: /红烧|braised/i, value: "braised" },
      { pattern: /蒸|steamed/i, value: "steamed" },
      { pattern: /拌|捞|mixed/i, value: "mixed" },
      { pattern: /煲|casserole|pot/i, value: "casserole" },
      { pattern: /冰|冷|chilled/i, value: "chilled" },
      { pattern: /炒|stir-fried/i, value: "stir_fried" },
      { pattern: /酱|sauce|glaze/i, value: "sauced" },
    ],
    4,
  );
}

function inferServingVesselFromBlob(blob, dishType, dishSubtype) {
  if (/竹笼|steamer/i.test(blob)) return "bamboo_steamer";
  if (/杯|cup|drink|杨枝甘露|soda|lemon/i.test(blob)) return "cup";
  if (/煲|casserole|pot/i.test(blob)) return "pot";
  if (dishSubtype === "rice_bowl" || dishSubtype === "soup_rice") return "bowl";
  if (dishType === "noodle" || dishType === "wonton" || dishType === "soup" || dishType === "tofu" || dishType === "rice") return "bowl";
  return "plate";
}

function inferVisualTagsFromBlob(blob, dishType, servingVessel) {
  const tags = [];
  if (/蟹黄|golden|yellow/i.test(blob)) tags.push("golden");
  if (/汤|soup|broth/i.test(blob)) tags.push("soupy");
  if (dishType === "noodle") tags.push("noodles_visible");
  if (dishType === "rice") tags.push("rice_visible");
  if (dishType === "wonton") tags.push("wontons_visible");
  if (dishType === "bun") tags.push("bun_shape");
  if (dishType === "dumpling") tags.push("dumpling_shape");
  if (/虾|shrimp|prawn/i.test(blob)) tags.push("shrimp_visible");
  if (/黄鱼|fish|eel|halibut|flounder|croaker/i.test(blob)) tags.push("fish_pieces");
  if (/蓝蟹|crab shell|blue crab|dungeness|king crab/i.test(blob)) tags.push("crab_shell_visible");
  if (servingVessel === "cup") tags.push("drink_like");
  if (servingVessel === "pot") tags.push("pot_served");
  return uniqueArray(tags);
}

function inferTextureTagsFromBlob(blob) {
  const tags = [];
  if (/脆|crispy|fried|煎|炸/i.test(blob)) tags.push("crispy");
  if (/汤|soup|broth/i.test(blob)) tags.push("brothy");
  if (/糯|sticky/i.test(blob)) tags.push("sticky");
  if (/豆腐|tofu/i.test(blob)) tags.push("silky", "soft");
  if (/酱|sauce|glaze|蟹黄/i.test(blob)) tags.push("glossy");
  return uniqueArray(tags);
}

function inferPresentationTagsFromBlob(blob, servingVessel) {
  const tags = [];
  if (servingVessel === "bowl") tags.push("single_bowl");
  if (servingVessel === "pot") tags.push("shared_pot");
  if (servingVessel === "plate") tags.push("shared_plate");
  if (servingVessel === "cup") tags.push("single_cup");
  if (/\d+\s*(pcs?|个|颗|粒)/i.test(blob)) tags.push("piece_count_visible");
  return uniqueArray(tags);
}

function getDishSignals(item) {
  const blob = buildDishSignalBlob(item);
  const dishType = item.dish_type || inferDishTypeFromBlob(blob);
  const dishSubtype = item.dish_subtype || inferDishSubtypeFromBlob(blob, dishType);
  const primaryProteins = item.primary_proteins && item.primary_proteins.length ? item.primary_proteins : inferProteinTagsFromBlob(blob);
  const primaryCarbs = item.primary_carbs && item.primary_carbs.length ? item.primary_carbs : inferCarbTagsFromBlob(blob);
  const cookingMethods = item.cooking_methods && item.cooking_methods.length ? item.cooking_methods : inferCookingMethodsFromBlob(blob);
  const servingVessel = item.serving_vessel || inferServingVesselFromBlob(blob, dishType, dishSubtype);
  const visualTags = uniqueArray((item.visual_tags || []).concat(inferVisualTagsFromBlob(blob, dishType, servingVessel)));
  const textureTags = uniqueArray((item.texture_tags || []).concat(inferTextureTagsFromBlob(blob)));
  const presentationTags = uniqueArray((item.presentation_tags || []).concat(inferPresentationTagsFromBlob(blob, servingVessel)));

  return {
    confidence_priority: Number(item.confidence_priority || 0),
    cooking_methods: cookingMethods,
    dish_subtype: dishSubtype,
    dish_type: dishType,
    match_hints: item.match_hints || [],
    negative_hints: item.negative_hints || [],
    normalized_search_blob: normalizeText(blob),
    presentation_tags: presentationTags,
    primary_carbs: primaryCarbs,
    primary_proteins: primaryProteins,
    search_blob: blob,
    serving_vessel: servingVessel,
    texture_tags: textureTags,
    visual_tags: visualTags,
  };
}

function normalizeObservation(observation) {
  observation = observation || {};
  return {
    image_kind: String(observation.image_kind || "unknown").trim(),
    confidence: String(observation.confidence || "low").trim(),
    dominant_subject: String(observation.dominant_subject || "").trim(),
    readable_text_level: String(observation.readable_text_level || "none").trim(),
    visible_texts: normalizeStringList(observation.visible_texts),
    dish_type: String(observation.dish_type || "").trim(),
    dish_subtype: String(observation.dish_subtype || "").trim(),
    primary_proteins: normalizeStringList(observation.primary_proteins),
    primary_carbs: normalizeStringList(observation.primary_carbs),
    cooking_methods: normalizeStringList(observation.cooking_methods),
    serving_vessel: String(observation.serving_vessel || "").trim(),
    visual_tags: normalizeStringList(observation.visual_tags),
    texture_tags: normalizeStringList(observation.texture_tags),
    presentation_tags: normalizeStringList(observation.presentation_tags),
    match_hints: normalizeStringList(observation.match_hints),
    negative_hints: normalizeStringList(observation.negative_hints),
  };
}

function extractPortionClues(item) {
  const source = [item.zh, item.en].join(" ");
  const matches = source.match(/\d+/g) || [];
  const numbers = uniqueArray(
    matches.filter(function (value) {
      const num = Number(value);
      return Number.isFinite(num) && num > 0 && num <= 12;
    }),
  );

  return uniqueArray(
    numbers.flatMap(function (value) {
      return [value, "*" + value, value + " pcs", value + "pcs"];
    }),
  );
}

function inferDishTypeClues(item) {
  const blob = [item.zh, item.en, item.categoryName].join(" ").toLowerCase();
  const clues = [];
  if (/包|bun/.test(blob)) clues.push("bun", "steamed bun", "包");
  if (/煎包|pan-fried/.test(blob)) clues.push("pan-fried", "煎");
  if (/饺|dumpling|wonton|shumai/.test(blob)) clues.push("dumpling", "dim sum", "饺");
  if (/面|noodle/.test(blob)) clues.push("noodle", "面");
  if (/饭|rice|fried rice|bowl/.test(blob)) clues.push("rice", "饭");
  if (/豆腐|tofu/.test(blob)) clues.push("tofu", "豆腐");
  if (/汤|soup|broth/.test(blob)) clues.push("soup", "汤");
  if (/鱼|fish|croaker|eel/.test(blob)) clues.push("fish", "鱼");
  if (/点心|dim sum/.test(blob)) clues.push("dim sum", "点心");
  return uniqueArray(clues);
}

function buildCatalogText(menuContext) {
  return menuContext.flatDishes
    .map(function (item) {
      const portionClues = extractPortionClues(item);
      const dishTypeClues = inferDishTypeClues(item);
      return [
        item.uqid,
        "zh: " + item.zh,
        "en: " + item.en,
        "aliases: " + ((item.aliases || []).join(", ") || "n/a"),
        "category: " + item.categoryName,
        "ingredients: " + (item.ingr || "n/a"),
        "dish_type_clues: " + (dishTypeClues.length ? dishTypeClues.join(", ") : "n/a"),
        "portion_clues: " + (portionClues.length ? portionClues.join(", ") : "n/a"),
      ].join(" | ");
    })
    .join("\n");
}

function scoreDishCandidates(menuContext, observation) {
  const obs = normalizeObservation(observation);
  const visibleTexts = obs.visible_texts.map(normalizeText);

  return menuContext.flatDishes
    .map(function (item) {
      const signals = getDishSignals(item);
      let score = Math.max(0, signals.confidence_priority * 3);
      const reasons = [];

      if (obs.dish_type && signals.dish_type === obs.dish_type) {
        score += 26;
        reasons.push("dish_type");
      }
      if (obs.dish_subtype && signals.dish_subtype === obs.dish_subtype) {
        score += 16;
        reasons.push("dish_subtype");
      }
      if (obs.serving_vessel && signals.serving_vessel === obs.serving_vessel) {
        score += 10;
        reasons.push("serving_vessel");
      }

      obs.primary_proteins.forEach(function (token) {
        if (signals.primary_proteins.indexOf(token) !== -1) {
          score += 9;
          reasons.push("protein:" + token);
        }
      });
      obs.primary_carbs.forEach(function (token) {
        if (signals.primary_carbs.indexOf(token) !== -1) {
          score += 7;
          reasons.push("carb:" + token);
        }
      });
      obs.cooking_methods.forEach(function (token) {
        if (signals.cooking_methods.indexOf(token) !== -1) {
          score += 6;
          reasons.push("method:" + token);
        }
      });
      obs.visual_tags.forEach(function (token) {
        if (signals.visual_tags.indexOf(token) !== -1) {
          score += 4;
          reasons.push("visual:" + token);
        }
      });
      obs.texture_tags.forEach(function (token) {
        if (signals.texture_tags.indexOf(token) !== -1) {
          score += 2;
          reasons.push("texture:" + token);
        }
      });
      obs.presentation_tags.forEach(function (token) {
        if (signals.presentation_tags.indexOf(token) !== -1) {
          score += 2;
          reasons.push("presentation:" + token);
        }
      });

      visibleTexts.forEach(function (token) {
        if (!token) return;
        if (
          normalizeText(item.zh) === token ||
          normalizeText(item.en) === token ||
          (item.aliases || []).some(function (alias) {
            return normalizeText(alias) === token;
          })
        ) {
          score += 24;
          reasons.push("visible_text_exact");
        } else if (signals.normalized_search_blob.indexOf(token) !== -1) {
          score += 10;
          reasons.push("visible_text_partial");
        }
      });

      obs.negative_hints.forEach(function (token) {
        const normalized = normalizeText(token);
        if (normalized && signals.normalized_search_blob.indexOf(normalized) !== -1) {
          score -= 4;
        }
      });

      signals.negative_hints.forEach(function (hint) {
        const normalizedHint = normalizeText(hint);
        if (!normalizedHint) return;
        if (
          visibleTexts.some(function (token) {
            return token && normalizedHint.indexOf(token) !== -1;
          }) ||
          obs.visual_tags.some(function (token) {
            return normalizedHint.indexOf(normalizeText(token)) !== -1;
          })
        ) {
          score -= 6;
        }
      });

      if (
        obs.dominant_subject &&
        normalizeText(obs.dominant_subject) &&
        signals.normalized_search_blob.indexOf(normalizeText(obs.dominant_subject)) !== -1
      ) {
        score += 8;
        reasons.push("dominant_subject");
      }

      return {
        item: item,
        signals: signals,
        score: score,
        reasons: uniqueArray(reasons),
      };
    })
    .sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return b.signals.confidence_priority - a.signals.confidence_priority;
    })
    .slice(0, 8);
}

function buildPhotoCandidateCatalog(candidates) {
  return candidates
    .map(function (candidate) {
      const item = candidate.item;
      const signals = candidate.signals;
      return [
        "dish_id: " + item.uqid,
        "zh: " + item.zh,
        "en: " + item.en,
        "category: " + item.categoryName,
        "ingredients: " + (item.ingr || "n/a"),
        "dish_type: " + (signals.dish_type || "unknown"),
        "dish_subtype: " + (signals.dish_subtype || "unknown"),
        "proteins: " + (signals.primary_proteins.join(", ") || "n/a"),
        "carbs: " + (signals.primary_carbs.join(", ") || "n/a"),
        "methods: " + (signals.cooking_methods.join(", ") || "n/a"),
        "vessel: " + (signals.serving_vessel || "unknown"),
        "visual_tags: " + (signals.visual_tags.join(", ") || "n/a"),
        "match_hints: " + (signals.match_hints.join("; ") || "n/a"),
        "negative_hints: " + (signals.negative_hints.join("; ") || "n/a"),
      ].join(" | ");
    })
    .join("\n");
}

function imageAnalysisSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: IMAGE_ANALYSIS_SCHEMA_NAME,
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          image_kind: { type: "string", enum: ["receipt", "dish_single", "dish_multi", "unknown"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          readable_text_level: { type: "string", enum: ["high", "medium", "low", "none"] },
          dominant_subject: { type: "string" },
          visible_texts: { type: "array", items: { type: "string" } },
          dish_type: { type: "string" },
          dish_subtype: { type: "string" },
          primary_proteins: { type: "array", items: { type: "string" } },
          primary_carbs: { type: "array", items: { type: "string" } },
          cooking_methods: { type: "array", items: { type: "string" } },
          serving_vessel: { type: "string" },
          visual_tags: { type: "array", items: { type: "string" } },
          texture_tags: { type: "array", items: { type: "string" } },
          presentation_tags: { type: "array", items: { type: "string" } },
          match_hints: { type: "array", items: { type: "string" } },
          negative_hints: { type: "array", items: { type: "string" } },
        },
        required: [
          "image_kind",
          "confidence",
          "readable_text_level",
          "dominant_subject",
          "visible_texts",
          "dish_type",
          "dish_subtype",
          "primary_proteins",
          "primary_carbs",
          "cooking_methods",
          "serving_vessel",
          "visual_tags",
          "texture_tags",
          "presentation_tags",
          "match_hints",
          "negative_hints",
        ],
      },
    },
  };
}

function receiptSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: RECEIPT_SCHEMA_NAME,
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          dishes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                dish_id: { type: "number" },
                source_text: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["dish_id", "source_text", "confidence"],
            },
          },
          uncertain_texts: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["dishes", "uncertain_texts"],
      },
    },
  };
}

function photoResolutionSchema(candidateDishIds) {
  return {
    type: "json_schema",
    json_schema: {
      name: PHOTO_RESOLUTION_SCHEMA_NAME,
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          dish_id: {
            type: "number",
            enum: candidateDishIds,
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          reason: { type: "string" },
        },
        required: ["dish_id", "confidence", "reason"],
      },
    },
  };
}

function buildImageAnalysisMessages(store) {
  return {
    system:
      "You classify salon-related uploads and extract structured visual clues. First decide whether the image is mainly a receipt or another salon-related photo. If it is not a receipt, focus only on the dominant service result or beauty subject. Extract only what is visually supported. Do not guess a final catalog item yet. Return JSON only.",
    user:
      "Salon: " +
      getRestaurantLabel(store) +
      "\n\nReturn these fields:\n" +
      "- image_kind: receipt, dish_single, dish_multi, or unknown\n" +
      "- confidence: high, medium, or low\n" +
      "- readable_text_level: high, medium, low, or none\n" +
      "- dominant_subject: one short phrase\n" +
      "- visible_texts: short text fragments if any are readable\n" +
      "- dish_type: choose the closest broad tag such as noodle, rice, bun, dumpling, wonton, soup, casserole, tofu, stir_fry, braised, dessert, drink, seafood_boil, appetizer, or unknown\n" +
      "- dish_subtype: optional short tag like broth_noodle, dry_mixed, fried_rice, pan_fried_bun, wonton_soup, rice_bowl\n" +
      "- primary_proteins, primary_carbs, cooking_methods, visual_tags, texture_tags, presentation_tags: short lowercase tags\n" +
      "- serving_vessel: bowl, plate, pot, cup, bamboo_steamer, tray, bag, or unknown\n" +
      "- match_hints: 2-4 short observations\n" +
      "- negative_hints: 0-3 short exclusions when visually supported\n\n" +
      "If the image is a receipt, still fill the dish_* and tag arrays with empty values.",
  };
}

function buildReceiptMessages(store, menuContext) {
  return {
    system:
      "You read an itemized business receipt and map its purchasable line items to the store catalog. The business may be a **salon/spa, restaurant/cafe, barbershop, or other retail** — 饭店/餐厅/饮品/小吃/火锅/简餐/套餐小票 is completely valid, not a mistake. " +
      "Line items are services (cut/color/manicure), or food, drinks, combos, boba, set meals, sides, and add-ons as printed. " +
      "Do NOT treat restaurant receipts as invalid. Use POS shorthand, abbreviations, wrapped lines, and fuzzy / cross-language matching. " +
      "Merge lines that belong to the same item before matching. " +
      "Ignore only: tax lines, subtotal/total, tips, payment card/wallet, change, coupon discounts as standalone rows, and pure store headers. " +
      "If a line is clearly food/drink/service but has no good catalog match, you MUST still copy the readable line text into uncertain_texts. " +
      "If two catalog items tie, use uncertain_texts, not a random guess. Return JSON only.",
    user:
      "Store / 门店: " +
      getRestaurantLabel(store) +
      "\n\n" +
      "Catalog (dish_id | fields — services OR menu items, depending on this business):\n" +
      buildCatalogText(menuContext) +
      "\n\n" +
      "Matching guidance:\n" +
      "- Exact string equality to catalog titles is NOT required.\n" +
      "- Restaurant/饭店: 菜品, 飲品, 套餐, 小食, 加價, add-on, combo, drink names are the thing to link when the catalog has similar food/service rows.\n" +
      "- Salon/美甲: service keywords, add-ons, package names are strong signals.\n" +
      "- Quantities, seat/table labels, and timing notes are weak; the descriptive part of the line is stronger.\n" +
      "- Wrap/merge: merge wrapped receipt lines that belong to one item before matching.\n" +
      "- Item codes (A1, B2) alone are weak; the descriptive line under/next to them is important.\n" +
      "- In `dishes`, return high, medium, or *low* confidence (use low for stretched but not absurd matches; never invent a dish_id not listed above). " +
      "- In `uncertain_texts`, include every other readable line item the customer likely paid for that you could not map, **including 饭店/餐厅 lines** when the catalog is mostly unrelated.\n\n" +
      "Analyze the receipt image and return JSON. Prefer mapping to catalog dish_id when plausible; always populate uncertain_texts for unmatched lines (do not leave it empty if many lines are visible and unmatched).",
  };
}

function buildPhotoResolutionMessages(store, observation, candidates) {
  const obs = normalizeObservation(observation);
  return {
    system:
      "You choose the single closest service catalog item for the dominant beauty subject in a salon photo. You must pick from the candidate list only. If the image contains multiple possible subjects, choose the dominant one only. Even when confidence is low, pick the closest candidate and explain briefly. Return JSON only.",
    user:
      "Salon: " +
      getRestaurantLabel(store) +
      "\n\nObserved image analysis:\n" +
      "- image_kind: " +
      (obs.image_kind || "unknown") +
      "\n- confidence: " +
      (obs.confidence || "low") +
      "\n- dominant_subject: " +
      (obs.dominant_subject || "n/a") +
      "\n- dish_type: " +
      (obs.dish_type || "unknown") +
      "\n- dish_subtype: " +
      (obs.dish_subtype || "unknown") +
      "\n- proteins: " +
      (obs.primary_proteins.join(", ") || "n/a") +
      "\n- carbs: " +
      (obs.primary_carbs.join(", ") || "n/a") +
      "\n- methods: " +
      (obs.cooking_methods.join(", ") || "n/a") +
      "\n- vessel: " +
      (obs.serving_vessel || "unknown") +
      "\n- visual_tags: " +
      (obs.visual_tags.join(", ") || "n/a") +
      "\n- texture_tags: " +
      (obs.texture_tags.join(", ") || "n/a") +
      "\n- presentation_tags: " +
      (obs.presentation_tags.join(", ") || "n/a") +
      "\n- visible_texts: " +
      (obs.visible_texts.join(", ") || "n/a") +
      "\n- match_hints: " +
      (obs.match_hints.join("; ") || "n/a") +
      "\n- negative_hints: " +
      (obs.negative_hints.join("; ") || "n/a") +
      "\n\nCandidate salon services:\n" +
      buildPhotoCandidateCatalog(candidates) +
      "\n\nChoose exactly one dish_id from the candidate list.",
  };
}

async function analyzeUploadImage(store, imageDataUrl, model) {
  const prompts = buildImageAnalysisMessages(store);
  const data = await callOpenAIChat({
    model: model,
    temperature: 0.1,
    max_tokens: 1000,
    response_format: imageAnalysisSchema(),
    messages: [
      { role: "system", content: prompts.system },
      {
        role: "user",
        content: [
          { type: "text", text: prompts.user },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  });

  return normalizeObservation(parseChatCompletionJson(data));
}

async function recognizeReceipt(store, menuContext, imageDataUrl, model) {
  const prompts = buildReceiptMessages(store, menuContext);
  const data = await callOpenAIChat({
    model: model,
    temperature: 0.1,
    max_tokens: 1000,
    response_format: receiptSchema(),
    messages: [
      { role: "system", content: prompts.system },
      {
        role: "user",
        content: [
          { type: "text", text: prompts.user },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  });

  return parseChatCompletionJson(data);
}

async function resolveDishPhoto(store, menuContext, imageDataUrl, observation, model) {
  const candidates = scoreDishCandidates(menuContext, observation);
  if (!candidates.length) {
    throw createAppError("NO_CANDIDATE_DISHES", "No candidate dishes available", 422);
  }

  const candidateDishIds = candidates.map(function (candidate) {
    return candidate.item.uqid;
  });
  const prompts = buildPhotoResolutionMessages(store, observation, candidates);

  try {
    const data = await callOpenAIChat({
      model: model,
      temperature: 0.15,
      max_tokens: 700,
      response_format: photoResolutionSchema(candidateDishIds),
      messages: [
        { role: "system", content: prompts.system },
        {
          role: "user",
          content: [
            { type: "text", text: prompts.user },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    });

    const parsed = parseChatCompletionJson(data);
    const resolvedDishId = Number(parsed.dish_id);
    const fallbackDishId = candidates[0].item.uqid;
    return {
      dish_id: candidateDishIds.indexOf(resolvedDishId) !== -1 ? resolvedDishId : fallbackDishId,
      confidence: String(parsed.confidence || "low"),
      reason: String(parsed.reason || ""),
      candidates: candidates,
    };
  } catch (error) {
    return {
      dish_id: candidates[0].item.uqid,
      confidence: "low",
      reason: "fallback_top_candidate",
      candidates: candidates,
    };
  }
}

async function recognizeStoreUpload(input) {
  const store = input.store;
  const imageDataUrl = String(input.imageDataUrl || "").trim();
  if (!imageDataUrl || imageDataUrl.indexOf("data:image/") !== 0) {
    throw createAppError("INVALID_IMAGE_PAYLOAD", "imageDataUrl must be a valid data URL", 400);
  }

  const menuContext = buildMenuContext(input.menuJson);
  if (!menuContext.flatDishes.length) {
    throw createAppError("MENU_EMPTY", "Published service catalog is empty", 422);
  }

  const result = await recognizeReceipt(store, menuContext, imageDataUrl, input.model);
  const validDishIds = uniqueArray(
    (result.dishes || [])
      .map(function (item) {
        return Number(item.dish_id);
      })
      .filter(function (dishId) {
        return menuContext.dishMap.has(dishId);
      }),
  );

  return {
    recognizedDishIds: validDishIds,
    uncertainTexts: uniqueArray(result.uncertain_texts || []),
    imageAnalysis: {
      image_kind: "receipt",
      confidence: "medium",
    },
    recognitionMeta: {
      mode: "receipt",
      matches: result.dishes || [],
    },
  };
}

module.exports = {
  recognizeStoreUpload,
};
