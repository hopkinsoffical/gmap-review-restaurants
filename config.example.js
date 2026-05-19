window.APP_CONFIG = {
  // Leave brand empty and let store bootstrap data fill it.
  restaurantNameZh: "",
  restaurantNameEn: "",
  defaultStoreSlug: "your-store-slug",
  googleReviewUrl: "",
  googleReviewFallbackUrl: "",
  shopify: {
    // Non-secret values only. Token must live in server env.
    domain: "your-store.myshopify.com",
    storefrontApiVersion: "2026-04",
    setupVariantId: "gid://shopify/ProductVariant/YOUR_SETUP_VARIANT_ID",
    monthlyVariantId: "gid://shopify/ProductVariant/YOUR_MONTHLY_VARIANT_ID",
    monthlySellingPlanId: "gid://shopify/SellingPlan/YOUR_MONTHLY_SELLING_PLAN_ID",
  },
};
