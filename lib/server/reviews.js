const { buildMenuContext } = require("./menu");
const { callOpenAIChat, parseChatCompletionJson } = require("./openai");
const { createAppError, normalizeText, uniqueArray } = require("./shared");

const REVIEW_SCHEMA_NAME = "review_variants";
const SINGLE_REVIEW_REMOTE_ATTEMPTS = 3;
const SINGLE_REVIEW_TIMEOUT_MS = 3500;
const SINGLE_REVIEW_TEMPERATURE = 0.55;
const SINGLE_REVIEW_MAX_TOKENS = 180;
const GROUP_DIVERSITY_ATTEMPTS = 2;
const GROUP_GENERATION_ATTEMPTS = 3;

const STYLE_VARIANTS = [
  {
    key: "review_a",
    zhLabel: "简洁",
    enLabel: "Simple",
    zhRule: "最口语、最随手，像刚吃完掏出手机就打两行字，别端着。",
    enRule: "Keep it the most casual and off-the-cuff, like someone typing right after the meal without overthinking.",
  },
  {
    key: "review_b",
    zhLabel: "详细",
    enLabel: "Detailed",
    zhRule: "多说一两个具体细节，但还是聊天口吻，别写成探店文案。",
    enRule: "Add one or two concrete details, but keep it chatty and personal, not like a food blogger script.",
  },
  {
    key: "review_c",
    zhLabel: "出彩",
    enLabel: "Standout",
    zhRule: "可以稍微夸张一点、更有记忆点，用当下流行的夸法，但得像真食客，不像网红通稿。",
    enRule: "Make it the most memorable with a touch of hype, but still sound like a real diner, not influencer copy.",
  },
];

const CARD_VOICE_DIRECTIVES = {
  review_a: {
    zhLabel: "结果先说",
    enLabel: "result-first phrasing",
    zhRule: "这一条最口语，先甩结论或第一口感，像跟朋友发微信，别写太满。",
    enRule: "Lead with the immediate reaction or verdict, like texting a friend. Keep it punchy.",
  },
  review_b: {
    zhLabel: "细节展开",
    enLabel: "detail-forward phrasing",
    zhRule: "这一条多写口感、火候、分量或一个小细节，起手别跟第一条撞车。",
    enRule: "Lean into texture, temperature, portion, or one craft detail. Open differently from the short one.",
  },
  review_c: {
    zhLabel: "记忆点表达",
    enLabel: "memory-point phrasing",
    zhRule: "这一条写出「为什么值得来/会再来」的那个点，可以用很绝、超预期、上头这类流行夸法，但别堆词。",
    enRule: "Land the reason it sticks or why you'd come back. A little trendy hype is fine, but do not stack buzzwords.",
  },
};

const REVIEW_FOCUS_TYPES = ["none", "service", "environment"];

const FOCUS_RULES = {
  none: {
    zhRule: "这一条只写菜品或饮品本身，比如味道、口感、分量、摆盘、温度，完全不要提staff、环境、氛围。",
    enRule:
      "This review must only talk about the food or drink itself, such as flavor, texture, portion, presentation, freshness, or how the meal came out. Do not mention staff, ambiance, atmosphere, decor, or the restaurant space.",
  },
  service: {
    zhRule: "这一条必须提服务员或staff热情、上菜快、沟通顺、服务周到之类，但完全不要提环境、氛围、装修。",
    enRule:
      "This review must clearly praise the staff, attentiveness, speed, hospitality, or communication, but must not mention ambiance, atmosphere, decor, or the restaurant space.",
  },
  environment: {
    zhRule: "这一条必须提环境、氛围、空间、装修、干净或整体用餐舒服，但完全不要提staff。",
    enRule:
      "This review must clearly praise the atmosphere, cleanliness, decor, comfort, or overall restaurant setting, but must not mention staff or attentiveness.",
  },
};

const VISIT_TIER_OPTIONS = [
  {
    key: "first_time",
    zhLabel: "第一次来",
    enLabel: "First time here",
    zhPrompt: "三条都要自然带出是第一次来，说法别撞车，像刚吃完顺手发出去的那种。",
    enPrompt: "All three should sound like a first visit, with varied wording like quick post-meal reactions.",
    zhPrefixes: ["头回来就被香到了", "第一次来，比想象中好吃", "初次打卡，整体很能打"],
    enPrefixes: ["First time here and it hit right away.", "Didn't expect it to be this good on visit one.", "First visit and I'm already planning round two."],
    zhPattern: /第一次|头一回|头一次/,
    enPattern: /\bfirst time\b|\bfirst visit\b|\bnew here\b/i,
  },
  {
    key: "few_times",
    zhLabel: "之前来过",
    enLabel: "Been back before",
    zhPrompt: "三条都要带出不是第一次来，这次也还想继续吃，语气轻松口语。",
    enPrompt: "All three should read like a return visit, casual and current.",
    zhPrefixes: ["来过几次了，还是很稳", "不是头回来了，味道依旧在线", "又来吃了，还是没踩雷"],
    enPrefixes: ["Been back a few times and it still hits.", "Not my first visit and it still delivers.", "Came back again and still no regrets."],
    zhPattern: /来过|不是第一次|之前来过|又来/,
    enPattern: /\bbeen back\b|\bnot my first time\b|\bcome by before\b|\bback before\b/i,
  },
  {
    key: "regular",
    zhLabel: "这家我常来",
    enLabel: "One of my regular spots",
    zhPrompt: "三条都要带出是常来的店，但别端着，像老客随口夸一句。",
    enPrompt: "All three should feel like a regular talking casually, not a formal endorsement.",
    zhPrefixes: ["老客了，每次来都不踩雷", "常来的店，出品一直很稳", "算是回头客了，味道还是能打"],
    enPrefixes: ["Regular here and it never misses.", "One of my go-to spots, always solid.", "I keep coming back because it stays consistent."],
    zhPattern: /常来|常客|来了很多次|每次来|回头客/,
    enPattern: /\bregular\b|\bcome here often\b|\bkeep me coming back\b|\bpretty often\b|\bregular spots\b/i,
  },
];

const SERVICE_PRAISE_OPTIONS = [
  { key: "friendly", zhLabel: "很热情", enLabel: "warm and friendly", zhPhrase: "热情", enPhrase: "warm and friendly" },
  { key: "patient", zhLabel: "很耐心", enLabel: "very patient", zhPhrase: "耐心", enPhrase: "very patient" },
  { key: "detailed", zhLabel: "很细心", enLabel: "very detailed", zhPhrase: "细心", enPhrase: "very detailed" },
  { key: "helpful", zhLabel: "沟通很顺", enLabel: "easy to communicate with", zhPhrase: "沟通很顺", enPhrase: "easy to communicate with" },
  { key: "gentle", zhLabel: "服务很舒服", enLabel: "smooth and careful", zhPhrase: "服务很舒服", enPhrase: "smooth and careful" },
];

const REVIEW_SPICE_BANK = {
  zh: [
    "真的绝",
    "超预期",
    "香迷糊了",
    "很能打",
    "味道在线",
    "没踩雷",
    "会回购",
    "一口沦陷",
    "扎实",
    "性价比拉满",
    "被香到了",
    "吃完还想再来",
    "朋友看了也想点",
    "比预期好吃",
  ],
  en: [
    "lowkey fire",
    "hits different",
    "better than expected",
    "no notes",
    "solid spot",
    "definitely coming back",
    "worth the hype",
    "so good",
    "crushed it",
    "easy recommend",
    "already planning round two",
    "did not disappoint",
    "flavor was on point",
    "portion was right",
  ],
};

const REVIEW_LENGTH_PROFILES = {
  zh: [
    { key: "short_30", weight: 0.5, min: 14, max: 30, promptLabel: "短评约14到30字" },
    { key: "mid_30_100", weight: 0.3, min: 32, max: 100, promptLabel: "中等约32到100字" },
    { key: "long_100", weight: 0.2, min: 100, max: 200, promptLabel: "较长约100到200字" },
  ],
  en: [
    { key: "short_30", weight: 0.5, min: 6, max: 12, promptLabel: "short about 6 to 12 words" },
    { key: "mid_30_100", weight: 0.3, min: 14, max: 32, promptLabel: "medium about 14 to 32 words" },
    {
      key: "long_50",
      weight: 0.2,
      min: 28,
      max: 50,
      promptLabel: "longest and most memorable, about 28 to 50 words, never more than 50 words",
    },
  ],
};

const REVIEW_PATTERN_TYPES = {
  staff_led: {
    zhLabel: "staff主导",
    enLabel: "staff-led testimonial",
    zhRule: "先点人，再点菜品，再落一个可信细节，最后只放一个轻的回头或推荐信号。",
    enRule:
      "Open with the person or staff mention, then the service, then one believable proof point, and finish with one light return or recommendation signal.",
  },
  repeat_customer: {
    zhLabel: "回头客验证",
    enLabel: "repeat-customer validation",
    zhRule: "先点出不是第一次来，再写这次的菜品或稳定发挥，最后轻轻落一个继续会来的信号。",
    enRule:
      "Start with the return-visit context, then the service or consistent result, and end with a light loyalty signal.",
  },
  first_time_surprise: {
    zhLabel: "第一次惊喜",
    enLabel: "first-time pleasant surprise",
    zhRule: "先点出第一次来，再写一个让人放心的具体亮点，最后放一个回头或推荐信号。",
    enRule:
      "Start with the first-time context, then one concrete pleasant surprise, and finish with a return or recommendation signal.",
  },
  service_result: {
    zhLabel: "菜品效果主导",
    enLabel: "service-result review",
    zhRule: "先点菜品，再写味道或出品，再补一个可信细节，最后只放一个轻收尾。",
    enRule:
      "Start with the dish, then the result, add one believable proof point, and finish with one light closing signal.",
  },
};

const REVIEW_PROOF_TYPES = {
  skill: {
    zhLabel: "服务或细节证明",
    enLabel: "skill proof",
    zhRule: "用细致、认真、上菜稳、沟通顺之类的真实细节证明不是空夸。",
    enRule: "Use a believable skill detail such as attention to detail, patience, precision, or listening well.",
  },
  cleanliness: {
    zhLabel: "环境干净证明",
    enLabel: "cleanliness proof",
    zhRule: "环境相关时优先写干净、明亮、舒服，不要写成宣传语。",
    enRule: "When mentioning the restaurant setting, prefer very clean, spotless, bright, or comfortable over marketing-style phrasing.",
  },
  warmth: {
    zhLabel: "热情舒适证明",
    enLabel: "warmth proof",
    zhRule: "写成被照顾到、沟通舒服、让人放松，不要只写 staff friendly 这种硬词。",
    enRule: "Phrase hospitality as feeling comfortable, welcomed, or easy to talk to rather than using stiff keyword phrases.",
  },
  relaxation: {
    zhLabel: "放松感证明",
    enLabel: "relaxation proof",
    zhRule: "写坐着舒服、氛围轻松、吃着不赶，别像套餐宣传。",
    enRule: "Use relaxing, comfortable, or easy-going vibe phrasing without sounding like a promo.",
  },
  result: {
    zhLabel: "菜品证明",
    enLabel: "dish proof",
    zhRule: "用口感、香气、火候、分量或第一口的具体感受做证明，别空夸好吃。",
    enRule: "Use texture, aroma, temperature, portion, or a first-bite detail as proof instead of empty praise.",
  },
};

const REVIEW_CLOSING_TYPES = {
  satisfaction: {
    zhLabel: "满意收尾",
    enLabel: "satisfaction close",
    zhRule: "以满意感收尾，比如很喜欢、很顺眼、正是想要的，不要再叠加推荐。",
    enRule: "Close on satisfaction, such as loving the result or getting exactly what was wanted, without piling on extra recommendation language.",
  },
  recommend: {
    zhLabel: "推荐收尾",
    enLabel: "recommendation close",
    zhRule: "只放一个轻推荐，例如会推荐或值得来，不要同时又写回头客又写推荐。",
    enRule: "Use one light recommendation close, such as highly recommend or worth it, without stacking loyalty language too.",
  },
  loyalty: {
    zhLabel: "回头收尾",
    enLabel: "loyalty close",
    zhRule: "只放一个回头信号，例如还会再来、会继续来，不要和推荐句叠加。",
    enRule: "Use one loyalty close, such as coming back or keeping this as a go-to spot, without also adding a recommendation sentence.",
  },
};

const SURFACE_START_TYPES = {
  normal_start: {
    zhLabel: "正常开头",
    enLabel: "normal opening",
    zhRule: "正常开头。",
    enRule: "Use a normal sentence opening.",
  },
  lowercase_start: {
    zhLabel: "英文小写开头",
    enLabel: "lowercase opening",
    zhRule: "如果是英文，这条可以像随手发的一样直接用小写字母开头。",
    enRule: "For English only, let the first alphabetic character stay lowercase like a casual real-user review.",
  },
};

const SURFACE_END_TYPES = {
  standard: {
    zhLabel: "正常收尾",
    enLabel: "standard ending",
    zhRule: "正常收尾。",
    enRule: "Use a normal sentence ending.",
  },
  no_terminal_punctuation: {
    zhLabel: "无句末标点",
    enLabel: "no terminal punctuation",
    zhRule: "最后一句末尾不要补句号或感叹号，像顺手发出去。",
    enRule: "Leave off the final period or exclamation mark so it feels casually posted.",
  },
};

const KEYWORD_REALIZATION_MAP = {
  clean: {
    zh: ["店里很干净", "收拾得利落", "坐着舒服不膈应"],
    en: ["super clean", "spotless", "clean and easy to relax in"],
  },
  detailed: {
    zh: ["细节拿捏住了", "做得很细", "出品很讲究"],
    en: ["attention to detail", "really thoughtful", "clearly cared about the little things"],
  },
  gentle: {
    zh: ["服务很温柔", "照顾得很舒服", "不会催也不会冷场"],
    en: ["gentle service", "really considerate", "made the visit feel easy"],
  },
  polished: {
    zh: ["摆盘很精致", "出品利落", "看着就很有食欲"],
    en: ["looked polished", "came out clean", "presentation was on point"],
  },
  relaxing: {
    zh: ["待着很放松", "氛围很舒服", "吃着不赶"],
    en: ["so relaxing", "easy vibe", "comfortable place to linger"],
  },
  natural: {
    zh: ["味道很自然", "吃着不腻", "调味不抢戏"],
    en: ["tasted natural", "not overdone", "balanced flavors"],
  },
  glossy: {
    zh: ["油亮亮的", "看着就香", "色泽很诱人"],
    en: ["nice sheen", "looked so good", "visually tempting"],
  },
  precise: {
    zh: ["火候很准", "口感拿捏住了", "每口都稳"],
    en: ["cooked just right", "texture was spot on", "really precise"],
  },
  lasting: {
    zh: ["回味很足", "吃完还惦记", "味道挺耐吃"],
    en: ["flavor lingered", "still thinking about it", "stays satisfying"],
  },
  welcoming: {
    zh: ["人一进来就很热情", "沟通很舒服", "服务让人放松"],
    en: ["super welcoming", "friendly right away", "made us feel comfortable"],
  },
  fresh: {
    zh: ["食材很新鲜", "一口就很鲜", "鲜味很足"],
    en: ["so fresh", "tasted super fresh", "freshness really showed"],
  },
  flavorful: {
    zh: ["味道很入味", "调味很到位", "香得不行"],
    en: ["packed with flavor", "seasoning was on point", "really flavorful"],
  },
  authentic: {
    zh: ["味道很地道", "吃得到家乡味", "做法很正宗"],
    en: ["tasted authentic", "real deal flavors", "felt genuinely traditional"],
  },
  generous: {
    zh: ["份量很足", "给料很大方", "吃着很过瘾"],
    en: ["generous portions", "portion was huge", "very filling"],
  },
  savory: {
    zh: ["鲜味拉满", "吃着很满足", "咸鲜口很正"],
    en: ["super savory", "rich and satisfying", "umami hit hard"],
  },
  attentive: {
    zh: ["服务很热情", "照顾得很周到", "有问必答很省心"],
    en: ["attentive service", "really looked after us", "on top of everything"],
  },
  fast: {
    zh: ["上菜很快", "不用干等", "节奏很顺"],
    en: ["came out fast", "quick service", "didn't wait long"],
  },
  value: {
    zh: ["性价比很高", "这价格很值", "吃得划算"],
    en: ["great value", "worth every penny", "solid for the price"],
  },
  signature_crab: {
    zh: ["招牌蟹真的顶", "蟹味很正", "蟹黄这块绝了"],
    en: ["signature crab was the star", "crab flavor was legit", "crab roe dish stole the show"],
  },
};

const KEYWORD_FOCUS_COMPATIBILITY_MAP = {
  clean: ["environment"],
  detailed: ["service"],
  gentle: ["service"],
  polished: ["none"],
  relaxing: ["environment"],
  natural: ["none"],
  glossy: ["none"],
  precise: ["none"],
  lasting: ["none"],
  welcoming: ["service"],
  fresh: ["none"],
  flavorful: ["none"],
  authentic: ["none"],
  generous: ["none"],
  savory: ["none"],
  attentive: ["service"],
  fast: ["service"],
  value: ["none"],
  signature_crab: ["none"],
};

function getReviewLengthBounds(lang) {
  return lang === "en"
    ? { min: 6, max: 50 }
    : { min: 16, max: 78 };
}

const DISH_PROFILE_OVERRIDES = {};

const DISH_PROFILE_RULES = [
  { test: /noodle|面|捞面|汤面|拌面/i, zh: ["面条很劲道", "汤底鲜到上头", "吃着停不下来"], en: ["great noodle bite", "broth was addictive", "hard to stop eating"] },
  { test: /rice|饭|炒饭|泡饭|盖饭/i, zh: ["米饭口感好", "配料给得足", "一口下去很满足"], en: ["rice was fluffy", "toppings were generous", "super satisfying bite"] },
  { test: /bun|包|生煎|小笼|月饼/i, zh: ["外皮酥脆", "馅料很足", "趁热吃真的香"], en: ["wrapper had great texture", "filling was generous", "best while hot"] },
  { test: /dumpling|wonton|饺|馄饨|锅贴|烧卖|shumai/i, zh: ["馅料很鲜", "皮薄馅大", "一口一个停不下来"], en: ["fresh filling", "thin wrapper lots of filling", "addictive little bites"] },
  { test: /seafood|crab|shrimp|fish|lobster|虾|蟹|鱼|龙虾|海鲜/i, zh: ["海鲜很鲜", "蟹味很正", "份量看得见"], en: ["seafood tasted fresh", "crab flavor was legit", "you could see the quality"] },
  { test: /soup|broth|汤|煲|casserole|pot/i, zh: ["汤底很舒服", "热乎乎很暖胃", "鲜掉眉毛"], en: ["comforting broth", "served piping hot", "so comforting"] },
  { test: /tofu|豆腐/i, zh: ["豆腐很嫩", "酱汁很下饭", "口感层次不错"], en: ["silky tofu", "sauce paired perfectly with rice", "nice layers of flavor"] },
  { test: /fried|crispy|煎|炸|脆/i, zh: ["外层很香脆", "火候到位", "吃着不腻"], en: ["crispy outside", "cooked just right", "not greasy at all"] },
  { test: /braised|红烧|酱|sauce|glaze/i, zh: ["酱汁很入味", "味道浓郁", "配饭一绝"], en: ["sauce was rich", "deep flavor", "perfect with rice"] },
  { test: /drink|tea|soda|lemon|饮品|茶|柠檬|金桔|百香果/i, zh: ["饮品很解腻", "甜度刚好", "搭配餐点很顺"], en: ["refreshing drink", "sweetness was just right", "paired well with the meal"] },
  { test: /dessert|甜点|杨枝甘露|mango|red bean|pineapple|莲藕/i, zh: ["甜度刚好", "收尾很舒服", "口感有层次"], en: ["balanced sweetness", "nice finish", "good texture"] },
];

const DISH_PROFILE_FALLBACK = {
  zh: ["味道很稳", "出品在线", "吃着很满足"],
  en: ["solid flavor", "well executed", "really happy with it"],
};

function getRestaurantLabel(store) {
  return [store.nameZh, store.nameEn].filter(Boolean).join(" / ");
}

function getStyleVariant(styleKey) {
  return STYLE_VARIANTS.find(function (variant) {
    return variant.key === styleKey;
  }) || STYLE_VARIANTS[0];
}

function getCardVoiceDirective(styleKey) {
  return CARD_VOICE_DIRECTIVES[styleKey] || CARD_VOICE_DIRECTIVES.review_a;
}

function shuffleArray(values) {
  const next = values.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = temp;
  }
  return next;
}

function sampleRandom(values, count) {
  return shuffleArray(values).slice(0, Math.max(0, Number(count) || 0));
}

function pickRandom(values, fallback) {
  if (!Array.isArray(values) || !values.length) return fallback;
  return values[Math.floor(Math.random() * values.length)] || fallback;
}

function getReviewLengthProfiles(lang) {
  return REVIEW_LENGTH_PROFILES[lang] || REVIEW_LENGTH_PROFILES.zh;
}

function cloneLengthProfileWithOrdinalPrompt(profile, ordinalIndex, lang) {
  const base = String(profile.promptLabel || "").trim();
  const suffixZh =
    ordinalIndex === 0
      ? "（对应 review_a，三条里最短）"
      : ordinalIndex === 1
        ? "（对应 review_b，比 review_a 长、比 review_c 短）"
        : "（对应 review_c，三条里最长）";
  const suffixEn =
    ordinalIndex === 0
      ? " (review_a: shortest of the three)"
      : ordinalIndex === 1
        ? " (review_b: longer than review_a, shorter than review_c)"
        : " (review_c: longest of the three)";
  return Object.assign({}, profile, {
    promptLabel: base + (lang === "en" ? suffixEn : suffixZh),
  });
}

function buildReviewLengthAssignments(lang) {
  const profiles = getReviewLengthProfiles(lang);
  return STYLE_VARIANTS.map(function (variant, index) {
    const profile = profiles[Math.min(index, profiles.length - 1)];
    return {
      styleKey: variant.key,
      profile: cloneLengthProfileWithOrdinalPrompt(profile, index, lang),
    };
  });
}

function getReviewLengthAssignment(styleKey, assignments, lang) {
  const found = (assignments || []).find(function (assignment) {
    return assignment.styleKey === styleKey;
  });
  return found && found.profile ? found.profile : getReviewLengthProfiles(lang)[0];
}

function countReviewLengthUnits(text, lang) {
  const value = String(text || "").trim();
  if (!value) return 0;

  if (lang === "en") {
    const words = value.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*/g);
    return words ? words.length : 0;
  }

  return value
    .replace(/[\s,.!?;:'"(){}\[\]<>/\\|@#$%^&*_+=~`，。！？；：、“”‘’（）【】《》—-]/g, "")
    .length;
}

/** Length of the model-controlled body after stripping the assigned visit prefix (if present). */
function countCoreReviewLength(text, visitTierKey, visitPrefixAssignment, lang) {
  let value = String(text || "").trim();
  if (visitPrefixAssignment && visitPrefixAssignment.prefix) {
    const prefix = String(visitPrefixAssignment.prefix || "").trim();
    if (prefix) {
      const separator = lang === "zh" ? "" : " ";
      const lead = (prefix + separator).trim();
      if (value.indexOf(lead) === 0) {
        value = value.slice(lead.length).trim();
      }
    }
  }
  return countReviewLengthUnits(value, lang);
}

function getReviewKeywordText(keyword, lang) {
  if (!keyword || typeof keyword !== "object") return "";
  return String(lang === "en" ? keyword.textEn || keyword.textZh : keyword.textZh || keyword.textEn || "").trim();
}

function getKeywordRealizationOptions(keyword, lang) {
  if (!keyword) return [];
  const mapKey = String(keyword.key || "").trim();
  const mapped = KEYWORD_REALIZATION_MAP[mapKey];
  const options = mapped && Array.isArray(mapped[lang === "en" ? "en" : "zh"])
    ? mapped[lang === "en" ? "en" : "zh"]
    : [];
  return uniqueArray(options.concat(getReviewKeywordText(keyword, lang)).filter(Boolean)).slice(0, 3);
}

function getActiveReviewKeywords(store, lang) {
  const keywordMap = new Map();

  (Array.isArray(store && store.reviewKeywords) ? store.reviewKeywords : [])
    .filter(function (keyword) {
      return keyword && keyword.enabled !== false;
    })
    .forEach(function (keyword) {
      const text = getReviewKeywordText(keyword, lang);
      if (!text) return;

      const key = String(keyword.key || normalizeText(text)).trim() || normalizeText(text);
      if (!key || keywordMap.has(key)) return;

      keywordMap.set(key, {
        key: key,
        text: text,
        weight: Number.isFinite(Number(keyword.weight)) ? Number(keyword.weight) : 1,
      });
    });

  return Array.from(keywordMap.values());
}

function getKeywordLengthFitScore(keywordText, profile, lang) {
  const units = countReviewLengthUnits(keywordText, lang);
  const isShort = profile && profile.key === "short_30";
  const isMid = profile && (profile.key === "mid_30_50" || profile.key === "mid_30_100");

  if (lang === "en") {
    if (isShort) {
      if (units <= 2) return 0.45;
      if (units <= 3) return 0.2;
      return -0.3;
    }
    if (isMid) {
      if (units <= 3) return 0.25;
      if (units <= 4) return 0.12;
      return -0.08;
    }
    if (units <= 4) return 0.18;
    return 0;
  }

  if (isShort) {
    if (units <= 3) return 0.45;
    if (units <= 5) return 0.18;
    return -0.3;
  }
  if (isMid) {
    if (units <= 4) return 0.28;
    if (units <= 6) return 0.12;
    return -0.08;
  }
  if (units <= 6) return 0.18;
  return 0;
}

function isKeywordCompatibleWithFocus(keyword, focus) {
  const keywordKey = String(keyword && keyword.key || "").trim();
  const compatibleFocuses = KEYWORD_FOCUS_COMPATIBILITY_MAP[keywordKey];

  if (!compatibleFocuses || !compatibleFocuses.length) {
    return true;
  }

  return compatibleFocuses.indexOf(focus) !== -1;
}

function buildKeywordAssignments(reviewKeywords, focusAssignments, lengthAssignments, lang) {
  if (!reviewKeywords.length) return [];

  const usedPrimaryKeys = [];
  return STYLE_VARIANTS.map(function (variant) {
    const focus = getAssignedFocus(variant.key, focusAssignments);
    const profile = getReviewLengthAssignment(variant.key, lengthAssignments, lang);
    const compatibleKeywords = reviewKeywords.filter(function (keyword) {
      return isKeywordCompatibleWithFocus(keyword, focus);
    });
    if (!compatibleKeywords.length) {
      return {
        styleKey: variant.key,
        primaryKeyword: "",
        keywordKey: "",
        naturalPhrases: [],
        candidates: [],
        allowSecondKeyword: false,
      };
    }
    const ranked = compatibleKeywords
      .map(function (keyword) {
        return Object.assign({}, keyword, {
          score:
            keyword.weight +
            getKeywordLengthFitScore(keyword.text, profile, lang) +
            (usedPrimaryKeys.indexOf(keyword.key) === -1 ? 0.12 : -0.08) +
            Math.random() * 0.2,
        });
      })
      .sort(function (left, right) {
        return right.score - left.score;
      });

    const primary = ranked[0] || null;
    if (primary) usedPrimaryKeys.push(primary.key);

    return {
      styleKey: variant.key,
      primaryKeyword: primary ? primary.text : "",
      keywordKey: primary ? primary.key : "",
      naturalPhrases: primary ? getKeywordRealizationOptions(primary, lang) : [],
      candidates: ranked.slice(0, Math.min(4, ranked.length)).map(function (keyword) {
        return keyword.text;
      }),
      allowSecondKeyword: profile && profile.key !== "short_30",
    };
  });
}

function getKeywordAssignment(styleKey, assignments) {
  return (assignments || []).find(function (assignment) {
    return assignment.styleKey === styleKey;
  }) || null;
}

function buildStoreKeywordLexiconLine(reviewKeywords, lang) {
  return reviewKeywords
    .map(function (keyword) {
      return keyword.text;
    })
    .join(lang === "en" ? ", " : "、");
}

function buildKeywordRuleLines(keywordAssignments, lang) {
  return STYLE_VARIANTS.map(function (variant, index) {
    const assignment = getKeywordAssignment(variant.key, keywordAssignments);
    if (!assignment || !assignment.candidates.length) return null;

    if (lang === "zh") {
      return (
        index +
        1 +
        ". 卡片 " +
        (index + 1) +
        " 关键词概念优先围绕「" +
        assignment.primaryKeyword +
        "」，口语说法可参考：" +
        assignment.naturalPhrases.join("、") +
        "。必须自然带入至少 1 个，且要和具体菜名出现在同一条里；" +
        (assignment.allowSecondKeyword ? "篇幅够时可顺带第 2 个，别堆成关键词清单。" : "短评优先只放 1 个，顺口第一。")
      );
    }

    return (
      index +
      1 +
      ". Card " +
      (index + 1) +
      " should realize the concept " +
      assignment.primaryKeyword +
      ". Prefer casual wording such as " +
      assignment.naturalPhrases.join(", ") +
      ". Include at least one naturally in the same review as a specific dish name; " +
      (assignment.allowSecondKeyword
        ? "a second keyword is fine if it still reads like a real person talking."
        : "one keyword is enough if it keeps the review easy to post.")
    );
  })
    .filter(Boolean)
    .join("\n");
}

function reviewContainsKeyword(text, reviewKeywords) {
  const normalizedText = normalizeText(text);
  return reviewKeywords.some(function (keyword) {
    return normalizedText.indexOf(normalizeText(keyword.text)) !== -1;
  });
}

function reviewMatchesKeywordAssignment(text, keywordAssignment) {
  if (!keywordAssignment) return true;
  const normalizedText = normalizeText(text);
  const phrases = []
    .concat(keywordAssignment.primaryKeyword || [])
    .concat(keywordAssignment.naturalPhrases || [])
    .concat(keywordAssignment.candidates || []);
  return uniqueArray(
    phrases
      .map(function (phrase) {
        return normalizeText(phrase);
      })
      .filter(Boolean),
  ).some(function (phrase) {
    return normalizedText.indexOf(phrase) !== -1;
  });
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function choosePatternKey(focus, visitTierKey, hasServicePraise) {
  if (focus === "service") {
    return "staff_led";
  }
  if (focus === "environment") {
    return visitTierKey === "first_time" ? "first_time_surprise" : "repeat_customer";
  }
  return "service_result";
}

function getProofTypeOptions(focus) {
  if (focus === "service") return ["skill", "warmth"];
  if (focus === "environment") return ["cleanliness", "relaxation"];
  return ["result"];
}

function chooseClosingType(styleKey, visitTierKey) {
  if (styleKey === "review_a") return "satisfaction";
  if (visitTierKey === "regular" || visitTierKey === "few_times") {
    return styleKey === "review_b" ? "loyalty" : "recommend";
  }
  return styleKey === "review_b" ? "recommend" : "satisfaction";
}

function buildPatternAssignments(focusAssignments, visitTierKey, servicePraise) {
  return STYLE_VARIANTS.map(function (variant) {
    const focus = getAssignedFocus(variant.key, focusAssignments);
    return {
      styleKey: variant.key,
      patternKey: choosePatternKey(focus, visitTierKey, !!servicePraise),
      proofKey: pickRandom(getProofTypeOptions(focus), "result"),
      closingKey: chooseClosingType(variant.key, visitTierKey),
    };
  });
}

function getPatternAssignment(styleKey, assignments) {
  return (assignments || []).find(function (assignment) {
    return assignment.styleKey === styleKey;
  }) || null;
}

function buildSurfaceAssignments(lang) {
  return STYLE_VARIANTS.map(function (variant) {
    return {
      styleKey: variant.key,
      startKey: "normal_start",
      endKey: "standard",
    };
  });
}

function getSurfaceAssignment(styleKey, assignments) {
  return (assignments || []).find(function (assignment) {
    return assignment.styleKey === styleKey;
  }) || null;
}

function buildAvoidFragments(recentTexts, lang) {
  const fragments = [];
  (recentTexts || []).slice(-3).forEach(function (text) {
    const value = String(text || "").trim();
    if (!value) return;
    if (lang === "en") {
      const words = value.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*/g) || [];
      if (words.length >= 3) fragments.push(words.slice(0, 4).join(" "));
      if (words.length >= 6) fragments.push(words.slice(-3).join(" "));
      return;
    }
    const compact = value.replace(/\s+/g, "");
    if (compact.length >= 6) {
      fragments.push(compact.slice(0, 8));
    }
  });
  return uniqueArray(fragments.filter(Boolean)).slice(0, 5);
}

function lowercaseFirstAlphabetic(text) {
  return String(text || "").replace(/[A-Z]/, function (match) {
    return match.toLowerCase();
  });
}

function stripTerminalPunctuation(text) {
  return String(text || "").replace(/[\s]+$/, "").replace(/[.!?。！？]+$/u, "");
}

function applySurfaceStyleToReviews(reviews, surfaceAssignments, lang) {
  return (reviews || []).map(function (review) {
    const assignment = getSurfaceAssignment(review.styleKey, surfaceAssignments);
    if (!assignment) return review;
    let text = String(review.text || "");
    if (lang === "en" && assignment.startKey === "lowercase_start") {
      text = lowercaseFirstAlphabetic(text);
    }
    if (assignment.endKey === "no_terminal_punctuation") {
      text = stripTerminalPunctuation(text);
    }
    return Object.assign({}, review, {
      text: text.trim(),
    });
  });
}

function buildFocusAssignments() {
  const shuffled = shuffleArray(REVIEW_FOCUS_TYPES);
  return STYLE_VARIANTS.map(function (variant, index) {
    return {
      styleKey: variant.key,
      focus: shuffled[index],
    };
  });
}

function getAssignedFocus(styleKey, assignments) {
  const found = (assignments || []).find(function (assignment) {
    return assignment.styleKey === styleKey;
  });
  return found ? found.focus : "none";
}

function getFocusRule(focusKey) {
  return FOCUS_RULES[focusKey] || FOCUS_RULES.none;
}

function getVisitTierOption(key) {
  return VISIT_TIER_OPTIONS.find(function (option) {
    return option.key === key;
  }) || null;
}

function buildVisitPrefixAssignments(visitTierKey, lang) {
  const option = getVisitTierOption(visitTierKey);
  if (!option) return [];
  const prefixes = shuffleArray((lang === "zh" ? option.zhPrefixes : option.enPrefixes).slice());
  return STYLE_VARIANTS.map(function (variant, index) {
    return {
      styleKey: variant.key,
      prefix: prefixes[index % prefixes.length],
    };
  });
}

function getVisitPrefixAssignment(styleKey, assignments) {
  return (assignments || []).find(function (assignment) {
    return assignment.styleKey === styleKey;
  }) || null;
}

function buildDishSelectionAssignments(dishIds) {
  const uniqueDishIds = uniqueArray((dishIds || []).map(function (dishId) {
    return Number(dishId);
  }).filter(function (dishId) {
    return Number.isFinite(dishId) && dishId > 0;
  }));

  return STYLE_VARIANTS.map(function (variant, index) {
    if (!uniqueDishIds.length) {
      return {
        styleKey: variant.key,
        dishIds: [],
      };
    }

    if (uniqueDishIds.length === 1) {
      return {
        styleKey: variant.key,
        dishIds: uniqueDishIds.slice(),
      };
    }

    if (uniqueDishIds.length === 2) {
      if (index === 0) {
        return { styleKey: variant.key, dishIds: [uniqueDishIds[0]] };
      }
      if (index === 1) {
        return { styleKey: variant.key, dishIds: [uniqueDishIds[1]] };
      }
      return { styleKey: variant.key, dishIds: uniqueDishIds.slice() };
    }

    if (index === 0) {
      return { styleKey: variant.key, dishIds: [uniqueDishIds[0]] };
    }
    if (index === 1) {
      return { styleKey: variant.key, dishIds: [uniqueDishIds[1]] };
    }
    return {
      styleKey: variant.key,
      dishIds: [uniqueDishIds[2], uniqueDishIds[0]],
    };
  });
}

function getDishSelectionAssignment(styleKey, assignments, fallbackDishIds) {
  const found = (assignments || []).find(function (assignment) {
    return assignment.styleKey === styleKey;
  });
  if (found && found.dishIds && found.dishIds.length) return found.dishIds.slice();
  return (fallbackDishIds || []).slice();
}

function getServicePraiseOption(key) {
  return SERVICE_PRAISE_OPTIONS.find(function (option) {
    return option.key === key;
  }) || SERVICE_PRAISE_OPTIONS[0];
}

function getDefaultServiceStaffLabel(lang) {
  return lang === "zh" ? "老师" : "staff";
}

function getResolvedServiceStaffLabel(rawValue, lang) {
  const explicitLabel = String(rawValue || "").trim();
  return explicitLabel || getDefaultServiceStaffLabel(lang);
}

function reviewMentionsVisitContext(text, visitTierKey, lang) {
  const option = getVisitTierOption(visitTierKey);
  if (!option) return true;
  return (lang === "zh" ? option.zhPattern : option.enPattern).test(String(text || ""));
}

function applyVisitContextToReviews(reviews, visitTierKey, lang) {
  const option = getVisitTierOption(visitTierKey);
  if (!option) return reviews;

  const prefixes = lang === "zh" ? option.zhPrefixes : option.enPrefixes;
  return reviews.map(function (review, index) {
    if (reviewMentionsVisitContext(review.text, visitTierKey, lang)) return review;
    return Object.assign({}, review, {
      text: prefixes[index % prefixes.length] + " " + review.text,
    });
  });
}

function stripLeadingVisitSentence(text, visitTierKey, lang) {
  const value = String(text || "").trim();
  if (!value) return value;

  const sentenceMatch = value.match(/^(.+?[。！？.!?])\s*(.*)$/u);
  if (sentenceMatch && reviewMentionsVisitContext(sentenceMatch[1], visitTierKey, lang)) {
    return String(sentenceMatch[2] || "").trim();
  }

  const option = getVisitTierOption(visitTierKey);
  if (!option) return value;

  const prefixes = (lang === "zh" ? option.zhPrefixes : option.enPrefixes).slice();
  for (const prefix of prefixes) {
    if (!prefix) continue;
    if (value.indexOf(prefix) === 0) {
      return value.slice(prefix.length).trim();
    }
  }

  return value;
}

function stripVisitContextEverywhere(text, visitTierKey, lang) {
  const option = getVisitTierOption(visitTierKey);
  let value = String(text || "").trim();
  if (!option || !value) return value;

  const prefixes = (lang === "zh" ? option.zhPrefixes : option.enPrefixes).slice();
  prefixes.forEach(function (prefix) {
    const base = stripTerminalPunctuation(prefix);
    if (!base) return;
    const pattern = new RegExp(escapeRegex(base) + "[.!?。！？]?", lang === "en" ? "gi" : "g");
    value = value.replace(pattern, " ");
  });

  const fragments = value
    .split(/(?<=[。！？.!?])\s*|\n+/u)
    .map(function (part) {
      return String(part || "").trim();
    })
    .filter(Boolean)
    .filter(function (part) {
      return !reviewMentionsVisitContext(part, visitTierKey, lang);
    });

  value = fragments.join(lang === "zh" ? "" : " ");

  if (lang === "zh") {
    return value
      .replace(/\s+/g, "")
      .replace(/^[，。！？]+/u, "")
      .trim();
  }

  return value
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^[,.;!?]+/u, "")
    .trim();
}

function applyAssignedVisitPrefix(review, visitPrefixAssignment, visitTierKey, lang) {
  if (!visitPrefixAssignment || !visitPrefixAssignment.prefix) return review;
  const prefix = String(visitPrefixAssignment.prefix || "").trim();
  if (!prefix) return review;

  const strippedBody = stripVisitContextEverywhere(review.text, visitTierKey, lang);
  const nextBody = strippedBody || String(review.text || "").trim();
  const separator = lang === "zh" ? "" : " ";
  const mergedText = (prefix + separator + nextBody).trim();

  return Object.assign({}, review, {
    text: mergedText,
  });
}

function normalizeSimilarityBody(text, visitTierKey, lang) {
  const body = String(stripLeadingVisitSentence(text, visitTierKey, lang) || "").trim().toLowerCase();
  if (!body) return "";

  if (lang === "en") {
    return body
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return body.replace(/[\s,.!?;:'"(){}\[\]<>/\\|@#$%^&*_+=~`，。！？；：、“”‘’（）【】《》—-]+/g, "");
}

function getReviewSimilarityLead(text, visitTierKey, lang) {
  const body = normalizeSimilarityBody(text, visitTierKey, lang);
  if (!body) return "";
  if (lang === "en") {
    return body.split(/\s+/).slice(0, 5).join(" ");
  }
  return body.slice(0, 10);
}

function getReviewSimilarityUnits(text, visitTierKey, lang) {
  const body = normalizeSimilarityBody(text, visitTierKey, lang);
  if (!body) return [];

  if (lang === "en") {
    return uniqueArray(body.split(/\s+/).filter(Boolean));
  }

  const units = [];
  if (body.length < 2) return [body];
  for (let index = 0; index < body.length - 1; index += 1) {
    units.push(body.slice(index, index + 2));
  }
  return uniqueArray(units);
}

function splitReviewFragments(text) {
  return String(text || "")
    .split(/(?<=[。！？.!?])\s*|[,;，、]\s*|\n+/u)
    .map(function (part) {
      return String(part || "").trim();
    })
    .filter(Boolean);
}

function hasDuplicateReviewFragment(text, lang) {
  const minLength = lang === "zh" ? 6 : 18;
  const seen = new Set();

  return splitReviewFragments(text).some(function (fragment) {
    const normalized = normalizeText(stripTerminalPunctuation(fragment));
    if (!normalized || normalized.length < minLength) return false;
    if (seen.has(normalized)) return true;
    seen.add(normalized);
    return false;
  });
}

function hasRepeatedWordWindow(text) {
  const words = String(text || "")
    .toLowerCase()
    .match(/[a-z0-9]+(?:'[a-z0-9]+)*/g) || [];

  for (let size = 6; size >= 4; size -= 1) {
    const seen = new Set();
    for (let index = 0; index <= words.length - size; index += 1) {
      const segment = words.slice(index, index + size).join(" ");
      if (segment.length < 20) continue;
      if (seen.has(segment)) return true;
      seen.add(segment);
    }
  }

  return false;
}

function hasRepeatedCharacterWindow(text) {
  const compact = normalizeText(text);
  for (let size = 10; size >= 8; size -= 1) {
    const seen = new Set();
    for (let index = 0; index <= compact.length - size; index += 1) {
      const segment = compact.slice(index, index + size);
      if (seen.has(segment)) return true;
      seen.add(segment);
    }
  }
  return false;
}

function reviewHasInternalDuplication(text, lang) {
  if (hasDuplicateReviewFragment(text, lang)) return true;
  return lang === "zh" ? hasRepeatedCharacterWindow(text) : hasRepeatedWordWindow(text);
}

function getCommonPrefixLength(left, right) {
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

function computeJaccardSimilarity(leftUnits, rightUnits) {
  const leftSet = new Set(leftUnits || []);
  const rightSet = new Set(rightUnits || []);
  if (!leftSet.size || !rightSet.size) return 0;

  let intersection = 0;
  leftSet.forEach(function (unit) {
    if (rightSet.has(unit)) intersection += 1;
  });

  const union = leftSet.size + rightSet.size - intersection;
  return union ? intersection / union : 0;
}

function areReviewsTooSimilar(leftText, rightText, visitTierKey, lang) {
  const leftBody = normalizeSimilarityBody(leftText, visitTierKey, lang);
  const rightBody = normalizeSimilarityBody(rightText, visitTierKey, lang);
  if (!leftBody || !rightBody) return false;
  if (leftBody === rightBody) return true;

  const leadMatches = getReviewSimilarityLead(leftText, visitTierKey, lang) === getReviewSimilarityLead(rightText, visitTierKey, lang);
  const prefixLength = getCommonPrefixLength(leftBody, rightBody);
  const similarity = computeJaccardSimilarity(
    getReviewSimilarityUnits(leftText, visitTierKey, lang),
    getReviewSimilarityUnits(rightText, visitTierKey, lang),
  );

  if (lang === "zh") {
    if (prefixLength >= 10) return true;
    if (leadMatches && similarity >= 0.42) return true;
    return similarity >= 0.72;
  }

  if (prefixLength >= 28) return true;
  if (leadMatches && similarity >= 0.45) return true;
  return similarity >= 0.74;
}

function getSimilarReviewStyleKeys(reviews, visitTierKey, lang) {
  const conflicted = new Set();

  for (let leftIndex = 0; leftIndex < reviews.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < reviews.length; rightIndex += 1) {
      if (areReviewsTooSimilar(reviews[leftIndex].text, reviews[rightIndex].text, visitTierKey, lang)) {
        conflicted.add(reviews[leftIndex].styleKey);
        conflicted.add(reviews[rightIndex].styleKey);
      }
    }
  }

  return Array.from(conflicted);
}

function applyServicePraiseToReviews(reviews, servicePraise, lang) {
  if (!servicePraise) return reviews;

  const staffLabel = getResolvedServiceStaffLabel(servicePraise.staffLabel, lang);
  const option = getServicePraiseOption(servicePraise.praiseKey);
  return reviews.map(function (review) {
    if (review.focus !== "service") return review;
    if (normalizeText(review.text).indexOf(normalizeText(staffLabel)) !== -1) return review;

    const sentence =
      lang === "zh"
        ? "也想夸夸" + staffLabel + "，人很" + option.zhPhrase + "。"
        : " " + staffLabel + " was " + option.enPhrase + " too.";

    return Object.assign({}, review, {
      text: review.text + sentence,
    });
  });
}

function buildDishProfile(item) {
  const override = DISH_PROFILE_OVERRIDES[item.uqid];
  if (override) {
    return {
      zh: override.zh.slice(0, 3),
      en: override.en.slice(0, 3),
    };
  }

  const textBlob = [item.zh, item.en, item.ingr, item.categoryName].join(" ");
  const zhAnchors = [];
  const enAnchors = [];

  DISH_PROFILE_RULES.forEach(function (rule) {
    if (!rule.test.test(textBlob)) return;
    rule.zh.forEach(function (text) {
      if (zhAnchors.length < 3 && zhAnchors.indexOf(text) === -1) zhAnchors.push(text);
    });
    rule.en.forEach(function (text) {
      if (enAnchors.length < 3 && enAnchors.indexOf(text) === -1) enAnchors.push(text);
    });
  });

  DISH_PROFILE_FALLBACK.zh.forEach(function (text) {
    if (zhAnchors.length < 3 && zhAnchors.indexOf(text) === -1) zhAnchors.push(text);
  });
  DISH_PROFILE_FALLBACK.en.forEach(function (text) {
    if (enAnchors.length < 3 && enAnchors.indexOf(text) === -1) enAnchors.push(text);
  });

  return {
    zh: zhAnchors.slice(0, 3),
    en: enAnchors.slice(0, 3),
  };
}

function buildFlavorHintBlock(lang) {
  const bank = REVIEW_SPICE_BANK[lang === "en" ? "en" : "zh"] || [];
  const samples = sampleRandom(bank, 3);
  if (!samples.length) return "";
  if (lang === "zh") {
    return (
      "\n口语灵感（每条最多借鉴一个说法，别照抄）：" +
      samples.join("、") +
      "\n"
    );
  }
  return (
    "\nCasual phrase sparks (use at most one idea per review, do not copy verbatim): " +
    samples.join(", ") +
    "\n"
  );
}

function dishPromptLines(menuContext, dishIds, lang) {
  return dishIds
    .map(function (dishId) {
      const item = menuContext.dishMap.get(dishId);
      if (!item) return null;
      const profile = buildDishProfile(item);
      const praise = (lang === "zh" ? profile.zh : profile.en).join(lang === "zh" ? "、" : ", ");
      return lang === "zh"
        ? "- " +
            item.zh +
            "：评论里必须自然点到这道菜（菜名太长就用食客会说的简称），夸赞可围绕「" +
            praise +
            "」，并把本条分配的关键词概念口语化融进去"
        : '- "' +
            item.en +
            '": name this dish naturally (shorten long menu titles the way diners talk); anchor praise on "' +
            praise +
            '" and weave in the assigned keyword concept in casual wording';
    })
    .filter(Boolean)
    .join("\n");
}

function reviewSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: REVIEW_SCHEMA_NAME,
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          reviews: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                style_key: {
                  type: "string",
                  enum: STYLE_VARIANTS.map(function (variant) {
                    return variant.key;
                  }),
                },
                text: { type: "string" },
              },
              required: ["style_key", "text"],
            },
          },
        },
        required: ["reviews"],
      },
    },
  };
}

function singleReviewSchema(styleKey) {
  return {
    type: "json_schema",
    json_schema: {
      name: REVIEW_SCHEMA_NAME + "_" + styleKey,
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          style_key: {
            type: "string",
            enum: [styleKey],
          },
          text: { type: "string" },
        },
        required: ["style_key", "text"],
      },
    },
  };
}

function buildReviewCardPlan(styleKey, lang, focusAssignments, lengthAssignments, keywordAssignments, patternAssignments, surfaceAssignments, visitPrefixAssignments, dishSelectionAssignments) {
  const variant = getStyleVariant(styleKey);
  const voiceDirective = getCardVoiceDirective(styleKey);
  const focusKey = getAssignedFocus(styleKey, focusAssignments);
  const lengthRule = getReviewLengthAssignment(styleKey, lengthAssignments, lang);
  const keywordAssignment = getKeywordAssignment(styleKey, keywordAssignments);
  const patternAssignment = getPatternAssignment(styleKey, patternAssignments) || {};
  const patternRule = REVIEW_PATTERN_TYPES[patternAssignment.patternKey] || REVIEW_PATTERN_TYPES.service_result;
  const proofRule = REVIEW_PROOF_TYPES[patternAssignment.proofKey] || REVIEW_PROOF_TYPES.result;
  const closingRule = REVIEW_CLOSING_TYPES[patternAssignment.closingKey] || REVIEW_CLOSING_TYPES.satisfaction;
  const surfaceRule = getSurfaceAssignment(styleKey, surfaceAssignments) || {
    startKey: "normal_start",
    endKey: "standard",
  };
  const startRule = SURFACE_START_TYPES[surfaceRule.startKey] || SURFACE_START_TYPES.normal_start;
  const endRule = SURFACE_END_TYPES[surfaceRule.endKey] || SURFACE_END_TYPES.standard;
  const visitPrefixAssignment = getVisitPrefixAssignment(styleKey, visitPrefixAssignments);
  const selectedDishIds = getDishSelectionAssignment(styleKey, dishSelectionAssignments, []);

  return {
    variant: variant,
    voiceDirective: voiceDirective,
    styleKey: styleKey,
    focusKey: focusKey,
    lengthRule: lengthRule,
    keywordAssignment: keywordAssignment,
    patternAssignment: patternAssignment,
    patternRule: patternRule,
    proofRule: proofRule,
    closingRule: closingRule,
    surfaceRule: surfaceRule,
    startRule: startRule,
    endRule: endRule,
    visitPrefixAssignment: visitPrefixAssignment,
    selectedDishIds: selectedDishIds,
  };
}

function buildSingleReviewMessages(store, menuContext, dishIds, lang, recentTexts, retryLevel, visitTierKey, servicePraise, cardPlan, extraAvoidTexts) {
  const effectiveDishIds = (cardPlan.selectedDishIds && cardPlan.selectedDishIds.length ? cardPlan.selectedDishIds : dishIds).slice();
  const sortedDishIds = effectiveDishIds.sort(function (a, b) {
    return a - b;
  });
  const dishLines = dishPromptLines(menuContext, sortedDishIds, lang);
  const visitTier = getVisitTierOption(visitTierKey);
  const avoidFragments = buildAvoidFragments([].concat(recentTexts || [], extraAvoidTexts || []), lang);
  const servicePraiseOption = servicePraise ? getServicePraiseOption(servicePraise.praiseKey) : null;
  const serviceStaffLabel = servicePraise ? getResolvedServiceStaffLabel(servicePraise.staffLabel, lang) : "";
  const keywordLine =
    cardPlan.keywordAssignment && cardPlan.keywordAssignment.primaryKeyword
      ? lang === "zh"
        ? "关键词概念=" +
          cardPlan.keywordAssignment.primaryKeyword +
          " | 口语说法=" +
          cardPlan.keywordAssignment.naturalPhrases.join("、")
        : "keyword concept=" +
          cardPlan.keywordAssignment.primaryKeyword +
          " | casual realizations=" +
          cardPlan.keywordAssignment.naturalPhrases.join(", ")
      : lang === "zh"
        ? "关键词概念=无额外要求"
        : "keyword concept=none";
  const flavorBlock = buildFlavorHintBlock(lang);

  if (lang === "zh") {
    return {
      system:
        "你只写 1 条像真实华人食客刚吃完、掏出手机顺手发的 Google Maps 短评。口语、有画面感，可用当下流行的夸法（如很绝、很能打、超预期、上头、扎实、没踩雷），但不要写成网红通稿或广告。必须自然提到具体菜名，并把关键词概念融进句子里。只返回 JSON。",
      user:
        "店铺：" +
        store.nameZh +
        "\n输出语言：中文\nstyle_key=" +
        cardPlan.styleKey +
        "\n来店信息：" +
        (visitTier ? visitTier.zhLabel : "未提供") +
        "\n本次菜品：\n" +
        dishLines +
        "\n\n本条卡片要求：\n" +
        "语气=" +
        cardPlan.variant.zhLabel +
        " | 结构=" +
        cardPlan.patternRule.zhLabel +
        " | 句式角度=" +
        cardPlan.voiceDirective.zhLabel +
        " | 焦点=" +
        describeFocusDirective(cardPlan.focusKey, lang) +
        " | 长度=" +
        cardPlan.lengthRule.promptLabel +
        " | proof=" +
        cardPlan.proofRule.zhLabel +
        " | 收尾=" +
        cardPlan.closingRule.zhLabel +
        " | " +
        keywordLine +
        " | 开头=" +
        cardPlan.startRule.zhLabel +
        " | 结尾=" +
        cardPlan.endRule.zhLabel +
        "\n" +
        (servicePraise && cardPlan.focusKey === "service"
          ? "如果这条写 staff，请明确提到" + serviceStaffLabel + "，并自然带出“" + servicePraiseOption.zhLabel + "”。\n"
          : "") +
        "这条自己的句式要求：" + cardPlan.voiceDirective.zhRule + "\n" +
        flavorBlock +
        "\n规则：\n" +
        "0. 同一套三条是「短 / 中 / 长」排版：review_a=短、review_b=中、review_c=长。三条一起发时，读者要能一眼看出越来越长，不要三条差不多长。\n" +
        "0b. 长度硬指标（只统计你写的正文里有效汉字数，不计空格与常见标点；若句首出现到店语境短句可忽略其字数）：本条必须在 " +
        cardPlan.lengthRule.min +
        "～" +
        cardPlan.lengthRule.max +
        " 字之间；少于此下限或多于此上限都视为失败。宁可在区间内略短，也不要超出上限。\n" +
        "1. 只返回一个 JSON 对象，字段必须是 style_key 和 text。\n" +
        "2. 必须自然写出至少 1 个具体菜名（可用简称，如蟹黄捞面、小笼、鲜肉月饼），不要只写「这道菜」「点的菜」。\n" +
        "2b. 必须把本条关键词概念用口语说法融进去，不要生硬贴字面词。\n" +
        "3. 不要用 emoji、井号、引号、项目符号，也不要在正文里用冒号或破折号。\n" +
        "4. 如果关键词像营销词，改写成真人会说的夸法。\n" +
        "5. 不要在同一条评论里重复同一句话、同一个回访表达，或把开头意思在结尾再说一遍。\n" +
        (avoidFragments.length ? "6. 尽量别复用这些旧说法：" + avoidFragments.join("、") + "。\n" : "") +
        (retryLevel > 0 ? (avoidFragments.length ? "7." : "6.") + " 上一轮不够口语，这一轮更像随手发、更真实。\n" : ""),
    };
  }

  return {
    system:
      "Write exactly one believable first-person Google Maps restaurant review. Sound like a real diner typing right after the meal—casual, specific, a little trendy when it fits (hits different, lowkey fire, no notes), but never like ad copy or an SEO checklist. Name the actual dish and weave in the keyword concept naturally. Return JSON only.",
    user:
      "Restaurant: " +
      getRestaurantLabel(store) +
      "\nOutput language: English\nstyle_key=" +
      cardPlan.styleKey +
      "\nVisit context: " +
      (visitTier ? visitTier.enLabel : "Not provided") +
      "\nServices from this visit:\n" +
      dishLines +
      "\n\nCard requirements:\n" +
      "tone=" +
      cardPlan.variant.enLabel +
      " | pattern=" +
      cardPlan.patternRule.enLabel +
      " | voice angle=" +
      cardPlan.voiceDirective.enLabel +
      " | focus=" +
      describeFocusDirective(cardPlan.focusKey, lang) +
      " | length=" +
      cardPlan.lengthRule.promptLabel +
      " | proof=" +
      cardPlan.proofRule.enLabel +
      " | close=" +
      cardPlan.closingRule.enLabel +
      " | " +
      keywordLine +
      " | opening=" +
      cardPlan.startRule.enLabel +
      " | ending=" +
      cardPlan.endRule.enLabel +
      "\n" +
      (servicePraise && cardPlan.focusKey === "service"
        ? "If this review is staff-focused, explicitly mention " + serviceStaffLabel + " and land the praise naturally as " + servicePraiseOption.enLabel + ".\n"
        : "") +
      "This card's own phrasing goal: " + cardPlan.voiceDirective.enRule + "\n" +
      flavorBlock +
      "\nRules:\n" +
      "0. The three reviews are a short / medium / long layout: review_a = short, review_b = medium, review_c = long. A reader skimming the set should immediately see length stepping up; do not make all three feel the same size.\n" +
      "0b. Hard length quota (count whole words made of letters/digits; ignore leading visit-context clause if you add one): stay between " +
      cardPlan.lengthRule.min +
      " and " +
      cardPlan.lengthRule.max +
      " words inclusive. Falling below the minimum or exceeding the maximum is a failure. Prefer staying inside the band rather than drifting long.\n" +
      "1. Return exactly one JSON object with only style_key and text.\n" +
      "2. Name at least one specific dish naturally (shorten long menu titles). Do not say only \"the dish\" or \"what we ordered\".\n" +
      "2b. Weave in the assigned keyword concept in casual customer wording, not stiff marketing language.\n" +
      "3. Mention at most 1 or 2 dishes total.\n" +
      "4. No emoji, hashtags, quote marks, bullets, colons, or dashes inside the review text.\n" +
      "5. If a keyword sounds stiff, translate it into how a real diner would say it.\n" +
      "6. Do not repeat the same clause, visit wording, or opening idea twice inside one review.\n" +
      (avoidFragments.length ? "7. Avoid sounding too close to these earlier fragments: " + avoidFragments.join("; ") + ".\n" : "") +
      (retryLevel > 0 ? (avoidFragments.length ? "8." : "7.") + " The last attempt was too stiff. Make this one more casual, specific, and easy to post.\n" : ""),
  };
}

function describeFocusDirective(focusKey, lang) {
  if (lang === "zh") {
    if (focusKey === "service") return "必须提 staff、服务、上菜或沟通；不要提干净、环境、氛围、空间。";
    if (focusKey === "environment") return "必须提干净、舒服、氛围或用餐空间；不要提 staff、服务员或具体人名。";
    return "只写菜品或饮品本身、味道、口感、分量或出品；不要提 staff，也不要提干净、欢迎感、放松氛围或空间。";
  }
  if (focusKey === "service") {
    return "Must mention the person, staff care, hospitality, or communication. Do not mention cleanliness, atmosphere, decor, the place, or the restaurant setting.";
  }
  if (focusKey === "environment") {
    return "Must mention cleanliness, comfort, atmosphere, or the restaurant setting. Do not mention staff, attentiveness, service speed, or any named person.";
  }
  return "Food or drink only. Mention flavor, texture, portion, freshness, or how the meal came out. Do not mention staff, friendliness, patience, cleanliness, welcoming, comfort, atmosphere, or the restaurant setting.";
}

function buildReviewMessages(store, menuContext, dishIds, lang, recentTexts, retryLevel, focusAssignments, lengthAssignments, visitTierKey, servicePraise, keywordAssignments, patternAssignments, surfaceAssignments) {
  const sortedDishIds = dishIds.slice().sort(function (a, b) {
    return a - b;
  });
  const dishLines = dishPromptLines(menuContext, sortedDishIds, lang);
  const visitTier = getVisitTierOption(visitTierKey);
  const servicePraiseOption = servicePraise ? getServicePraiseOption(servicePraise.praiseKey) : null;
  const serviceStaffLabel = servicePraise ? getResolvedServiceStaffLabel(servicePraise.staffLabel, lang) : "";
  const avoidFragments = buildAvoidFragments(recentTexts, lang);
  const variantLines = STYLE_VARIANTS.map(function (variant, index) {
    const focusKey = getAssignedFocus(variant.key, focusAssignments);
    const lengthRule = getReviewLengthAssignment(variant.key, lengthAssignments, lang);
    const keywordAssignment = getKeywordAssignment(variant.key, keywordAssignments);
    const patternAssignment = getPatternAssignment(variant.key, patternAssignments) || {};
    const patternRule = REVIEW_PATTERN_TYPES[patternAssignment.patternKey] || REVIEW_PATTERN_TYPES.service_result;
    const proofRule = REVIEW_PROOF_TYPES[patternAssignment.proofKey] || REVIEW_PROOF_TYPES.result;
    const closingRule = REVIEW_CLOSING_TYPES[patternAssignment.closingKey] || REVIEW_CLOSING_TYPES.satisfaction;
    const surfaceRule = getSurfaceAssignment(variant.key, surfaceAssignments) || {
      startKey: "normal_start",
      endKey: "standard",
    };
    const startRule = SURFACE_START_TYPES[surfaceRule.startKey] || SURFACE_START_TYPES.normal_start;
    const endRule = SURFACE_END_TYPES[surfaceRule.endKey] || SURFACE_END_TYPES.standard;

    if (lang === "zh") {
      return (
        index + 1 + ". style_key=" + variant.key + " | 卡片语气=" +
        variant.zhLabel +
        " | 结构=" +
        patternRule.zhLabel +
        " | 焦点=" +
        describeFocusDirective(focusKey, lang) +
        " | 长度=" +
        lengthRule.promptLabel +
        " | proof=" +
        proofRule.zhLabel +
        " | 收尾=" +
        closingRule.zhLabel +
        (keywordAssignment && keywordAssignment.primaryKeyword
          ? " | 关键词概念=" +
            keywordAssignment.primaryKeyword +
            " | 更自然的写法=" +
            keywordAssignment.naturalPhrases.join("、")
          : "") +
        " | 开头=" +
        startRule.zhLabel +
        " | 结尾=" +
        endRule.zhLabel +
        "\n   结构说明：" +
        patternRule.zhRule
      );
    }

    return (
      index + 1 + ". style_key=" + variant.key + " | tone=" +
      variant.enLabel +
      " | pattern=" +
      patternRule.enLabel +
      " | focus=" +
      describeFocusDirective(focusKey, lang) +
      " | length=" +
      lengthRule.promptLabel +
      " | proof=" +
      proofRule.enLabel +
      " | close=" +
      closingRule.enLabel +
      (keywordAssignment && keywordAssignment.primaryKeyword
        ? " | keyword concept=" +
          keywordAssignment.primaryKeyword +
          " | natural realizations=" +
          keywordAssignment.naturalPhrases.join(", ")
        : "") +
      " | opening=" +
      startRule.enLabel +
      " | ending=" +
      endRule.enLabel +
      "\n   Pattern note: " +
      patternRule.enRule
    );
  }).join("\n");

  if (lang === "zh") {
    return {
      system:
        "你在帮真实顾客写 Google Maps 餐厅短评。第一人称、口语、像刚吃完顺手发出去，不像广告或关键词清单。每条必须点到具体菜名，自然融入关键词概念，可用流行夸法（很绝、很能打、超预期、上头）。每条最多 1～2 个菜，1 个可信细节，1 个收尾。只返回 JSON。",
      user:
        "店铺：" +
        store.nameZh +
        "\n输出语言：中文\n\n这次点的菜品：\n" +
        dishLines +
        "\n\n来店信息：\n- " +
        (visitTier ? visitTier.zhLabel : "未提供") +
        "\n" +
        (servicePraise
          ? "- 如果某条是 staff 焦点，请明确提到" +
            serviceStaffLabel +
            "，并把夸奖自然落在“" +
            servicePraiseOption.zhLabel +
            "”上。\n"
          : "") +
        "\n每张卡的生成指令：\n" +
        variantLines +
        buildFlavorHintBlock(lang) +
        "\n\n全局规则：\n" +
        "1. 必须输出 3 条评论，并严格使用 review_a、review_b、review_c 这 3 个 style_key。\n" +
        "2. 三条正文的总体长度必须递增：review_a 最短，review_b 比 review_a 明显更长，review_c 最长；不要三条写得差不多长。\n" +
        "3. 每条都要像真人会发的短评，口语、真实，不要像介绍页或宣传文案。\n" +
        "4. 每条必须自然写出至少 1 个具体菜名，最多提 1 到 2 个菜。\n" +
        "5. 每条必须把分配的关键词概念用口语说法融进去，不要硬贴字面词。\n" +
        "6. 推荐、满意、回头意愿三种收尾只选一种，不要一条里全堆上。\n" +
        "7. 禁止 emoji、井号、引号、项目符号；不要用冒号或破折号写评论正文。\n" +
        "8. 三条开头和收尾不要太像。\n" +
        (avoidFragments.length
          ? "9. 尽量不要复用这些旧说法：" + avoidFragments.join("、") + "。\n"
          : "") +
        (retryLevel > 0
          ? (avoidFragments.length ? "10." : "9.") + " 上一轮不够口语，这一轮更像随手发、更真实。\n"
          : ""),
    };
  }

  return {
    system:
      "You write believable Google Maps restaurant reviews in first-person customer voice. Sound like someone typing right after the meal—casual, specific, a little trendy when it fits, never like ad copy. Each review must name the actual dish, weave in the keyword concept naturally, mention at most 1 or 2 dishes, include one believable proof point, and end with one light closing signal. Return JSON only.",
    user:
      "Restaurant: " +
      getRestaurantLabel(store) +
      "\nOutput language: English\n\nServices from this visit:\n" +
      dishLines +
      "\n\nVisit context:\n- " +
      (visitTier ? visitTier.enLabel : "Not provided") +
      "\n" +
      (servicePraise
        ? "- If a card is staff-focused, explicitly mention " +
          serviceStaffLabel +
          " and land the praise naturally as " +
          servicePraiseOption.enLabel +
          ".\n"
        : "") +
      "\nPer-card directives:\n" +
      variantLines +
      buildFlavorHintBlock(lang) +
      "\n\nGlobal rules:\n" +
      "1. Output exactly 3 reviews and use these exact style_key values: review_a, review_b, review_c.\n" +
      "2. Overall length must increase across the three: review_a is the shortest, review_b is clearly longer than review_a, and review_c is the longest, but review_c must never exceed 50 words in the body (count full words of letters and digits).\n" +
      "3. Make each review sound like a real happy customer typing casually, not a landing page or keyword dump.\n" +
      "4. Name at least one specific dish per review; mention at most 1 or 2 dishes total.\n" +
      "5. Weave each card's keyword concept in casual customer wording, not stiff marketing language.\n" +
      "6. Satisfaction, recommendation, and loyalty are different close types. Use only one close type per review.\n" +
      "7. No emoji, hashtags, quote marks, or bullet points inside the review text.\n" +
      "8. Do not make all three reviews open or close the same way.\n" +
      (avoidFragments.length
        ? "9. Avoid sounding too close to these earlier fragments: " + avoidFragments.join("; ") + ".\n"
        : "") +
      (retryLevel > 0
        ? (avoidFragments.length ? "10." : "9.") + " The last attempt was too stiff. Make this round more casual, specific, and easy to post.\n"
        : ""),
  };
}

function normalizeGeneratedReviews(reviews, focusAssignments) {
  const styleCounts = {};
  reviews.forEach(function (review) {
    const styleKey = String((review && review.style_key) || "").trim();
    if (!styleKey) return;
    styleCounts[styleKey] = (styleCounts[styleKey] || 0) + 1;
  });

  STYLE_VARIANTS.forEach(function (variant) {
    if (styleCounts[variant.key] !== 1) {
      throw createAppError("INVALID_REVIEW_SHAPE", "Returned style keys invalid", 502);
    }
  });

  return STYLE_VARIANTS.map(function (variant, index) {
    const found = reviews.find(function (review) {
      return review.style_key === variant.key;
    }) || reviews[index] || {};
    const expectedFocus = getAssignedFocus(variant.key, focusAssignments);

    return {
      styleKey: variant.key,
      focus: expectedFocus,
      text: String(found.text || "").trim(),
    };
  });
}

function validateReviewContent(review, lang, keywordAssignment, servicePraise, options) {
  const opts = options && typeof options === "object" ? options : {};
  const lengthProfile = opts.lengthProfile;
  const visitTierKey = String(opts.visitTierKey || "").trim();
  const visitPrefixAssignment = opts.visitPrefixAssignment;
  const servicePattern =
    lang === "zh"
      ? /服务|staff|服务员|店员|态度|热情|耐心|细心|认真|沟通|照顾周到|上菜/
      : /\bservice\b|\bstaff\b|\btech(?:nician)?\b|\bartist\b|\bteam\b|\battentive\b|\bpatient\b|\bfriendly\b|\bkind\b|\bcommunicat(?:ion|e|ive)\b|\bgentle\b|took care of us|well taken care of|hospitality|easy to communicate with|made me feel comfortable|super welcoming|everyone was friendly/i;
  const namedStaffPattern =
    servicePraise && String(servicePraise.staffLabel || "").trim()
      ? new RegExp(escapeRegex(String(servicePraise.staffLabel || "").trim()), lang === "en" ? "i" : "")
      : null;
  const environmentPattern =
    lang === "zh"
      ? /环境|氛围|装修|店里|空间|座位|坐着舒服|店里很干净|环境很舒服|空间很舒服|氛围很放松|店里很安静|空间很明亮/
      : /\bambiance\b|\batmosphere\b|\bdecor\b|\benvironment\b|\bspace\b|\bsetting\b|\broom\b|\bvibe(?:s)?\b|\bcozy\b|\bspotless\b|\bvery clean\b(?! (flavor|broth|sauce|meal|dish))|\bclean and welcoming\b|\bbright and clean\b|\bclean and professional\b|\bwell kept\b|\bclean (restaurant|dining room|space|place)\b|\b(restaurant|dining room|space|place) (was |felt )?clean\b|\b(relaxing|calm|comfortable) (space|room|setting|vibe|atmosphere|restaurant)\b|\brelaxing atmosphere\b/i;
  const bannedPunctuationPattern = /[:：—–-]/;

  if (!review.text) {
    throw createAppError("EMPTY_REVIEW_TEXT", "Empty review text", 502);
  }

  const hasService = servicePattern.test(review.text) || (namedStaffPattern ? namedStaffPattern.test(review.text) : false);
  const hasEnvironment = environmentPattern.test(review.text);
  const measuredLength = lengthProfile
    ? countCoreReviewLength(review.text, visitTierKey, visitPrefixAssignment, lang)
    : countReviewLengthUnits(review.text, lang);
  const lengthBounds = lengthProfile
    ? { min: Number(lengthProfile.min), max: Number(lengthProfile.max) }
    : getReviewLengthBounds(lang);

  if (lang === "zh" && bannedPunctuationPattern.test(review.text)) {
    throw createAppError("BANNED_ZH_PUNCTUATION", "Chinese review used banned punctuation", 502);
  }

  if (review.focus === "none" && (hasService || hasEnvironment)) {
    throw createAppError("INVALID_REVIEW_FOCUS", "Food-only review mentioned staff or restaurant environment", 502);
  }

  if (review.focus === "service" && (!hasService || hasEnvironment)) {
    throw createAppError("INVALID_REVIEW_FOCUS", "Service review focus invalid", 502);
  }

  if (review.focus === "environment" && (!hasEnvironment || hasService)) {
    throw createAppError("INVALID_REVIEW_FOCUS", "Environment review focus invalid", 502);
  }

  if (!Number.isFinite(lengthBounds.min) || !Number.isFinite(lengthBounds.max)) {
    throw createAppError("INVALID_REVIEW_LENGTH", "Review length bounds invalid", 502);
  }
  if (measuredLength < lengthBounds.min || measuredLength > lengthBounds.max) {
    throw createAppError("INVALID_REVIEW_LENGTH", "Review length out of range", 502);
  }

  if (reviewHasInternalDuplication(review.text, lang)) {
    throw createAppError("DUPLICATE_REVIEW_FRAGMENT", "Review repeated the same clause", 502);
  }

  if (!reviewMatchesKeywordAssignment(review.text, keywordAssignment)) {
    throw createAppError("MISSING_STORE_KEYWORD", "Review missing required keyword concept realization", 502);
  }
}

function validateSingleGeneratedReview(review, lang, recentTexts, keywordAssignment, servicePraise, cardPlan, visitTierKey) {
  validateReviewContent(review, lang, keywordAssignment, servicePraise, {
    lengthProfile: cardPlan && cardPlan.lengthRule,
    visitTierKey: visitTierKey,
    visitPrefixAssignment: cardPlan && cardPlan.visitPrefixAssignment,
  });
  const normalizedRecent = (recentTexts || []).map(normalizeText);
  if (normalizedRecent.indexOf(normalizeText(review.text)) !== -1) {
    throw createAppError("DUPLICATE_REVIEW_TEXT", "Duplicate review text", 502);
  }
}

function validateGeneratedReviews(
  reviews,
  lang,
  recentTexts,
  lengthAssignments,
  keywordAssignments,
  servicePraise,
  visitTierKey,
  visitPrefixAssignments,
) {
  if (!Array.isArray(reviews) || reviews.length !== 3) {
    throw createAppError("INVALID_REVIEW_COUNT", "Invalid review count", 502);
  }

  reviews.forEach(function (review) {
    const profile = getReviewLengthAssignment(review.styleKey, lengthAssignments, lang);
    const visitPrefixAssignment = getVisitPrefixAssignment(review.styleKey, visitPrefixAssignments || []);
    validateReviewContent(review, lang, getKeywordAssignment(review.styleKey, keywordAssignments), servicePraise, {
      lengthProfile: profile,
      visitTierKey: visitTierKey,
      visitPrefixAssignment: visitPrefixAssignment,
    });
  });

  const normalizedRecent = (recentTexts || []).map(normalizeText);
  reviews.forEach(function (review) {
    if (normalizedRecent.indexOf(normalizeText(review.text)) !== -1) {
      throw createAppError("DUPLICATE_REVIEW_TEXT", "Duplicate review text", 502);
    }
  });
}

function normalizeSingleGeneratedReview(review, cardPlan) {
  if (
    !review ||
    typeof review !== "object" ||
    String(review.style_key || "").trim() !== cardPlan.styleKey
  ) {
    throw createAppError("INVALID_REVIEW_SHAPE", "Returned review shape invalid", 502);
  }

  return {
    styleKey: cardPlan.styleKey,
    focus: cardPlan.focusKey,
    text: String(review.text || "").trim(),
  };
}

function finalizeReviewCard(review, visitTierKey, servicePraise, cardPlan, lang) {
  let finalized = [review];
  finalized = finalized.map(function (currentReview) {
    return applyAssignedVisitPrefix(currentReview, cardPlan.visitPrefixAssignment, visitTierKey, lang);
  });
  finalized = applyServicePraiseToReviews(finalized, servicePraise, lang);
  finalized = applySurfaceStyleToReviews(finalized, [cardPlan.surfaceRule], lang);
  return finalized[0];
}

function getFallbackKeywordPhrases(cardPlan, servicePraise, lang) {
  const phrases = [];
  if (servicePraise && cardPlan.focusKey === "service") {
    const option = getServicePraiseOption(servicePraise.praiseKey);
    phrases.push(lang === "zh" ? option.zhPhrase : option.enPhrase);
  }
  if (cardPlan.keywordAssignment) {
    phrases.push.apply(phrases, cardPlan.keywordAssignment.naturalPhrases || []);
    phrases.push(cardPlan.keywordAssignment.primaryKeyword || "");
  }

  const defaults = lang === "zh"
    ? {
        service: ["沟通很顺", "照顾得很周到", "服务很热情"],
        environment: ["店里很干净", "坐着很舒服", "氛围很轻松"],
        none: ["味道很稳", "鲜味很足", "吃着很满足"],
      }
    : {
        service: ["easy to talk to", "really attentive", "looked after us well"],
        environment: ["super clean", "comfortable vibe", "easy place to relax"],
        none: ["solid flavor", "really fresh", "super satisfying"],
      };

  return uniqueArray(phrases.filter(Boolean).concat(defaults[cardPlan.focusKey] || defaults.none));
}

function buildEnglishServiceClause(phrase, staffLabel) {
  const value = String(phrase || "").trim();
  const subject = normalizeText(staffLabel) === "staff" ? "The staff" : staffLabel;
  if (!value) return subject + " was attentive and easy to communicate with";
  if (/made me feel comfortable/i.test(value)) return subject + " " + value;
  if (/easy to communicate with/i.test(value)) return subject + " was " + value;
  if (/attention to detail/i.test(value)) return subject + " had " + value;
  if (/^took .* time/i.test(value)) return subject + " " + value;
  if (/everyone was friendly/i.test(value)) return subject + " and everyone else were friendly";
  return subject + " was " + value;
}

function buildZhServiceClause(phrase, staffLabel, servicePraise) {
  const option = getServicePraiseOption(servicePraise && servicePraise.praiseKey);
  const praise = String(option.zhPhrase || "").trim();
  const value = String(phrase || "").trim();
  const basePraiseClause =
    praise.indexOf("很") !== -1 || /^做得|^沟通|^手法/.test(praise)
      ? staffLabel + praise
      : staffLabel + "很" + praise;
  if (!value) return basePraiseClause;
  if (normalizeText(value) === normalizeText(praise) || value.indexOf(praise) !== -1) {
    return basePraiseClause;
  }
  return basePraiseClause + "，" + value;
}

function buildEnglishEnvironmentClause(phrase) {
  const value = String(phrase || "").trim();
  if (!value) return "The restaurant felt very clean and comfortable";
  if (/atmosphere/i.test(value)) return "The restaurant had a " + value;
  return "The restaurant felt " + value;
}

function buildEnglishResultClause(phrase) {
  const value = String(phrase || "").trim();
  if (!value) return "The dish tasted fresh and satisfying";
  if (/^looked /i.test(value) || /^came out /i.test(value)) return "The dish " + value;
  if (/^holding up /i.test(value)) return "It's " + value;
  if (/^lasted /i.test(value)) return "It " + value;
  if (/^shape was /i.test(value)) return "The " + value;
  if (/finish$|shine$/i.test(value)) return "The dish had a " + value;
  if (/portion/i.test(value)) return "The " + value;
  if (/crab/i.test(value) || /signature/i.test(value)) return "The " + value + " really stood out";
  if (/flavor/i.test(value) || /fresh/i.test(value) || /savory/i.test(value) || /authentic/i.test(value)) {
    return "The dish tasted " + value.replace(/^really\s+/i, "");
  }
  if (/value/i.test(value)) return "It felt like " + value;
  return "The dish was " + value;
}

function getFallbackClosings(styleKey, lang) {
  if (lang === "zh") {
    if (styleKey === "review_a") return ["整体很满意。", "这次做得很值。"];
    if (styleKey === "review_b") return ["下次还会来做。", "会想继续来。"];
    return ["比预期还好。", "朋友看到也会夸。"];
  }

  if (styleKey === "review_a") return ["Really happy with how it came out.", "Glad I booked this."];
  if (styleKey === "review_b") return ["Would come back for this.", "Easy one to book again."];
  return ["Better than I expected.", "This one really worked for me."];
}

function getFallbackSpiceVariants(styleKey, lang) {
  const bank = REVIEW_SPICE_BANK[lang === "en" ? "en" : "zh"] || [];
  if (styleKey === "review_a") return bank.slice(0, 3);
  if (styleKey === "review_b") return bank.slice(2, 6);
  return bank.slice(4, 8);
}

function addSpiceToFallbackText(text, spice, lang) {
  const baseText = String(text || "").trim();
  const spiceText = String(spice || "").trim();
  if (!baseText || !spiceText) return baseText;

  if (lang === "zh") {
    return baseText.replace(/[。！？]+$/u, "") + "，" + spiceText + "。";
  }

  const sentence = /^[A-Z]/.test(spiceText)
    ? spiceText
    : spiceText.charAt(0).toUpperCase() + spiceText.slice(1);
  return baseText.replace(/[.!?]+$/u, "") + ". " + sentence + ".";
}

function buildFallbackCandidateTexts(cardPlan, servicePraise, lang) {
  const keywordPhrases = getFallbackKeywordPhrases(cardPlan, servicePraise, lang).slice(0, 3);
  const closings = getFallbackClosings(cardPlan.styleKey, lang);
  const staffLabel = getResolvedServiceStaffLabel(servicePraise && servicePraise.staffLabel, lang);
  const styleKey = cardPlan.styleKey;

  if (lang === "zh") {
    if (cardPlan.focusKey === "service") {
      return keywordPhrases.flatMap(function (phrase, index) {
        if (styleKey === "review_a") {
          return [
            buildZhServiceClause(phrase, staffLabel, servicePraise) + "，" + closings[index % closings.length],
            staffLabel + "做得很稳，" + phrase + "，这次也很满意。",
          ];
        }
        if (styleKey === "review_b") {
          return [
            staffLabel + "这次做得很细，" + phrase + "，沟通也很顺，" + closings[index % closings.length],
            "这次想夸夸" + staffLabel + "，" + phrase + "，整个过程都很安心。",
          ];
        }
        return [
          staffLabel + "给人的感觉很稳，" + phrase + "，成品也很利落，" + closings[index % closings.length],
          "最记得的是" + staffLabel + "做事很到位，" + phrase + "，会想再来。",
        ];
      });
    }
    if (cardPlan.focusKey === "environment") {
      return keywordPhrases.flatMap(function (phrase, index) {
        if (styleKey === "review_a") {
          return [
            phrase + "，坐着也舒服，" + closings[index % closings.length],
            phrase + "，整个过程都挺放松。",
          ];
        }
        if (styleKey === "review_b") {
          return [
            "店里收拾得很舒服，" + phrase + "，待着不会有压力，" + closings[index % closings.length],
            "环境这次特别加分，" + phrase + "，从头到尾都很轻松。",
          ];
        }
        return [
          "这家让我记住的不只是成品，" + phrase + "，待着也很舒服，" + closings[index % closings.length],
          "环境让人很放松，" + phrase + "，会推荐给喜欢舒服一点的人。",
        ];
      });
    }
    return keywordPhrases.flatMap(function (phrase, index) {
      if (styleKey === "review_a") {
        return [
          phrase + "，味道很稳，" + closings[index % closings.length],
          phrase + "，这次吃着挺满意。",
        ];
      }
      if (styleKey === "review_b") {
        return [
          "这次点的菜很加分，" + phrase + "，口感和调味都在线，" + closings[index % closings.length],
          "菜品这次很稳，" + phrase + "，细节也做得不错。",
        ];
      }
      return [
        "最喜欢的是" + phrase + "，吃完还想再来，" + closings[index % closings.length],
        phrase + "，整体体验比预期更好。",
      ];
    });
  }

  if (cardPlan.focusKey === "service") {
    return keywordPhrases.flatMap(function (phrase, index) {
      if (styleKey === "review_a") {
        return [
          buildEnglishServiceClause(phrase, staffLabel) + ". The result came out polished. " + closings[index % closings.length],
          buildEnglishServiceClause(phrase, staffLabel) + ". This visit felt easy from start to finish.",
        ];
      }
      if (styleKey === "review_b") {
        return [
          buildEnglishServiceClause(phrase, staffLabel) + ". She paid attention to the little details. " + closings[index % closings.length],
          "What stood out most is that " + buildEnglishServiceClause(phrase, staffLabel).replace(/\.$/, "") + ". Everything looked really even.",
        ];
      }
      return [
        buildEnglishServiceClause(phrase, staffLabel) + ". That part really made the whole visit stand out. " + closings[index % closings.length],
        "The part I remember most is that " + buildEnglishServiceClause(phrase, staffLabel).replace(/\.$/, "") + ". The finish looked clean.",
      ];
    });
  }
  if (cardPlan.focusKey === "environment") {
    return keywordPhrases.flatMap(function (phrase, index) {
      if (styleKey === "review_a") {
        return [
          buildEnglishEnvironmentClause(phrase) + ". " + closings[index % closings.length],
          buildEnglishEnvironmentClause(phrase) + ". The whole visit felt easy.",
        ];
      }
      if (styleKey === "review_b") {
        return [
          "One thing I noticed right away is that " + buildEnglishEnvironmentClause(phrase).replace(/\.$/, "").toLowerCase() + ". " + closings[index % closings.length],
          buildEnglishEnvironmentClause(phrase) + ". It made it easy to relax.",
        ];
      }
      return [
        "What made this one stand out for me is that " + buildEnglishEnvironmentClause(phrase).replace(/\.$/, "").toLowerCase() + ". " + closings[index % closings.length],
        buildEnglishEnvironmentClause(phrase) + ". It felt like a place I would happily come back to.",
      ];
    });
  }
  return keywordPhrases.flatMap(function (phrase, index) {
    if (styleKey === "review_a") {
      return [
        buildEnglishResultClause(phrase) + ". " + closings[index % closings.length],
        buildEnglishResultClause(phrase) + ". Exactly the look I wanted.",
      ];
    }
    if (styleKey === "review_b") {
      return [
        "The best part for me is that " + buildEnglishResultClause(phrase).replace(/\.$/, "").toLowerCase() + ". " + closings[index % closings.length],
        buildEnglishResultClause(phrase) + ". The shape and finish both looked really neat.",
      ];
    }
    return [
      "What I keep noticing is that " + buildEnglishResultClause(phrase).replace(/\.$/, "").toLowerCase() + ". " + closings[index % closings.length],
      buildEnglishResultClause(phrase) + ". It looked good right away and still felt worth it.",
    ];
  });
}

function getPrimaryKeywordPhrase(cardPlan) {
  const assignment = cardPlan && cardPlan.keywordAssignment;
  if (!assignment) return "";
  return String(
    assignment.primaryKeyword ||
      (Array.isArray(assignment.naturalPhrases) && assignment.naturalPhrases[0]) ||
      (Array.isArray(assignment.candidates) && assignment.candidates[0]) ||
      "",
  ).trim();
}

function extendEnglishFallbackCore(coreText, minWords, maxWords) {
  let value = String(coreText || "").trim();
  const extenders = [
    "Really happy with the meal.",
    "Would come back for this.",
    "Left feeling satisfied.",
    "Great spot for a casual meal.",
    "Portion and flavor both felt right.",
    "Easy place to recommend to friends.",
  ];
  let guard = 0;
  while (countReviewLengthUnits(value, "en") < minWords && guard < extenders.length) {
    value = value.replace(/[.!?]+$/u, "") + ". " + extenders[guard];
    guard += 1;
  }
  while (countReviewLengthUnits(value, "en") > maxWords && value.indexOf(". ") !== -1) {
    value = value.slice(0, value.lastIndexOf(". ")).trim() + ".";
  }
  const words = value.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*/g) || [];
  if (words.length > maxWords) {
    value = words.slice(0, maxWords).join(" ") + ".";
  }
  return value.trim();
}

function extendZhFallbackCore(coreText, minUnits, maxUnits, focusKey) {
  let value = String(coreText || "").trim();
  const focus = String(focusKey || "none");
  const extendersByFocus = {
    service: [
      "服务节奏顺，沟通也舒服。",
      "态度很好，整个过程很省心。",
      "上菜时会主动确认，挺贴心。",
      "这次服务体验很稳，会再来。",
      "从进门到离店都照顾得很周到。",
    ],
    environment: [
      "店里坐着舒服，氛围也轻松。",
      "环境干净利落，待着很放松。",
      "空间和座位都舒服，适合慢慢吃。",
      "店里整体很整洁，体验加分。",
      "环境比想象中更好，愿意再来。",
    ],
    none: [
      "味道和口感都在线，吃着很舒服。",
      "从第一口到最后都很稳，没有踩雷。",
      "分量也实在，整体体验比预期更好。",
      "菜品表现很稳，这次吃着挺满意。",
      "已经想好了下次还要点什么。",
    ],
  };
  const extenders = extendersByFocus[focus] || extendersByFocus.none;
  let guard = 0;
  while (countReviewLengthUnits(value, "zh") < minUnits && guard < extenders.length) {
    value = value.replace(/[。！？]+$/u, "") + extenders[guard];
    guard += 1;
  }
  const fillerVariants =
    focus === "service"
      ? [
          "服务体验挺扎实，值得再来的。",
          "沟通顺畅，整体很省心。",
          "这次被照顾得很周到。",
          "下次还会来试试别的菜。",
        ]
      : focus === "environment"
        ? [
            "环境体验挺舒服，值得再来的。",
            "坐着很轻松，整体氛围不错。",
            "店里收拾得利落，待着舒服。",
            "下次还会来试试别的菜。",
          ]
        : [
            "整体味道挺扎实，值得再来的。",
            "吃完还想再点别的试试。",
            "这次体验比预期更满意。",
            "分量也实在，吃着很过瘾。",
            "下次还会来试试别的菜。",
          ];
  let fillerIndex = 0;
  const usedFillers = new Set();
  while (countReviewLengthUnits(value, "zh") < minUnits && value.length < 320 && fillerIndex < 24) {
    const next = fillerVariants[fillerIndex % fillerVariants.length];
    fillerIndex += 1;
    if (usedFillers.has(next)) continue;
    usedFillers.add(next);
    value = value.replace(/[。！？]+$/u, "") + next;
  }
  while (countReviewLengthUnits(value, "zh") > maxUnits && value.length > minUnits) {
    value = value.slice(0, Math.max(minUnits, value.length - 6)).replace(/[，、；：]+$/u, "") + "。";
  }
  return value.trim();
}

function buildGuaranteedFallbackText(cardPlan, servicePraise, lang) {
  const staffLabel = getResolvedServiceStaffLabel(servicePraise && servicePraise.staffLabel, lang);
  const keywordPhrase = getPrimaryKeywordPhrase(cardPlan);
  const lengthRule = cardPlan && cardPlan.lengthRule ? cardPlan.lengthRule : null;
  const minUnits = lengthRule && Number.isFinite(Number(lengthRule.min)) ? Number(lengthRule.min) : null;
  const maxUnits = lengthRule && Number.isFinite(Number(lengthRule.max)) ? Number(lengthRule.max) : null;

  if (lang === "zh") {
    let text = "";
    if (cardPlan.focusKey === "service") {
      if (cardPlan.styleKey === "review_a") text = buildZhServiceClause(keywordPhrase, staffLabel, servicePraise) + "，这次也很满意。";
      else if (cardPlan.styleKey === "review_b") {
        text =
          "这次想夸夸" +
          staffLabel +
          "，" +
          (keywordPhrase || "服务很热情") +
          "，沟通也很顺，上菜节奏舒服，下次还会来做。";
      } else {
        text =
          "最记得的是" +
          staffLabel +
          "做事很稳，" +
          (keywordPhrase || "照顾得很周到") +
          "，会主动确认口味，也会提醒趁热吃，整个过程省心又舒服，已经想好下次还要来。";
      }
    } else if (cardPlan.focusKey === "environment") {
      if (cardPlan.styleKey === "review_a") text = (keywordPhrase || "店里很干净") + "，坐着也舒服，整体很满意。";
      else if (cardPlan.styleKey === "review_b") {
        text =
          "环境这次特别加分，" +
          (keywordPhrase || "空间很舒服") +
          "，座位间距也合理，待着不会有压力，下次还会来做。";
      } else {
        text =
          "让我记住的是店里很放松，" +
          (keywordPhrase || "环境也收拾得很利落") +
          "，灯光和座位都舒服，适合慢慢吃慢慢聊，整体氛围比预期更好，会推荐给朋友。";
      }
    } else if (cardPlan.styleKey === "review_a") {
      text = (keywordPhrase || "味道很稳") + "，菜品吃着很顺口，这次也很满意。";
    } else if (cardPlan.styleKey === "review_b") {
      text =
        "这次点的菜很加分，" +
        (keywordPhrase || "味道很鲜美") +
        "，口感和调味都在线，吃着很舒服，下次还会来做。";
    } else {
      text =
        "最喜欢的是" +
        (keywordPhrase || "味道很稳") +
        "，从第一口到最后都很满足，口感、调味和火候都在线，分量也实在，边吃边聊很舒服，整体比预期更好，已经想好下次还要点什么。";
    }
    if (minUnits != null && maxUnits != null) {
      text = extendZhFallbackCore(text, minUnits, maxUnits, cardPlan.focusKey);
    }
    return text;
  }

  let text = "";
  if (cardPlan.focusKey === "service") {
    if (cardPlan.styleKey === "review_a") {
      text = buildEnglishServiceClause(keywordPhrase || "attentive", staffLabel) + ". Really happy with the meal.";
    } else if (cardPlan.styleKey === "review_b") {
      text =
        buildEnglishServiceClause(keywordPhrase || "easy to communicate with", staffLabel) +
        ". The team kept everything moving smoothly. Would come back for this.";
    } else {
      text =
        "The part I remember most is that " +
        buildEnglishServiceClause(keywordPhrase || "very attentive", staffLabel).replace(/\.$/, "").toLowerCase() +
        ". It made the whole visit stand out.";
    }
  } else if (cardPlan.focusKey === "environment") {
    if (cardPlan.styleKey === "review_a") {
      text = buildEnglishEnvironmentClause(keywordPhrase || "very clean") + ". Really happy with the meal.";
    } else if (cardPlan.styleKey === "review_b") {
      text =
        "One thing I noticed right away is that " +
        buildEnglishEnvironmentClause(keywordPhrase || "very clean").replace(/\.$/, "").toLowerCase() +
        ". It made it easy to relax and enjoy the food.";
    } else {
      text =
        "What stood out most is that " +
        buildEnglishEnvironmentClause(keywordPhrase || "relaxing").replace(/\.$/, "").toLowerCase() +
        ". Better than I expected and easy to recommend.";
    }
  } else if (cardPlan.styleKey === "review_a") {
    text = buildEnglishResultClause(keywordPhrase) + ". Really happy with the meal.";
  } else if (cardPlan.styleKey === "review_b") {
    text =
      "The best part for me is that " +
      buildEnglishResultClause(keywordPhrase).replace(/\.$/, "").toLowerCase() +
      ", and the portion felt right. Would come back for this.";
  } else {
    text =
      "What I noticed most is that " +
      buildEnglishResultClause(keywordPhrase).replace(/\.$/, "").toLowerCase() +
      ". The flavors stayed satisfying from the first bite to the last, and it felt like a place I would happily come back to.";
  }

  if (minUnits != null && maxUnits != null) {
    text = extendEnglishFallbackCore(text, minUnits, maxUnits);
  }
  return text;
}

function buildFallbackReview(cardPlan, lang, recentTexts, visitTierKey, servicePraise, extraAvoidTexts) {
  let lastError = null;
  const baseCandidateTexts = buildFallbackCandidateTexts(cardPlan, servicePraise, lang);
  const candidateTexts = uniqueArray(
    baseCandidateTexts.concat(
      baseCandidateTexts.flatMap(function (candidateText) {
        return getFallbackSpiceVariants(cardPlan.styleKey, lang).map(function (spiceText) {
          return addSpiceToFallbackText(candidateText, spiceText, lang);
        });
      }),
    ),
  );

  for (const candidateText of candidateTexts) {
    try {
      let normalizedCandidate = String(candidateText || "").trim();
      if (cardPlan.lengthRule) {
        if (lang === "zh") {
          normalizedCandidate = extendZhFallbackCore(
            normalizedCandidate,
            Number(cardPlan.lengthRule.min),
            Number(cardPlan.lengthRule.max),
            cardPlan.focusKey,
          );
        } else {
          normalizedCandidate = extendEnglishFallbackCore(
            normalizedCandidate,
            Number(cardPlan.lengthRule.min),
            Number(cardPlan.lengthRule.max),
          );
        }
      }
      const finalized = finalizeReviewCard(
        {
          styleKey: cardPlan.styleKey,
          focus: cardPlan.focusKey,
          text: normalizedCandidate,
        },
        visitTierKey,
        servicePraise,
        cardPlan,
        lang,
      );
      validateSingleGeneratedReview(finalized, lang, recentTexts, cardPlan.keywordAssignment, servicePraise, cardPlan, visitTierKey);
      if ((extraAvoidTexts || []).some(function (referenceText) {
        return areReviewsTooSimilar(finalized.text, referenceText, visitTierKey, lang);
      })) {
        throw createAppError("REVIEWS_TOO_SIMILAR", "Generated reviews were too similar", 502);
      }
      return finalized;
    } catch (error) {
      lastError = error;
    }
  }

  try {
    const finalized = finalizeReviewCard(
      {
        styleKey: cardPlan.styleKey,
        focus: cardPlan.focusKey,
        text: buildGuaranteedFallbackText(cardPlan, servicePraise, lang),
      },
      visitTierKey,
      servicePraise,
      cardPlan,
      lang,
    );
    validateSingleGeneratedReview(finalized, lang, recentTexts, cardPlan.keywordAssignment, servicePraise, cardPlan, visitTierKey);
    if ((extraAvoidTexts || []).some(function (referenceText) {
      return areReviewsTooSimilar(finalized.text, referenceText, visitTierKey, lang);
    })) {
      throw createAppError("REVIEWS_TOO_SIMILAR", "Generated reviews were too similar", 502);
    }
    return finalized;
  } catch (error) {
    lastError = error;
  }

  for (const spiceText of getFallbackSpiceVariants(cardPlan.styleKey, lang)) {
    try {
      const finalized = finalizeReviewCard(
        {
          styleKey: cardPlan.styleKey,
          focus: cardPlan.focusKey,
          text: addSpiceToFallbackText(buildGuaranteedFallbackText(cardPlan, servicePraise, lang), spiceText, lang),
        },
        visitTierKey,
        servicePraise,
        cardPlan,
        lang,
      );
      validateSingleGeneratedReview(finalized, lang, recentTexts, cardPlan.keywordAssignment, servicePraise, cardPlan, visitTierKey);
      if ((extraAvoidTexts || []).some(function (referenceText) {
        return areReviewsTooSimilar(finalized.text, referenceText, visitTierKey, lang);
      })) {
        throw createAppError("REVIEWS_TOO_SIMILAR", "Generated reviews were too similar", 502);
      }
      return finalized;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || createAppError("REVIEW_FALLBACK_FAILED", "Unable to build a valid fallback review", 502);
}

async function generateSingleReviewCard(input) {
  const cardPlan = input.cardPlan;
  const extraAvoidTexts = uniqueArray(input.extraAvoidTexts || []);
  let lastError = null;

  for (let attempt = 0; attempt < SINGLE_REVIEW_REMOTE_ATTEMPTS; attempt += 1) {
    try {
      const prompts = buildSingleReviewMessages(
        input.store,
        input.menuContext,
        input.dishIds,
        input.lang,
        input.recentTexts,
        attempt,
        input.visitTierKey,
        input.servicePraise,
        cardPlan,
        extraAvoidTexts,
      );
      const data = await callOpenAIChat({
        model: input.model,
        temperature: SINGLE_REVIEW_TEMPERATURE,
        max_tokens: SINGLE_REVIEW_MAX_TOKENS,
        timeout_ms: SINGLE_REVIEW_TIMEOUT_MS,
        response_format: singleReviewSchema(cardPlan.styleKey),
        messages: [
          { role: "system", content: prompts.system },
          { role: "user", content: prompts.user },
        ],
      });

      const parsed = parseChatCompletionJson(data);
      const normalized = normalizeSingleGeneratedReview(parsed, cardPlan);
      const finalized = finalizeReviewCard(normalized, input.visitTierKey, input.servicePraise, cardPlan, input.lang);
      validateSingleGeneratedReview(
        finalized,
        input.lang,
        input.recentTexts,
        cardPlan.keywordAssignment,
        input.servicePraise,
        cardPlan,
        input.visitTierKey,
      );
      if (extraAvoidTexts.some(function (referenceText) {
        return areReviewsTooSimilar(finalized.text, referenceText, input.visitTierKey, input.lang);
      })) {
        throw createAppError("REVIEWS_TOO_SIMILAR", "Generated reviews were too similar", 502);
      }
      return finalized;
    } catch (error) {
      lastError = error;
    }
  }

  console.warn("[reviews] using fallback review", {
    styleKey: cardPlan.styleKey,
    focus: cardPlan.focusKey,
    errorCode: lastError && lastError.code,
    visitTierKey: input.visitTierKey,
    hasServicePraise: !!input.servicePraise,
  });

  return buildFallbackReview(
    cardPlan,
    input.lang,
    input.recentTexts,
    input.visitTierKey,
    input.servicePraise,
    extraAvoidTexts,
  );
}

async function generateReviewsForStore(input) {
  const store = input.store;
  const lang = input.lang === "en" ? "en" : "zh";
  const recentTexts = uniqueArray(input.recentTexts || []).slice(-6);
  const menuContext = buildMenuContext(input.menuJson);
  const visitTierKey = String(input.visitTier || "").trim();
  const visitTier = getVisitTierOption(visitTierKey);
  const rawServicePraise = input.servicePraise && typeof input.servicePraise === "object" ? input.servicePraise : null;
  const servicePraise =
    rawServicePraise && String(rawServicePraise.staffLabel || "").trim()
      ? {
          staffLabel: String(rawServicePraise.staffLabel || "").trim(),
          praiseKey: getServicePraiseOption(String(rawServicePraise.praiseKey || "").trim()).key,
        }
      : null;

  if (!menuContext.flatDishes.length) {
    throw createAppError("MENU_EMPTY", "Published service catalog is empty", 422);
  }

  if (!visitTier) {
    throw createAppError("INVALID_VISIT_TIER", "Visit tier is required", 400);
  }

  const dishIds = uniqueArray(
    (input.dishIds || [])
      .map(function (dishId) {
        return Number(dishId);
      })
      .filter(function (dishId) {
        return menuContext.dishMap.has(dishId);
      }),
  );

  if (!dishIds.length) {
    throw createAppError("INVALID_DISH_IDS", "No valid dish IDs supplied for this store", 400);
  }

  let lastError = null;
  const reviewKeywords = getActiveReviewKeywords(store, lang);
  const focusAssignments = buildFocusAssignments();
  const lengthAssignments = buildReviewLengthAssignments(lang);
  const keywordAssignments = buildKeywordAssignments(reviewKeywords, focusAssignments, lengthAssignments, lang);
  const patternAssignments = buildPatternAssignments(focusAssignments, visitTierKey, servicePraise);
  const surfaceAssignments = buildSurfaceAssignments(lang);
  const visitPrefixAssignments = buildVisitPrefixAssignments(visitTierKey, lang);
  const dishSelectionAssignments = buildDishSelectionAssignments(dishIds);
  const cardPlans = STYLE_VARIANTS.map(function (variant) {
    return buildReviewCardPlan(
      variant.key,
      lang,
      focusAssignments,
      lengthAssignments,
      keywordAssignments,
      patternAssignments,
      surfaceAssignments,
      visitPrefixAssignments,
      dishSelectionAssignments,
    );
  });
  const cardPlanMap = new Map(cardPlans.map(function (cardPlan) {
    return [cardPlan.styleKey, cardPlan];
  }));

  async function generateReviewBatch() {
    let reviews = await Promise.all(
      STYLE_VARIANTS.map(function (variant) {
        return generateSingleReviewCard({
          store: store,
          menuContext: menuContext,
          dishIds: dishIds,
          lang: lang,
          recentTexts: recentTexts,
          visitTierKey: visitTierKey,
          servicePraise: servicePraise,
          model: input.model,
          cardPlan: cardPlanMap.get(variant.key),
        });
      }),
    );

    validateGeneratedReviews(
      reviews,
      lang,
      recentTexts,
      lengthAssignments,
      keywordAssignments,
      servicePraise,
      visitTierKey,
      visitPrefixAssignments,
    );

    for (let groupAttempt = 0; groupAttempt < GROUP_DIVERSITY_ATTEMPTS; groupAttempt += 1) {
      const similarStyleKeys = getSimilarReviewStyleKeys(reviews, visitTierKey, lang);
      if (!similarStyleKeys.length) {
        return reviews;
      }

      reviews = await Promise.all(
        reviews.map(function (review) {
          if (similarStyleKeys.indexOf(review.styleKey) === -1) {
            return Promise.resolve(review);
          }

          const extraAvoidTexts = reviews
            .filter(function (otherReview) {
              return otherReview.styleKey !== review.styleKey;
            })
            .map(function (otherReview) {
              return otherReview.text;
            });

          return generateSingleReviewCard({
            store: store,
            menuContext: menuContext,
            dishIds: dishIds,
            lang: lang,
            recentTexts: recentTexts,
            visitTierKey: visitTierKey,
            servicePraise: servicePraise,
            model: input.model,
            cardPlan: cardPlanMap.get(review.styleKey),
            extraAvoidTexts: extraAvoidTexts,
          });
        }),
      );

      validateGeneratedReviews(
        reviews,
        lang,
        recentTexts,
        lengthAssignments,
        keywordAssignments,
        servicePraise,
        visitTierKey,
        visitPrefixAssignments,
      );
    }

    if (getSimilarReviewStyleKeys(reviews, visitTierKey, lang).length) {
      throw createAppError("REVIEWS_TOO_SIMILAR", "Generated reviews were too similar", 502);
    }

    return reviews;
  }

  for (let generationAttempt = 0; generationAttempt < GROUP_GENERATION_ATTEMPTS; generationAttempt += 1) {
    try {
      return await generateReviewBatch();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || createAppError("REVIEW_GENERATION_FAILED", "Unable to generate reviews", 502);
}

module.exports = {
  generateReviewsForStore,
};
