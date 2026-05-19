// ============================================
// Salon 配置
// ============================================
window.APP_CONFIG = {
  // 品牌名称
  // 留空时由门店 bootstrap 数据覆盖。
  restaurantNameZh: "",
  restaurantNameEn: "",
  defaultStoreSlug: "angel-tips-garwood",

  // Google 评论入口（优先使用门店 store settings 里的 Google review URL）
  googleReviewUrl: "",

  // 可选备用入口（可在门店 store settings 里单独配置）
  googleReviewFallbackUrl: "",

  // Shopify checkout 配置（敏感 token 放后端环境变量，不放前端）
  // 这里只保留非敏感的产品/订阅标识。
  // 当前 pricing CTA 会创建一个包含：
  // 1. $199 一次性 setup（商品 Professional Setup）
  // 2. $29 / month 订阅（商品 RankMySalon Monthly Plan；变体 ID 与 Admin 商品页一致）
  // 的 Shopify cart，然后跳转到托管 checkout。
  shopify: {
    domain: "y6y1hf-45.myshopify.com",
    storefrontApiVersion: "2026-04",
    setupVariantId: "gid://shopify/ProductVariant/45083563884623",
    monthlyVariantId: "gid://shopify/ProductVariant/45109454700623",
    monthlySellingPlanId: "gid://shopify/SellingPlan/1787723855",
  },

  // 当前版本应通过后端 API 调用 OpenAI。
  // 不要在前端配置里放 API Key。

  // 评论提示词参考
  reviewAspects: {
    zh: [
      { category: "效果", tags: ["做得细致", "颜色很好看", "成品很干净", "整体很精致"] },
      { category: "体验", tags: ["过程很放松", "很耐心", "节奏刚好"] },
      { category: "服务", tags: ["staff很热情", "沟通很顺", "照顾得很周到"] },
      { category: "环境", tags: ["店里很干净", "空间舒服", "氛围轻松"] },
      { category: "推荐", tags: ["会再来", "会推荐给朋友", "比预期更好"] },
    ],
    en: [
      { category: "Results", tags: ["Clean finish", "Beautiful color", "Detailed work", "Polished look"] },
      { category: "Experience", tags: ["Relaxing", "Patient", "Smooth process"] },
      { category: "Service", tags: ["Warm staff", "Thoughtful", "Easy communication"] },
      { category: "Ambiance", tags: ["Clean salon", "Comfortable space", "Calming vibe"] },
      { category: "Recommend", tags: ["Would come back", "Recommend it", "Better than expected"] },
    ],
  },
};
