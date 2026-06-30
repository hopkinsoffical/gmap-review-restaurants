(function () {
  const SITE_NAME = "RankMyRestaurant";
  /** Full salon growth report — Shopify cart checkout (xxr20030522 / ec9b72e). */
  const FULL_REPORT_SHOPIFY_CHECKOUT_URL = "https://y6y1hf-45.myshopify.com/cart/45257592176719:1";
  const ROUTE_LANDING = "overview";
  const ROUTE_PRICE = "price";
  const ROUTE_SERVICES = "services";
  const ROUTE_ABOUT = "about";
  const ROUTE_TALK = "talk";
  const ROUTE_TAVUS_DEMO = "tavus-demo";
  const ROUTE_STORE = "store";
  const ROUTE_LOGIN = "login";
  const ROUTE_ADMIN = "admin";
  const ROUTE_ADMIN_STORES = "admin-stores";
  const ROUTE_ADMIN_STORE = "admin-store";
  const ROUTE_ADMIN_SMS = "admin-sms";
  const ROUTE_LEGACY = "legacy";
  const ROUTE_ANALYSIS_LIST = "analysis-list";
  const ROUTE_ANALYSIS_SALON = "analysis-salon";
  const ROUTE_ANALYSIS_FULL = "analysis-full";
  const ROUTE_LEADERBOARD_LIST = "leaderboard-list";
  const ROUTE_LEADERBOARD_SALON = "leaderboard-salon";
  const ROUTE_SMS_CONSENT = "sms-consent";
  const ROUTE_PRIVACY = "privacy";
  const ROUTE_TERMS = "terms";
  /** Client grid page size (keep in sync with server DEFAULT_PREVIEW_LIMIT / RLS top-N). */
  const LEADERBOARD_PAGE_SIZE = 20;
  const INTEL_PAGE_SIZE = 20;
  var smsFunnelPingTimer = null;
  var smsFunnelRuntimeCfg = null;
  var smsFunnelVisibilityBound = false;
  var smsFunnelScrollBound = false;
  var smsFunnelScrollMarks = {};
  /** Match DB geo strings to UI filters (keep in sync with lib/server/leaderboard-geo-variants.js). */
  function leaderboardRowMatchesState(rowState, filterState) {
    if (filterState === "All States") return true;
    var r = String(rowState || "").trim();
    var f = String(filterState || "").trim();
    if (r === f) return true;
    var pairs = [
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
    for (var i = 0; i < pairs.length; i++) {
      var ab = pairs[i][0];
      var full = pairs[i][1];
      if ((f === ab || f === full) && (r === ab || r === full)) return true;
      if (f.toLowerCase() === full.toLowerCase() && (r === ab || r === full)) return true;
    }
    return false;
  }
  function leaderboardRowMatchesCounty(rowCounty, filterCounty) {
    if (filterCounty === "All Counties") return true;
    var r = String(rowCounty || "").trim();
    var f = String(filterCounty || "").trim();
    if (r === f) return true;
    var rBase = r.replace(/\s+County$/i, "").trim();
    var fBase = f.replace(/\s+County$/i, "").trim();
    return rBase !== "" && fBase !== "" && rBase === fBase;
  }
  function leaderboardRowMatchesTown(rowTown, filterTown) {
    if (filterTown === "All Townships") return true;
    var r = String(rowTown || "").trim();
    var f = String(filterTown || "").trim();
    if (r === f) return true;
    var rBare = r.replace(/\s+Township$/i, "").trim();
    var fBare = f.replace(/\s+Township$/i, "").trim();
    return rBare !== "" && fBare !== "" && rBare === fBare;
  }
  const LANGUAGE_STORAGE_KEY = "rankmyrestaurant-language-v1";
  /** Public marketing site: single control cycles these (store/portal still zh|en only). */
  const SITE_LANG_ORDER = ["en", "zh", "vi", "ko", "es"];
  const SITE_LANG_LABELS = {
    en: "English",
    zh: "中文",
    vi: "Tiếng Việt",
    ko: "한국어",
    es: "Español",
  };
  const SITE_LANG_HTML = {
    en: "en",
    zh: "zh-CN",
    vi: "vi",
    ko: "ko",
    es: "es",
  };

  const defaultConfig = {
    restaurantNameZh: "蟹宝 Edison",
    restaurantNameEn: "Xiebao Edison",
    defaultStoreSlug: "xiebao-edison",
    googleReviewUrl: "",
    googleReviewFallbackUrl: "",
  };

  const config = Object.assign({}, defaultConfig, window.APP_CONFIG || {});
  let lastTrackedPagePath = "";

  function trackEvent(name, params) {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    try {
      window.gtag("event", name, params || {});
    } catch (err) {
      console.warn("Analytics track failed:", err);
    }
  }

  function analyticsParams(extra) {
    const base = {
      page_type: state && state.routeKind ? state.routeKind : "",
      locale: state && state.lang ? state.lang : "",
      store_slug: state && state.storeSlug ? state.storeSlug : "",
    };
    return Object.assign(base, extra || {});
  }

  function trackPageView() {
    if (typeof window === "undefined") return;
    const path = window.location.pathname + window.location.search;
    if (lastTrackedPagePath === path) return;
    lastTrackedPagePath = path;
    trackEvent("page_view", analyticsParams({
      page_path: path,
      page_title: document.title || "",
    }));
  }
  const DIGITAL_HUMAN_VIDEO_PATH = "/assets/marketing/front_desk.mp4";
  const DIGITAL_HUMAN_POSTER_PATH = "/assets/marketing/front_desk-poster.png";
  const MARKETING_COPY_I18N = {
    en: {
      navBrand: SITE_NAME,
      rating: "4.9 out of 5",
      heroTitleLead: "Get More Diners.",
      heroTitleMiddle: "",
      heroTitleAccent: "Rank Higher.",
      heroBody:
        "We help restaurants rank #1 on Google Maps and turn every search into reservations, calls, and loyal diners.",
      landingBenefitRank: "Rank Higher",
      landingBenefitCalls: "More Calls",
      landingBenefitReviews: "Better Reviews",
      landingCtaPrimary: "Get My Free Report",
      landingCtaSecondary: "See How It Works",
      landingTrustFree: "100% Free",
      landingTrustNoObligation: "No obligation",
      landingTrustFast: "60 seconds",
      landingStatGrowth: "247%",
      landingStatGrowthLabel: "Ranking Growth",
      landingStatBookings: "3.2x",
      landingStatBookingsLabel: "Bookings",
      landingStatReviews: "4.9★",
      landingStatReviewsLabel: "Reviews",
      landingStatTraffic: "89%",
      landingStatTrafficLabel: "Foot Traffic",
      landingLeadTitle: "See How You Appear on Google",
      landingSocialProof: "4.9 / 5",
      landingSocialCount: "1200+ restaurants",
      landingPhoneRestaurant: "Bella Trattoria",
      landingPhoneRankBadge: "#1",
      landingPhoneRankLabel: "Local ranking",
      landingPhoneNotif: "New 5-star review",
      primaryCtaLabel: "Get your restaurant rank",
      trustTitle: "We Help Restaurants Get",
      trustPoints: [
        "More 5-Star Reviews on Google",
        "More Reservations from Your Profile",
        "More Diners from Social Media",
        "More Calls Turned into Tables",
      ],
      digitalHumanOverviewKicker: "The Smartest Person in the Room",
      digitalHumanOverviewTitle: "Meet Ryan, Your Growth Advisor",
      digitalHumanOverviewHeading: "You Might Be Losing Diners on Google Right Now",
      digitalHumanOverviewBody:
        "Open Ryan's live conversation page to see the front desk video, real-time transcript, and next-step coaching in one place.",
      digitalHumanOverviewPoints: [
        "Live voice + transcript",
        "Host stand video stage",
        "Starts only when clicked",
      ],
      digitalHumanOverviewStageLabel: "Superhuman host stand",
      digitalHumanOverviewStageTitle: "Ryan feels more like a premium AI host and local growth closer than a chatbot.",
      digitalHumanOverviewStageBody:
        "Open the live conversation page to start voice, video, and transcript together.",
      digitalHumanPhoneLabel: "Or Call/Text 877-600-3082",
      digitalHumanPhoneHref: "tel:8776003082",
      digitalHumanTitle: "Meet Ryan, Your AI Voice Agent",
      digitalHumanHeading: "Experience AI-Led Exponential Growth",
      digitalHumanBody:
        "Your always-on, top revenue producer with perfect recall and empathy. Qualifies leads. Pitches your services. Runs demos. And goes for the close.",
      digitalHumanCtaLabel: "Talk to Ryan",
      insightsTitle: "Insights",
      insightsSubtitle: "Video picks for Google Maps visibility, reviews, and restaurant growth.",
      insightsVideoLabel: "Featured clip",
      priceTitle: "Simple Pricing:",
      pricingAmount: "$29",
      pricingPeriod: "/ Month",
      pricingAnnualAmount: "$200",
      pricingAnnualPeriod: "/ Year",
      pricingAnnualSaveNote: "Save over $140/yr",
      pricingGuarantees: ["NO Contract", "NO Hidden Fees", "CANCEL Anytime"],
      pricingCtaLabel: "Start attracting new diners today!",
      pricingSetupNote: "(* $199 One-time Professional Setup + NFC Device)",
      pricingSetupTitle: "Professional Setup",
      pricingSetupAmount: "$199",
      pricingSetupBadge: "One-time",
      pricingSetupIncludes: "Includes 1 NFC Review Card",
      pricingExtraDeviceTitle: "Extra NFC Review Card",
      pricingExtraDeviceAmount: "$15",
      pricingExtraDeviceBadge: "Add-on",
      pricingExtraDeviceCopy: "Additional tap-to-review cards for host stands, tables, and checkout areas.",
      aboutTitle: "About Us",
      aboutBody:
        "Placeholder about page. Use this route for the final brand story, restaurant positioning, trust points, and direct contact details.",
    },
    zh: {
      navBrand: SITE_NAME,
      rating: "4.9 / 5",
      heroTitleLead: "带来更多食客。",
      heroTitleMiddle: "",
      heroTitleAccent: "排名更高。",
      heroBody: "我们帮助餐厅在 Google Maps 上排名第一，把每次搜索变成订位、来电和回头客。",
      landingBenefitRank: "排名更高",
      landingBenefitCalls: "更多来电",
      landingBenefitReviews: "更好评论",
      landingCtaPrimary: "获取免费报告",
      landingCtaSecondary: "了解如何运作",
      landingTrustFree: "100% 免费",
      landingTrustNoObligation: "无强制义务",
      landingTrustFast: "60 秒完成",
      landingStatGrowth: "247%",
      landingStatGrowthLabel: "排名增长",
      landingStatBookings: "3.2x",
      landingStatBookingsLabel: "订位增长",
      landingStatReviews: "4.9★",
      landingStatReviewsLabel: "评论表现",
      landingStatTraffic: "89%",
      landingStatTrafficLabel: "到店客流",
      landingLeadTitle: "看看你在 Google 上的呈现",
      landingSocialProof: "4.9 / 5",
      landingSocialCount: "1200+ 家餐厅",
      landingPhoneRestaurant: "Bella Trattoria",
      landingPhoneRankBadge: "#1",
      landingPhoneRankLabel: "本地排名",
      landingPhoneNotif: "新的五星好评",
      primaryCtaLabel: "查看餐厅排名",
      trustTitle: "我们帮助餐厅获得",
      trustPoints: [
        "获得更多 Google 五星评论",
        "让门店主页带来更多订位",
        "从社交媒体带来更多食客",
        "把来电变成真实到店餐桌",
      ],
      digitalHumanOverviewKicker: "房间里最聪明的前台",
      digitalHumanOverviewTitle: "认识 Ryan，你的增长顾问",
      digitalHumanOverviewHeading: "你现在可能正在 Google 上流失食客",
      digitalHumanOverviewBody:
        "打开 Ryan 的实时对话页，在一个页面里看到 front desk 视频、聊天记录和下一步增长建议。",
      digitalHumanOverviewPoints: [
        "实时语音 + 聊天记录",
        "餐厅接待视频展示",
        "点击后才开始",
      ],
      digitalHumanOverviewStageLabel: "Superhuman 餐厅接待",
      digitalHumanOverviewStageTitle: "Ryan 更像高级 AI 接待与本地增长顾问，而不是普通聊天机器人。",
      digitalHumanOverviewStageBody:
        "打开实时对话页后，就能把语音、视频和聊天记录放在同一个页面里。",
      digitalHumanPhoneLabel: "也可电话/短信 877-600-3082",
      digitalHumanPhoneHref: "tel:8776003082",
      digitalHumanTitle: "认识 Ryan，你的 AI 语音顾问",
      digitalHumanHeading: "体验 AI 驱动的增长",
      digitalHumanBody:
        "一个全天在线、记忆清楚、有同理心的增长助手。帮你筛选线索、介绍服务、完成演示，并推动客户下一步行动。",
      digitalHumanCtaLabel: "和 Ryan 对话",
      insightsTitle: "精选洞察",
      insightsSubtitle: "关于地图曝光、评论与门店获客的短视频精选。",
      insightsVideoLabel: "精选视频",
      priceTitle: "简单价格：",
      pricingAmount: "$29",
      pricingPeriod: "/ 月",
      pricingAnnualAmount: "$200",
      pricingAnnualPeriod: "/ 年",
      pricingAnnualSaveNote: "每年节省超过 $140",
      pricingGuarantees: ["无合约", "无隐藏费用", "随时取消"],
      pricingCtaLabel: "现在开始吸引新食客",
      pricingSetupNote: "（* $199 一次性专业设置费 + NFC 设备）",
      pricingSetupTitle: "专业设置",
      pricingSetupAmount: "$199",
      pricingSetupBadge: "一次性",
      pricingSetupIncludes: "包含 1 张 NFC 评论卡",
      pricingExtraDeviceTitle: "额外 NFC 评论卡",
      pricingExtraDeviceAmount: "$15",
      pricingExtraDeviceBadge: "可加购",
      pricingExtraDeviceCopy: "可为前台、餐桌与结账区增加轻触评价卡。",
      aboutTitle: "关于我们",
      aboutBody: "这里用于呈现最终品牌故事、餐厅定位、信任点和联系方式。",
    },
  };
  const MARKETING_COPY = createLocalizedProxy(MARKETING_COPY_I18N);

  const ABOUT_PAGE_CONTENT_I18N = {
    en: {
      kicker: "Built by 360AI Media",
      title: "About Us",
      tagline: "Strategy, creativity, and execution focused on real growth.",
      intro:
        "RankMyRestaurant is built by 360AI Media, a next-gen creative and digital marketing agency focused on turning attention into bookings, calls, and measurable business growth.",
      summary:
        "The team behind 360AI Media combines audience strategy, design, messaging, and performance execution. Instead of chasing vanity metrics, the work is built around visibility that converts and systems that keep demand moving.",
      pillars: [
        {
          title: "Strategy First",
          body: "Audience insight, competitor mapping, and offer clarity shape the work before anything goes live.",
        },
        {
          title: "Creative That Connects",
          body: "Strong positioning and scroll-stopping creative help brands stand out and stay memorable.",
        },
        {
          title: "Growth That Performs",
          body: "Campaigns, automation, and follow-up flows are tuned for leads, bookings, and revenue.",
        },
      ],
      storyKicker: "Who We Are",
      storyTitle: "The operating model behind RankMyRestaurant",
      storyBody:
        "360AI Media presents itself as the place where strategy meets creativity and execution. RankMyRestaurant applies that same mindset to restaurants: stronger reputation, smarter follow-up, and more diners from the attention they already earn.",
      strengthsKicker: "What We Bring",
      strengthsTitle: "A practical growth system, not disconnected tactics",
      strengths: [
        {
          title: "360-Degree Strategy",
          body: "We start with market understanding, audience signals, and a clear plan before pushing tools or campaigns.",
        },
        {
          title: "Creative That Clicks",
          body: "Messaging, design, and brand expression are shaped to grab attention and make the offer instantly clear.",
        },
        {
          title: "Performance-Driven Execution",
          body: "Every touchpoint is measured against trust, lead quality, and the actions that move customers closer to booking.",
        },
        {
          title: "Agile Follow-Through",
          body: "Ideas are only useful when they ship. The team works with urgency, adapts fast, and keeps momentum high.",
        },
      ],
      teamKicker: "Leadership",
      teamTitle: "The people behind 360AI Media",
      team: [
        {
          name: "Dr. Homer Wu",
          role: "CEO & Founder",
          body: "Leads the overall vision across product direction, market positioning, and growth strategy.",
        },
        {
          name: "Max",
          role: "CTO & Co-founder",
          body: "Owns the technical foundation that turns operational ideas into working products and automation.",
        },
        {
          name: "Scott",
          role: "COO & Co-founder",
          body: "Drives execution, systems, and day-to-day operational follow-through across the business.",
        },
        {
          name: "Jaye",
          role: "VP Marketing",
          body: "Shapes the go-to-market narrative, campaign direction, and audience-facing brand communication.",
        },
      ],
      edgeKicker: "Why It Matters",
      edgeTitle: "Why teams choose 360AI Media",
      edge: [
        {
          title: "Deep Industry Expertise",
          body: "Experience across multiple sectors helps the team build strategies that resonate and stay measurable.",
        },
        {
          title: "Full-Stack Digital Support",
          body: "From brand messaging to automation and follow-up, services are designed to work as one system.",
        },
        {
          title: "Global Scale, Boutique Thinking",
          body: "The operating model combines broad capability with the attention and tailoring of a smaller creative partner.",
        },
        {
          title: "Scale With Soul",
          body: "Growth is pursued without flattening the brand. The work aims to keep identity, trust, and performance aligned.",
        },
      ],
      ctaKicker: "Start The Conversation",
      ctaTitle: "Turn local attention into booked tables.",
      ctaBody:
        "If demand is leaking between Google discovery and actual reservations, we can help you identify the bottleneck and recommend the next practical fix.",
      ctaNote: "Most restaurant teams ask us about:",
      ctaHighlights: [
        "Google Maps visibility and ranking",
        "Review growth and reputation lift",
        "Missed-call recovery, reservations, and smart follow-up",
      ],
      serviceOptions: [
        "Google ranking and visibility",
        "Review capture and reputation",
        "AI host / voice agent",
        "Lead follow-up automation",
        "Repeat visits and diner retention",
        "Website / reservation conversion",
        "Not sure yet",
      ],
    },
    zh: {
      kicker: "由 360AI Media 打造",
      title: "关于我们",
      tagline: "用策略、创意和执行力推动真实增长。",
      intro:
        "RankMyRestaurant 由 360AI Media 打造。我们是一家新一代创意与数字营销机构，专注把注意力转化为预约、来电和可衡量的业务增长。",
      summary:
        "360AI Media 团队结合用户策略、设计、信息表达和增长执行。我们不追逐虚荣指标，而是围绕能带来转化的曝光和持续推动需求的系统来工作。",
      pillars: [
        {
          title: "策略先行",
          body: "在任何内容上线前，先明确目标客群、竞争格局和门店卖点。",
        },
        {
          title: "让人记住的创意",
          body: "通过清晰定位和有记忆点的表达，让品牌更容易被看见、被理解。",
        },
        {
          title: "以结果为导向",
          body: "广告、自动化和跟进流程都围绕线索、预约和营收来优化。",
        },
      ],
      storyKicker: "我们是谁",
      storyTitle: "RankMyRestaurant 背后的运营模型",
      storyBody:
        "360AI Media 的核心是把策略、创意和执行结合起来。RankMyRestaurant 将这套方法应用到餐饮门店：提升口碑、优化跟进，把已经获得的曝光转化成更多到店食客。",
      strengthsKicker: "我们带来的价值",
      strengthsTitle: "这是一套实用增长系统，不是零散工具",
      strengths: [
        {
          title: "360 度策略",
          body: "先理解市场、客户信号和增长目标，再决定使用哪些工具和活动。",
        },
        {
          title: "能被点击的创意",
          body: "用更清楚的文案、视觉和品牌表达，让客户一眼明白你为什么值得选择。",
        },
        {
          title: "以表现为核心的执行",
          body: "每一个触点都围绕信任、线索质量和推动预约的动作来衡量。",
        },
        {
          title: "快速落地",
          body: "想法只有上线才有价值。团队保持高节奏执行，并根据反馈快速调整。",
        },
      ],
      teamKicker: "领导团队",
      teamTitle: "360AI Media 背后的团队",
      team: [
        {
          name: "Dr. Homer Wu",
          role: "CEO & Founder",
          body: "负责整体愿景、产品方向、市场定位和增长策略。",
        },
        {
          name: "Max",
          role: "CTO & Co-founder",
          body: "负责技术基础，把运营想法变成可工作的产品和自动化系统。",
        },
        {
          name: "Scott",
          role: "COO & Co-founder",
          body: "负责执行、流程和日常运营推进。",
        },
        {
          name: "Jaye",
          role: "VP Marketing",
          body: "负责市场叙事、活动方向和面向客户的品牌沟通。",
        },
      ],
      edgeKicker: "为什么重要",
      edgeTitle: "为什么团队选择 360AI Media",
      edge: [
        {
          title: "深入行业理解",
          body: "跨行业经验帮助我们建立既能打动客户、又能衡量效果的增长策略。",
        },
        {
          title: "全栈数字支持",
          body: "从品牌表达、内容到自动化跟进，各项服务被设计成一套协同系统。",
        },
        {
          title: "具备规模能力，也保留精品思维",
          body: "既有完整能力，也保留小团队式的专注和定制化服务。",
        },
        {
          title: "有温度的增长",
          body: "增长不应该牺牲品牌个性。我们的目标是让信任、身份和表现保持一致。",
        },
      ],
      ctaKicker: "开始沟通",
      ctaTitle: "把本地曝光变成真实订位和到店。",
      ctaBody:
        "如果食客从 Google 发现你到真正订位/到店之间正在流失，我们可以帮你找出瓶颈，并给出下一步可执行的修复建议。",
      ctaNote: "多数餐厅团队会问我们：",
      ctaHighlights: [
        "Google Maps 曝光和排名",
        "评论增长和口碑提升",
        "未接来电挽回、订位和智能跟进",
      ],
      serviceOptions: [
        "Google 排名和曝光",
        "评论获取和口碑管理",
        "AI 接待 / 语音顾问",
        "线索跟进自动化",
        "复购、回头客和会员留存",
        "网站 / 订位转化",
        "暂时不确定",
      ],
    },
  };
  const ABOUT_PAGE_CONTENT = createLocalizedProxy(ABOUT_PAGE_CONTENT_I18N);
  const LEGAL_PAGE_CONTENT = {
    sms: {
      title: "SMS Consent & Messaging Terms",
      updatedAt: "Last updated: April 28, 2026",
      intro:
        "This page explains how RankMyRestaurant sends SMS messages in the United States, how consent works, and how to stop messages at any time.",
      sections: [
        {
          title: "How You Opt In",
          bullets: [
            "You may opt in through our website forms, sales onboarding, or direct written confirmation.",
            "By opting in, you agree to receive recurring service-related text messages from RankMyRestaurant.",
            "Consent is not a condition of purchase.",
          ],
        },
        {
          title: "Message Types",
          bullets: [
            "Onboarding and account setup updates.",
            "Appointment and follow-up reminders.",
            "Service notices and customer support responses.",
          ],
        },
        {
          title: "Frequency, Carriers, and Fees",
          bullets: [
            "Message frequency varies by your account activity.",
            "Message and data rates may apply depending on your carrier plan.",
            "Carriers are not liable for delayed or undelivered messages.",
          ],
        },
        {
          title: "How To Opt Out",
          bullets: [
            "Reply STOP to any message to unsubscribe.",
            "After STOP, you will receive a confirmation text and no further SMS messages unless you opt in again.",
            "For assistance, reply HELP or contact info@360AIMedia.com.",
          ],
        },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      updatedAt: "Last updated: April 28, 2026",
      intro:
        "This Privacy Policy explains what information we collect, how we use it, and your choices, including SMS-specific privacy protections.",
      sections: [
        {
          title: "Information We Collect",
          bullets: [
            "Contact details such as name, email, and phone number.",
            "Business profile details provided during onboarding.",
            "Operational and analytics data related to platform usage.",
          ],
        },
        {
          title: "How We Use Information",
          bullets: [
            "To deliver and improve RankMyRestaurant services.",
            "To provide customer support and account notifications.",
            "To send SMS messages only where valid consent exists.",
          ],
        },
        {
          title: "SMS Privacy Commitment",
          bullets: [
            "SMS consent is not shared with third parties for their own marketing.",
            "Phone numbers and consent records are used only for service delivery, compliance, and support.",
            "You can opt out of SMS at any time by replying STOP.",
          ],
        },
        {
          title: "Data Sharing & Security",
          bullets: [
            "We may use trusted service providers for hosting, messaging, and analytics under contractual safeguards.",
            "We maintain reasonable technical and organizational safeguards to protect your information.",
            "No method of transmission or storage is 100% secure, but we continuously improve protections.",
          ],
        },
      ],
    },
    terms: {
      title: "Terms of Service",
      updatedAt: "Last updated: April 28, 2026",
      intro:
        "These Terms govern access to and use of RankMyRestaurant services. By using the service, you agree to these Terms.",
      sections: [
        {
          title: "Use of Service",
          bullets: [
            "You agree to provide accurate account information and keep credentials secure.",
            "You are responsible for activity under your account.",
            "You must use the service in compliance with applicable laws and regulations.",
          ],
        },
        {
          title: "SMS Terms",
          bullets: [
            "If you opt in to SMS, you agree to receive recurring service-related text messages.",
            "Message frequency varies. Message and data rates may apply.",
            "Reply STOP to opt out or HELP for help.",
          ],
        },
        {
          title: "Service Availability & Changes",
          bullets: [
            "Features may evolve over time and we may modify, suspend, or discontinue features as needed.",
            "We may update these Terms periodically and will post revised versions on this page.",
            "Continued use after updates means you accept the revised Terms.",
          ],
        },
        {
          title: "Contact",
          bullets: ["Questions about these Terms, Privacy Policy, or SMS practices: info@360AIMedia.com"],
        },
      ],
    },
  };

const MARKETING_THEME_STORAGE_KEY = "site-theme";

function getMarketingTheme() {
  const savedTheme = localStorage.getItem(MARKETING_THEME_STORAGE_KEY);

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return "light";
}

function getMarketingThemeIcon() {
  return getMarketingTheme() === "dark" ? "☾" : "☀";
}

function isStoreVisitPathname(pathname) {
  return /^\/stores\/[^/]+/i.test(String(pathname || location.pathname || ""));
}

function applyMarketingTheme(theme, options) {
  var opts = options || {};
  document.documentElement.setAttribute("data-theme", theme);
  if (opts.persist !== false) {
    localStorage.setItem(MARKETING_THEME_STORAGE_KEY, theme);
  }

  const themeIcons = document.querySelectorAll("[data-theme-icon]");

  themeIcons.forEach(function (icon) {
    icon.textContent = theme === "dark" ? "☾" : "☀";
  });
}

function toggleMarketingTheme() {
  if (isStoreVisitPathname(location.pathname)) {
    return;
  }
  const currentTheme = getMarketingTheme();
  const nextTheme = currentTheme === "dark" ? "light" : "dark";

  applyMarketingTheme(nextTheme);
}

window.toggleMarketingTheme = toggleMarketingTheme;

if (isStoreVisitPathname(location.pathname)) {
  document.documentElement.classList.add("store-theme-locked");
  applyMarketingTheme("dark", { persist: false });
} else {
  applyMarketingTheme(getMarketingTheme());
}


  const MARKETING_UI_I18N = {
    en: {
      pageTitleLanding: "AI Growth for Restaurants",
      pageTitlePricing: "Pricing",
      pageTitleAbout: "About Us",
      pageTitleTalk: "Call voice agent",
      pageTitleTavusDemo: "Voice agent",
      pageTitleAnalysisList: "Local Restaurant Ranking",
      pageTitleAnalysisSalon: "Restaurant ranking detail",
      pageTitleLeaderboardList: "AI Leaderboard",
      pageTitleLeaderboardSalon: "Restaurant scorecard",
      pageTitleSmsConsent: "SMS Consent",
      pageTitlePrivacy: "Privacy Policy",
      pageTitleTerms: "Terms of Service",
      pageTitleLogin: "Sign In",
      pageTitleAdmin: "Admin",
      pageTitleAdminStores: "Stores",
      pageTitleAdminStore: "Store Editor",
      navOverview: "Overview",
      navPrice: "Price",
      navServices: "Services",
      navAbout: "About Us",
      navLeaderboard: "Leaderboard",
      navAnalysis: "Local Ranking",
      navAgent: "AI Agent",
      navTools: "Tools",
      navContact: "Contact Us",
      navDashboard: "Dashboard",
      navSignIn: "Sign in",
      footerProduct: "PRODUCT",
      footerProductHeader: "Review Tools",
      footerReviewsManager: "Reviews Manager",
      footerResponseManager: "Response Manager",
      footerAnalytics: "Analytics",
      footerReports: "Reports",
      footerFeatures: "FEATURES",
      footerFeaturesHeader: "Automation",
      footerAiVoiceAgent: "AI Voice Agent",
      footerSmartFollowUp: "Smart Follow-up",
      footerClientAcquisition: "Client Acquisition",
      footerBookingSystem: "Booking System",
      footerCompany: "COMPANY",
      footerAboutUs: "About Us",
      footerPricing: "Pricing",
      footerBlog: "Blog",
      footerContact: "Contact",
      footerSupport: "Support",
      footerSmsConsent: "SMS Consent",
      footerPrivacy: "Privacy Policy",
      footerTerms: "Terms of Service",
      footerAddressSalon: "Restaurant Platform",
      footerAddressAutomation: "AI Growth Automation",
      footerCopyright: "© 2026 RankMyRestaurant. Restaurant-ready AI for reviews, follow-up, and voice automation.",
      formNameLabel: "Name *",
      formNamePlaceholder: "Your full name",
      formEmailLabel: "Email *",
      formEmailPlaceholder: "Best email for reply",
      formPhoneLabel: "Phone *",
      formPhonePlaceholder: "Best number to reach you",
      formCompanyLabel: "Company",
      formCompanyPlaceholder: "Restaurant or company name",
      formServiceLabel: "What Do You Need Help With?",
      formServicePlaceholder: "Choose the closest fit",
      formMessageLabel: "Message *",
      formMessagePlaceholder: "What is the biggest growth bottleneck right now?",
      formSubmit: "Send Inquiry",
      formSending: "Sending your message...",
      formSmsConsentNotice:
        "By providing your phone number, you agree to receive recurring SMS messages from RankMyRestaurant (service updates and follow-up). Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.",
      formSmsConsentLinksPrefix: "See our",
      formSmsConsentLinkSms: "SMS Consent",
      formSmsConsentLinkPrivacy: "Privacy Policy",
      formSmsConsentLinkTerms: "Terms",
      formSmsConsentCheckbox:
        "I agree to receive recurring SMS messages from RankMyRestaurant (service updates and follow-up).",
      formSmsConsentRequired: "Please check the SMS consent box to continue.",
      formSuccess: "Thank you. We received your message and will follow up soon. You can also reach us at info@360AIMedia.com.",
      formFailure: "Could not save your message. Please try again or email info@360AIMedia.com.",
      heroBriefSalonLabel: "Restaurant name *",
      heroBriefSalonPlaceholder: "As shown on Google Maps",
      heroBriefContactLabel: "Mobile or email *",
      heroBriefContactPlaceholder: "(555) 123-4567 or owner@restaurant.com",
      heroBriefSubmit: "Get My Free Report",
      heroBriefSmsConsentCheckbox:
        "If you entered a mobile number, I agree to receive SMS with my brief report and related updates from RankMyRestaurant.",
      heroBriefFieldsRequired: "Please enter your restaurant name and a valid mobile number or email.",
      heroBriefInvalidEmail: "That email doesn’t look valid. Double-check or use a phone number instead.",
      heroBriefInvalidPhone: "Enter a phone number with at least 7 digits, or use your email instead.",
      heroBriefSuccess:
        "You’re on the list — we’ll send your brief report shortly. Check spam if you used email.",
      contactModalTitle: "Contact us",
      contactModalClose: "Close dialog",
      contactModalLead:
        "Tell us how we can help. Your details are sent securely to our team; we typically reply within one business day.",
      pricingKicker: "Pricing",
      pricingBody: "One clean plan for restaurants that want faster reviews, follow-up, and reservations.",
      pricingMonthly: "Monthly",
      pricingAnnual: "Annual",
      pricingOr: "or",
      pricingMonthlyDetail: "Billed monthly. Cancel anytime.",
      pricingAnnualBadge: "Annual · Best Value",
      pricingAnnualDetailPrefix: "One-time payment.",
      pricingSetupCopy: "Separate one-time fee to get your account launched and ready.",
      pricingExtraAmountUnit: " / each",
      pricingSummaryKicker: "Order Summary",
      pricingSummaryClose: "Close order summary",
      pricingSummaryTitle: "Review your order before checkout",
      pricingSummaryBody:
        "You will confirm one launch fee and one monthly subscription before we send you to Shopify's secure hosted checkout.",
      pricingSummaryPlanTitle: "RankMyRestaurant Monthly Plan",
      pricingSummaryPlanDetail: "Subscription · Billed monthly",
      pricingSummarySetupDeviceSuffix: " + NFC Device",
      pricingSummarySetupDetail: "One-time launch fee · Includes 1 NFC card",
      pricingSummaryDueTodayLabel: "Due today",
      pricingSummaryRecurringLabel: "Recurring after checkout",
      pricingSummaryBack: "Back",
      pricingSummaryCheckout: "Continue to Shopify Checkout",
      pricingSummarySecurity: "Secure checkout powered by Shopify.",
      pricingBusyLoading: "Loading...",
      pricingBusyRedirecting: "Redirecting...",
      shopifyNotConfigured: "Shopify checkout is not configured yet. Update config.js with the storefront token and variant IDs.",
      shopifyNotConfiguredShort: "Shopify checkout is not configured yet. Update config.js with domain and variant IDs.",
      shopifyCartFailedPrefix: "Shopify cart request failed with status ",
      shopifyCheckoutMissing: "Shopify cart checkout URL was missing.",
      shopifyStartFailed: "Unable to start checkout. Please try again.",
      assistantKicker: "Voice agent",
      assistantVoiceIntro:
        "Tap the button to call Ryan, our voice agent, on your phone. Your device will open the dialer.",
      assistantCallCta: "Call now",
      assistantBack: "Back to Overview",
      leaderboardLoadingTitle: "Local restaurant rankings",
      leaderboardLoadingBody: "Loading Supabase data...",
      leaderboardErrorTitle: "Leaderboard",
      leaderboardSetupHint:
        "Run sql/013_salon_ai_leaderboard.sql then sql/014_seed_salon_ai_leaderboard.sql in Supabase, reload schema cache if needed, and refresh.",
      leaderboardHeroKicker: "RankMyRestaurant.AI",
      leaderboardHeroTitlePrefix: "Is your restaurant ",
      leaderboardHeroTitleAccent: "losing customers",
      leaderboardHeroTitleSuffix: " to competitors?",
      leaderboardHeroBody:
        "Browse the live AI leaderboard for Google ranking factors: Google Maps visibility, review volume, sentiment, recency, local SEO strength, and conversion signals. Open any restaurant scorecard to see actions, voice agent Ryan workflow, and social media content building opportunities.",
      leaderboardSearchPlaceholder: "Restaurant name, township, ZIP, or address...",
      leaderboardSearchButton: "Search",
      leaderboardSearchAria: "Search by restaurant name, township, or address",
      leaderboardLive: "Live · Supabase realtime",
      leaderboardLiveUpdated: "Live · updated just now",
      leaderboardPreviewLabel: "Preview:",
      leaderboardPreviewSuffix: " by AI score.",
      leaderboardSignInFull: "Sign in",
      leaderboardSignInFullSuffix: " for the full directory.",
      leaderboardDirectoryKicker: "Directory:",
      leaderboardDirectoryBody: "all listed restaurants load here with Google ranking, local SEO, review management, voice agent, and social content growth context.",
      leaderboardDirectoryScorecardSuffix: " to open a restaurant scorecard.",
      leaderboardDirectorySampleHrefLabel: "Middlesex, NJ",
      leaderboardRequestListing: "Request listing",
      leaderboardRequestLead:
        "Tell us about your restaurant or ask for coverage in a new market. We will follow up by email.",
      leaderboardRequestType: "Request type",
      leaderboardRequestAddSalon: "Add my restaurant",
      leaderboardRequestMoreCoverage: "More markets / restaurants",
      leaderboardRequestSalonName: "Restaurant name",
      leaderboardRequestYourName: "Your name",
      leaderboardRequestEmail: "Email",
      leaderboardRequestPhone: "Phone",
      leaderboardRequestAddress: "Address",
      leaderboardRequestMessage: "Message",
      leaderboardRequestMessagePlaceholder: "Hours, Google Maps link, or coverage area",
      leaderboardRequestSend: "Send request",
      leaderboardRequestCancel: "Cancel",
      leaderboardRequestSending: "Sending...",
      leaderboardRequestFailed: "Request failed.",
      leaderboardRequestCouldNotSend: "Could not send.",
      leaderboardRequestThanks: "Thanks. We received your request.",
      leaderboardClose: "Close",
      leaderboardPrevious: "Previous",
      leaderboardNext: "Next",
      leaderboardState: "State",
      leaderboardCounty: "County",
      leaderboardTownship: "Township",
      leaderboardSalonCount: "restaurants",
      leaderboardScorecardLoading: "Loading scorecard...",
      leaderboardNotFound: "Restaurant not found.",
      leaderboardBack: "Back to leaderboard",
      leaderboardPreviewStrip: "Public preview",
      leaderboardTopLink: "Leaderboard",
      leaderboardCardMenuAria: "More options",
      leaderboardCardShare: "Share link",
      leaderboardCardViewScorecard: "View scorecard",
      leaderboardCardLinkCopied: "Link copied",
      leaderboardCardShareFailed: "Could not copy link",
      leaderboardAiKicker: "AI leaderboard",
      analysisLoadingTitle: "Analysis reports",
      analysisLoadingBody:
        "This might take a moment, we are pulling in a lot of data..",
      analysisDetailLoading:
        "This might take a moment, we are pulling in a lot of data..",
      analysisBackAll: "Back to all restaurants",
      analysisTalkListing: "Can't find your restaurant? Talk to Ryan to be listed",
      analysisKicker: "Google Maps · Local visibility",
      analysisTitle: "Local Restaurant Ranking",
      analysisBody:
        "Compare restaurants by Google Visibility score in your city. Rankings emphasize local SEO strength and customer-acquisition readiness from live Google signals.",
      analysisFreshDbHint:
        "If this is a fresh database, run sql/034_restr_ai_leaderboard.sql in Supabase SQL Editor, then reload.",
      analysisGeoLabel: "Showing Google Visibility rankings for",
      analysisGeoFallback: "your area",
      analysisListLoading: "Loading local restaurant rankings...",
      analysisNoResultsGeo: "No listed restaurants in this city yet. Try search or talk to Ryan to add coverage.",
      analysisPrevious: "Previous",
      analysisNext: "Next",
      analysisSearchLabel: "Search restaurants",
      analysisSearchPlaceholder: "Name, address, city, or township",
      analysisSearchEmptyHint: "Browse rankings for your city below, or type 2+ characters to search.",
      analysisSearchLoading: "Searching restaurants...",
      analysisTableLabel: "Restaurant listings",
      analysisThSalon: "Restaurant",
      analysisThAddress: "Address",
      analysisThRating: "Google rating",
      analysisThReviews: "Google reviews",
      analysisThScore: "Visibility score",
      analysisReportKicker: "Restaurant report",
      analysisReportUnavailable: "Report unavailable",
      analysisReportLoadFailed: "This restaurant could not be loaded.",
      analysisTownshipCity: "Township / city",
      analysisSalonsInSample: "restaurants in sample",
      analysisAvgGoogleRating: "Avg Google rating",
      analysisMedian: "Median:",
      analysisAvgReviewCount: "Avg review count",
      analysisAvg: "avg",
      analysisRatingBenchmark: "Rating benchmark",
      analysisThisSalon: "This restaurant",
      analysisTownshipAverage: "Township average",
      analysisTownshipMedian: "Township median",
      analysisReviewVolumeBenchmark: "Review volume benchmark",
      analysisTownshipAvg: "Township avg",
      analysisSentimentBenchmark: "Sentiment benchmark",
      analysisSentimentDefaultNote: "Positive-tone share vs township sample (from scraped review summaries).",
      analysisThisSalonPositive: "This restaurant (positive)",
      analysisTownshipBenchmark: "Township benchmark",
      analysisReviewSentiment: "Review sentiment (this restaurant)",
      analysisPositive: "Positive",
      analysisNeutral: "Neutral",
      analysisNegative: "Negative",
      analysisAllSalons: "All restaurants",
      analysisIntelligence: "Restaurant intelligence",
      analysisGoogleReviews: "Google reviews",
      analysisInTownship: "In township (marketing score)",
      analysisTopFiveTownship: "Top 5 in this township",
      analysisWhyDoingWell: "Why they are doing well",
      analysisShouldImprove: "What should be improved",
      analysisNoNarrative: "No narrative yet.",
      analysisLetMeHelp: "Let me help",
      analysisReviewsThisSalon: "Reviews · this restaurant",
      analysisNoSampleLines: "No sample lines yet.",
      analysisTopTownshipReviews: "Top township reviews",
      analysisReviewHint: "Restaurant name, review date, and highlight text.",
      analysisNoTownshipHighlights: "No township highlights yet.",
      briefReportKicker: "Business Brief",
      briefReportPreview: "Free Preview",
      briefReportGenerated: "Report generated",
      briefOverallHealth: "Overall health score",
      briefCriticalIssues: "critical issues",
      briefQuickWins: "quick wins",
      briefKeyMetrics: "Key metrics snapshot",
      briefMetricRating: "Rating",
      briefMetricReviews: "Reviews",
      briefMetricRank: "Rank",
      briefMetricPhotos: "Photos",
      briefGoogleMaps: "Google Maps",
      briefTotalReviews: "Total reviews",
      briefLocalArea: "Local area",
      briefOnProfile: "On profile",
      briefScorecard: "Scorecard breakdown",
      briefGrowthPotential: "Growth potential by service",
      briefGrowthLocked: "Full keyword gaps & competitor benchmarks in the full report",
      briefCompetitors: "Competitor comparison",
      briefCompetitorsLocked: "Competitor data unlocked in full report",
      briefCompetitorsSub: "See exactly where your top 5 rivals rank and why",
      briefCtaTitle: "Get your full growth report",
      briefCtaBody:
        "Your brief shows {critical} critical issues and {quickWins} quick wins. The full report gives you a step-by-step action plan to move from rank #{rank} to the top 3 in your area — and how much revenue that means for your practice.",
      briefCtaUnlock: "View full report →",
      pageTitleAnalysisFull: "Full growth report",
      briefCtaPrice: "$18.99",
      briefCtaPriceSub: " one-time",
      briefCtaFootnote: "Includes 1 month of free expert consulting support.",
      briefCtaFeature1: "Full competitor teardown",
      briefCtaFeature2: "30-day action plan",
      briefCtaFeature3: "Review response templates",
      briefCtaFeature4: "Keyword opportunity map",
      briefCtaFeature5: "Photo strategy guide",
      briefCtaFeature6: "ROI revenue estimate",
      briefScoreGood: "Good",
      briefScoreFair: "Fair",
      briefScoreWeak: "Weak",
      briefPotentialHigh: "High potential",
      briefPotentialMedium: "Medium potential",
      briefPotentialLow: "Competitive",
      mobileScrollCue: "Scroll to explore",
      mobilePanelLeadTitle: "Get More Diners. Rank Higher.",
      mobilePanelLeadSub: "See how you appear on Google — free report in 60 seconds.",
      mobilePanelStory: "Results",
      mobilePanelTrust: "Trusted by restaurants",
      mobilePanelDigital: "Meet Ryan",
      mobilePanelInsights: "Insights",
    },
    zh: {
      pageTitleLanding: "餐厅 AI 增长",
      pageTitlePricing: "价格",
      pageTitleAbout: "关于我们",
      pageTitleTalk: "拨打语音顾问",
      pageTitleTavusDemo: "语音顾问",
      pageTitleAnalysisList: "本地餐厅排名",
      pageTitleAnalysisSalon: "餐厅排名详情",
      pageTitleAnalysisFull: "完整增长报告",
      pageTitleLeaderboardList: "AI 排行榜",
      pageTitleLeaderboardSalon: "餐厅评分卡",
      pageTitleSmsConsent: "短信同意说明",
      pageTitlePrivacy: "隐私政策",
      pageTitleTerms: "服务条款",
      pageTitleLogin: "登录",
      pageTitleAdmin: "后台",
      pageTitleAdminStores: "门店",
      pageTitleAdminStore: "门店编辑",
      navOverview: "首页",
      navPrice: "价格",
      navServices: "服务",
      navAbout: "关于我们",
      navLeaderboard: "排行榜",
      navAnalysis: "本地排名",
      navAgent: "AI 智能体",
      navTools: "工具",
      navContact: "联系我们",
      navDashboard: "后台",
      navSignIn: "登录",
      footerProduct: "产品",
      footerProductHeader: "评论工具",
      footerReviewsManager: "评论管理",
      footerResponseManager: "回复管理",
      footerAnalytics: "数据分析",
      footerReports: "报告",
      footerFeatures: "功能",
      footerFeaturesHeader: "自动化",
      footerAiVoiceAgent: "AI 语音顾问",
      footerSmartFollowUp: "智能跟进",
      footerClientAcquisition: "获客系统",
      footerBookingSystem: "预约系统",
      footerCompany: "公司",
      footerAboutUs: "关于我们",
      footerPricing: "价格",
      footerBlog: "博客",
      footerContact: "联系",
      footerSupport: "支持",
      footerSmsConsent: "短信同意说明",
      footerPrivacy: "隐私政策",
      footerTerms: "服务条款",
      footerAddressSalon: "餐厅增长平台",
      footerAddressAutomation: "AI 增长自动化",
      footerCopyright: "© 2026 RankMyRestaurant。为餐厅打造的评论、跟进和语音自动化 AI。",
      formNameLabel: "姓名 *",
      formNamePlaceholder: "请输入你的姓名",
      formEmailLabel: "邮箱 *",
      formEmailPlaceholder: "用于回复你的邮箱",
      formPhoneLabel: "电话 *",
      formPhonePlaceholder: "方便联系你的号码",
      formCompanyLabel: "公司 / 门店",
      formCompanyPlaceholder: "餐厅或公司名称",
      formServiceLabel: "你最需要哪方面帮助？",
      formServicePlaceholder: "选择最接近的一项",
      formMessageLabel: "留言 *",
      formMessagePlaceholder: "目前最大的增长瓶颈是什么？",
      formSubmit: "发送咨询",
      formSending: "正在发送...",
      formSmsConsentNotice:
        "提交手机号即表示你同意接收 RankMyRestaurant 的短信（服务更新与跟进）。短信频率因业务而异，可能产生运营商短信/流量费用。回复 STOP 可退订，回复 HELP 获取帮助。",
      formSmsConsentLinksPrefix: "详情请查看",
      formSmsConsentLinkSms: "短信同意说明",
      formSmsConsentLinkPrivacy: "隐私政策",
      formSmsConsentLinkTerms: "服务条款",
      formSmsConsentCheckbox: "我同意接收 RankMyRestaurant 的短信（服务更新与跟进）。",
      formSmsConsentRequired: "请先勾选短信同意后再提交。",
      formSuccess: "谢谢，我们已收到你的信息，会尽快跟进。你也可以发邮件到 info@360AIMedia.com。",
      formFailure: "暂时无法保存你的信息。请重试，或直接发送邮件到 info@360AIMedia.com。",
      heroBriefSalonLabel: "餐厅名称 *",
      heroBriefSalonPlaceholder: "与 Google Maps 上显示一致",
      heroBriefContactLabel: "手机或邮箱 *",
      heroBriefContactPlaceholder: "(555) 123-4567 或 owner@restaurant.com",
      heroBriefSubmit: "获取免费报告",
      heroBriefSmsConsentCheckbox:
        "若填写了手机号，我同意接收 RankMyRestaurant 发来的简报短信及相关服务短信。",
      heroBriefFieldsRequired: "请填写餐厅名称，以及可用的手机号或邮箱。",
      heroBriefInvalidEmail: "邮箱格式似乎不对，请核对或改用手机号。",
      heroBriefInvalidPhone: "请输入至少 7 位数字的电话，或改用邮箱。",
      heroBriefSuccess: "已收到 — 简报将尽快发出。若使用邮箱，请留意垃圾箱。",
      contactModalTitle: "联系我们",
      contactModalClose: "关闭弹窗",
      contactModalLead: "告诉我们你需要什么帮助。信息会安全发送给团队，我们通常会在一个工作日内回复。",
      pricingKicker: "价格",
      pricingBody: "一套清晰方案，帮助餐厅更快获得评论、完成跟进并带来订位。",
      pricingMonthly: "月付",
      pricingAnnual: "年付",
      pricingOr: "或",
      pricingMonthlyDetail: "按月计费，随时取消。",
      pricingAnnualBadge: "年付 · 最划算",
      pricingAnnualDetailPrefix: "一次性付款。",
      pricingSetupCopy: "一次性设置费用，用于帮你完成账户上线和启动准备。",
      pricingExtraAmountUnit: " / 张",
      pricingSummaryKicker: "订单确认",
      pricingSummaryClose: "关闭订单确认",
      pricingSummaryTitle: "结账前确认订单",
      pricingSummaryBody: "在跳转到 Shopify 安全结账页前，请确认一次性启动费和月度订阅。",
      pricingSummaryPlanTitle: "RankMyRestaurant 月度方案",
      pricingSummaryPlanDetail: "订阅 · 按月计费",
      pricingSummarySetupDeviceSuffix: " + NFC 设备",
      pricingSummarySetupDetail: "一次性启动费 · 包含 1 张 NFC 卡",
      pricingSummaryDueTodayLabel: "今日应付",
      pricingSummaryRecurringLabel: "结账后续费",
      pricingSummaryBack: "返回",
      pricingSummaryCheckout: "继续到 Shopify 结账",
      pricingSummarySecurity: "由 Shopify 提供安全结账。",
      pricingBusyLoading: "加载中...",
      pricingBusyRedirecting: "跳转中...",
      shopifyNotConfigured: "Shopify 结账尚未配置。请在 config.js 中更新 storefront token 和商品变体 ID。",
      shopifyNotConfiguredShort: "Shopify 结账尚未配置。请在 config.js 中更新域名和商品变体 ID。",
      shopifyCartFailedPrefix: "Shopify 购物车请求失败，状态码 ",
      shopifyCheckoutMissing: "Shopify 结账链接缺失。",
      shopifyStartFailed: "无法开始结账，请稍后重试。",
      assistantKicker: "语音顾问",
      assistantVoiceIntro: "点击下方按钮，通过手机拨打语音顾问 Ryan。系统将打开手机拨号界面。",
      assistantCallCta: "立即拨打",
      assistantBack: "返回首页",
      leaderboardLoadingTitle: "本地餐厅排名",
      leaderboardLoadingBody: "正在加载 Supabase 数据...",
      leaderboardErrorTitle: "排行榜",
      leaderboardSetupHint:
        "请在 Supabase 执行 sql/013_salon_ai_leaderboard.sql 和 sql/014_seed_salon_ai_leaderboard.sql，必要时刷新 schema cache 后再刷新页面。",
      leaderboardHeroKicker: "RankMyRestaurant.AI",
      leaderboardHeroTitlePrefix: "你的餐厅是否正在把食客",
      leaderboardHeroTitleAccent: "输给竞争对手",
      leaderboardHeroTitleSuffix: "？",
      leaderboardHeroBody:
        "查看实时餐厅 AI 排行榜，聚焦 Google 排名关键因子：Google Maps 曝光、评论数量、情绪、近期活跃度、本地 SEO 强度与转化信号。点开任意餐厅评分卡可看到可执行动作、语音顾问 Ryan 流程和社媒内容建设机会。",
      leaderboardSearchPlaceholder: "餐厅名称、城市、邮编或地址...",
      leaderboardSearchButton: "搜索",
      leaderboardSearchAria: "按餐厅名称、城市或地址搜索",
      leaderboardLive: "实时 · Supabase 同步",
      leaderboardLiveUpdated: "实时 · 刚刚更新",
      leaderboardPreviewLabel: "预览：",
      leaderboardPreviewSuffix: "，按 AI 分数排序。",
      leaderboardSignInFull: "登录",
      leaderboardSignInFullSuffix: "查看完整目录。",
      leaderboardDirectoryKicker: "目录：",
      leaderboardDirectoryBody: "此处加载目录内全部餐厅，并结合 Google 排名、本地 SEO、评论管理、语音顾问与社媒内容增长语境。",
      leaderboardDirectoryScorecardSuffix: " 即可打开餐厅评分卡。",
      leaderboardDirectorySampleHrefLabel: "新泽西 Middlesex 县",
      leaderboardRequestListing: "申请收录",
      leaderboardRequestLead: "告诉我们你的餐厅信息，或申请覆盖新的市场。我们会通过邮箱跟进。",
      leaderboardRequestType: "申请类型",
      leaderboardRequestAddSalon: "添加我的餐厅",
      leaderboardRequestMoreCoverage: "更多市场 / 餐厅",
      leaderboardRequestSalonName: "餐厅名称",
      leaderboardRequestYourName: "你的姓名",
      leaderboardRequestEmail: "邮箱",
      leaderboardRequestPhone: "电话",
      leaderboardRequestAddress: "地址",
      leaderboardRequestMessage: "留言",
      leaderboardRequestMessagePlaceholder: "营业时间、Google Maps 链接或覆盖区域",
      leaderboardRequestSend: "发送申请",
      leaderboardRequestCancel: "取消",
      leaderboardRequestSending: "正在发送...",
      leaderboardRequestFailed: "申请失败。",
      leaderboardRequestCouldNotSend: "发送失败。",
      leaderboardRequestThanks: "谢谢，我们已收到你的申请。",
      leaderboardClose: "关闭",
      leaderboardPrevious: "上一页",
      leaderboardNext: "下一页",
      leaderboardState: "州",
      leaderboardCounty: "县",
      leaderboardTownship: "镇区（Township）",
      leaderboardSalonCount: "家餐厅",
      leaderboardScorecardLoading: "正在加载评分卡...",
      leaderboardNotFound: "未找到该餐厅。",
      leaderboardBack: "返回排行榜",
      leaderboardPreviewStrip: "公开预览",
      leaderboardTopLink: "排行榜",
      leaderboardCardMenuAria: "更多操作",
      leaderboardCardShare: "分享链接",
      leaderboardCardViewScorecard: "查看评分卡",
      leaderboardCardLinkCopied: "已复制链接",
      leaderboardCardShareFailed: "无法复制链接",
      leaderboardAiKicker: "AI 排行榜",
      analysisLoadingTitle: "分析报告",
      analysisLoadingBody: "可能需要稍等片刻，我们正在拉取大量数据……",
      analysisDetailLoading: "可能需要稍等片刻，我们正在拉取大量数据……",
      analysisBackAll: "返回全部餐厅",
      analysisTalkListing: "找不到你的餐厅？和 Ryan 对话申请收录",
      analysisKicker: "Google Maps · 本地可见度",
      analysisTitle: "本地餐厅排名",
      analysisBody:
        "按 Google Visibility 评分浏览您所在城市的餐厅排名，侧重本地 SEO 与获客就绪度等 Google 信号。",
      analysisFreshDbHint: "如果这是新数据库，请在 Supabase SQL Editor 中执行 sql/034_restr_ai_leaderboard.sql，然后重新加载。",
      analysisGeoLabel: "当前展示 Google Visibility 排名：",
      analysisGeoFallback: "您所在地区",
      analysisListLoading: "正在加载本地餐厅排名...",
      analysisNoResultsGeo: "该城市暂无收录餐厅。可尝试搜索，或与 Ryan 对话申请覆盖。",
      analysisPrevious: "上一页",
      analysisNext: "下一页",
      analysisSearchLabel: "搜索餐厅",
      analysisSearchPlaceholder: "名称、地址、城市或 township",
      analysisSearchEmptyHint: "下方为所在城市排名，或输入至少 2 个字符搜索。",
      analysisSearchLoading: "正在搜索餐厅...",
      analysisTableLabel: "餐厅列表",
      analysisThSalon: "餐厅",
      analysisThAddress: "地址",
      analysisThRating: "Google 评分",
      analysisThReviews: "Google 评论数",
      analysisThScore: "Visibility 评分",
      analysisReportKicker: "餐厅报告",
      analysisReportUnavailable: "报告暂不可用",
      analysisReportLoadFailed: "无法加载该餐厅。",
      analysisTownshipCity: "Township / 城市",
      analysisSalonsInSample: "家餐厅样本",
      analysisAvgGoogleRating: "Google 平均评分",
      analysisMedian: "中位数：",
      analysisAvgReviewCount: "平均评论数",
      analysisAvg: "均值",
      analysisRatingBenchmark: "评分基准",
      analysisThisSalon: "本店",
      analysisTownshipAverage: "地区平均",
      analysisTownshipMedian: "地区中位数",
      analysisReviewVolumeBenchmark: "评论量基准",
      analysisTownshipAvg: "地区均值",
      analysisSentimentBenchmark: "情绪基准",
      analysisSentimentDefaultNote: "正向语气占比与地区样本对比（来自抓取的评论摘要）。",
      analysisThisSalonPositive: "本店（正向）",
      analysisTownshipBenchmark: "地区基准",
      analysisReviewSentiment: "本店评论情绪",
      analysisPositive: "正向",
      analysisNeutral: "中性",
      analysisNegative: "负向",
      analysisAllSalons: "全部餐厅",
      analysisIntelligence: "餐厅情报",
      analysisGoogleReviews: "Google 评论",
      analysisInTownship: "地区排名（营销评分）",
      analysisTopFiveTownship: "本地区前 5 名",
      analysisWhyDoingWell: "做得好的原因",
      analysisShouldImprove: "需要改进的地方",
      analysisNoNarrative: "暂无分析内容。",
      analysisLetMeHelp: "让我来帮你",
      analysisReviewsThisSalon: "本店评论",
      analysisNoSampleLines: "暂无样本文字。",
      analysisTopTownshipReviews: "地区热门评论",
      analysisReviewHint: "餐厅名称、评论日期和亮点文字。",
      analysisNoTownshipHighlights: "暂无地区评论亮点。",
      briefReportKicker: "商业简报",
      briefReportPreview: "免费预览",
      briefReportGenerated: "报告生成日期",
      briefOverallHealth: "整体健康评分",
      briefCriticalIssues: "项严重问题",
      briefQuickWins: "项快速改进",
      briefKeyMetrics: "关键指标快照",
      briefMetricRating: "评分",
      briefMetricReviews: "评论",
      briefMetricRank: "排名",
      briefMetricPhotos: "照片",
      briefGoogleMaps: "Google 地图",
      briefTotalReviews: "评论总数",
      briefLocalArea: "本地区",
      briefOnProfile: "资料页照片",
      briefScorecard: "评分明细",
      briefGrowthPotential: "各服务增长潜力",
      briefGrowthLocked: "完整报告含关键词缺口与竞品基准",
      briefCompetitors: "竞品对比",
      briefCompetitorsLocked: "完整报告解锁竞品数据",
      briefCompetitorsSub: "查看本地区前 5 名竞品的排名与原因",
      briefCtaTitle: "获取完整增长报告",
      briefCtaBody:
        "简报显示 {critical} 项严重问题与 {quickWins} 项快速改进。完整报告提供从第 #{rank} 名进入本地区前 3 的行动计划，并估算收入影响。",
      briefCtaUnlock: "解锁完整报告 →",
      briefCtaPrice: "$18.99",
      briefCtaPriceSub: " 一次性",
      briefCtaFootnote: "含 1 个月免费专家咨询支持。",
      briefCtaFeature1: "完整竞品拆解",
      briefCtaFeature2: "30 天行动计划",
      briefCtaFeature3: "评论回复模板",
      briefCtaFeature4: "关键词机会图",
      briefCtaFeature5: "照片策略指南",
      briefCtaFeature6: "ROI 收入估算",
      briefScoreGood: "良好",
      briefScoreFair: "一般",
      briefScoreWeak: "偏弱",
      briefPotentialHigh: "高潜力",
      briefPotentialMedium: "中等潜力",
      briefPotentialLow: "竞争激烈",
      mobileScrollCue: "向下滑动浏览",
      mobilePanelLeadTitle: "带来更多食客，排名更高。",
      mobilePanelLeadSub: "看看你在 Google 上的呈现 — 60 秒获取免费报告。",
      mobilePanelStory: "成果数据",
      mobilePanelTrust: "餐厅信赖之选",
      mobilePanelDigital: "认识 Ryan",
      mobilePanelInsights: "精选洞察",
    },
  };
  const MARKETING_UI = createLocalizedProxy(MARKETING_UI_I18N);

  const STYLE_VARIANTS = [
    {
      key: "review_a",
      zhLabel: "简洁",
      enLabel: "Simple",
      zhSubLabel: "",
      enSubLabel: "",
      zhRule: "最口语、最随手，像刚吃完掏出手机就打两行字，别端着。",
      enRule: "Keep it the most casual and off-the-cuff, like someone typing right after the meal without overthinking.",
    },
    {
      key: "review_b",
      zhLabel: "详细",
      enLabel: "Detailed",
      zhSubLabel: "",
      enSubLabel: "",
      zhRule: "多说一两个具体细节，但还是聊天口吻，别写成探店文案。",
      enRule: "Add one or two concrete details, but keep it chatty and personal, not like a food blogger script.",
    },
    {
      key: "review_c",
      zhLabel: "出彩",
      enLabel: "Standout",
      zhSubLabel: "",
      enSubLabel: "",
      zhRule: "可以稍微夸张一点、更有记忆点，用当下流行的夸法，但得像真食客，不像网红通稿。",
      enRule: "Make it the most memorable with a touch of hype, but still sound like a real diner, not influencer copy.",
    },
  ];

  const REVIEW_FOCUS_TYPES = ["none", "service", "environment"];

  const FOCUS_RULES = {
    none: {
      zhLabel: "只写菜品",
      enLabel: "food or drink only",
      zhRule: "这一条只写菜品或饮品本身，比如味道、口感、分量、摆盘、温度，完全不要提staff、环境、氛围。",
      enRule:
        "This review must only talk about the food or drink itself, such as flavor, texture, portion, presentation, freshness, or how the meal came out. Do not mention staff, ambiance, atmosphere, decor, or the restaurant space.",
    },
    service: {
      zhLabel: "提服务",
      enLabel: "staff or service mention",
      zhRule: "这一条必须提服务员或staff热情、上菜快、沟通顺、服务周到之类，但完全不要提环境、氛围、装修。",
      enRule:
        "This review must clearly praise the staff, attentiveness, speed, hospitality, or communication, but must not mention ambiance, atmosphere, decor, or the restaurant space.",
    },
    environment: {
      zhLabel: "提环境",
      enLabel: "atmosphere mention",
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
    {
      key: "friendly",
      zhLabel: "很热情",
      enLabel: "warm and friendly",
      zhPhrase: "热情",
      enPhrase: "warm and friendly",
    },
    {
      key: "patient",
      zhLabel: "很耐心",
      enLabel: "very patient",
      zhPhrase: "耐心",
      enPhrase: "very patient",
    },
    {
      key: "detailed",
      zhLabel: "很细心",
      enLabel: "very detailed",
      zhPhrase: "细心",
      enPhrase: "very detailed",
    },
    {
      key: "helpful",
      zhLabel: "沟通很顺",
      enLabel: "easy to communicate with",
      zhPhrase: "沟通很顺",
      enPhrase: "easy to communicate with",
    },
    {
      key: "gentle",
      zhLabel: "服务很舒服",
      enLabel: "smooth and careful",
      zhPhrase: "服务很舒服",
      enPhrase: "smooth and careful",
    },
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
      { key: "short_30", weight: 0.5, min: 24, max: 34, promptLabel: "约30字" },
      { key: "mid_30_50", weight: 0.3, min: 35, max: 49, promptLabel: "30到50字" },
      { key: "long_50", weight: 0.2, min: 50, max: 60, promptLabel: "约50字" },
    ],
    en: [
      { key: "short_30", weight: 0.5, min: 6, max: 12, promptLabel: "short about 6 to 12 words" },
      { key: "mid_30_100", weight: 0.3, min: 14, max: 32, promptLabel: "medium about 14 to 32 words" },
      {
        key: "long_50",
        weight: 0.2,
        min: 28,
        max: 50,
        promptLabel: "longest, about 28 to 50 words, never more than 50 words",
      },
    ],
  };

  const i18n = {
    zh: {
      title: "拍张小票，评论更快",
      subtitle: "传一张消费小票，几秒就能挑一句顺手发。",
      landingTitle: "让餐厅的 Google 评论增长更顺手",
      landingSubtitle: "RankMyRestaurant 根域名后续会升级成完整产品 landing page。当前先用这个占位页承接品牌入口，门店版 review studio 继续通过规范的 store 路径访问。",
      landingStatus: "临时首页占位",
      landingPrimaryCta: "打开 蟹宝 Edison 门店页",
      landingSecondaryCta: "查看规范门店路径",
      landingCardOneTitle: "当前能做什么",
      landingCardOneBody: "上传消费小票，确认这次来店情况，再拿到 3 条更像真人会发的 Google 评论。",
      landingCardTwoTitle: "接下来的正式结构",
      landingCardTwoBody: "根域名会升级成完整产品站，门店体验统一放到 /stores/:slug，短链接 /s/:slug 继续保留。",
      landingCardThreeTitle: "当前生产示例",
      landingCardThreeBody: "蟹宝 Edison 是第一家上线的门店示例，后续应继续沿用真实 store slug，而不是手写短别名。",
      uploadTitle: "先传一张小票",
      uploadHint: "上传消费小票照片。可拍照，也可选相册。",
      uploadBtn: "拍/选小票",
      writeOwnReviewBtn: "自己写",
      retakeBtn: "换一张照片",
      retakeInlineBtn: "重新上传一张",
      previewEmpty: "上传后会显示在这里",
      dishesTitle: "确认菜品",
      dishesHint: "识别不对就补加或删除，下面的评价会自动重算。",
      correctionLabel: "补加或修改菜品",
      dishSearchPlaceholder: "选择要补加的菜品",
      addDishBtn: "补加菜品",
      resetBtn: "清空重来",
      reviewsTitle: "选一条你喜欢的评价",
      visitSheetTitle: "再加一点小信息",
      visitSheetHint: "选一个最像今天的情况，让评论更真实。",
      visitContinueBtn: "帮我写个评论",
      visitUpdateBtn: "按这个重写",
      visitSummaryLabel: "这次体验",
      visitSummaryAction: "修改",
      serviceToggleLabel: "再加一点",
      serviceToggle: "想把staff也写进去？",
      serviceToggleEnabled: "已加 staff 亮点",
      serviceToggleMeta: "可选",
      serviceNameLabel: "想提到哪位 staff？可选",
      serviceNamePlaceholder: "选择一位 staff",
      servicePraiseLabel: "最想突出哪一点？",
      serviceApplyBtn: "更新评论",
      serviceClearBtn: "先不用",
      reviewsEmpty: "识别完后，这里会出现 3 条可直接使用的短评。",
      anotherSetBtn: "换一组",
      anotherSetWorking: "处理中...",
      langToggle: "English",
      receiptWorking: "正在整理内容，请稍候…",
      receiptDone: "小票识别完成。",
      receiptDetectedSingle: "识别到：{dish}",
      receiptDetectedMulti: "已识别 {count} 个菜品",
      receiptDetectedNone: "这张小票还没认出明确菜品",
      receiptDetectedUncertain: "小票有读出文字，但未对上菜单，请在下方手选菜品",
      receiptFailed: "小票识别失败，请换一张更清楚的小票。",
      routeReceipt: "正在整理内容，请稍候…",
      routeDish: "正在整理内容，请稍候…",
      routeUnknown: "正在整理内容，请稍候…",
      reviewWorking: "正在整理内容，请稍候…",
      reviewDone: "评价已更新。",
      reviewFailed: "评论生成失败，请稍后重试。",
      noApiKey: "未配置 OpenAI API Key。",
      noReceipt: "请先上传小票。",
      noDishes: "还没认出菜品，换张更清楚的小票试试。",
      receiptUnmatchedOnly:
        "小票上读到的品名与当前餐厅菜单目录对不上，下面已列出识别文字，请点「从目录添加菜品」手选最相近的；如目录仍是示例内容，请先在后台把菜单改成与你店一致的品项。",
      noUrl: "未配置 Google 跳转链接。",
      copiedAndGoing: "已复制评价，正在打开 Google...",
      copyFail: "复制失败，请手动复制后再打开 Google。",
      reviewSelected: "已选中并复制评价。",
      reviewSelectedCopyFail: "已选中评价。如需请手动复制，然后继续。",
      manualOpen: "没打开？换个入口",
      manualOpenMaps: "优先试 Google Maps",
      manualOpenBrowser: "改用浏览器评论页",
      addDishFail: "没找到这个菜品，请换个写法或从下拉建议里选。",
      addDishSuccess: "已补加菜品。",
      removeDishSuccess: "已移除菜品。",
      correctionChanged: "正在整理内容，请稍候…",
      uncertainTitle: "这些字样不太确定",
      recognizedCount: "识别到 {count} 个菜品",
      recognizedEmpty: "还没识别到菜品，换张更清楚的小票试试。",
      reviewCardHint: "",
      correctionToggleClosed: "识别不对？修改菜品",
      correctionToggleOpen: "收起菜品修改",
      localHistoryHint: "尽量换个说法，别和刚才那组太像。",
      startOverDone: "已清空。",
      visitRequired: "先选一下这是第几次来。",
      storeNotAvailable: "门店未启用或不存在。请在后台勾选「Active immediately」或开启 Active 后刷新。",
      storeMenuNotPublished:
        "门店还没有可用的菜单目录。请在后台该门店的「Service catalog」添加菜品并保存，然后刷新本页。",
      storeServiceCatalogEmpty: "已发布的菜单目录为空，请在后台补充菜品。",
      storeCatalogDefaultHint:
        "当前使用通用示例菜单，拍照写评价可以正常使用。在后台保存本店菜单目录后，会自动切换为你店自己的菜品。",
      storeBootstrapGeneric: "门店页面加载失败，请稍后重试。",
      storeVisitServiceLabel: "今日菜品",
      storeVisitHeading: "给 {store} 留个点评",
      storeVisitHeroTitle: "今天体验怎么样？",
      storeVisitHeroLead: "你的反馈帮助我们做得更好，也帮助其他食客发现我们。",
      storeVisitMoodPick: "请点击星星继续。",
      storeVisitStarsLabel: "为本次体验评分",
      storeVisitGoogleBadgeLabel: "Google 评价",
      storeVisitGoogleReviewsLabel: "条 Google 评价",
      storeVisitBenefitOneTitle: "AI 帮你写评价",
      storeVisitBenefitOneBody: "我们帮你整理可直接发布的文案。",
      storeVisitBenefitTwoTitle: "不到 30 秒",
      storeVisitBenefitTwoBody: "几步就能完成。",
      storeFlowVisitTitle: "这是你第几次来？",
      storeFlowVisitHint: "选择最接近今天情况的一项。",
      storeFlowStaffTitle: "今天是哪位服务员接待你？",
      storeFlowStaffHint: "可跳过。也可搜索姓名后点选一位服务员；再次点选可取消。",
      storeFlowStaffSearchPlaceholder: "搜索服务员姓名",
      storeFlowStaffSkipBtn: "暂不选择服务员",
      storeFlowStaffEmpty: "没有找到匹配的服务员，请换个关键词试试。",
      storeFlowServicesTitle: "今天吃了哪些菜？",
      storeFlowServicesHint: "列表先展示少量菜品。请用搜索找到更多，可多选；越准确，生成的点评越自然。",
      storeFlowServicesSearchPlaceholder: "搜索菜品",
      storeFlowServicesSelected: "已选菜品",
      storeFlowServicesEmpty: "没有找到匹配的菜品，请换个关键词试试。",
      storeFlowServicesRequired: "请至少选择一道菜。",
      storeFlowStepBack: "返回",
      storeFlowStepContinue: "继续",
      storeFlowStepGenerate: "生成 3 条点评",
      storeFlowVisitRequired: "请先选择来店次数。",
      storeFlowStaffRequired: "请先选择今天的服务员。",
      storeFlowWriteOwnBtn: "自己写点评，去 Google",
      storeReceiptScanHint: "",
      storeCallbackTitle: "抱歉这次没有让你满意",
      storeCallbackIntro: "留下你的电话，我们会让经理尽快联系你。",
      storeCallbackPhoneLabel: "你的电话",
      storeCallbackPhonePlaceholder: "请输入手机号",
      storeCallbackPlaceholderName: "您的姓名",
      storeCallbackPlaceholderPhone: "您的手机号",
      storeCallbackPlaceholderGoogle: "Google / Gmail 邮箱（选填，便于核对 Maps 账号）",
      storeCallbackPlaceholderMessage: "想告诉我们什么？",
      storeCallbackNameRequired: "请填写您的姓名。",
      storeCallbackMessageRequired: "请写几句具体的反馈。",
      storeCallbackSubmitBtn: "继续",
      storeCallbackPhoneRequired: "请填写有效的电话号码。",
      storeCallbackThanksTitle: "❤️ 我们希望下次能做得更好",
      storeCallbackThanksBody:
        "感谢您的反馈。\n我们已经收到您的意见，会尽快联系您解决问题。\n许多顾客在问题解决后都愿意再次光顾并更新评价。",
      storeCallbackThanksDone: "提交完成",
      storePrivateModalTitle: "私下反馈给店家",
      storePrivateModalIntro: "只有后台团队能看到，不会出现在 Google 上。我们会认真阅读每一条。",
      storePrivateFieldName: "怎么称呼您",
      storePrivateFieldPhone: "手机号（选填）",
      storePrivateFieldGoogle: "Google / Gmail 邮箱（选填，便于核对 Maps 账号）",
      storePrivateFieldMessage: "想告诉我们的话",
      storePrivateSubmitBtn: "提交",
      storePrivateCancelBtn: "取消",
      storePrivateThanksTitle: "收到了，谢谢您愿意说出来",
      storePrivateThanksBody:
        "我们会认真对待您的私下反馈，用来改进下次的体验。之后若您心情好一些，也欢迎随时再来；是否去 Google 留公开评价，完全尊重您的节奏，绝不打扰。",
      storePrivateThanksDone: "好的",
      storePrivateErrorGeneric: "提交失败，请稍后再试。",
      storePrivateSubmitting: "提交中…",
    },
    en: {
      title: "Snap your receipt. Review faster.",
      subtitle: "Upload your restaurant receipt and get a few lines worth posting.",
      landingTitle: "Google review growth for restaurants, with less awkward follow-up",
      landingSubtitle: "RankMyRestaurant will eventually become the full product landing page at the root domain. For now, this placeholder holds the top-level brand entry while the live store-specific review studio stays available on the canonical store path.",
      landingStatus: "Temporary landing page",
      landingPrimaryCta: "Open the Xiebao Edison store page",
      landingSecondaryCta: "View the canonical store route",
      landingCardOneTitle: "What works today",
      landingCardOneBody: "Upload a receipt, confirm the visit context, and get three short Google review options that still sound like a real diner.",
      landingCardTwoTitle: "Where the product is going",
      landingCardTwoBody: "The root domain becomes the main marketing site, store-specific experiences live under /stores/:slug, and /s/:slug stays as the short link.",
      landingCardThreeTitle: "Current production example",
      landingCardThreeBody: "Xiebao Edison is the live store example today, and the long-form slug should stay aligned with the real backend store identifier.",
      uploadTitle: "Start with a receipt",
      uploadHint: "Upload a restaurant receipt photo. Take one now or pick it from your library.",
      uploadBtn: "Snap / choose",
      writeOwnReviewBtn: "Write my own",
      retakeBtn: "Use another photo",
      retakeInlineBtn: "Upload another photo",
      previewEmpty: "It will appear here after upload",
      dishesTitle: "Check the dishes",
      dishesHint: "Add or remove dishes if needed. The reviews below will refresh automatically.",
      correctionLabel: "Add or fix dishes",
      dishSearchPlaceholder: "Choose a dish to add",
      addDishBtn: "Add dish",
      resetBtn: "Clear all",
      reviewsTitle: "Select a review you like",
      visitSheetTitle: "One quick detail",
      visitSheetHint: "Pick what fits today so the review feels more believable.",
      visitContinueBtn: "Write one for me",
      visitUpdateBtn: "Rewrite with this",
      visitSummaryLabel: "This visit",
      visitSummaryAction: "Change",
      serviceToggleLabel: "Nice extra touch",
      serviceToggle: "Want to highlight a staff member too?",
      serviceToggleEnabled: "Staff mention added",
      serviceToggleMeta: "Optional",
      serviceNameLabel: "Which staff member should we mention? Optional",
      serviceNamePlaceholder: "Choose a staff member",
      servicePraiseLabel: "What stood out most?",
      serviceApplyBtn: "Update reviews",
      serviceClearBtn: "Not now",
      reviewsEmpty: "Once the receipt is read, three short post-ready options will show up here.",
      anotherSetBtn: "See more options",
      anotherSetWorking: "Getting more options ready...",
      langToggle: "中文",
      receiptWorking: "Preparing everything. Please wait...",
      receiptDone: "Receipt processed.",
      receiptDetectedSingle: "Detected: {dish}",
      receiptDetectedMulti: "{count} dishes detected",
      receiptDetectedNone: "No matching dishes on this receipt yet.",
      receiptDetectedUncertain: "We read lines on the receipt but they do not match the menu yet — pick dishes below.",
      receiptFailed: "Receipt reading failed. Try a clearer receipt photo.",
      routeReceipt: "Preparing everything. Please wait...",
      routeDish: "Preparing everything. Please wait...",
      routeUnknown: "Preparing everything. Please wait...",
      reviewWorking: "Preparing everything. Please wait...",
      reviewDone: "Reviews updated.",
      reviewFailed: "Review generation failed. Please try again.",
      noApiKey: "OpenAI API key is missing.",
      noReceipt: "Upload a receipt first.",
      noDishes: "No dish found yet. Try a clearer receipt photo.",
      receiptUnmatchedOnly:
        "We read these lines, but they do not match the restaurant catalog yet. Add dishes manually from the list, or update the catalog in admin so it matches your menu. See the uncertain lines below.",
      noUrl: "Google link is not configured.",
      copiedAndGoing: "Review copied. Opening Google...",
      copyFail: "Copy failed. Please copy manually, then open Google.",
      reviewSelected: "Review selected and copied.",
      reviewSelectedCopyFail: "Review selected. Copy manually if needed, then continue.",
      manualOpen: "Didn't open? Try the other route",
      manualOpenMaps: "Try Google Maps",
      manualOpenBrowser: "Open browser review page",
      addDishFail: "Dish not found. Try another spelling or use a suggestion.",
      addDishSuccess: "Dish added.",
      removeDishSuccess: "Dish removed.",
      correctionChanged: "Preparing everything. Please wait...",
      uncertainTitle: "These items need a quick check",
      recognizedCount: "Detected {count} dishes",
      recognizedEmpty: "No dishes detected yet. Try a clearer receipt photo.",
      reviewCardHint: "",
      correctionToggleClosed: "Wrong dish? Edit the dishes",
      correctionToggleOpen: "Hide dish edits",
      localHistoryHint: "Keep the wording varied so the next set does not feel recycled.",
      startOverDone: "Cleared.",
      visitRequired: "Pick the visit count first.",
      storeNotAvailable: "This store is inactive or missing. Turn on Active in admin and refresh.",
      storeMenuNotPublished:
        "No menu catalog is available for this store yet. Add dishes under this store’s Service catalog in admin, save, then reload this page.",
      storeServiceCatalogEmpty: "Published menu catalog is empty. Add dishes in admin.",
      storeCatalogDefaultHint:
        "Using a generic sample list for now — receipts and reviews still work. Save your own catalog in admin to match your real menu.",
      storeBootstrapGeneric: "Could not load this store. Please try again.",
      storeVisitServiceLabel: "Today's dish",
      storeVisitHeading: "Review for {store}",
      storeVisitHeroTitle: "How was your experience today?",
      storeVisitHeroLead: "Your feedback helps us improve and helps other guests discover us.",
      storeVisitMoodPick: "Tap a star to continue.",
      storeVisitStarsLabel: "Rate your visit",
      storeVisitGoogleBadgeLabel: "Google Reviews",
      storeVisitGoogleReviewsLabel: "Google Reviews",
      storeVisitBenefitOneTitle: "AI Review Draft",
      storeVisitBenefitOneBody: "We'll help write your review.",
      storeVisitBenefitTwoTitle: "Less than 30 seconds",
      storeVisitBenefitTwoBody: "Quick and easy to post.",
      storeFlowVisitTitle: "How many times have you visited us?",
      storeFlowVisitHint: "Pick the option that fits today best.",
      storeFlowStaffTitle: "Who was your server today?",
      storeFlowStaffHint: "Optional: skip, or search and tap one server. Tap again to clear your choice.",
      storeFlowStaffSearchPlaceholder: "Search server name",
      storeFlowStaffSkipBtn: "Skip server",
      storeFlowStaffEmpty: "No server matched that search. Try another keyword.",
      storeFlowServicesTitle: "Which dishes did you have today?",
      storeFlowServicesHint: "A few dishes show first. Search to find more — select all that apply for a more natural review.",
      storeFlowServicesSearchPlaceholder: "Search dishes",
      storeFlowServicesSelected: "Selected dishes",
      storeFlowServicesEmpty: "No dishes matched that search. Try another keyword.",
      storeFlowServicesRequired: "Please choose at least one dish.",
      storeFlowStepBack: "Back",
      storeFlowStepContinue: "Continue",
      storeFlowStepGenerate: "Generate 3 review ideas",
      storeFlowVisitRequired: "Pick the visit count first.",
      storeFlowStaffRequired: "Choose your server first.",
      storeFlowWriteOwnBtn: "Write my own on Google",
      storeReceiptScanHint: "",
      storeCallbackTitle: "We're sorry today's visit missed the mark",
      storeCallbackIntro: "Leave your phone number and we'll ask the manager to call you.",
      storeCallbackPhoneLabel: "Your phone number",
      storeCallbackPhonePlaceholder: "Your phone number",
      storeCallbackPlaceholderName: "Your Name",
      storeCallbackPlaceholderPhone: "Your phone number",
      storeCallbackPlaceholderGoogle: "Google / Gmail (optional, helps us match your Maps account)",
      storeCallbackPlaceholderMessage: "What would you like us to know?",
      storeCallbackNameRequired: "Please add your name.",
      storeCallbackMessageRequired: "Please add a few words about your visit.",
      storeCallbackSubmitBtn: "Continue",
      storeCallbackPhoneRequired: "Please enter a valid phone number.",
      storeCallbackThanksTitle: "❤️ We hope to do better next time",
      storeCallbackThanksBody:
        "Thank you for your feedback.\nWe've received your message and will contact you soon to resolve the issue.\nMany guests come back and update their review once everything is sorted.",
      storeCallbackThanksDone: "Done",
      storePrivateModalTitle: "Private note to the restaurant",
      storePrivateModalIntro:
        "This goes straight to the team behind the scenes — it is never posted on Google. We read every message.",
      storePrivateFieldName: "Your name",
      storePrivateFieldPhone: "Phone (optional)",
      storePrivateFieldGoogle: "Google / Gmail (optional, helps us match your Maps account)",
      storePrivateFieldMessage: "What would you like us to know?",
      storePrivateSubmitBtn: "Send privately",
      storePrivateCancelBtn: "Cancel",
      storePrivateThanksTitle: "Thank you — we’ve received your note",
      storePrivateThanksBody:
        "It means a lot that you trusted us with something private. We read every message and use it to make the next visit better. Come back whenever the timing feels right — and if you ever want to leave a public Google review, that is entirely up to you, with zero pressure.",
      storePrivateThanksDone: "Close",
      storePrivateErrorGeneric: "Something went wrong. Please try again in a moment.",
      storePrivateSubmitting: "Sending…",
    },
  };

  const DISH_PROFILE_OVERRIDES = {};

  const DISH_PROFILE_RULES = [
    { test: /noodle|面|捞面|汤面|拌面/i, zh: ["面条口感好", "汤底或酱汁很入味", "吃起来很顺口"], en: ["nice noodle texture", "flavorful broth or sauce", "easy to keep eating"] },
    { test: /rice|饭|炒饭|泡饭|盖饭/i, zh: ["米饭口感不错", "配料给得足", "味道很稳"], en: ["rice texture was good", "generous toppings", "solid flavor"] },
    { test: /bun|包|生煎|小笼|月饼/i, zh: ["外皮口感好", "馅料很足", "趁热吃很香"], en: ["wrapper had a good bite", "generous filling", "best while hot"] },
    { test: /dumpling|wonton|饺|馄饨|锅贴|烧卖|shumai/i, zh: ["馅料鲜", "皮和馅比例好", "口感很扎实"], en: ["fresh filling", "good wrapper-to-filling balance", "satisfying bite"] },
    { test: /seafood|crab|shrimp|fish|lobster|虾|蟹|鱼|龙虾|海鲜/i, zh: ["海鲜很鲜", "调味够入味", "份量看得见"], en: ["seafood tasted fresh", "seasoning landed well", "portion felt generous"] },
    { test: /soup|broth|汤|煲|casserole|pot/i, zh: ["汤底舒服", "热度刚好", "味道很暖胃"], en: ["comforting broth", "served at a good temperature", "warm and satisfying"] },
    { test: /tofu|豆腐/i, zh: ["豆腐口感嫩", "酱汁很下饭", "味道层次不错"], en: ["silky tofu texture", "sauce went well with rice", "nice layers of flavor"] },
    { test: /fried|crispy|煎|炸|脆/i, zh: ["外层很香脆", "火候不错", "吃起来不腻"], en: ["crispy outside", "well-cooked", "not too heavy"] },
    { test: /braised|红烧|酱|sauce|glaze/i, zh: ["酱汁很入味", "味道浓郁", "很适合配饭"], en: ["sauce was flavorful", "rich taste", "great with rice"] },
    { test: /drink|tea|soda|lemon|饮品|茶|柠檬|金桔|百香果/i, zh: ["饮品清爽", "甜度舒服", "搭配餐点刚好"], en: ["refreshing drink", "comfortable sweetness", "paired well with the meal"] },
    { test: /dessert|甜点|杨枝甘露|mango|red bean|pineapple|莲藕/i, zh: ["甜度刚好", "收尾很舒服", "口感有层次"], en: ["balanced sweetness", "nice finish to the meal", "good texture"] },
  ];

  const DISH_PROFILE_FALLBACK = {
    zh: ["味道很稳", "出品不错", "整体很满意"],
    en: ["solid flavor", "good execution", "really happy with the meal"],
  };

  const STORE_FEATURED_DISH_ORDER = {
    "xiebao-flushing": [
      /蟹黄盖饭（体验版）/,
      /蟹黄盖饭（至尊版）/,
      /蟹黄捞面（体验版）/,
      /蟹黄捞面（至尊版）/,
      /^红烧肉包$/,
      /^海虎蟹肉包$/,
      /^纯蟹黄小笼包$/,
      /蟹黄鸡汤肉皮煲/,
    ],
  };

  const STORE_LOGO_URLS = {
    "xiebao-edison": "/assets/stores/xiebao-edison-logo.png",
    "xiebao-flushing": "/assets/stores/xiebao-flushing-logo.jpg",
    "xiebao-manhattan": "/assets/stores/xiebao-manhattan-logo.png",
  };

  const STORE_GOOGLE_REVIEW_URLS = {
    "xiebao-manhattan": {
      googleReviewUrl:
        "https://www.google.com/maps/place/Xie+Bao+%E8%9F%B9%E5%AE%9D/@40.7606451,-73.9933645,747m/data=!3m1!1e3!4m8!3m7!1s0x89c25900533f308d:0x955c81afe0a5c325!8m2!3d40.7606411!4d-73.9907896!9m1!1b1!16s%2Fg%2F11wy40txdp?entry=ttu&g_ep=EgoyMDI2MDYyOC4wIKXMDSoASAFQAw%3D%3D",
      googlePlaceId: "0x89c25900533f308d:0x955c81afe0a5c325",
    },
  };

  const STORE_PRIVATE_FEEDBACK_OPEN_GUARD_MS = 500;

  const HISTORY_STORAGE_KEY = "gmap-faster-review-history-v1";
  const RECEIPT_SCHEMA_NAME = "receipt_detection";
  const IMAGE_ANALYSIS_SCHEMA_NAME = "upload_image_analysis";
  const PHOTO_RESOLUTION_SCHEMA_NAME = "dish_photo_resolution";
  const REVIEW_SCHEMA_NAME = "review_variants";

  const state = {
    lang: readSavedLanguage(),
    routeKind: ROUTE_LANDING,
    storeSlug: "",
    features: {
      servicePraise: true,
    },
    menuRaw: null,
    staffOptions: [],
    categories: [],
    flatDishes: [],
    dishMap: new Map(),
    dishAliasMap: new Map(),
    dishProfiles: new Map(),
    receiptDataUrl: "",
    receiptName: "",
    recognizedDishIds: new Set(),
    uncertainTexts: [],
    generatedReviews: [],
    recognitionMeta: [],
    imageAnalysis: null,
    lastRecognitionMode: "",
    visitTier: "",
    visitSheetDraftTier: "",
    isVisitSheetOpen: false,
    isPricingSummaryOpen: false,
    visitSheetDelayId: null,
    shouldRefreshAfterVisitSheet: false,
    visitSheetDrag: {
      active: false,
      pointerId: null,
      startY: 0,
      lastY: 0,
      startedAt: 0,
    },
    isServicePanelOpen: false,
    servicePraiseEnabled: false,
    serviceStaffLabel: "",
    servicePraiseKey: SERVICE_PRAISE_OPTIONS[0].key,
    comboHistory: loadHistory(),
    isRecognizing: false,
    isGenerating: false,
    isCorrectionOpen: false,
    hasAttemptedReviewOpen: false,
    loyaltyPromoDone: false,
    pendingReviewUrl: null,
    selectedReviewStyleKey: "",
    selectedReviewText: "",
    assistant: {
      initialized: false,
    },
    intelLoading: false,
    intelError: "",
    intelSalons: [],
    intelDetail: null,
    intelSearchQuery: "",
    intelListSearchLoading: false,
    intelListSearchTimer: null,
    intelListSearchDelegationBound: false,
    intelGeoState: "",
    intelGeoCity: "",
    intelGeoResolved: false,
    intelListPage: 1,
    intelListTotal: 0,
    intelListSource: "geo",
    leaderboardLoading: false,
    leaderboardError: "",
    leaderboardSalons: [],
    leaderboardDetail: null,
    leaderboardSearchQuery: "",
    leaderboardStateF: "All States",
    leaderboardCountyF: "All Counties",
    leaderboardTownF: "All Townships",
    leaderboardCategoryF: "All Categories",
    leaderboardDetailTab: "overview",
    mobileSnapBound: false,
    leaderboardRealtimeChannel: null,
    leaderboardSupabaseClient: null,
    leaderboardRequestBusy: false,
    leaderboardListDelegationBound: false,
    leaderboardVisibility: "preview",
    /** "geo" = state/county snapshot; "search" = rows from ?q= API (cross-county). */
    leaderboardListSource: "geo",
    /** "global" | "county" — from /api/leaderboard/salons when ?state=&county= are used */
    leaderboardPreviewScope: "global",
    leaderboardPreviewLimit: LEADERBOARD_PAGE_SIZE,
    leaderboardListPage: 1,
    leaderboardRequestModalOpen: false,
    leaderboardRequestToast: "",
    /** Leaderboard salon detail AI summary: "en" | "zh" (persisted in localStorage). */
    leaderboardLocale: "en",
    storeBootstrapFailure: null,
    storeBootstrapPending: false,
    storeCatalogIsDefault: false,
    serviceSpotlight: null,
    storeReviewCount: null,
    storeGoogleRating: null,
    storeVisitStars: 0,
    storeVisitStarsHover: 0,
    storeVisitStarsBound: false,
    storeReviewFlowStage: "gate",
    storeReviewSatisfaction: "",
    storeServiceSearch: "",
    storeStaffSearch: "",
    storePrivateFeedbackMode: "private",
    storePrivateFeedbackModalBound: false,
    storePrivateFeedbackOpenedAt: 0,
    storeVisitChromeBound: false,
  };

  const el = {
    appShell: document.getElementById("appShell"),
    pageHero: document.getElementById("pageHero"),
    landingContent: document.getElementById("landingContent"),
    portalContent: document.getElementById("portalContent"),
    layout: document.getElementById("layout"),
    intakeCard: document.getElementById("intakeCard"),
    storeVisitReceiptBlock: document.getElementById("storeVisitReceiptBlock"),
    storeVisitShell: document.getElementById("storeVisitShell"),
    storeVisitBrandName: document.getElementById("storeVisitBrandName"),
    storeVisitLogoMark: document.getElementById("storeVisitLogoMark"),
    storeVisitGoogleTrust: document.getElementById("storeVisitGoogleTrust"),
    storeVisitGoogleTrustStars: document.getElementById("storeVisitGoogleTrustStars"),
    storeVisitGoogleRating: document.getElementById("storeVisitGoogleRating"),
    storeVisitGoogleReviewCount: document.getElementById("storeVisitGoogleReviewCount"),
    storeVisitGoogleBadgeLabel: document.getElementById("storeVisitGoogleBadgeLabel"),
    storeVisitBenefitOneTitle: document.getElementById("storeVisitBenefitOneTitle"),
    storeVisitBenefitOneBody: document.getElementById("storeVisitBenefitOneBody"),
    storeVisitBenefitTwoTitle: document.getElementById("storeVisitBenefitTwoTitle"),
    storeVisitBenefitTwoBody: document.getElementById("storeVisitBenefitTwoBody"),
    storeVisitServiceCard: document.getElementById("storeVisitServiceCard"),
    storeVisitServiceLabel: document.getElementById("storeVisitServiceLabel"),
    storeVisitServiceName: document.getElementById("storeVisitServiceName"),
    storeVisitHeroTitle: document.getElementById("storeVisitHeroTitle"),
    storeVisitHeroLead: document.getElementById("storeVisitHeroLead"),
    storeVisitStars: document.getElementById("storeVisitStars"),
    storeVisitMood: document.getElementById("storeVisitMood"),
    storeFlowCard: document.getElementById("storeFlowCard"),
    dishesCard: document.getElementById("dishesCard"),
    reviewsCard: document.getElementById("reviewsCard"),
    brandName: document.getElementById("brandName"),
    title: document.getElementById("title"),
    subtitle: document.getElementById("subtitle"),
    langMenu: document.getElementById("langMenu"),
    langMenuToggle: document.getElementById("langMenuToggle"),
    langMenuPopover: document.getElementById("langMenuPopover"),
    langOptionEn: document.getElementById("langOptionEn"),
    langOptionZh: document.getElementById("langOptionZh"),
    uploadTitle: document.getElementById("uploadTitle"),
    uploadHint: document.getElementById("uploadHint"),
    uploadBtn: document.getElementById("uploadBtn"),
    writeOwnReviewBtn: document.getElementById("writeOwnReviewBtn"),
    retakeBtn: document.getElementById("retakeBtn"),
    receiptInput: document.getElementById("receiptInput"),
    receiptPreview: document.getElementById("receiptPreview"),
    previewEmptyText: document.getElementById("previewEmptyText"),
    receiptStatusGroup: document.getElementById("receiptStatusGroup"),
    receiptStatus: document.getElementById("receiptStatus"),
    receiptMeta: document.getElementById("receiptMeta"),
    dishesTitle: document.getElementById("dishesTitle"),
    dishesHint: document.getElementById("dishesHint"),
    correctionLabel: document.getElementById("correctionLabel"),
    correctionToggle: document.getElementById("correctionToggle"),
    correctionPanel: document.getElementById("correctionPanel"),
    dishSearch: document.getElementById("dishSearch"),
    recognizedSummary: document.getElementById("recognizedSummary"),
    recognizedList: document.getElementById("recognizedList"),
    recognizedEmptyText: document.getElementById("recognizedEmptyText"),
    uncertainWrap: document.getElementById("uncertainWrap"),
    uncertainTitle: document.getElementById("uncertainTitle"),
    uncertainList: document.getElementById("uncertainList"),
    retakeInlineBtn: document.getElementById("retakeInlineBtn"),
    resetBtn: document.getElementById("resetBtn"),
    reviewsTitle: document.getElementById("reviewsTitle"),
    reviewContextBar: document.getElementById("reviewContextBar"),
    visitSummaryBtn: document.getElementById("visitSummaryBtn"),
    visitSummaryLabel: document.getElementById("visitSummaryLabel"),
    visitSummaryText: document.getElementById("visitSummaryText"),
    visitSummaryAction: document.getElementById("visitSummaryAction"),
    serviceToggleBtn: document.getElementById("serviceToggleBtn"),
    serviceModule: document.querySelector(".service-module"),
    serviceToggleLabel: document.getElementById("serviceToggleLabel"),
    serviceToggleText: document.getElementById("serviceToggleText"),
    serviceToggleMeta: document.getElementById("serviceToggleMeta"),
    servicePanel: document.getElementById("servicePanel"),
    serviceNameLabel: document.getElementById("serviceNameLabel"),
    serviceStaffSelect: document.getElementById("serviceStaffSelect"),
    servicePraiseLabel: document.getElementById("servicePraiseLabel"),
    servicePraiseOptions: document.getElementById("servicePraiseOptions"),
    serviceClearBtn: document.getElementById("serviceClearBtn"),
    serviceApplyBtn: document.getElementById("serviceApplyBtn"),
    reviewsStatus: document.getElementById("reviewsStatus"),
    manualOpenLink: document.getElementById("manualOpenLink"),
    reviewsGrid: document.getElementById("reviewsGrid"),
    loyaltyPromoPanel: document.getElementById("loyaltyPromoPanel"),
    loyaltyPromoIntro: document.getElementById("loyaltyPromoIntro"),
    loyaltyPromoForm: document.getElementById("loyaltyPromoForm"),
    loyaltyPromoPhone: document.getElementById("loyaltyPromoPhone"),
    loyaltyPromoConsent: document.getElementById("loyaltyPromoConsent"),
    loyaltyPromoConsentText: document.getElementById("loyaltyPromoConsentText"),
    loyaltyPromoSubmitBtn: document.getElementById("loyaltyPromoSubmitBtn"),
    loyaltyPromoResult: document.getElementById("loyaltyPromoResult"),
    loyaltyPromoCodeText: document.getElementById("loyaltyPromoCodeText"),
    loyaltyPromoContinueBtn: document.getElementById("loyaltyPromoContinueBtn"),
    loyaltyPromoStatus: document.getElementById("loyaltyPromoStatus"),
    anotherSetBtn: document.getElementById("anotherSetBtn"),
    reviewWriteOwnBtn: document.getElementById("reviewWriteOwnBtn"),
    visitSheetBackdrop: document.getElementById("visitSheetBackdrop"),
    visitSheet: document.getElementById("visitSheet"),
    visitSheetDragZone: document.getElementById("visitSheetDragZone"),
    visitSheetTitle: document.getElementById("visitSheetTitle"),
    visitSheetHint: document.getElementById("visitSheetHint"),
    visitOptions: document.getElementById("visitOptions"),
    visitContinueBtn: document.getElementById("visitContinueBtn"),
    pricingSummaryBackdrop: document.getElementById("pricingSummaryBackdrop"),
    pricingSummaryDialog: document.getElementById("pricingSummaryDialog"),
    pricingSummaryTitle: document.getElementById("pricingSummaryTitle"),
    pricingSummaryBody: document.getElementById("pricingSummaryBody"),
    pricingSummaryLines: document.getElementById("pricingSummaryLines"),
    pricingSummaryDueToday: document.getElementById("pricingSummaryDueToday"),
    pricingSummaryRecurring: document.getElementById("pricingSummaryRecurring"),
    pricingSummaryCloseBtn: document.getElementById("pricingSummaryCloseBtn"),
    pricingSummaryBackBtn: document.getElementById("pricingSummaryBackBtn"),
    pricingSummaryCheckoutBtn: document.getElementById("pricingSummaryCheckoutBtn"),
    storePrivateFeedbackBackdrop: document.getElementById("storePrivateFeedbackBackdrop"),
    storePrivateFeedbackDialog: document.getElementById("storePrivateFeedbackDialog"),
    storePrivateFeedbackCloseBtn: document.getElementById("storePrivateFeedbackCloseBtn"),
    storePrivateFeedbackFormPane: document.getElementById("storePrivateFeedbackFormPane"),
    storePrivateFeedbackThanksPane: document.getElementById("storePrivateFeedbackThanksPane"),
    storePrivateFeedbackTitle: document.getElementById("storePrivateFeedbackTitle"),
    storePrivateFeedbackIntro: document.getElementById("storePrivateFeedbackIntro"),
    storePrivateFeedbackForm: document.getElementById("storePrivateFeedbackForm"),
    storePrivateFeedbackFormError: document.getElementById("storePrivateFeedbackFormError"),
    storePrivateFeedbackCancelBtn: document.getElementById("storePrivateFeedbackCancelBtn"),
    storePrivateFeedbackSubmitBtn: document.getElementById("storePrivateFeedbackSubmitBtn"),
    storePrivateFeedbackThanksTitle: document.getElementById("storePrivateFeedbackThanksTitle"),
    storePrivateFeedbackThanksBody: document.getElementById("storePrivateFeedbackThanksBody"),
    storePrivateFeedbackThanksDoneBtn: document.getElementById("storePrivateFeedbackThanksDoneBtn"),
    storePrivateLabelName: document.getElementById("storePrivateLabelName"),
    storePrivateLabelPhone: document.getElementById("storePrivateLabelPhone"),
    storePrivateLabelGoogle: document.getElementById("storePrivateLabelGoogle"),
    storePrivateLabelMessage: document.getElementById("storePrivateLabelMessage"),
    storePrivateInputName: document.getElementById("storePrivateInputName"),
    storePrivateInputPhone: document.getElementById("storePrivateInputPhone"),
    storePrivateInputGoogle: document.getElementById("storePrivateInputGoogle"),
    storePrivateInputMessage: document.getElementById("storePrivateInputMessage"),
  };

  function getEffectiveReviewLang() {
    return state.lang === "zh" ? "zh" : "en";
  }

  function t(key) {
    var L = getEffectiveReviewLang();
    return i18n[L][key];
  }

  function isSiteLangSupported(code) {
    return SITE_LANG_ORDER.indexOf(code) >= 0;
  }

  function getMarketingSiteLangDisplayLabel() {
    return SITE_LANG_LABELS[state.lang] || SITE_LANG_LABELS.en;
  }

  function syncDocumentHtmlLang() {
    document.documentElement.lang = SITE_LANG_HTML[state.lang] || "en";
  }

  function clampLangToAppLocales() {
    if (isMarketingRoute()) return;
    if (state.lang !== "zh" && state.lang !== "en") {
      state.lang = "en";
      saveLanguagePreference("en");
    }
  }

  function getMarketingLangMenuHtml() {
    return SITE_LANG_ORDER.map(function (code) {
      var active = state.lang === code ? " is-active" : "";
      return (
        '<li role="none">' +
        '<button type="button" role="menuitemradio" class="marketing-lang-option' +
        active +
        '" data-marketing-lang="' +
        escapeHtml(code) +
        '" aria-checked="' +
        (state.lang === code ? "true" : "false") +
        '">' +
        escapeHtml(SITE_LANG_LABELS[code] || code) +
        "</button></li>"
      );
    }).join("");
  }

  function setMarketingLangMenuOpen(wrap, open) {
    if (!wrap) return;
    var menu = wrap.querySelector("[data-marketing-lang-menu]");
    var btn = wrap.querySelector("[data-marketing-lang-btn]");
    var isOpen = !!open;
    wrap.setAttribute("data-open", isOpen ? "true" : "false");
    if (btn) btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (menu) {
      menu.classList.toggle("hidden", !isOpen);
      menu.setAttribute("aria-hidden", isOpen ? "false" : "true");
    }
    var shell = wrap.closest(".marketing-nav-shell");
    if (shell) shell.classList.toggle("marketing-nav-lang-open", isOpen);
  }

  function closeAllMarketingLangMenus() {
    var wraps = document.querySelectorAll("[data-marketing-lang-wrap]");
    for (var i = 0; i < wraps.length; i++) {
      setMarketingLangMenuOpen(wraps[i], false);
    }
  }

  function setMarketingSiteLang(lang) {
    if (!isSiteLangSupported(lang)) {
      closeAllMarketingLangMenus();
      return;
    }
    if (lang === state.lang) {
      closeAllMarketingLangMenus();
      return;
    }
    state.lang = lang;
    saveLanguagePreference(lang);
    if (isLeaderboardRoute()) {
      state.leaderboardLocale = lang === "zh" ? "zh" : "en";
      try {
        localStorage.setItem("leaderboardLocale", state.leaderboardLocale);
      } catch (e) {
        /* ignore */
      }
    }
    syncDocumentHtmlLang();
    document.title = getPageTitle();
    renderLandingContent();
    trackEvent("language_toggled", analyticsParams({ site_lang: lang }));
  }

  function formatText(template, params) {
    return template.replace(/\{(\w+)\}/g, function (_, name) {
      return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : "";
    });
  }

  function setNodeText(node, value) {
    if (node) node.textContent = value;
  }

  function readSavedLanguage() {
    try {
      var saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return isSiteLangSupported(saved) ? saved : "en";
    } catch (e) {
      return "en";
    }
  }

  function saveLanguagePreference(lang) {
    var normalized = isSiteLangSupported(lang) ? lang : "en";
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch (e) {
      /* ignore */
    }
    try {
      sessionStorage.setItem("portalLocale", normalized === "zh" ? "zh" : "en");
    } catch (e2) {
      /* ignore */
    }
  }

  function getActiveLanguage() {
    return state.lang === "zh" ? "zh" : "en";
  }

  function createLocalizedProxy(packs) {
    var fallback = (packs && packs.en) || {};
    return new Proxy(fallback, {
      get: function (target, prop) {
        if (typeof prop === "symbol") return target[prop];
        var active = (packs && packs[getActiveLanguage()]) || fallback;
        if (Object.prototype.hasOwnProperty.call(active, prop)) return active[prop];
        return target[prop];
      },
    });
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/（[^）]*）/g, " ")
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "")
      .trim();
  }

  function simplifyText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/（[^）]*）/g, " ")
      .replace(/\b\d+\s*(pcs?|piece|lb|oz)\b/g, " ")
      .replace(/[^\w\u4e00-\u9fff]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function uniqueArray(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function normalizeStringList(values) {
    if (!Array.isArray(values)) return [];
    return uniqueArray(
      values
        .map(function (value) {
          return String(value || "").trim();
        })
        .filter(Boolean),
    );
  }

  function shuffleArray(values) {
    const next = values.slice();
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = next[i];
      next[i] = next[j];
      next[j] = temp;
    }
    return next;
  }

  function sampleRandom(values, count) {
    return shuffleArray(values).slice(0, Math.max(0, Number(count) || 0));
  }

  function getReviewLengthProfiles(lang) {
    return REVIEW_LENGTH_PROFILES[lang] || REVIEW_LENGTH_PROFILES.zh;
  }

  function cloneLengthProfileWithOrdinalPrompt(profile, ordinalIndex, lang) {
    const resolvedLang = lang || state.lang;
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
      promptLabel: base + (resolvedLang === "en" ? suffixEn : suffixZh),
    });
  }

  function buildReviewLengthAssignments(lang) {
    const resolvedLang = lang || state.lang;
    const profiles = getReviewLengthProfiles(resolvedLang);
    return STYLE_VARIANTS.map(function (variant, index) {
      const profile = profiles[Math.min(index, profiles.length - 1)];
      return {
        styleKey: variant.key,
        profile: cloneLengthProfileWithOrdinalPrompt(profile, index, resolvedLang),
      };
    });
  }

  function getReviewLengthAssignment(styleKey, assignments, lang) {
    const resolvedLang = lang || state.lang;
    const found = (assignments || []).find(function (assignment) {
      return assignment.styleKey === styleKey;
    });
    return found && found.profile ? found.profile : getReviewLengthProfiles(resolvedLang)[0];
  }

  function getReviewLengthBounds(lang) {
    return (lang || state.lang) === "en"
      ? { min: 6, max: 50 }
      : { min: 16, max: 78 };
  }

  function countReviewLengthUnits(text, lang) {
    const value = String(text || "").trim();
    if (!value) return 0;

    if ((lang || state.lang) === "en") {
      const words = value.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*/g);
      return words ? words.length : 0;
    }

    return value
      .replace(/[\s,.!?;:'"(){}\[\]<>/\\|@#$%^&*_+=~`，。！？；：、“”‘’（）【】《》—-]/g, "")
      .length;
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

  function getAssignedFocus(styleKey, focusAssignments) {
    const found = (focusAssignments || []).find(function (assignment) {
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

  function getServicePraiseOption(key) {
    return SERVICE_PRAISE_OPTIONS.find(function (option) {
      return option.key === key;
    }) || SERVICE_PRAISE_OPTIONS[0];
  }

  function isServicePraiseAvailable() {
    return state.features.servicePraise !== false;
  }

  function getVisitTierLabel(key) {
    const option = getVisitTierOption(key);
    if (!option) return "";
    return state.lang === "zh" ? option.zhLabel : option.enLabel;
  }

  function getDefaultServiceStaffLabel(langOverride) {
    return "staff";
  }

  function getResolvedServiceStaffLabel(rawValue, langOverride) {
    const explicitLabel = String(rawValue || "").trim();
    return explicitLabel || getDefaultServiceStaffLabel(langOverride);
  }

  function buildServicePraisePayload() {
    if (
      isStoreRoute() &&
      String(state.serviceStaffLabel || "").trim() &&
      state.storeReviewFlowStage === "reviews"
    ) {
      return {
        staffLabel: getResolvedServiceStaffLabel(state.serviceStaffLabel, state.lang),
        praiseKey: "friendly",
      };
    }

    if (!isServicePraiseAvailable() || !state.servicePraiseEnabled) return null;

    const option = getServicePraiseOption(state.servicePraiseKey);
    return {
      staffLabel: getResolvedServiceStaffLabel(state.serviceStaffLabel, state.lang),
      praiseKey: option.key,
    };
  }

  function getStoreFlowStaffOptions() {
    return uniqueArray(
      (state.staffOptions || [])
        .map(function (staff) {
          return String(staff && (staff.displayName || staff.name) || "").trim();
        })
        .filter(Boolean),
    );
  }

  function getStoreFlowNextStageAfterVisit() {
    return "services";
  }

  function getStoreFlowPreviousStage(stage) {
    if (stage === "services") return "visit";
    if (stage === "visit") return "gate";
    return "gate";
  }

  function getStoreFeaturedDishRank(item) {
    const patterns = STORE_FEATURED_DISH_ORDER[String(state.storeSlug || "").trim()];
    if (!patterns || !patterns.length || !item) return Number.MAX_SAFE_INTEGER;

    const zh = String(item.zh || "");
    const en = String(item.en || item.n || "");
    for (let i = 0; i < patterns.length; i += 1) {
      if (patterns[i].test(zh) || patterns[i].test(en)) return i;
    }
    return Number.MAX_SAFE_INTEGER;
  }

  function sortDishesForBrowse(a, b) {
    const featuredDiff = getStoreFeaturedDishRank(a) - getStoreFeaturedDishRank(b);
    if (featuredDiff !== 0) return featuredDiff;
    return getDishName(a).localeCompare(getDishName(b), state.lang === "zh" ? "zh-Hans" : "en", {
      sensitivity: "base",
    });
  }

  function getStoreServiceMatches(query) {
    const normalizedQuery = normalizeText(query || "");
    const sorted = state.flatDishes.slice().sort(sortDishesForBrowse);

    const browseLimit = 5;
    const searchLimit = 36;

    if (!normalizedQuery) return sorted.slice(0, browseLimit);

    return sorted.filter(function (item) {
      const haystack = [
        item.zh,
        item.en,
        item.categoryName,
        (item.aliases || []).join(" "),
      ].join(" ");
      return normalizeText(haystack).indexOf(normalizedQuery) !== -1;
    }).slice(0, searchLimit);
  }

  function getStoreStaffMatches(query, staffNames) {
    const normalizedQuery = normalizeText(query || "");
    const list = Array.isArray(staffNames) ? staffNames.slice() : [];
    const browseLimit = 5;
    const searchLimit = 36;

    if (!normalizedQuery) {
      return list.slice(0, browseLimit);
    }

    return list
      .filter(function (name) {
        return normalizeText(String(name || "")).indexOf(normalizedQuery) !== -1;
      })
      .slice(0, searchLimit);
  }

  function reviewMentionsVisitContext(text, visitTierKey) {
    const option = getVisitTierOption(visitTierKey);
    if (!option) return true;
    return (state.lang === "zh" ? option.zhPattern : option.enPattern).test(String(text || ""));
  }

  function applyVisitContextToReviews(reviews) {
    const option = getVisitTierOption(state.visitTier);
    if (!option) return reviews;

    const prefixes = state.lang === "zh" ? option.zhPrefixes : option.enPrefixes;
    return reviews.map(function (review, index) {
      if (reviewMentionsVisitContext(review.text, state.visitTier)) return review;
      const prefix = prefixes[index % prefixes.length];
      return Object.assign({}, review, {
        text: prefix + " " + review.text,
      });
    });
  }

  function applyServicePraiseToReviews(reviews) {
    const payload = buildServicePraisePayload();
    if (!payload) return reviews;

    const option = getServicePraiseOption(payload.praiseKey);
    return reviews.map(function (review) {
      if (review.focus !== "service") return review;
      if (String(review.text || "").indexOf(payload.staffLabel) !== -1) return review;

      const sentence =
        state.lang === "zh"
          ? "也提一下" + payload.staffLabel + "，服务" + option.zhPhrase + "。"
          : " Also shoutout to " + payload.staffLabel + " for the " + option.enPhrase + " service.";

      return Object.assign({}, review, {
        text: state.lang === "zh" ? review.text + sentence : review.text + sentence,
      });
    });
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state.comboHistory));
    } catch (err) {
      console.warn("Failed to save history", err);
    }
  }

  function getRestaurantName() {
    return state.lang === "zh" ? config.restaurantNameZh : config.restaurantNameEn;
  }

  function getBrandDisplayName() {
    if (isMarketingRoute()) return SITE_NAME;
    if (!config.restaurantNameZh) return config.restaurantNameEn;
    if (!config.restaurantNameEn) return config.restaurantNameZh;
    if (config.restaurantNameZh === config.restaurantNameEn) return config.restaurantNameZh;
    return config.restaurantNameZh + " " + config.restaurantNameEn;
  }

  function isLandingRoute() {
    return state.routeKind === ROUTE_LANDING;
  }

  function isPriceRoute() {
    return state.routeKind === ROUTE_PRICE;
  }

  function isServicesRoute() {
  return state.routeKind === ROUTE_SERVICES;
  }

  function isAboutRoute() {
    return state.routeKind === ROUTE_ABOUT;
  }

  function isAnalysisListRoute() {
    return state.routeKind === ROUTE_ANALYSIS_LIST;
  }

  function isAnalysisSalonRoute() {
    return state.routeKind === ROUTE_ANALYSIS_SALON;
  }

  function isAnalysisFullRoute() {
    return state.routeKind === ROUTE_ANALYSIS_FULL;
  }

  function isAnalysisRoute() {
    return isAnalysisListRoute() || isAnalysisSalonRoute() || isAnalysisFullRoute();
  }

  function isLeaderboardListRoute() {
    return state.routeKind === ROUTE_LEADERBOARD_LIST;
  }

  function isLeaderboardSalonRoute() {
    return state.routeKind === ROUTE_LEADERBOARD_SALON;
  }

  function isLeaderboardRoute() {
    return isLeaderboardListRoute() || isLeaderboardSalonRoute();
  }

  function isSmsConsentRoute() {
    return state.routeKind === ROUTE_SMS_CONSENT;
  }

  function isPrivacyRoute() {
    return state.routeKind === ROUTE_PRIVACY;
  }

  function isTermsRoute() {
    return state.routeKind === ROUTE_TERMS;
  }

  function isLegalRoute() {
    return isSmsConsentRoute() || isPrivacyRoute() || isTermsRoute();
  }

  function isTalkRoute() {
    return state.routeKind === ROUTE_TALK;
  }

  function isTavusDemoRoute() {
    return state.routeKind === ROUTE_TAVUS_DEMO;
  }

  function isAssistantRoute() {
    return isTalkRoute() || isTavusDemoRoute();
  }

  function isStoreRoute() {
    return state.routeKind === ROUTE_STORE;
  }

  function isLoginRoute() {
    return state.routeKind === ROUTE_LOGIN;
  }

  function isAdminRoute() {
    return (
      state.routeKind === ROUTE_ADMIN ||
      state.routeKind === ROUTE_ADMIN_STORES ||
      state.routeKind === ROUTE_ADMIN_STORE ||
      state.routeKind === ROUTE_ADMIN_SMS
    );
  }

  function isPortalRoute() {
    return isLoginRoute() || isAdminRoute();
  }

  function isMarketingRoute() {
    return !isStoreRoute() && !isPortalRoute() && state.routeKind !== ROUTE_LEGACY;
  }

  function getStorePath(slug) {
    const cleanSlug = String(slug || "").trim();
    return cleanSlug ? "/stores/" + encodeURIComponent(cleanSlug) : "/";
  }

  function slugToStorePlaceholderLabel(slug) {
    const raw = String(slug || "").trim();
    if (!raw) return SITE_NAME;
    return raw
      .split("-")
      .filter(Boolean)
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  function applyProvisionalStoreBranding(slug) {
    const label = slugToStorePlaceholderLabel(slug);
    config.restaurantNameZh = label;
    config.restaurantNameEn = label;
    const storeGoogleFallback = STORE_GOOGLE_REVIEW_URLS[String(slug || "").trim()];
    if (storeGoogleFallback && storeGoogleFallback.googleReviewUrl) {
      config.googleReviewUrl = storeGoogleFallback.googleReviewUrl;
      config.googleReviewFallbackUrl = storeGoogleFallback.googleReviewUrl;
    }
  }

  function resolveBootstrapFailureCopy(failure) {
    if (!failure) return "";
    const code = String(failure.code || "");
    const msg = String(failure.message || "");
    if (code === "STORE_NOT_FOUND") return t("storeNotAvailable");
    if (code === "MENU_SNAPSHOT_NOT_FOUND") return t("storeMenuNotPublished");
    if (code === "MENU_EMPTY") return t("storeServiceCatalogEmpty");
    if (/published menu snapshot not found|published service catalog not found/i.test(msg)) {
      return t("storeMenuNotPublished");
    }
    if (/published service catalog is empty|published menu snapshot is empty/i.test(msg)) {
      return t("storeServiceCatalogEmpty");
    }
    if (/store not found or inactive/i.test(msg)) return t("storeNotAvailable");
    return msg || t("storeBootstrapGeneric");
  }

  function getPagePath(routeKind) {
    if (routeKind === ROUTE_SERVICES) return "/services.html";
    if (routeKind === ROUTE_PRICE) return "/price";
    if (routeKind === ROUTE_ABOUT) return "/about-us";
    if (routeKind === ROUTE_SMS_CONSENT) return "/sms-consent";
    if (routeKind === ROUTE_PRIVACY) return "/privacy";
    if (routeKind === ROUTE_TERMS) return "/terms";
    if (routeKind === ROUTE_TALK) return "/button.html";
    if (routeKind === ROUTE_TAVUS_DEMO) return "/tavus-demo";
    if (routeKind === ROUTE_ANALYSIS_LIST) return "/analysis-reports";
    if (routeKind === ROUTE_LEADERBOARD_LIST) return "/analysis-reports";
    return "/";
  }

  function getRouteInfo() {
    const normalizedPath = String(window.location.pathname || "/").replace(/\/+$/, "") || "/";
    const legacyMatch = normalizedPath.match(/^\/s\/([^/]+)$/);
    if (legacyMatch) {
      return {
        kind: ROUTE_LEGACY,
        slug: decodeURIComponent(legacyMatch[1]),
      };
    }

    const storeMatch = normalizedPath.match(/^\/stores\/([^/]+)$/);
    if (storeMatch) {
      return {
        kind: ROUTE_STORE,
        slug: decodeURIComponent(storeMatch[1]),
      };
    }

    if (normalizedPath === "/price") {
      return {
        kind: ROUTE_PRICE,
        slug: "",
      };
    }

    if (normalizedPath === "/services") {
  return {
    kind: ROUTE_SERVICES,
    slug: "",
  };
}

    if (normalizedPath === "/about-us") {
      return {
        kind: ROUTE_ABOUT,
        slug: "",
      };
    }

    if (normalizedPath === "/sms-consent") {
      return {
        kind: ROUTE_SMS_CONSENT,
        slug: "",
      };
    }

    if (normalizedPath === "/privacy") {
      return {
        kind: ROUTE_PRIVACY,
        slug: "",
      };
    }

    if (normalizedPath === "/terms") {
      return {
        kind: ROUTE_TERMS,
        slug: "",
      };
    }

    if (normalizedPath === "/talk-to-assistant") {
      return {
        kind: ROUTE_TALK,
        slug: "",
      };
    }

    if (normalizedPath === "/tavus-demo") {
      return {
        kind: ROUTE_TAVUS_DEMO,
        slug: "",
      };
    }

    if (normalizedPath === "/analysis-reports") {
      return {
        kind: ROUTE_ANALYSIS_LIST,
        slug: "",
      };
    }

    if (normalizedPath === "/leaderboard") {
      return {
        kind: ROUTE_ANALYSIS_LIST,
        slug: "",
      };
    }

    const leaderboardSalonMatch = normalizedPath.match(/^\/leaderboard\/([^/]+)$/);
    if (leaderboardSalonMatch) {
      return {
        kind: ROUTE_ANALYSIS_SALON,
        slug: decodeURIComponent(leaderboardSalonMatch[1]),
      };
    }

    const analysisFullMatch = normalizedPath.match(/^\/analysis-reports\/([^/]+)\/full$/);
    if (analysisFullMatch) {
      return {
        kind: ROUTE_ANALYSIS_FULL,
        slug: decodeURIComponent(analysisFullMatch[1]),
      };
    }

    const analysisSalonMatch = normalizedPath.match(/^\/analysis-reports\/([^/]+)$/);
    if (analysisSalonMatch) {
      return {
        kind: ROUTE_ANALYSIS_SALON,
        slug: decodeURIComponent(analysisSalonMatch[1]),
      };
    }

    if (normalizedPath === "/login") {
      return {
        kind: ROUTE_LOGIN,
        slug: "",
      };
    }

    if (normalizedPath.match(/^\/admin\/stores\/([^/]+)$/)) {
      const adminStoreMatch = normalizedPath.match(/^\/admin\/stores\/([^/]+)$/);
      return {
        kind: ROUTE_ADMIN_STORE,
        slug: decodeURIComponent(adminStoreMatch[1]),
      };
    }

    if (normalizedPath === "/admin/stores") {
      return {
        kind: ROUTE_ADMIN_STORES,
        slug: "",
      };
    }

    if (normalizedPath === "/admin/sms") {
      return {
        kind: ROUTE_ADMIN_SMS,
        slug: "",
      };
    }

    if (normalizedPath === "/admin") {
      return {
        kind: ROUTE_ADMIN,
        slug: "",
      };
    }

    return {
      kind: ROUTE_LANDING,
      slug: "",
    };
  }

  function redirectLegacyRoute(slug) {
    const target = getStorePath(slug) + window.location.search + window.location.hash;
    window.location.replace(target);
  }

  function getPageTitle() {
    if (isLandingRoute()) return SITE_NAME + " | " + MARKETING_UI.pageTitleLanding;
    if (isPriceRoute()) return SITE_NAME + " | " + MARKETING_UI.pageTitlePricing;
    if (isAboutRoute()) return SITE_NAME + " | " + MARKETING_UI.pageTitleAbout;
    if (isTalkRoute()) return SITE_NAME + " | " + MARKETING_UI.pageTitleTalk;
    if (isTavusDemoRoute()) return SITE_NAME + " | " + MARKETING_UI.pageTitleTavusDemo;
    if (isAnalysisListRoute()) return SITE_NAME + " | " + MARKETING_UI.pageTitleAnalysisList;
    if (isAnalysisSalonRoute()) return SITE_NAME + " | " + MARKETING_UI.pageTitleAnalysisSalon;
    if (isAnalysisFullRoute()) return SITE_NAME + " | " + MARKETING_UI.pageTitleAnalysisFull;
    if (isLeaderboardListRoute()) return "Restaurant AI Leaderboard | Google Maps SEO Rankings | " + SITE_NAME;
    if (isLeaderboardSalonRoute()) return "Restaurant Scorecard & Google Maps SEO Audit | " + SITE_NAME;
    if (isSmsConsentRoute()) return SITE_NAME + " | " + MARKETING_UI.pageTitleSmsConsent;
    if (isPrivacyRoute()) return SITE_NAME + " | " + MARKETING_UI.pageTitlePrivacy;
    if (isTermsRoute()) return SITE_NAME + " | " + MARKETING_UI.pageTitleTerms;
    if (isLoginRoute()) return SITE_NAME + " | " + MARKETING_UI.pageTitleLogin;
    if (state.routeKind === ROUTE_ADMIN) return SITE_NAME + " | " + MARKETING_UI.pageTitleAdmin;
    if (state.routeKind === ROUTE_ADMIN_STORES) return SITE_NAME + " | " + MARKETING_UI.pageTitleAdminStores;
    if (state.routeKind === ROUTE_ADMIN_STORE) return SITE_NAME + " | " + MARKETING_UI.pageTitleAdminStore;
    if (state.routeKind === ROUTE_ADMIN_SMS) return SITE_NAME + " | SMS campaigns";
    return getRestaurantName() + " | " + (state.lang === "zh" ? "评论工作室" : "Review Studio");
  }

  function getPreferredOrigin() {
    if (typeof location !== "undefined" && location.origin) {
      if (/vercel\.app$/i.test(location.hostname || "")) return location.origin;
      return "https://rankmyrestaurant.ai";
    }
    return "https://rankmyrestaurant.ai";
  }

  function getCanonicalPath() {
    if (isStoreRoute() && String(state.storeSlug || "").trim()) return getStorePath(state.storeSlug);
    if (isLeaderboardSalonRoute() && String(state.storeSlug || "").trim()) {
      return "/leaderboard/" + encodeURIComponent(String(state.storeSlug).trim());
    }
    if (isAnalysisFullRoute() && String(state.storeSlug || "").trim()) {
      return (
        "/analysis-reports/" + encodeURIComponent(String(state.storeSlug).trim()) + "/full"
      );
    }
    if (isAnalysisSalonRoute() && String(state.storeSlug || "").trim()) {
      return "/analysis-reports/" + encodeURIComponent(String(state.storeSlug).trim());
    }
    return getPagePath(state.routeKind || ROUTE_LANDING);
  }

  function getPageDescription() {
    if (isStoreRoute()) {
      return "Generate restaurant-ready Google reviews faster and improve your Google Maps trust signals with RankMyRestaurant.";
    }
    if (isLeaderboardRoute()) {
      return "Browse restaurant leaderboard insights for Google ranking improvement, local SEO optimization, review growth, voice agent Ryan automation, and social media content building.";
    }
    if (isAnalysisRoute()) {
      return "See AI-powered Google Maps analysis reports for restaurants and identify practical next steps to improve rankings.";
    }
    if (isPriceRoute()) {
      return "Simple restaurant growth pricing: one-time setup plus monthly optimization to improve Google Maps visibility.";
    }
    return "RankMyRestaurant helps restaurants improve Google Maps visibility with AI review workflows, local SEO insights, and growth tools.";
  }

  function isIndexableRoute() {
    return !isPortalRoute();
  }

  function buildLeaderboardItemListSchema() {
    if (!isLeaderboardListRoute()) return null;
    var rows = getLeaderboardSalonsFiltered().slice(0, 10);
    if (!rows.length) return null;
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "RankMyRestaurant Leaderboard",
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      numberOfItems: rows.length,
      itemListElement: rows.map(function (row, idx) {
        var item = {
          "@type": "LocalBusiness",
          name: String(row.name || "").trim() || "Restaurant",
          address: String(row.address || "").trim(),
          telephone: String(row.phone || "").trim(),
        };
        if (Number.isFinite(Number(row.googleRating))) item.aggregateRating = { "@type": "AggregateRating", ratingValue: Number(row.googleRating) };
        return { "@type": "ListItem", position: idx + 1, item: item };
      }),
    };
  }

  function buildLeaderboardDetailSchema() {
    if (!isLeaderboardSalonRoute() || !state.leaderboardDetail) return null;
    var salon = state.leaderboardDetail;
    var schema = {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: String(salon.name || "").trim() || "Restaurant",
      address: String(salon.address || "").trim(),
      telephone: String(salon.phone || "").trim(),
      url: getPreferredOrigin() + "/leaderboard/" + encodeURIComponent(String(salon.slug || state.storeSlug || "").trim()),
    };
    if (Number.isFinite(Number(salon.googleRating))) {
      schema.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: Number(salon.googleRating),
        reviewCount: Number.isFinite(Number(salon.googleReviewCount)) ? Number(salon.googleReviewCount) : undefined,
      };
    }
    return schema;
  }

  function setLinkPreviewMetaByKey(nameOrProp, isProperty, value) {
    if (!nameOrProp || !value) return;
    var sel = isProperty
      ? "meta[data-rms-og=\"1\"][property=\"" + nameOrProp + "\"]"
      : "meta[data-rms-og=\"1\"][name=\"" + nameOrProp + "\"]";
    var node = document.head && document.head.querySelector(sel);
    if (!node) {
      node = document.createElement("meta");
      node.setAttribute("data-rms-og", "1");
      if (isProperty) {
        node.setAttribute("property", nameOrProp);
      } else {
        node.setAttribute("name", nameOrProp);
      }
      document.head.appendChild(node);
    }
    node.setAttribute("content", value);
  }

  function removeRmsLinkPreviewMeta() {
    if (!document.head) return;
    var nodes = document.querySelectorAll(
      "meta[data-rms-og], link[rel=canonical][data-rms-og=\"1\"], script[type=\"application/ld+json\"][data-rms-og=\"1\"]",
    );
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].remove();
    }
  }

  function getLeaderboardOpenGraphImageUrl() {
    var o = (typeof location !== "undefined" && location.origin) || "";
    if (!o) {
      return "";
    }
    if (isLeaderboardListRoute()) {
      var p = new URLSearchParams();
      if (state.leaderboardStateF && state.leaderboardStateF !== "All States") {
        p.set("state", state.leaderboardStateF);
      }
      if (state.leaderboardCountyF && state.leaderboardCountyF !== "All Counties") {
        p.set("county", state.leaderboardCountyF);
      }
      if (state.leaderboardTownF && state.leaderboardTownF !== "All Townships") {
        p.set("town", state.leaderboardTownF);
      }
      if (state.leaderboardLocale === "zh") {
        p.set("locale", "zh");
      }
      var q = p.toString();
      return o + "/api/og/leaderboard-image" + (q ? "?" + q : "");
    }
    if (isLeaderboardSalonRoute() && String(state.storeSlug || "").trim()) {
      var slug = String(state.storeSlug).trim();
      return (
        o + "/api/og/leaderboard-image?slug=" + encodeURIComponent(slug) + (state.leaderboardLocale === "zh" ? "&locale=zh" : "")
      );
    }
    return "";
  }

  function syncLinkPreviewMeta() {
    removeRmsLinkPreviewMeta();
    var origin = getPreferredOrigin();
    var canonicalUrl = origin + getCanonicalPath();
    var title = (typeof document !== "undefined" && document.title) || getPageTitle();
    var description = getPageDescription();
    var imageUrl = getLeaderboardOpenGraphImageUrl() || origin + "/favicon.svg";
    setLinkPreviewMetaByKey("description", false, description);
    setLinkPreviewMetaByKey("robots", false, isIndexableRoute() ? "index,follow,max-image-preview:large" : "noindex,nofollow");
    setLinkPreviewMetaByKey("og:site_name", true, SITE_NAME);
    setLinkPreviewMetaByKey("og:url", true, canonicalUrl);
    setLinkPreviewMetaByKey("og:type", true, "website");
    setLinkPreviewMetaByKey("og:title", true, title);
    setLinkPreviewMetaByKey("og:description", true, description);
    setLinkPreviewMetaByKey("og:image", true, imageUrl);
    setLinkPreviewMetaByKey("twitter:card", false, "summary_large_image");
    setLinkPreviewMetaByKey("twitter:title", false, title);
    setLinkPreviewMetaByKey("twitter:description", false, description);
    setLinkPreviewMetaByKey("twitter:image", false, imageUrl);
    var canonicalNode = document.createElement("link");
    canonicalNode.setAttribute("data-rms-og", "1");
    canonicalNode.setAttribute("rel", "canonical");
    canonicalNode.setAttribute("href", canonicalUrl);
    document.head.appendChild(canonicalNode);
    var siteSchema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: origin + "/",
      potentialAction: {
        "@type": "SearchAction",
        target: origin + "/leaderboard?query={query}",
        "query-input": "required name=query",
      },
    };
    var schemas = [siteSchema, buildLeaderboardItemListSchema(), buildLeaderboardDetailSchema()].filter(Boolean);
    var schemaNode = document.createElement("script");
    schemaNode.setAttribute("type", "application/ld+json");
    schemaNode.setAttribute("data-rms-og", "1");
    schemaNode.textContent = JSON.stringify(schemas.length === 1 ? schemas[0] : { "@context": "https://schema.org", "@graph": schemas });
    document.head.appendChild(schemaNode);
  }

  function getPageHeading() {
    return isStoreRoute() ? t("title") : "";
  }

  function getPageSubtitle() {
    return isStoreRoute() ? t("subtitle") : "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDashNumber(value, digits) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    var d = Number(digits) >= 0 ? Number(digits) : 1;
    return Number(value).toFixed(d);
  }

  function formatIntelPct(value) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    return Math.round(Number(value)) + "%";
  }

  function barWidthFromRating(rating) {
    if (rating == null || !Number.isFinite(Number(rating))) return 0;
    return Math.max(6, Math.min(100, (Number(rating) / 5) * 100));
  }

  function barWidthFromPct(pct) {
    if (pct == null || !Number.isFinite(Number(pct))) return 0;
    return Math.max(6, Math.min(100, Number(pct)));
  }

  function getIntelSalonsFiltered() {
    var all = state.intelSalons || [];
    var q = String(state.intelSearchQuery || "")
      .trim()
      .toLowerCase();
    if (!q || q.length < 2 || state.intelListSource === "geo") return all;
    return all.filter(function (s) {
      return (
        String(s.name || "")
          .toLowerCase()
          .indexOf(q) !== -1 ||
        String(s.slug || "")
          .toLowerCase()
          .indexOf(q) !== -1 ||
        String(s.address || "")
          .toLowerCase()
          .indexOf(q) !== -1 ||
        String(s.township || "")
          .toLowerCase()
          .indexOf(q) !== -1 ||
        String(s.city || "")
          .toLowerCase()
          .indexOf(q) !== -1
      );
    });
  }

  function intelGeoDisplayLabel() {
    var city = String(state.intelGeoCity || "").trim();
    var st = String(state.intelGeoState || "").trim();
    if (city && st) return city + ", " + st;
    if (city) return city;
    if (st) return st;
    return MARKETING_UI.analysisGeoFallback;
  }

  function buildIntelListQuerySuffix() {
    var qLen = String(state.intelSearchQuery || "").trim().length;
    if (qLen >= 2) {
      return (
        "?q=" +
        encodeURIComponent(String(state.intelSearchQuery || "").trim()) +
        "&limit=" +
        INTEL_PAGE_SIZE +
        "&offset=" +
        String((state.intelListPage - 1) * INTEL_PAGE_SIZE)
      );
    }
    var parts = [];
    var st = String(state.intelGeoState || "").trim();
    var city = String(state.intelGeoCity || "").trim();
    if (st) parts.push("state=" + encodeURIComponent(st));
    if (city) parts.push("city=" + encodeURIComponent(city));
    parts.push("limit=" + String(INTEL_PAGE_SIZE));
    parts.push("offset=" + String((state.intelListPage - 1) * INTEL_PAGE_SIZE));
    return parts.length ? "?" + parts.join("&") : "";
  }

  async function resolveIntelUserGeo() {
    try {
      var cached = localStorage.getItem("intelUserGeo");
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && (parsed.city || parsed.state)) {
          state.intelGeoCity = String(parsed.city || "").trim();
          state.intelGeoState = String(parsed.state || "").trim();
          state.intelGeoResolved = true;
          return;
        }
      }
    } catch (_e) {}

    try {
      var ps = new URLSearchParams(window.location.search || "");
      var urlState = (ps.get("state") || "").trim();
      var urlCity = (ps.get("city") || ps.get("town") || "").trim();
      if (urlState || urlCity) {
        state.intelGeoState = urlState;
        state.intelGeoCity = urlCity;
        state.intelGeoResolved = true;
        try {
          localStorage.setItem(
            "intelUserGeo",
            JSON.stringify({ city: state.intelGeoCity, state: state.intelGeoState }),
          );
        } catch (_e2) {}
        return;
      }
    } catch (_e3) {}

    try {
      var geoRes = await fetch("/api/user-geo", { cache: "no-store" });
      var geoPayload = await geoRes.json().catch(function () {
        return null;
      });
      if (geoRes.ok && geoPayload) {
        state.intelGeoCity = String(geoPayload.city || "").trim();
        state.intelGeoState = String(geoPayload.state || "").trim();
        if (state.intelGeoCity || state.intelGeoState) {
          state.intelGeoResolved = true;
          try {
            localStorage.setItem(
              "intelUserGeo",
              JSON.stringify({ city: state.intelGeoCity, state: state.intelGeoState }),
            );
          } catch (_e4) {}
          return;
        }
      }
    } catch (_e5) {}

    state.intelGeoResolved = true;
  }

  async function loadIntelSalonList() {
    if (!isAnalysisListRoute()) return;
    var q = String(state.intelSearchQuery || "").trim();
    if (q.length >= 2) {
      state.intelListSource = "search";
      return loadIntelSalonSearch();
    }
    state.intelListSource = "geo";
    state.intelListSearchLoading = true;
    refreshIntelListTableBody();
    try {
      await resolveIntelUserGeo();
      var response = await fetch("/api/intel/salons" + buildIntelListQuerySuffix(), { cache: "no-store" });
      var payload = await response.json().catch(function () {
        return null;
      });
      if (!response.ok) {
        var msg =
          payload && payload.error && payload.error.message
            ? payload.error.message
            : "Could not load restaurant rankings (" + response.status + ").";
        throw new Error(msg);
      }
      state.intelSalons = Array.isArray(payload && payload.salons) ? payload.salons : [];
      state.intelListTotal = payload && payload.total != null ? Number(payload.total) || 0 : state.intelSalons.length;
      if (payload && payload.geo) {
        if (payload.geo.state) state.intelGeoState = String(payload.geo.state).trim();
        if (payload.geo.city || payload.geo.town) {
          state.intelGeoCity = String(payload.geo.city || payload.geo.town).trim();
        }
      }
    } catch (err) {
      console.error(err);
      state.intelError = (err && err.message) || "Unexpected error loading restaurant rankings.";
      state.intelSalons = [];
      state.intelListTotal = 0;
    } finally {
      state.intelListSearchLoading = false;
      refreshIntelListTableBody();
      refreshIntelListPagination();
    }
  }

  function buildIntelTableRowsHtml(salons) {
    var list = Array.isArray(salons) ? salons : [];
    var rows = list
      .map(function (s) {
        var href = "/analysis-reports/" + encodeURIComponent(s.slug);
        var rating = formatDashNumber(s.googleRating, 1);
        var reviews = s.googleReviewCount != null && Number.isFinite(Number(s.googleReviewCount)) ? String(s.googleReviewCount) : "—";
        var score = formatDashNumber(s.marketingScore, 1);
        return (
          '<tr class="intel-table-row">' +
          '<td class="intel-td-name">' +
          '<a class="intel-salon-link" href="' +
          href +
          '">' +
          escapeHtml(s.name || s.slug) +
          "</a>" +
          "</td>" +
          '<td class="intel-td-address">' +
          escapeHtml(s.address || "") +
          "</td>" +
          '<td class="intel-td-num">' +
          escapeHtml(rating) +
          "</td>" +
          '<td class="intel-td-num">' +
          escapeHtml(reviews) +
          "</td>" +
          '<td class="intel-td-num">' +
          escapeHtml(score) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (!rows) {
      var qLen = String(state.intelSearchQuery || "").trim().length;
      var hasQuery = qLen >= 2;
      var emptyMsg = state.intelListSearchLoading
        ? hasQuery
          ? MARKETING_UI.analysisSearchLoading
          : MARKETING_UI.analysisListLoading
        : hasQuery
          ? "No restaurants match your search. Try another name, street, city, or town."
          : MARKETING_UI.analysisNoResultsGeo;
      rows =
        '<tr><td colspan="5" class="intel-table-empty">' + escapeHtml(emptyMsg) + "</td></tr>";
    }

    return rows;
  }

  function refreshIntelListTableBody() {
    var tbody = document.getElementById("intelSalonTableBody");
    if (!tbody) return;
    tbody.innerHTML = buildIntelTableRowsHtml(getIntelSalonsFiltered());
  }

  function buildIntelPaginationHtml() {
    var total = Math.max(0, Number(state.intelListTotal) || 0);
    var totalPages = Math.max(1, Math.ceil(total / INTEL_PAGE_SIZE));
    var page = state.intelListPage;
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    state.intelListPage = page;
    var meta =
      '<span class="lb-pager-meta intel-pager-meta">' +
      escapeHtml(String(total)) +
      " restaurants" +
      (totalPages > 1 ? " · Page " + page + " / " + totalPages : "") +
      "</span>";
    if (totalPages <= 1) {
      return (
        '<nav id="intelListPager" class="lb-pager intel-pager" aria-label="Restaurant ranking pages">' +
        meta +
        "</nav>"
      );
    }
    var prevDis = page <= 1 ? " disabled" : "";
    var nextDis = page >= totalPages ? " disabled" : "";
    return (
      '<nav id="intelListPager" class="lb-pager intel-pager" aria-label="Restaurant ranking pages">' +
      meta +
      '<div class="lb-pager-btns">' +
      '<button type="button" class="ghost lb-pager-btn"' +
      prevDis +
      ' data-intel-page="prev">' +
      escapeHtml(MARKETING_UI.analysisPrevious) +
      "</button>" +
      '<button type="button" class="ghost lb-pager-btn"' +
      nextDis +
      ' data-intel-page="next">' +
      escapeHtml(MARKETING_UI.analysisNext) +
      "</button>" +
      "</div></nav>"
    );
  }

  function refreshIntelListPagination() {
    var nav = document.getElementById("intelListPager");
    if (!nav) return;
    nav.outerHTML = buildIntelPaginationHtml();
  }

  async function loadIntelSalonSearch() {
    if (!isAnalysisListRoute()) return;
    var q = String(state.intelSearchQuery || "").trim();
    if (q.length < 2) {
      state.intelListPage = 1;
      return loadIntelSalonList();
    }
    state.intelListSource = "search";
    state.intelListSearchLoading = true;
    refreshIntelListTableBody();
    try {
      var response = await fetch("/api/intel/salons" + buildIntelListQuerySuffix(), { cache: "no-store" });
      var payload = await response.json().catch(function () {
        return null;
      });
      if (!response.ok) {
        var msg =
          payload && payload.error && payload.error.message
            ? payload.error.message
            : "Could not search restaurants (" + response.status + ").";
        throw new Error(msg);
      }
      state.intelSalons = Array.isArray(payload && payload.salons) ? payload.salons : [];
      state.intelListTotal = payload && payload.total != null ? Number(payload.total) || 0 : state.intelSalons.length;
    } catch (err) {
      console.error(err);
      state.intelError = (err && err.message) || "Unexpected error searching restaurants.";
      state.intelSalons = [];
      state.intelListTotal = 0;
    } finally {
      state.intelListSearchLoading = false;
      refreshIntelListTableBody();
      refreshIntelListPagination();
    }
  }

  function bindIntelListSearchDelegation() {
    if (state.intelListSearchDelegationBound) return;
    state.intelListSearchDelegationBound = true;
    document.addEventListener("input", function (ev) {
      if (!ev || !ev.target || ev.target.id !== "intelSalonSearch") return;
      state.intelSearchQuery = ev.target.value;
      state.intelError = "";
      if (state.intelListSearchTimer) {
        clearTimeout(state.intelListSearchTimer);
        state.intelListSearchTimer = null;
      }
      var q = String(state.intelSearchQuery || "").trim();
      state.intelListPage = 1;
      if (q.length < 2) {
        state.intelListSearchTimer = setTimeout(function () {
          state.intelListSearchTimer = null;
          loadIntelSalonList().catch(function (err) {
            console.error(err);
          });
        }, 280);
        return;
      }
      state.intelListSearchTimer = setTimeout(function () {
        state.intelListSearchTimer = null;
        loadIntelSalonSearch().catch(function (err) {
          console.error(err);
        });
      }, 320);
    });
    document.addEventListener("click", function (ev) {
      if (!isAnalysisListRoute()) return;
      var t = ev.target;
      if (!t || !t.closest) return;
      var pageBtn = t.closest("[data-intel-page]");
      if (!pageBtn || pageBtn.disabled) return;
      var dir = pageBtn.getAttribute("data-intel-page") || "";
      var totalPages = Math.max(1, Math.ceil((Number(state.intelListTotal) || 0) / INTEL_PAGE_SIZE));
      if (dir === "prev" && state.intelListPage > 1) {
        state.intelListPage -= 1;
      } else if (dir === "next" && state.intelListPage < totalPages) {
        state.intelListPage += 1;
      } else {
        return;
      }
      ev.preventDefault();
      var q = String(state.intelSearchQuery || "").trim();
      if (q.length >= 2) {
        loadIntelSalonSearch().catch(function (err) {
          console.error(err);
        });
      } else {
        loadIntelSalonList().catch(function (err) {
          console.error(err);
        });
      }
    });
  }

  function rankSalonInCounty(salon, allSalons) {
    var all = Array.isArray(allSalons) ? allSalons : state.leaderboardSalons;
    var pool = all.filter(function (s) {
      return (
        s.id !== salon.id &&
        leaderboardRowMatchesState(s.state, salon.state) &&
        leaderboardRowMatchesCounty(s.county, salon.county)
      );
    });
    var group = pool.concat([salon]).sort(function (a, b) {
      return b.score - a.score;
    });
    var rank = 0;
    for (var i = 0; i < group.length; i++) {
      if (group[i].id === salon.id) {
        rank = i + 1;
        break;
      }
    }
    var rankLabel = rank <= 5 ? "#" + rank : "5+";
    return { rank: rank, rankLabel: rankLabel, total: group.length, top5: group.slice(0, 5) };
  }

  function leaderboardIssueFocusZh(issue) {
    var t = String((issue && issue.title) || "").toLowerCase();
    if (t.indexOf("rating") >= 0 && t.indexOf("4.5") >= 0) return "Google 评分与星级信任";
    if (t.indexOf("low review") >= 0 || t.indexOf("review volume") >= 0) return "评论数量与更新节奏";
    if (t.indexOf("booking") >= 0) return "在线预约与转化路径";
    if (t.indexOf("composite") >= 0 || t.indexOf("below market") >= 0) return "综合 AI 分与曝光排位";
    if (t.indexOf("specialist") >= 0) return "招牌菜、服务亮点与差异化";
    return "Google 门店信任证据";
  }

  /**
   * Sales-oriented AI-style summary (deterministic copy from live metrics).
   * locale: "en" | "zh"
   */
  function generateLeaderboardAiSummaryHtml(salon, ranked, issues, assessmentVisual, locale) {
    var lang = locale === "zh" ? "zh" : "en";
    var a = assessmentVisual || getLeaderboardAssessmentVisual(salon);
    var name = String((salon && salon.name) || (lang === "zh" ? "本店" : "This restaurant")).trim();
    var county = String((salon && salon.county) || (lang === "zh" ? "本区域" : "your market")).trim();
    var town = String((salon && salon.town) || "").trim();
    var loc = lang === "zh" ? (town ? town + " · " + county : county) : town ? town + ", " + county : county;
    var score = Number(salon && salon.score) || 0;
    var rating = Number(salon && salon.rating) || 0;
    var reviews = Number(salon && salon.reviews) || 0;
    var level = String(a.level || "MODERATE").toUpperCase();
    var rank = ranked && ranked.rank ? ranked.rank : 0;
    var total = ranked && ranked.total ? ranked.total : 0;

    var kicker = lang === "zh" ? "AI 简评" : "AI summary";
    var focusLbl = lang === "zh" ? "建议优先" : "Where to tighten";

    var encourage = "";
    if (lang === "zh") {
      if (level === "EXCELLENT" || score >= 84) {
        encourage =
          name +
          " 在 " +
          loc +
          " 呈现出「头部门店」的信任信号，对高意向 Google 流量非常友好。接下来要把运营节奏固化下来，避免分数松动时被同行快速模仿、反超。";
      } else if (level === "GOOD" || score >= 70) {
        encourage =
          name +
          " 已经具备扎实的社会证明：顾客愿意相信这是一家「靠谱门店」。下一阶段的关键，是把少数几个杠杆拧紧——从「周末忙」迈向「整周满档」，多数老板正是在这里悄悄流失利润。";
      } else if (score >= 56) {
        encourage =
          name +
          " 处在竞争最密集的中间带：评分、评论节奏、新鲜度都会快速拉动这份 AI 指数。你并非「永远落后」，往往只差一次有纪律的 30 天冲刺，曲线就会明显不同。";
      } else {
        encourage =
          "数据很直白：" +
          name +
          " 在 " +
          county +
          " 仍有不少订位、来电和到店被「信任证据更强」的同行截走。餐饮市场对 Google 信任反应很快——只要抢在下一轮评论周期前行动，地图上的故事就会改写。";
      }
    } else {
      if (level === "EXCELLENT" || score >= 84) {
        encourage =
          name +
          " reads like a leader in " +
          loc +
          "—strong signals that attract high-intent Google traffic. The opportunity now is to lock in the operational habits that keep this score from slipping when competitors copy your playbook.";
      } else if (level === "GOOD" || score >= 70) {
        encourage =
          "There is a lot to like about " +
          name +
          ": guests see a credible restaurant with real social proof. The next chapter is tightening the few levers that separate 'busy weekends' from 'fully booked weeks'—and that is where most owners leave money on the table.";
      } else if (score >= 56) {
        encourage =
          name +
          " is in the competitive middle band where small upgrades compound fast—rating bumps, review cadence, and recency all move this AI index quickly. You are not 'behind forever'; you are one disciplined sprint away from a different trajectory.";
      } else {
        encourage =
          "The data is direct: " +
          name +
          " is leaving reservations, calls, and visits on the table versus restaurants with fresher proof signals in " +
          county +
          ". The encouraging part is that restaurant markets respond quickly when Google trust catches up—if you move before the next review cycle reshuffles the map.";
      }
    }

    var focusItems = [];
    if (Array.isArray(issues) && issues.length) {
      for (var i = 0; i < Math.min(2, issues.length); i += 1) {
        if (lang === "zh") {
          focusItems.push(leaderboardIssueFocusZh(issues[i]));
        } else {
          var tEn = String(issues[i].title || "").replace(/\s+—\s+.*$/, "");
          if (tEn) focusItems.push(tEn);
        }
      }
    }
    if (!focusItems.length) {
      if (lang === "zh") {
        focusItems.push("Google 评分与评论证据链");
        focusItems.push("预约链路与顾客第一印象");
      } else {
        focusItems.push("Review volume and star-rating alignment on Google");
        focusItems.push("Frictionless booking and instant trust on your Business Profile");
      }
    }

    var fomo = "";
    if (lang === "zh") {
      if (rank === 1 && total > 1) {
        fomo =
          "你在本县的这份快照里排名第一——分数更低的门店已经在琢磨你做对了什么。真正的风险是「松懈」：只要评论更新慢一个月，别人就可能抢走顾客第一眼看到的故事。";
      } else if (rank > 0 && rank <= 3 && total > 3) {
        fomo =
          "你在 " +
          county +
          " 的实时榜单里处于前三，这正是顾客「比一比再下单」时会停留的区间。排在你前面的店不会停手；一旦他们在评论量或星级上拉开差距，空位和预约流失往往以「周」为单位出现，而不是「季度」。";
      } else if (rank > 3 && total > rank) {
        fomo =
          "目前在 " +
          county +
          " 至少有 " +
          String(rank - 1) +
          " 家门店在这份公开分数上排在你前面——顾客在点「致电」或「路线」前就会扫到。差距不是概念，而是今晚就可能进别人店的到店与定金。";
      } else {
        fomo =
          "这份指数会随评分、评论量、情绪与新鲜度持续变化。把接下来 30 天当成「上新季」来打的门店，会悄悄拉开差距——等别人反应过来，往往要付出更高的补课成本。";
      }
    } else {
      if (rank === 1 && total > 1) {
        fomo =
          "You are #1 in this county snapshot—every competitor with a lower score is already wondering what you changed. The risk is coasting: one slow month of reviews and someone else rewrites the story shoppers see first.";
      } else if (rank > 0 && rank <= 3 && total > 3) {
        fomo =
          "You are inside the top three in " +
          county +
          " on this live leaderboard—exactly where comparison diners short-list restaurants. The restaurants above you are not pausing; if they widen their review lead or rating edge, you feel it in empty tables within weeks, not quarters.";
      } else if (rank > 3 && total > rank) {
        fomo =
          String(rank - 1) +
          " restaurants in " +
          county +
          " currently sit ahead on the same public scorecard prospects skim before they tap 'Call' or 'Directions.' That gap is not theoretical—it is walk-ins and deposits your profile is not winning tonight.";
      } else {
        fomo =
          "This index updates as ratings, volume, sentiment, and recency move. Restaurants that treat the next 30 days like a launch window pull ahead quietly—then everyone else plays catch-up at a higher cost.";
      }
    }

    var proof =
      lang === "zh"
        ? "今日快照：" +
          String(Math.round(score)) +
          "/100 AI 分 · " +
          String(Number(rating).toFixed(1)) +
          " 星 · " +
          String(reviews) +
          " 条评论——在你阅读这几行时，附近的店仍在累积「能在地图上压你一头」的证据。"
        : "Snapshot today: " +
          String(Math.round(score)) +
          "/100 AI score · " +
          String(Number(rating).toFixed(1)) +
          "★ · " +
          String(reviews) +
          " reviews—while you read this, nearby competitors are still collecting proof that ranks them higher in Maps.";

    var phoneHref = escapeHtml(MARKETING_COPY.digitalHumanPhoneHref || "tel:8776003082");
    var cta =
      lang === "zh"
        ? '<a class="landing-link lb-ai-summary-cta-link" href="' +
          getPagePath(ROUTE_TALK) +
          '">与 Ryan 约一次增长冲刺</a>，也可<a class="landing-link lb-ai-summary-cta-link" href="' +
          phoneHref +
          '">致电/短信团队</a>。多数老板等到「资料看起来坏了」才动；先行动的人，往往能留住本来要走进隔壁店的收入。'
        : '<a class="landing-link lb-ai-summary-cta-link" href="' +
          getPagePath(ROUTE_TALK) +
          '">Talk to Ryan</a> for a prioritized growth sprint, or <a class="landing-link lb-ai-summary-cta-link" href="' +
          phoneHref +
          '">call/text the team</a>. Most owners wait until the profile looks broken; the ones who move first keep the revenue that was about to walk next door.';

    var accent = escapeHtml(a.color || "#1A365D");
    var listHtml = focusItems
      .map(function (line) {
        return '<li><span class="lb-ai-summary-focus-label">' + escapeHtml(focusLbl) + "</span> " + escapeHtml(line) + "</li>";
      })
      .join("");

    return (
      '<section class="lb-ai-summary card" style="border-left:4px solid ' +
      accent +
      '">' +
      '<p class="lb-ai-summary-kicker">' +
      escapeHtml(kicker) +
      "</p>" +
      '<p class="lb-ai-summary-lead">' +
      escapeHtml(encourage) +
      '</p><ul class="lb-ai-summary-points">' +
      listHtml +
      "</ul>" +
      '<p class="lb-ai-summary-fomo">' +
      escapeHtml(fomo) +
      " " +
      escapeHtml(proof) +
      '</p><p class="lb-ai-summary-cta">' +
      cta +
      "</p></section>"
    );
  }

  function generateLeaderboardIssues(salon) {
    var issues = [];
    var rating = salon.rating;
    var reviews = salon.reviews;
    var score = salon.score;
    if (rating < 4.5) {
      issues.push({
        icon: "⭐",
        sev: "HIGH",
        sevColor: "#DC2626",
        bg: "#FEF2F2",
        title: "Rating Below 4.5★ — Google Visibility Risk",
        detail:
          "A " +
          rating +
          "★ rating puts you below Google's Local Pack threshold. Restaurants above 4.5★ receive more search impressions, direction taps, and table intent.",
        fix: "Identify your 1–2★ reviewers and reach out with a personal recovery offer. One resolved complaint can become a 5★ update.",
      });
    }
    if (reviews < 100) {
      issues.push({
        icon: "📝",
        sev: "HIGH",
        sevColor: "#DC2626",
        bg: "#FEF2F2",
        title: "Low Review Volume — Invisible to New Customers",
        detail: "Only " + reviews + " reviews makes your profile appear inactive.",
        fix: "Send a direct Google review link via SMS to recent diners after checkout or reservation follow-up.",
      });
    } else if (reviews < 300) {
      issues.push({
        icon: "📊",
        sev: "MEDIUM",
        sevColor: "#D97706",
        bg: "#FFFBEB",
        title: "Review Volume Gap vs. Market Leaders",
        detail: reviews + " reviews is solid but market leaders in your area have 500–1,200+.",
        fix: "Target 10 new reviews per week via table QR, receipt QR, or automated SMS follow-up.",
      });
    }
    issues.push({
      icon: "📲",
      sev: "MEDIUM",
      sevColor: "#D97706",
      bg: "#FFFBEB",
      title: "No Reservation / Order Link Detected",
      detail:
        "New diners who find you on Google expect to reserve, call, or order instantly. Every extra friction step loses high-intent searches to competitors with clearer actions.",
      fix: "Add reservation, order, menu, or direct-call actions to your Google Business profile and landing page.",
    });
    if (score < 70) {
      issues.push({
        icon: "🔍",
        sev: "HIGH",
        sevColor: "#DC2626",
        bg: "#FEF2F2",
        title: "AI Composite Score Below Market Average",
        detail:
          "Your combined rating, review volume, sentiment, and recency score is below 70/100. Competitors with higher scores rank above you in Google Search and Maps results.",
        fix: "Improving your rating by 0.3★ and adding 50 reviews in the next 60 days can push your score above 70.",
      });
    }
    issues.push({
      icon: "🎯",
      sev: "LOW",
      sevColor: "#2563EB",
      bg: "#EFF6FF",
      title: "No Signature Dish or Occasion Promotion",
      detail:
        "Diners searching for signature dishes, catering, private dining, or special occasions can't quickly see what makes you worth choosing.",
      fix: "Feature 1–2 signature dishes, chef specials, or event offers on your Google profile, menu photos, and social channels.",
    });
    return issues.slice(0, 4);
  }

  function normalizeLeaderboardSearchQuery(raw) {
    var q = String(raw || "")
      .trim()
      .toLowerCase();
    return q.replace(/\s+township\s*$/i, "").trim();
  }

  function leaderboardSalonMatchesSearch(s, rawQ) {
    var q = normalizeLeaderboardSearchQuery(rawQ);
    if (!q) return true;
    var slugSpace = String((s && s.slug) || "")
      .toLowerCase()
      .replace(/-/g, " ");
    var town = String((s && s.town) || "").toLowerCase();
    var townBare = town.replace(/\s+township\s*$/i, "").trim();
    var phoneDigits = String((s && s.phone) || "").replace(/\D/g, "");
    var qDigits = q.replace(/\D/g, "");
    var parts = [
      String((s && s.name) || "").toLowerCase(),
      town,
      townBare,
      String((s && s.address) || "").toLowerCase(),
      String((s && s.county) || "").toLowerCase(),
      String((s && s.zipcode) || "").toLowerCase(),
      slugSpace,
    ];
    if (qDigits && qDigits.length >= 3 && phoneDigits && phoneDigits.indexOf(qDigits) >= 0) return true;
    var hay = parts.join(" ");
    if (hay.indexOf(q) >= 0) return true;
    var tokens = q.split(/\s+/).filter(function (t) {
      return t.length > 0;
    });
    if (tokens.length > 1) {
      return tokens.every(function (t) {
        return hay.indexOf(t) >= 0;
      });
    }
    return false;
  }

  function getLeaderboardSalonsFiltered() {
    var all = state.leaderboardSalons || [];
    var qRaw = String(state.leaderboardSearchQuery || "").trim();
    var hasSearchText = qRaw.length > 0;
    var sourceSearch = state.leaderboardListSource === "search";
    var stateF = state.leaderboardStateF;
    var countyF = state.leaderboardCountyF;
    var townF = state.leaderboardTownF || "All Townships";
    var categoryF = state.leaderboardCategoryF;
    return all.filter(function (s) {
      var ms = sourceSearch ? true : leaderboardRowMatchesState(s.state, stateF);
      var mc = sourceSearch ? true : leaderboardRowMatchesCounty(s.county, countyF);
      var mt = hasSearchText || sourceSearch ? true : leaderboardRowMatchesTown(s.town, townF);
      var mcat = categoryF === "All Categories" || s.category === categoryF;
      var mq = leaderboardSalonMatchesSearch(s, qRaw);
      return ms && mc && mt && mcat && mq;
    });
  }

  /** Same geographic + category filters as the list, but ignores search text so rank stays stable while searching. */
  function getLeaderboardSalonsRankPool() {
    var all = state.leaderboardSalons || [];
    var stateF = state.leaderboardStateF;
    var countyF = state.leaderboardCountyF;
    var townF = state.leaderboardTownF || "All Townships";
    var categoryF = state.leaderboardCategoryF;
    return all.filter(function (s) {
      var ms = leaderboardRowMatchesState(s.state, stateF);
      var mc = leaderboardRowMatchesCounty(s.county, countyF);
      var mt = leaderboardRowMatchesTown(s.town, townF);
      var mcat = categoryF === "All Categories" || s.category === categoryF;
      return ms && mc && mt && mcat;
    });
  }

  /** County-wide pool for scorecard rank (same state + county as the salon), independent of list township filter. */
  function getLeaderboardSalonsInSameCounty(salon) {
    var st = String((salon && salon.state) || "").trim();
    var co = String((salon && salon.county) || "").trim();
    if (!st || !co) return state.leaderboardSalons || [];
    var all = state.leaderboardSalons || [];
    return all.filter(function (s) {
      return leaderboardRowMatchesState(s.state, st) && leaderboardRowMatchesCounty(s.county, co);
    });
  }

  /** Same state + county + township (falls back to county cohort when township is blank). */
  function getLeaderboardSalonsInSameTownship(salon) {
    var st = String((salon && salon.state) || "").trim();
    var co = String((salon && salon.county) || "").trim();
    var tw = String((salon && salon.town) || "").trim();
    var all = state.leaderboardSalons || [];
    if (!st || !co) return all;
    if (!tw) {
      return getLeaderboardSalonsInSameCounty(salon);
    }
    return all.filter(function (s) {
      return (
        leaderboardRowMatchesState(s.state, st) &&
        leaderboardRowMatchesCounty(s.county, co) &&
        leaderboardRowMatchesTown(s.town, tw)
      );
    });
  }

  function ensureSalonInLeaderboardCohort(salon, cohort) {
    var list = Array.isArray(cohort) ? cohort.slice() : [];
    var found = list.some(function (s) {
      return s && salon && String(s.id) === String(salon.id);
    });
    if (!found && salon) list.push(salon);
    return list;
  }

  /** Mirrors lib/server/leaderboard-scoring.js calcAiScore (v2 blend + shrink). */
  function clamp01LbScore(x, fb) {
    var n = Number(x);
    if (!isFinite(n)) return fb;
    return Math.min(1, Math.max(0, n));
  }

  function calcClientAiScore(salon) {
    var r = Math.min(5, Math.max(1, Number(salon && salon.rating) || 0));
    var n = Math.max(0, Math.floor(Number(salon && salon.reviews) || 0));
    var pn = clamp01LbScore(salon && salon.p, 0.72);
    var fn = clamp01LbScore(salon && salon.f, 0.7);
    var ratingNorm = Math.min(1, Math.max(0, (r - 3) / 2));
    var volumeNorm = Math.min(1, Math.log10(n + 1) / Math.log10(900));
    var blend = ratingNorm * 0.31 + volumeNorm * 0.33 + pn * 0.22 + fn * 0.14;
    var conf = 1 - Math.exp(-n / 52);
    var prior = 0.52;
    var adjusted = prior + (blend - prior) * (0.36 + 0.64 * conf);
    var out = adjusted * 100;
    return Math.round(Math.min(100, Math.max(0, out)) * 10) / 10;
  }

  /** Absolute 0–100 dimensions aligned with lib/server/leaderboard-ingest dimensionScoresFromSignals. */
  function salonAbsoluteDimScores(salon) {
    var rating = Number(salon && salon.rating) || 0;
    var reviewCount = Math.max(0, Math.floor(Number(salon && salon.reviews) || 0));
    var rClamped = Math.min(5, Math.max(1, rating));
    var ratingScore = Math.round(Math.max(0, Math.min(100, ((rClamped - 3) / 2) * 100)) * 10) / 10;
    var reviewScore = Math.round(Math.max(0, Math.min(100, (Math.log10(reviewCount + 1) / Math.log10(900)) * 100)) * 10) / 10;
    var sentimentP = clamp01LbScore(salon && salon.p, 0.72);
    var freshnessF = clamp01LbScore(salon && salon.f, 0.7);
    var sentimentScore = Math.round(sentimentP * 1000) / 10;
    var recencyScore = Math.round(freshnessF * 1000) / 10;
    var dimLocalSeo = Number(
      salon.dimLocalSeoScore != null ? salon.dimLocalSeoScore : salon.dim_local_seo_score,
    );
    if (!isFinite(dimLocalSeo) || dimLocalSeo < 0) {
      dimLocalSeo =
        Math.round(
          (ratingScore * 0.42 +
            reviewScore * 0.26 +
            recencyScore * 0.12 +
            (String((salon && salon.address) || "").trim() ? 10 : 0) +
            (String((salon && (salon.placeId || salon.googlePlaceId)) || "").trim() ? 10 : 0)) *
            10,
        ) / 10;
      dimLocalSeo = Math.max(0, Math.min(100, dimLocalSeo));
    }
    var dimConversion = Number(
      salon.dimConversionScore != null ? salon.dimConversionScore : salon.dim_conversion_score,
    );
    if (!isFinite(dimConversion) || dimConversion < 0) {
      dimConversion =
        Math.round(
          (ratingScore * 0.3 +
            reviewScore * 0.2 +
            (String((salon && salon.phone) || "").trim() ? 24 : 0) +
            (String((salon && (salon.placeId || salon.googlePlaceId)) || "").trim() ? 14 : 0)) *
            10,
        ) / 10;
      dimConversion = Math.max(0, Math.min(100, dimConversion));
    }
    return {
      reviews: reviewScore,
      rating: ratingScore,
      sentiment: sentimentScore,
      recency: recencyScore,
      localSeo: Math.max(0, Math.min(100, dimLocalSeo)),
      conversion: Math.max(0, Math.min(100, dimConversion)),
    };
  }

  /** Percentile 0–100 within cohort; higher raw score = higher percentile. Solo salon → 50. */
  function townshipPercentileHigherBetter(salon, cohort, scoreFn) {
    var group = ensureSalonInLeaderboardCohort(salon, cohort);
    var n = group.length;
    if (n <= 1) return 50;
    var scored = group.map(function (s) {
      return { s: s, v: Number(scoreFn(s)) || 0 };
    });
    scored.sort(function (a, b) {
      if (b.v !== a.v) return b.v - a.v;
      return String((a.s && a.s.slug) || "").localeCompare(String((b.s && b.s.slug) || ""));
    });
    var idx = -1;
    for (var i = 0; i < n; i += 1) {
      if (String(scored[i].s && scored[i].s.id) === String(salon && salon.id)) {
        idx = i;
        break;
      }
    }
    if (idx < 0) idx = n - 1;
    return Math.round((100 * (n - 1 - idx)) / Math.max(1, n - 1));
  }

  /** If URL township is not present in the loaded snapshot, reset to All Townships and sync URL. */
  function normalizeLeaderboardTownFilter() {
    if (!isLeaderboardListRoute()) return;
    var tw = String(state.leaderboardTownF || "").trim();
    if (!tw || tw === "All Townships") return;
    var stateF = state.leaderboardStateF;
    var countyF = state.leaderboardCountyF;
    var found = false;
    (state.leaderboardSalons || []).forEach(function (s) {
      if (!leaderboardRowMatchesState(s.state, stateF)) return;
      if (!leaderboardRowMatchesCounty(s.county, countyF)) return;
      if (leaderboardRowMatchesTown(s.town, tw)) found = true;
    });
    if (!found) {
      state.leaderboardTownF = "All Townships";
      state.leaderboardListPage = 1;
      syncLeaderboardListUrl();
    }
  }

  function getLeaderboardCategoryOptions() {
    var set = {};
    (state.leaderboardSalons || []).forEach(function (s) {
      if (s.category) set[s.category] = true;
    });
    return ["All Categories"].concat(
      Object.keys(set).sort(function (a, b) {
        return a.localeCompare(b);
      }),
    );
  }

  function getLeaderboardStateOptions() {
    var set = {};
    (state.leaderboardSalons || []).forEach(function (s) {
      if (s.state) set[s.state] = true;
    });
    var out = ["All States"].concat(
      Object.keys(set).sort(function (a, b) {
        return a.localeCompare(b);
      }),
    );
    if (state.leaderboardStateF && state.leaderboardStateF !== "All States" && out.indexOf(state.leaderboardStateF) < 0) {
      out.splice(1, 0, state.leaderboardStateF);
    }
    return out;
  }

  var LEADERBOARD_ASSESSMENT_VISUAL = {
    EXCELLENT: {
      level: "EXCELLENT",
      labelEn: "Excellent",
      labelZh: "优秀",
      emoji: "⭐",
      color: "#1A365D",
      light: "#EBF8FF",
      mid: "#4299E1",
      border: "#63B3ED",
    },
    GOOD: {
      level: "GOOD",
      labelEn: "Good",
      labelZh: "良好",
      emoji: "🟢",
      color: "#276749",
      light: "#F0FFF4",
      mid: "#68D391",
      border: "#68D391",
    },
    MODERATE: {
      level: "MODERATE",
      labelEn: "Fair",
      labelZh: "一般",
      emoji: "🟡",
      color: "#975A16",
      light: "#FFFFF0",
      mid: "#F6E05E",
      border: "#ECC94B",
    },
    LOW: {
      level: "LOW",
      labelEn: "Poor",
      labelZh: "较差",
      emoji: "🟠",
      color: "#C05621",
      light: "#FFFAF0",
      mid: "#F6AD55",
      border: "#F6AD55",
    },
    RISKY: {
      level: "RISKY",
      labelEn: "Critical",
      labelZh: "严重",
      emoji: "🔴",
      color: "#C53030",
      light: "#FFF5F5",
      mid: "#FC8181",
      border: "#FC8181",
    },
  };

  function getLeaderboardAssessmentVisual(salon) {
    var raw = String((salon && salon.assessmentLevel) || (salon && salon.assessment_level) || "")
      .trim()
      .toUpperCase();
    var key = raw && LEADERBOARD_ASSESSMENT_VISUAL[raw] ? raw : "MODERATE";
    return LEADERBOARD_ASSESSMENT_VISUAL[key];
  }

  /** UI label for badges; DB/API still use EXCELLENT / GOOD / MODERATE / LOW / RISKY. locPref: "en" | "zh". */
  function getLeaderboardLevelDisplayLabel(visual, locPref) {
    if (!visual) return "";
    var z = locPref === "zh";
    if (z && visual.labelZh) return visual.labelZh;
    if (visual.labelEn) return visual.labelEn;
    return String(visual.level || "");
  }

  function buildLeaderboardCountyOptionsHtml() {
    var stateF = state.leaderboardStateF;
    var set = {};
    (state.leaderboardSalons || []).forEach(function (s) {
      if (!leaderboardRowMatchesState(s.state, stateF)) return;
      set[s.county] = true;
    });
    var counties = ["All Counties"].concat(
      Object.keys(set).sort(function (a, b) {
        return a.localeCompare(b);
      }),
    );
    if (
      state.leaderboardCountyF &&
      state.leaderboardCountyF !== "All Counties" &&
      counties.indexOf(state.leaderboardCountyF) < 0
    ) {
      counties.splice(1, 0, state.leaderboardCountyF);
    }
    return counties
      .map(function (c) {
        var sel = state.leaderboardCountyF === c ? " selected" : "";
        return '<option value="' + escapeHtml(c) + '"' + sel + ">" + escapeHtml(c) + "</option>";
      })
      .join("");
  }

  function getLeaderboardTownOptions() {
    var stateF = state.leaderboardStateF;
    var countyF = state.leaderboardCountyF;
    var set = {};
    (state.leaderboardSalons || []).forEach(function (s) {
      if (!leaderboardRowMatchesState(s.state, stateF)) return;
      if (!leaderboardRowMatchesCounty(s.county, countyF)) return;
      var t = String(s.town || "").trim();
      if (t) set[t] = true;
    });
    var out = ["All Townships"].concat(
      Object.keys(set).sort(function (a, b) {
        return a.localeCompare(b);
      }),
    );
    if (
      state.leaderboardTownF &&
      state.leaderboardTownF !== "All Townships" &&
      out.indexOf(state.leaderboardTownF) < 0
    ) {
      out.splice(1, 0, state.leaderboardTownF);
    }
    return out;
  }

  function buildLeaderboardTownOptionsHtml() {
    return getLeaderboardTownOptions()
      .map(function (t) {
        var sel = state.leaderboardTownF === t ? " selected" : "";
        return '<option value="' + escapeHtml(t) + '"' + sel + ">" + escapeHtml(t) + "</option>";
      })
      .join("");
  }

  function buildLeaderboardCardShareUrl(salon) {
    var path = "/leaderboard/" + encodeURIComponent(salon.slug);
    if (typeof location !== "undefined" && location.origin) {
      return location.origin + path;
    }
    return path;
  }

  function showLeaderboardShareToast(message) {
    var text = String(message || "").trim();
    if (!text || typeof document === "undefined") return;
    var el = document.createElement("div");
    el.className = "lb-share-toast";
    el.setAttribute("role", "status");
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(function () {
      el.classList.add("is-visible");
    });
    setTimeout(function () {
      el.classList.remove("is-visible");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 280);
    }, 2400);
  }

  function closeAllLeaderboardCardMenus() {
    if (typeof document === "undefined") return;
    var wraps = document.querySelectorAll(".lb-card-menu-wrap.is-open");
    for (var i = 0; i < wraps.length; i += 1) {
      var wrap = wraps[i];
      wrap.classList.remove("is-open");
      var btn = wrap.querySelector("[data-lb-card-menu-btn]");
      var pop = wrap.querySelector("[data-lb-card-menu-popover]");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (pop) pop.hidden = true;
    }
  }

  function shareOrCopyLeaderboardSalon(url, title) {
    var u = String(url || "").trim();
    if (!u) return;
    var ttl = String(title || "").trim();
    if (navigator.share) {
      navigator
        .share({ url: u, title: ttl, text: ttl })
        .then(function () {
          closeAllLeaderboardCardMenus();
        })
        .catch(function (err) {
          if (err && err.name === "AbortError") return;
          copyLeaderboardSalonLink(u);
        });
      return;
    }
    copyLeaderboardSalonLink(u);
  }

  function copyLeaderboardSalonLink(url) {
    var u = String(url || "").trim();
    if (!u) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(u).then(
        function () {
          showLeaderboardShareToast(MARKETING_UI.leaderboardCardLinkCopied);
          closeAllLeaderboardCardMenus();
        },
        function () {
          showLeaderboardShareToast(MARKETING_UI.leaderboardCardShareFailed);
        },
      );
      return;
    }
    try {
      var ta = document.createElement("textarea");
      ta.value = u;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showLeaderboardShareToast(MARKETING_UI.leaderboardCardLinkCopied);
      closeAllLeaderboardCardMenus();
    } catch (_e) {
      showLeaderboardShareToast(MARKETING_UI.leaderboardCardShareFailed);
    }
  }

  function buildLeaderboardCardHtml(salon) {
    var a = getLeaderboardAssessmentVisual(salon);
    var ac = a.color || "#1A365D";
    var al = a.light || "#F0F4F8";
    var abr = a.border || "#CBD5E0";
    var ranked = rankSalonInCounty(salon, getLeaderboardSalonsRankPool());
    var href = "/leaderboard/" + encodeURIComponent(salon.slug);
    var shareUrl = buildLeaderboardCardShareUrl(salon);
    var rankTone = ranked.rankLabel === "5+" ? "#DC2626" : "#276749";
    var rankBg = ranked.rankLabel === "5+" ? "#FEF2F2" : "#F0FFF4";
    return (
      '<article class="lb-card" style="border-color:' +
      escapeHtml(abr) +
      '33">' +
      '<div class="lb-card-accent" style="background:linear-gradient(90deg,' +
      escapeHtml(ac) +
      "," +
      escapeHtml(abr) +
      ')"></div>' +
      '<div class="lb-card-body">' +
      '<div class="lb-card-head">' +
      '<div class="lb-card-titles">' +
      '<p class="lb-card-kicker" style="color:' +
      escapeHtml(ac) +
      '">' +
      escapeHtml(salon.category || "") +
      "</p>" +
      '<h2 class="lb-card-name"><a href="' +
      href +
      '">' +
      escapeHtml(salon.name) +
      "</a></h2>" +
      '<p class="lb-card-meta">📍 ' +
      escapeHtml(salon.town || "") +
      ", " +
      escapeHtml(salon.county || "") +
      " County, " +
      escapeHtml(salon.state || "") +
      (salon.zipcode ? " · " + escapeHtml(salon.zipcode) : "") +
      "</p>" +
      "</div>" +
      '<div class="lb-card-head-actions">' +
      '<div class="lb-card-menu-wrap">' +
      '<button type="button" class="lb-card-menu-btn" data-lb-card-menu-btn aria-expanded="false" aria-haspopup="true" aria-label="' +
      escapeHtml(MARKETING_UI.leaderboardCardMenuAria) +
      '">' +
      '<span class="lb-card-menu-ic" aria-hidden="true"><span></span><span></span><span></span></span>' +
      "</button>" +
      '<div class="lb-card-menu-popover" data-lb-card-menu-popover hidden role="menu">' +
      '<button type="button" class="lb-card-menu-item" role="menuitem" data-lb-share-salon data-lb-share-url="' +
      escapeHtml(shareUrl) +
      '" data-lb-share-title="' +
      escapeHtml(salon.name || "") +
      '">' +
      escapeHtml(MARKETING_UI.leaderboardCardShare) +
      "</button>" +
      '<a class="lb-card-menu-item lb-card-menu-item--link" role="menuitem" href="' +
      href +
      '">' +
      escapeHtml(MARKETING_UI.leaderboardCardViewScorecard) +
      "</a>" +
      "</div></div>" +
      '<div class="lb-badge" style="background:' +
      escapeHtml(al) +
      ";border-color:" +
      escapeHtml(abr) +
      '">' +
      '<span class="lb-badge-emoji">' +
      escapeHtml(a.emoji || "") +
      "</span>" +
      '<span class="lb-badge-level" style="color:' +
      escapeHtml(ac) +
      '">' +
      escapeHtml(getLeaderboardLevelDisplayLabel(a, state.leaderboardLocale === "zh" ? "zh" : "en")) +
      "</span>" +
      "</div>" +
      "</div></div>" +
      '<div class="lb-metrics">' +
      '<div class="lb-metric" style="background:' +
      escapeHtml(al) +
      '"><div class="lb-metric-val" style="color:' +
      escapeHtml(ac) +
      '">' +
      escapeHtml(String(Number(salon.rating).toFixed(1))) +
      '★</div><div class="lb-metric-lbl">reviews ' +
      escapeHtml(String(salon.reviews)) +
      "</div></div>" +
      '<div class="lb-metric lb-metric-muted"><div class="lb-metric-val">' +
      escapeHtml(String(Math.round(salon.score))) +
      '</div><div class="lb-metric-lbl">AI score</div></div>' +
      '<div class="lb-metric" style="background:' +
      rankBg +
      '"><div class="lb-metric-val" style="color:' +
      rankTone +
      '">' +
      escapeHtml(ranked.rankLabel) +
      '</div><div class="lb-metric-lbl">of ' +
      escapeHtml(String(ranked.total)) +
      "</div></div>" +
      "</div>" +
      '<a class="lb-card-cta" style="background:' +
      escapeHtml(ac) +
      '" href="' +
      href +
      '">View scorecard →</a>' +
      "</div></article>"
    );
  }

  function buildLeaderboardPaginationHtml(page, totalPages, totalCount) {
    if (!totalCount) {
      return "";
    }
    var meta =
      '<span class="lb-pager-meta">' +
      escapeHtml(String(totalCount)) +
      " restaurants" +
      (totalPages > 1 ? " · Page " + page + " / " + totalPages : "") +
      "</span>";
    if (totalPages <= 1) {
      return '<nav class="lb-pager" aria-label="' + escapeHtml(MARKETING_UI.leaderboardTopLink) + '">' + meta + "</nav>";
    }
    var prevDis = page <= 1 ? " disabled" : "";
    var nextDis = page >= totalPages ? " disabled" : "";
    return (
      '<nav class="lb-pager" aria-label="' + escapeHtml(MARKETING_UI.leaderboardTopLink) + '">' +
      meta +
      '<div class="lb-pager-btns">' +
      '<button type="button" class="ghost lb-pager-btn"' +
      prevDis +
      ' data-lb-page="prev">' +
      escapeHtml(MARKETING_UI.leaderboardPrevious) +
      "</button>" +
      '<button type="button" class="ghost lb-pager-btn"' +
      nextDis +
      ' data-lb-page="next">' +
      escapeHtml(MARKETING_UI.leaderboardNext) +
      "</button>" +
      "</div></nav>"
    );
  }

  function buildLeaderboardRequestModalHtml() {
    var open = !!state.leaderboardRequestModalOpen;
    return (
      '<div id="lbRequestModal" class="lb-modal' +
      (open ? " is-open" : "") +
      '" role="presentation" aria-hidden="' +
      (open ? "false" : "true") +
      '">' +
      '<div class="lb-modal-backdrop" data-lb-close-request-modal tabindex="-1"></div>' +
      '<div class="lb-modal-dialog card" role="dialog" aria-modal="true" aria-labelledby="lbRequestModalTitle">' +
      '<div class="lb-modal-head">' +
      '<h2 id="lbRequestModalTitle">' +
      escapeHtml(MARKETING_UI.leaderboardRequestListing) +
      "</h2>" +
      '<button type="button" class="ghost lb-modal-close" data-lb-close-request-modal aria-label="' +
      escapeHtml(MARKETING_UI.leaderboardClose) +
      '">×</button>' +
      "</div>" +
      '<p class="lb-modal-lead">' +
      escapeHtml(MARKETING_UI.leaderboardRequestLead) +
      "</p>" +
      '<form id="leaderboardRequestForm" class="lb-request-form">' +
      '<fieldset class="lb-req-kind">' +
      '<legend class="lb-sr-only">' +
      escapeHtml(MARKETING_UI.leaderboardRequestType) +
      "</legend>" +
      '<label class="lb-req-kind-opt"><input type="radio" name="request_kind" value="add_store" checked /> ' +
      escapeHtml(MARKETING_UI.leaderboardRequestAddSalon) +
      "</label>" +
      '<label class="lb-req-kind-opt"><input type="radio" name="request_kind" value="more_coverage" /> ' +
      escapeHtml(MARKETING_UI.leaderboardRequestMoreCoverage) +
      "</label>" +
      "</fieldset>" +
      '<label>' +
      escapeHtml(MARKETING_UI.leaderboardRequestSalonName) +
      '<input name="salon_name" class="lb-input" required autocomplete="organization" /></label>' +
      '<label>' +
      escapeHtml(MARKETING_UI.leaderboardRequestYourName) +
      '<input name="contact_name" class="lb-input" required autocomplete="name" /></label>' +
      '<label>' +
      escapeHtml(MARKETING_UI.leaderboardRequestEmail) +
      '<input name="email" type="email" class="lb-input" required autocomplete="email" /></label>' +
      '<label>' +
      escapeHtml(MARKETING_UI.leaderboardRequestPhone) +
      '<input name="phone" class="lb-input" autocomplete="tel" /></label>' +
      '<label>' +
      escapeHtml(MARKETING_UI.leaderboardRequestAddress) +
      '<textarea name="address" class="lb-textarea" rows="2"></textarea></label>' +
      '<label>' +
      escapeHtml(MARKETING_UI.leaderboardRequestMessage) +
      '<textarea name="message" class="lb-textarea" rows="3" placeholder="' +
      escapeHtml(MARKETING_UI.leaderboardRequestMessagePlaceholder) +
      '"></textarea></label>' +
      '<div class="lb-req-actions">' +
      '<button type="submit" class="cta" id="lbReqSubmit">' +
      escapeHtml(MARKETING_UI.leaderboardRequestSend) +
      "</button>" +
      '<button type="button" class="ghost" data-lb-close-request-modal>' +
      escapeHtml(MARKETING_UI.leaderboardRequestCancel) +
      "</button>" +
      "</div>" +
      '<p id="leaderboardRequestStatus" class="lb-req-status" role="status"></p>' +
      "</form></div></div>"
    );
  }

  function buildLeaderboardListBlockHtml() {
    var all = getLeaderboardSalonsFiltered();
    var pageSize = LEADERBOARD_PAGE_SIZE;
    var total = all.length;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (state.leaderboardListPage > totalPages) state.leaderboardListPage = totalPages;
    if (state.leaderboardListPage < 1) state.leaderboardListPage = 1;
    var page = state.leaderboardListPage;
    var slice = all.slice((page - 1) * pageSize, page * pageSize);
    if (!total) {
      return (
        '<div id="leaderboardListBlock" class="lb-list-block">' +
        '<p class="lb-empty">No restaurants match these filters.</p>' +
        "</div>"
      );
    }
    return (
      '<div id="leaderboardListBlock" class="lb-list-block">' +
      '<div class="lb-grid" id="leaderboardGrid">' +
      slice.map(buildLeaderboardCardHtml).join("") +
      "</div>" +
      buildLeaderboardPaginationHtml(page, totalPages, total) +
      "</div>"
    );
  }

  function refreshLeaderboardGrid() {
    var block = document.getElementById("leaderboardListBlock");
    if (!block) return;
    block.outerHTML = buildLeaderboardListBlockHtml();
    syncLinkPreviewMeta();
  }

  /** Modeled ranges from public leaderboard fields only — not audited financials. */
  function lbReportModelLossRange(salon, ranked) {
    var score = Number(salon && salon.score) || 0;
    var reviews = Number(salon && salon.reviews) || 0;
    var leaderReviews = 0;
    if (ranked && ranked.top5 && ranked.top5.length) leaderReviews = Number(ranked.top5[0].reviews) || 0;
    var gap = Math.max(0, leaderReviews - reviews);
    var rk = ranked && ranked.rank ? ranked.rank : 3;
    var low = Math.round(9 + (100 - score) * 0.14 + gap / 38 + Math.max(0, rk - 2) * 1.8);
    low = Math.max(7, Math.min(36, low));
    var high = Math.round(low * (rk <= 2 ? 1.65 : 2.05));
    high = Math.min(68, Math.max(low + 6, high));
    return { low: low, high: high, gapReviews: gap };
  }

  function lbReportRevenueBand(lowClients, highClients) {
    var ticket = 78;
    return {
      low: Math.round(lowClients * ticket),
      high: Math.round(highClients * ticket * 1.12),
    };
  }

  function lbReportRatingRibbon(rating) {
    var r = Number(rating) || 0;
    if (r >= 4.85) return { tag: "Elite signal", sub: "Top ~5% band — but stars plateau without review velocity.", tone: "warn" };
    if (r >= 4.55) return { tag: "Strong with exposure risk", sub: "One slow review month lets competitors rewrite the story on Maps.", tone: "warn" };
    if (r >= 4.25) return { tag: "Conversion leak", sub: "Many shoppers filter below 4.5★ before they ever tap Call.", tone: "bad" };
    return { tag: "Urgent trust gap", sub: "Maps treats this band like higher risk — fewer impressions, fewer bookings.", tone: "bad" };
  }

  function lbReportScoreRibbon(score) {
    var s = Math.round(Number(score) || 0);
    if (s >= 90) return { tag: "Leaderboard momentum", sub: "At risk if review growth slows — peers can close the gap in weeks.", tone: "warn" };
    if (s >= 78) return { tag: "Competitive band", sub: "Small moves in volume + recency swing rank faster than owners expect.", tone: "warn" };
    if (s >= 65) return { tag: "Pressure building", sub: "Below where many owners feel 'fully booked' consistency on Google.", tone: "bad" };
    return { tag: "High urgency", sub: "Composite trust is trailing — each week costs discoverability.", tone: "bad" };
  }

  /** 0–100 dimension → CSS suffix `warn` | `bad` (see .lb-rep-tone-* in styles.css). */
  function qualityTone(score0to100) {
    var v = Math.max(0, Math.min(100, Math.round(Number(score0to100) || 0)));
    return v >= 70 ? "warn" : "bad";
  }

  function lbReportPeerMonthlyIndex(peer, salon, idx) {
    var pr = Number(peer && peer.reviews) || 0;
    var sr = Number(salon && salon.reviews) || 0;
    var base = Math.round(7 + pr / 42 + idx * 3 + Math.max(0, pr - sr) / 36);
    return Math.max(5, Math.min(54, base));
  }

  function buildLeaderboardGrowthReportHtml(salon, ranked, issues, a, locPref, ac, al, abr, am) {
    var z = locPref === "zh";
    var loss = lbReportModelLossRange(salon, ranked);
    var money = lbReportRevenueBand(loss.low, loss.high);
    var rr = lbReportRatingRibbon(salon.rating);
    var modelAi = calcClientAiScore(salon);
    var apiScore = Number(salon.score);
    var displayAi = Math.round(isFinite(apiScore) ? apiScore : modelAi);
    var sr = lbReportScoreRibbon(displayAi);
    var rk = ranked.rank || 0;
    var peers = (ranked.top5 || [])
      .filter(function (c) {
        return c.id !== salon.id;
      })
      .slice(0, 3);
    var leader = ranked.top5 && ranked.top5.length ? ranked.top5[0] : null;
    var leaderReviews = leader ? Number(leader.reviews) || 0 : 0;
    var gapVel = Math.max(0, leaderReviews - (Number(salon.reviews) || 0));
    var modeledPeerReviews = Math.max(12, Math.round(gapVel / 6 + 18 + (Number(salon.reviews) || 0) / 80));

    var heroTitle = "";
    var heroSub = "";
    if (z) {
      if (rk === 1) {
        heroTitle = "你在 " + escapeHtml(String(salon.county || "")) + " 排名第 1——但仍有「看不见的需求」在流失";
        heroSub =
          "头部门店通常靠评论节奏多拿下每月 20–40 次额外预约。只要同行把评论速度拉起来，你的优势窗口就会变窄。";
      } else if (rk > 0 && rk <= 3) {
        heroTitle = "你在前三——但竞争对手正在买走你错过的预约";
        heroSub =
          "顾客在 Google 上会用同一张榜单做对比。评论与新鲜度一旦落后，流失不是按季度算，而是按周算。";
      } else {
        heroTitle = escapeHtml(String(salon.name || "Your restaurant")) + "：高意向食客正在从指缝溜走";
        heroSub =
          "这不是「仪表盘」，而是一份增长诊断：把星级、评论量与 AI 综合分，翻译成可预约的现金流。";
      }
    } else {
      if (rk === 1) {
        heroTitle =
          "You're Ranked #1 in " +
          escapeHtml(String(salon.county || "your county")) +
          " — But You're Still Losing Customers You Don't See";
        heroSub =
          "Top restaurants in this market often capture 20–40 more high-intent actions per month by maintaining review velocity and freshness. When competitors accelerate, your invisible demand walks away first.";
      } else if (rk > 0 && rk <= 3) {
        heroTitle = "You're in the Top 3 — Competitors Are Capturing the Diners You Miss";
        heroSub =
          "Diners compare restaurants on the same live signals you see here. When review cadence slips, the loss shows up in tables — not quarters.";
      } else {
        heroTitle =
          escapeHtml(String(salon.name || "Your restaurant")) + ": High-Intent Diners Are Slipping Through";
        heroSub =
          "This is not a dashboard — it's a revenue diagnosis: we translate stars, volume, and composite AI score into money left on the table.";
      }
    }

    var disc = z
      ? "*以下为基于公开榜单信号（评分/评论/排名/综合分）的模型估算，非财务审计。*"
      : "*Estimates modeled from public leaderboard signals (rating, reviews, rank, score) — not a financial audit.*";

    var s1t = z ? "估算：每月可能错失的新客（区间）" : "Est. monthly new-client leakage (modeled)";
    var s2t = z ? "与本县 #1 的评论节奏差" : "Review cadence gap vs. #1 in county";
    var s3t = z ? "若 30–60 天优化，估算增收" : "Est. upside if optimized (30–60 days)";

    var stat1 =
      '<div class="lb-rep-stat card lb-rep-stat--risk"><p class="lb-rep-stat-k">' +
      escapeHtml(s1t) +
      '</p><p class="lb-rep-stat-val">' +
      escapeHtml(String(loss.low)) +
      "–" +
      escapeHtml(String(loss.high)) +
      '</p><p class="lb-rep-stat-sub">' +
      (z
        ? "区间为示意参考，不同门店会有差异，不构成效果或收入承诺。"
        : "Illustrative range; results vary by restaurant. Not a performance or revenue guarantee.") +
      "</p></div>";
    var stat2 =
      '<div class="lb-rep-stat card lb-rep-stat--warn"><p class="lb-rep-stat-k">' +
      escapeHtml(s2t) +
      '</p><p class="lb-rep-stat-val">' +
      (leader ? "≈ +" + escapeHtml(String(Math.max(0, gapVel))) : "—") +
      '</p><p class="lb-rep-stat-sub">' +
      (z
        ? "相对本县当前榜首评论量的缺口（公开数据推导）。"
        : "Gap vs. current #1 review count on this leaderboard snapshot.") +
      "</p></div>";
    var stat3 =
      '<div class="lb-rep-stat card lb-rep-stat--money"><p class="lb-rep-stat-k">' +
      escapeHtml(s3t) +
      '</p><p class="lb-rep-stat-val">$' +
      escapeHtml(String(money.low.toLocaleString())) +
      "–$" +
      escapeHtml(String(money.high.toLocaleString())) +
      '</p><p class="lb-rep-stat-sub">' +
      (z ? "在相对保守的客单价假设下估算；仅供参考。" : "Estimated using a conservative ticket assumption; for reference only.") +
      "</p></div>";

    var scoreHintText =
      "AI ranks restaurants using v2 weighted blend: rating×31% + review volume×33% + sentiment×22% + recency×14%, then applies evidence confidence shrinkage for low-review profiles.";
    var ratingPct = Math.max(0, Math.min(100, Math.round((Number(salon.rating) / 5) * 100)));
    var scorePct = Math.max(0, Math.min(100, Math.round(Number(salon.score) || 0)));
    var dimReviews = Math.max(0, Math.min(100, Math.round(Number(salon.dimReviewsScore != null ? salon.dimReviewsScore : salon.dim_reviews_score) || 0)));
    var dimRating = Math.max(0, Math.min(100, Math.round(Number(salon.dimRatingScore != null ? salon.dimRatingScore : salon.dim_rating_score) || ratingPct)));
    var dimSentiment = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          Number(salon.dimSentimentScore != null ? salon.dimSentimentScore : salon.dim_sentiment_score) ||
            Math.round((Number(salon.p) || 0.8) * 100),
        ),
      ),
    );
    var dimRecency = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          Number(salon.dimRecencyScore != null ? salon.dimRecencyScore : salon.dim_recency_score) || Math.round((Number(salon.f) || 0.75) * 100),
        ),
      ),
    );
    var dimLocalSeo = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          Number(salon.dimLocalSeoScore != null ? salon.dimLocalSeoScore : salon.dim_local_seo_score) ||
            Math.round(dimRating * 0.45 + dimReviews * 0.35 + dimRecency * 0.2),
        ),
      ),
    );
    var dimConversion = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          Number(salon.dimConversionScore != null ? salon.dimConversionScore : salon.dim_conversion_score) ||
            Math.round(dimRating * 0.3 + dimReviews * 0.2 + (String(salon.phone || "").trim() ? 24 : 0) + 20),
        ),
      ),
    );
    var scoreVisual =
      '<section class="lb-rep-section lb-rep-section--score"><div class="lb-rep-score card">' +
      '<div class="lb-rep-score-head"><h2 class="lb-rep-h">' +
      (z ? "评分冲击视图" : "Score impact view") +
      '</h2><p class="lb-rep-lead">' +
      (z
        ? "顾客通常先看星级，再看评论与排名。下面是你在决策瞬间的可见信号强度。"
        : "Shoppers usually decide in this order: stars, proof volume, then rank. This is your visible trust intensity at decision time.") +
      "</p></div>" +
      '<div class="lb-rep-score-grid"><article class="lb-rep-score-kpi"><p class="lb-rep-score-k">' +
      (z ? "Google 星级信号" : "Google star signal") +
      '</p><p class="lb-rep-score-v">' +
      escapeHtml(String(Number(salon.rating || 0).toFixed(1))) +
      '★</p><div class="lb-rep-meter"><span style="width:' +
      escapeHtml(String(ratingPct)) +
      '%"></span></div><p class="lb-rep-score-sub">' +
      escapeHtml(rr.tag) +
      "</p></article>" +
      '<article class="lb-rep-score-kpi"><p class="lb-rep-score-k">AI Composite</p><p class="lb-rep-score-v">' +
      escapeHtml(String(Math.round(Number(salon.score) || 0))) +
      '</p><div class="lb-rep-meter"><span style="width:' +
      escapeHtml(String(scorePct)) +
      '%"></span></div><p class="lb-rep-score-sub">' +
      escapeHtml(sr.tag) +
      "</p></article>" +
      '<article class="lb-rep-score-kpi"><p class="lb-rep-score-k">' +
      (z ? "县域抢单位置" : "County deal position") +
      '</p><p class="lb-rep-score-v">#' +
      escapeHtml(String(ranked.rank || "—")) +
      '</p><div class="lb-rep-score-rank">' +
      (z ? "共 " : "of ") +
      escapeHtml(String(ranked.total || 0)) +
      (z ? " 家" : " restaurants") +
      "</div><p class=\"lb-rep-score-sub\">" +
      (z ? "排名越靠前，电话与导航点击越集中。" : "Higher rank concentrates calls and direction taps.") +
      "</p></article></div></div></section>";
    var radarValues = [dimReviews, dimRating, dimSentiment, dimRecency, dimLocalSeo, dimConversion];
    var radarLabels = z ? ["评论量", "星级", "情绪", "新鲜度", "本地SEO", "转化"] : ["Reviews", "Rating", "Sentiment", "Recency", "Local SEO", "Conversion"];
    var radarDots = "";
    var radarPolyPoints = [];
    var radarGrid = "";
    for (var rl = 1; rl <= 3; rl++) {
      var ratio = rl / 3;
      var ring = [];
      for (var rg = 0; rg < radarValues.length; rg++) {
        var ga = -Math.PI / 2 + (rg * Math.PI * 2) / radarValues.length;
        ring.push((80 + Math.cos(ga) * 56 * ratio).toFixed(1) + "," + (80 + Math.sin(ga) * 56 * ratio).toFixed(1));
      }
      radarGrid += '<polygon points="' + ring.join(" ") + '" fill="none" stroke="#e2e8f0" stroke-width="1"/>';
    }
    for (var ri = 0; ri < radarValues.length; ri++) {
      var a1 = -Math.PI / 2 + (ri * Math.PI * 2) / radarValues.length;
      var rv = radarValues[ri];
      var ax = 80 + Math.cos(a1) * 56;
      var ay = 80 + Math.sin(a1) * 56;
      var px = 80 + Math.cos(a1) * (56 * rv) / 100;
      var py = 80 + Math.sin(a1) * (56 * rv) / 100;
      var lx = 80 + Math.cos(a1) * 70;
      var ly = 80 + Math.sin(a1) * 70;
      radarPolyPoints.push(px.toFixed(1) + "," + py.toFixed(1));
      radarDots +=
        '<line x1="80" y1="80" x2="' +
        ax.toFixed(1) +
        '" y2="' +
        ay.toFixed(1) +
        '" stroke="#dbeafe" stroke-width="1"/>' +
        '<circle cx="' +
        px.toFixed(1) +
        '" cy="' +
        py.toFixed(1) +
        '" r="2.5" fill="#ec4899"/>' +
        '<text x="' +
        lx.toFixed(1) +
        '" y="' +
        ly.toFixed(1) +
        '" text-anchor="middle" dominant-baseline="middle" font-size="8.5" fill="#475569">' +
        escapeHtml(radarLabels[ri]) +
        "</text>";
    }
    var radarSection =
      '<section class="lb-rep-section lb-rep-section--radar"><div class="lb-rep-radar card"><div><h2 class="lb-rep-h">' +
      (z ? "评分雷达图" : "Scoring radar") +
      '</h2><p class="lb-rep-lead">' +
      (z ? "6 维评分可视化（全部来自 Supabase 字段），快速看到最短板和优先修复维度。" : "Six-dimension view (backed by Supabase fields) to spot your weakest growth signal first.") +
      '</p></div><div class="lb-rep-radar-canvas"><svg viewBox="0 0 160 160" aria-label="' +
      (z ? "评分雷达图" : "Scoring radar") +
      '">' +
      radarGrid +
      '<polygon points="' +
      radarPolyPoints.join(" ") +
      '" fill="rgba(236,72,153,0.2)" stroke="#ec4899" stroke-width="2"/>' +
      radarDots +
      '</svg></div></div></section>';

    var metricRatingBand = qualityTone(dimRating);
    var metricReviewsBand = qualityTone(dimReviews);
    var metricSentimentBand = qualityTone(dimSentiment);
    var metricRecencyBand = qualityTone(dimRecency);
    var metricLocalSeoBand = qualityTone(dimLocalSeo);
    var metricConversionBand = qualityTone(dimConversion);
    var metrics =
      '<section class="lb-rep-section"><h2 class="lb-rep-h">' +
      (z ? "6维关键指标（Supabase 数据）" : "Six key dimensions (Supabase-backed)") +
      '</h2><div class="lb-rep-metrics">' +
      '<article class="lb-rep-metric card lb-rep-tone-' +
      escapeHtml(metricReviewsBand) +
      '"><p class="lb-rep-metric-val">' +
      escapeHtml(String(dimReviews)) +
      '</p><p class="lb-rep-metric-tag">' +
      (z ? "评论量维度" : "Reviews dimension") +
      '</p><p class="lb-rep-metric-sub">' +
      (z ? "由评论数量归一化得到，体现社证体量。" : "Log-normalized from review volume; reflects social proof depth.") +
      '</p><p class="lb-rep-metric-lbl">' +
      (z ? "Reviews score" : "Reviews score") +
      "</p></article>" +
      '<article class="lb-rep-metric card lb-rep-tone-' +
      escapeHtml(metricRatingBand) +
      '"><p class="lb-rep-metric-val">' +
      escapeHtml(String(dimRating)) +
      '</p><p class="lb-rep-metric-tag">' +
      (z ? "星级维度" : "Rating dimension") +
      '</p><p class="lb-rep-metric-sub">' +
      (z ? "由 Google 星级映射为 0-100 信号。" : "Mapped from Google star rating into a 0-100 signal.") +
      '</p><p class="lb-rep-metric-lbl">' +
      (z ? "Rating score" : "Rating score") +
      "</p></article>" +
      '<article class="lb-rep-metric card lb-rep-tone-' +
      escapeHtml(metricSentimentBand) +
      '"><p class="lb-rep-metric-val">' +
      escapeHtml(String(dimSentiment)) +
      '</p><p class="lb-rep-metric-tag">' +
      (z ? "口碑情绪维度" : "Sentiment dimension") +
      '</p><p class="lb-rep-metric-sub">' +
      (z ? "来自 sentiment_p，反映评价内容质量倾向。" : "Derived from sentiment_p; reflects review tone quality.") +
      '</p><p class="lb-rep-metric-lbl">' +
      (z ? "Sentiment score" : "Sentiment score") +
      "</p></article>" +
      '<article class="lb-rep-metric card lb-rep-tone-' +
      escapeHtml(metricRecencyBand) +
      '"><p class="lb-rep-metric-val">' +
      escapeHtml(String(dimRecency)) +
      '</p><p class="lb-rep-metric-tag">' +
      (z ? "新鲜度维度" : "Recency dimension") +
      '</p><p class="lb-rep-metric-sub">' +
      (z ? "来自 freshness_f，反映近120天评论活跃度。" : "From freshness_f, indicating recent review activity.") +
      '</p><p class="lb-rep-metric-lbl">' +
      (z ? "Recency score" : "Recency score") +
      "</p></article>" +
      '<article class="lb-rep-metric card lb-rep-tone-' +
      escapeHtml(metricLocalSeoBand) +
      '"><p class="lb-rep-metric-val">' +
      escapeHtml(String(dimLocalSeo)) +
      '</p><p class="lb-rep-metric-tag">' +
      (z ? "本地SEO维度" : "Local SEO dimension") +
      '</p><p class="lb-rep-metric-sub">' +
      (z ? "由信任信号+资料完整度计算的本地排名代理值。" : "Proxy score from trust signals and profile completeness.") +
      '</p><p class="lb-rep-metric-lbl">' +
      (z ? "Local SEO score" : "Local SEO score") +
      "</p></article>" +
      '<article class="lb-rep-metric card lb-rep-tone-' +
      escapeHtml(metricConversionBand) +
      ' lb-rep-metric--ai"><p class="lb-rep-metric-val">' +
      escapeHtml(String(dimConversion)) +
      '</p><span class="lb-stat-hint lb-rep-score-hint" tabindex="0" role="button" aria-label="How AI score is calculated">' +
      '<span class="lb-stat-hint-icon" aria-hidden="true">?</span>' +
      '<span class="lb-stat-hint-pop" role="tooltip">' +
      escapeHtml(
        z
          ? "转化维度根据电话可达性、信任信号与资料完整度计算，用于衡量线索转预约准备度。"
          : "Conversion dimension is modeled from contactability, trust signals, and profile completeness as booking-readiness proxy.",
      ) +
      "</span></span>" +
      '<p class="lb-rep-metric-tag">' +
      (z ? "转化维度" : "Conversion dimension") +
      '</p><p class="lb-rep-metric-sub">' +
      (z ? "衡量从曝光到咨询/预约的摩擦程度。" : "Measures friction from visibility to inquiry/booking.") +
      '</p><p class="lb-rep-metric-lbl">Conversion score</p></article></div></section>';

    var compRows = peers
      .map(function (c, idx) {
        var idxVel = lbReportPeerMonthlyIndex(c, salon, idx);
        var up = Number(c.score) >= Number(salon.score) - 1.5;
        var arrow = up ? '<span class="lb-rep-arr lb-rep-arr--bad">▲</span>' : '<span class="lb-rep-arr lb-rep-arr--ok">▼</span>';
        return (
          '<tr><td>' +
          arrow +
          " " +
          escapeHtml(String(c.name || "")) +
          '</td><td class="lb-rep-td-num">' +
          escapeHtml(String(Math.round(Number(c.score) || 0))) +
          '</td><td class="lb-rep-td-num">' +
          escapeHtml(String(c.reviews || 0)) +
          '</td><td class="lb-rep-td-hot">~+' +
          escapeHtml(String(idxVel)) +
          (z ? " /30天*</td></tr>" : " /30d*</td></tr>")
        );
      })
      .join("");

    var compSection =
      '<section class="lb-rep-section lb-rep-section--pressure">' +
      '<h2 class="lb-rep-h">🚨 ' +
      (z ? "附近门店正在逼近" : "Nearby Competitors Are Catching Up") +
      '</h2><p class="lb-rep-lead">' +
      (z
        ? "以下为同县榜单中的参考门店，以及基于公开数据推算的评论节奏示意指数*。"
        : "Leaderboard peers in your county, plus a directional review-cadence index from public data*.") +
      '</p><div class="lb-rep-table-wrap card"><table class="lb-rep-table"><thead><tr><th>' +
      (z ? "门店" : "Restaurant") +
      "</th><th>AI</th><th>" +
      (z ? "评论" : "Reviews") +
      "</th><th>" +
      (z ? "节奏参考" : "Modeled pace") +
      "</th></tr></thead><tbody>" +
      (compRows ||
        "<tr><td colspan=\"4\">" +
        (z ? "暂无足够对比样本。" : "Not enough peers in this snapshot.") +
        "</td></tr>") +
      '</tbody></table><p class="lb-rep-micro">*' +
      (z
        ? "非 Google 官方 30 天增量；由榜单公开字段推导的示意指数。"
        : "Not Google's official 30-day delta — a directional index from public leaderboard fields.") +
      "</p></div>" +
      '<p class="lb-rep-urgent">📈 ' +
      (z
        ? "对比来看：同行本月可能多出约 " + escapeHtml(String(modeledPeerReviews)) + " 条「可见证据」——而顾客往往只点前几名。"
        : "By comparison, peers may add ~" +
          escapeHtml(String(modeledPeerReviews)) +
          " visible proof signals this month — shoppers often tap the top few.") +
      "</p></section>";
    var heatRows = (ranked.top5 || []).slice(0, 6).map(function (c, idx) {
      var cScore = Math.max(0, Math.min(100, Math.round(Number(c.dimLocalSeoScore != null ? c.dimLocalSeoScore : c.dim_local_seo_score) || Number(c.score) || 0)));
      var cReviews = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            Number(c.dimReviewsScore != null ? c.dimReviewsScore : c.dim_reviews_score) ||
              (Math.log((Number(c.reviews) || 0) + 1) / Math.log((leaderReviews || 1) + 1)) * 100,
          ),
        ),
      );
      var cStars = Math.max(
        0,
        Math.min(100, Math.round(Number(c.dimRatingScore != null ? c.dimRatingScore : c.dim_rating_score) || (Number(c.rating || 0) / 5) * 100)),
      );
      return (
        '<tr class="' +
        (c.id === salon.id ? "is-you" : "") +
        '"><td><strong>#' +
        escapeHtml(String(idx + 1)) +
        "</strong> " +
        escapeHtml(String(c.name || "")) +
        '</td><td><span class="lb-rep-heat-cell"><em style="opacity:' +
        escapeHtml(String(Math.max(0.2, cStars / 100))) +
        '"></em><span class="lb-rep-heat-txt">' +
        escapeHtml(String(Number(c.rating || 0).toFixed(1))) +
        '★</span></span></td><td><span class="lb-rep-heat-cell"><em style="opacity:' +
        escapeHtml(String(Math.max(0.2, cReviews / 100))) +
        '"></em><span class="lb-rep-heat-txt">' +
        escapeHtml(String(c.reviews || 0)) +
        "</span></span></td><td><span class=\"lb-rep-heat-cell\"><em style=\"opacity:" +
        escapeHtml(String(Math.max(0.2, cScore / 100))) +
        '"></em><span class="lb-rep-heat-txt">' +
        escapeHtml(String(cScore)) +
        "</span></span></td></tr>"
      );
    }).join("");
    var heatmapSection =
      '<section class="lb-rep-section lb-rep-section--heat"><h2 class="lb-rep-h">🔥 ' +
      (z ? "竞争对手热力图（本县榜单）" : "Competitor heatmap (county leaderboard)") +
      '</h2><p class="lb-rep-lead">' +
      (z
        ? "颜色越深，代表该项在顾客眼中越强。先追平热区，再冲击前 3。"
        : "Darker cells mean stronger proof at the moment of choice. Match these heat zones first, then push for top 3.") +
      '</p><div class="lb-rep-heat-wrap card"><table class="lb-rep-heat"><thead><tr><th>' +
      (z ? "门店" : "Restaurant") +
      "</th><th>" +
      (z ? "星级热度" : "Star heat") +
      "</th><th>" +
      (z ? "评论热度" : "Review heat") +
      "</th><th>" +
      (z ? "Local SEO 热度" : "Local SEO heat") +
      "</th></tr></thead><tbody>" +
      (heatRows ||
        "<tr><td colspan=\"4\">" +
        (z ? "暂无足够样本。" : "Not enough peers.") +
        "</td></tr>") +
      "</tbody></table></div></section>";

    var missCards = issues
      .map(function (iss) {
        var revLine = "";
        var ht = String(iss.title || "");
        if (ht.indexOf("Booking") >= 0) {
          revLine = z
            ? "高意向食客偏好一键订位、点餐或致电。缺链路的每一次曝光，都是把订单让给动作更清楚的隔壁店。"
            : "High-intent diners prefer one-tap reservations, calls, or ordering. Every impression without a clear action leaks conversions to restaurants that remove friction.";
        } else if (ht.indexOf("Review") >= 0 || ht.indexOf("Volume") >= 0) {
          revLine = z
            ? "评论速度=地图信任速度。慢 30 天，排名与来电会被重新分配。"
            : "Review velocity = Maps trust velocity. Slow 30 days and calls get re-routed.";
        } else if (ht.indexOf("Rating") >= 0) {
          revLine = z
            ? "星级是「门槛」：低于顾客心理线，点击与到店会断崖式下降。"
            : "Stars are a threshold: below shopper comfort, taps and visits fall off a cliff.";
        } else {
          revLine = z ? "直接影响转化与客单价，而不是「运营细节」。" : "Impacts conversion and ticket — not a minor ops note.";
        }
        return (
          '<article class="lb-rep-miss card"><p class="lb-rep-miss-flag">' +
          (z ? "收入漏洞" : "Revenue leak") +
          '</p><h3 class="lb-rep-miss-h">' +
          escapeHtml(iss.title) +
          '</h3><p class="lb-rep-miss-b">' +
          escapeHtml(iss.detail) +
          '</p><p class="lb-rep-miss-rev"><strong>' +
          (z ? "收入含义：" : "Revenue implication:") +
          "</strong> " +
          escapeHtml(revLine) +
          '</p><p class="lb-rep-miss-fix"><strong>' +
          (z ? "修复路径：" : "Fix:") +
          "</strong> " +
          escapeHtml(iss.fix) +
          "</p></article>"
        );
      })
      .join("");

    var plan =
      '<section class="lb-rep-section"><h2 class="lb-rep-h">📈 ' +
      (z ? "30 天进攻路线（预告）" : "30-Day Offensive (Teaser)") +
      '</h2><ol class="lb-rep-ol card"><li>' +
      (z ? "锁定 2 个最高 ROI 的 Google 证据杠杆（评论/订位/星级）。" : "Pick the 2 highest-ROI Google proof levers (reviews / reservations / stars).") +
      "</li><li>" +
      (z ? "建立每周可执行的评论节奏（餐桌二维码+短信+接待话术）。" : "Install a weekly review cadence (table QR + SMS + host script).") +
      "</li><li>" +
      (z ? "把「榜单分数」翻译成「订位、来电与到店」的跟踪表。" : "Translate leaderboard movement into reservations, calls, and visits tracked weekly.") +
      "</li></ol></section>";
    var solutionCatalog = [
      {
        id: "google-growth",
        service: "Google Diner Growth System",
        titleZh: "解决：排名和评论量落后",
        titleEn: "Solves: rank and review deficits",
        detailZh: "部署评论获取节奏、关键词优化和门店内容更新，让你在地图结果里持续上浮。",
        detailEn: "Installs review cadence, keyword optimization, and profile updates to lift local map visibility.",
        impactZh: "目标结果：提升地图曝光和来电咨询",
        impactEn: "Target outcome: more map impressions and inbound calls",
        weight:
          Math.max(0, 100 - dimReviews) * 0.45 +
          Math.max(0, 100 - dimRating) * 0.15 +
          Math.max(0, 100 - dimLocalSeo) * 0.4,
      },
      {
        id: "social-growth",
        service: "Social Media Growth Engine",
        titleZh: "解决：有菜品亮点但缺少稳定获客入口",
        titleEn: "Solves: good work but weak discovery flow",
        detailZh: "把招牌菜、环境与顾客场景转成短视频和图文流，持续引流到订位页、电话和点餐入口。",
        detailEn: "Turns signature dishes, dining moments, and guest proof into repeatable short-form traffic that feeds reservation links, calls, and orders.",
        impactZh: "目标结果：增加主动咨询和新客发现流量",
        impactEn: "Target outcome: more discovery traffic and DM-to-booking intent",
        weight:
          Math.max(0, 100 - dimConversion) * 0.35 +
          Math.max(0, 100 - dimLocalSeo) * 0.15 +
          Math.max(0, 100 - dimRecency) * 0.5,
      },
      {
        id: "conversion-system",
        service: "Phone + Local Mail Conversion System",
        titleZh: "解决：有流量但订位/来电转化低",
        titleEn: "Solves: traffic exists, reservations stay low",
        detailZh: "通过电话脚本、未接回拨、落地页与周边邮寄触达，把曝光变成可落座订单。",
        detailEn: "Combines phone scripts, missed-call recovery, landing-page fixes, and local mail campaigns to convert attention into reservations, orders, and visits.",
        impactZh: "目标结果：提升订位率、来电和客单收入",
        impactEn: "Target outcome: higher reservation rate, calls, and per-table revenue",
        weight: Math.max(0, 100 - dimConversion) * 0.7 + Math.max(0, 100 - dimSentiment) * 0.3,
      },
    ];
    var rankedSolutions = solutionCatalog
      .slice()
      .sort(function (a, b) {
        return b.weight - a.weight;
      })
      .map(function (item, idx) {
        var priority = idx === 0 ? (z ? "优先级 #1（建议先做）" : "Priority #1 (start here)") : idx === 1 ? (z ? "优先级 #2" : "Priority #2") : z ? "优先级 #3" : "Priority #3";
        return (
          '<article class="lb-rep-sol card"><p class="lb-rep-sol-tag">' +
          escapeHtml(item.service) +
          '</p><h3>' +
          escapeHtml(z ? item.titleZh : item.titleEn) +
          '</h3><p>' +
          escapeHtml(z ? item.detailZh : item.detailEn) +
          '</p><p class="lb-rep-sol-impact">' +
          escapeHtml(z ? item.impactZh : item.impactEn) +
          '</p><p class="lb-rep-sol-priority">' +
          escapeHtml(priority) +
          "</p></article>"
        );
      })
      .join("");
    var solutions =
      '<section class="lb-rep-section lb-rep-section--solutions"><h2 class="lb-rep-h">🧩 ' +
      (z ? "我们的产品如何直接修复你的增长漏洞" : "How our products solve your growth leaks") +
      '</h2><p class="lb-rep-lead">' +
      (z
        ? "不是泛泛营销服务，而是按你当前最弱维度自动排序的执行系统。"
        : "Not generic marketing services. These are auto-ranked by your weakest dimensions.") +
      '</p><div class="lb-rep-sol-grid">' +
      rankedSolutions +
      "</div></section>";

    var social =
      '<section class="lb-rep-section lb-rep-section--proof"><h2 class="lb-rep-h">💰 ' +
      (z ? "同类餐厅已在赢" : "Restaurants Like Yours Are Already Winning") +
      '</h2><div class="lb-rep-ba card"><div class="lb-rep-ba-col"><p class="lb-rep-ba-k">Before</p><p class="lb-rep-ba-v">120 reviews · #5</p></div><div class="lb-rep-ba-arrow">→</div><div class="lb-rep-ba-col"><p class="lb-rep-ba-k">After</p><p class="lb-rep-ba-v">340 reviews · #1</p></div></div><p class="lb-rep-quote">“We treated Maps like a sales funnel, not a brochure. Calls changed in two weeks.”</p><p class="lb-rep-disclaim">' +
      (z
        ? "*示例结果，非本店个案；基于聚合项目成果的教育性展示。"
        : "*Illustrative example — not this restaurant; educational aggregate outcome.") +
      "</p></section>";

    var talk = getPagePath(ROUTE_TALK);
    var tel = escapeHtml(MARKETING_COPY.digitalHumanPhoneHref || "tel:8776003082");
    var ctaBand =
      '<section class="lb-rep-cta-band" style="--lb-cta:' +
      escapeHtml(ac) +
      '"><div class="lb-rep-cta-inner card">' +
      '<p class="lb-rep-cta-scarcity">⏳ ' +
      (z
        ? "本季度每个区域深度陪跑名额有限（每区约 3 家），通常很快满额。"
        : "We only run deep hands-on optimization for ~3 restaurants per area each quarter, and spots fill fast.") +
      '</p><p class="lb-rep-cta-fomo">' +
      (z
        ? "你的同行正在持续累积评论与排名优势；再延迟 30 天，获客成本通常更高。"
        : "Peers are compounding review and ranking advantage weekly; waiting another 30 days usually makes recovery more expensive.") +
      '</p><a class="cta lb-rep-cta-primary" href="' +
      talk +
      '">' +
      (z ? "立即抢占本区域增长名额" : "Claim My Local Growth Slot Now") +
      '</a><p class="lb-rep-cta-micro">' +
      (z ? "约 30 秒，无需承诺；先看诊断方案再决定。" : "Takes 30 seconds. No commitment; review your diagnostic plan first.") +
      '</p><div class="lb-rep-cta-row"><a class="ghost lb-rep-cta-sec" href="' +
      talk +
      '">' +
      (z ? "领取：30 天 +30 条评论路线图" : "See: +30 Reviews in 30 Days Roadmap") +
      '</a><a class="ghost lb-rep-cta-sec" href="' +
      tel +
      '">' +
      (z ? "电话/短信：立即预约诊断" : "Call / text for a same-day diagnostic") +
      "</a></div></div></section>";

    var hero =
      '<header class="lb-rep-hero card" style="border-color:' +
      escapeHtml(abr) +
      ';background:linear-gradient(135deg,' +
      escapeHtml(al) +
      ',#fff 72%)">' +
      '<div class="lb-rep-hero-top"><p class="lb-rep-kicker">' +
      (z ? "增长诊断报告" : "Growth diagnosis report") +
      '</p><div class="lb-rep-badge" style="border-color:' +
      escapeHtml(abr) +
      ";color:" +
      escapeHtml(ac) +
      '"><span class="lb-rep-badge-e">' +
      escapeHtml(a.emoji || "") +
      '</span><span class="lb-rep-badge-l">' +
      escapeHtml(getLeaderboardLevelDisplayLabel(a, locPref)) +
      "</span></div></div>" +
      '<h1 class="lb-rep-title">' +
      heroTitle +
      '</h1><p class="lb-rep-sub">' +
      heroSub +
      '</p><p class="lb-rep-salonline"><strong>' +
      escapeHtml(String(salon.name || "")) +
      "</strong> · " +
      escapeHtml(String(salon.category || "")) +
      " · " +
      escapeHtml(String(salon.town || "")) +
      ", " +
      escapeHtml(String(salon.state || "")) +
      '</p><p class="lb-rep-addr">📍 ' +
      escapeHtml(String(salon.address || "")) +
      (salon.zipcode ? " · ZIP " + escapeHtml(String(salon.zipcode)) : "") +
      '</p><p class="lb-rep-phone">📞 ' +
      escapeHtml(String(salon.phone || "—")) +
      "</p></header>";

    return (
      hero +
      '<p class="lb-rep-disclaimer">' +
      escapeHtml(disc) +
      '</p><div class="lb-rep-impact">' +
      stat1 +
      stat2 +
      stat3 +
      "</div>" +
      scoreVisual +
      radarSection +
      metrics +
      generateLeaderboardAiSummaryHtml(salon, ranked, issues, a, locPref) +
      heatmapSection +
      compSection +
      '<section class="lb-rep-section"><h2 class="lb-rep-h">🚨 ' +
      (z ? "你正在错过什么（收入翻译）" : "What You're Missing (Revenue Translation)") +
      "</h2>" +
      missCards +
      "</section>" +
      solutions +
      plan +
      social +
      ctaBand
    );
  }

  function renderLeaderboardListPage() {
    if (state.leaderboardLoading) {
      return (
        '<div class="marketing-page lb-page">' +
        getMarketingNavHtml() +
        '<section class="lb-hero card"><p class="marketing-section-kicker">' +
        escapeHtml(MARKETING_UI.leaderboardAiKicker) +
        "</p>" +
        '<h1 class="marketing-title marketing-title-small">' +
        escapeHtml(MARKETING_UI.leaderboardLoadingTitle) +
        "</h1>" +
        "<p>" +
        escapeHtml(MARKETING_UI.leaderboardLoadingBody) +
        "</p></section>" +
        getMarketingFooterHtml() +
        "</div>"
      );
    }
    if (state.leaderboardError) {
      return (
        '<div class="marketing-page lb-page">' +
        getMarketingNavHtml() +
        '<section class="lb-hero card"><h1 class="marketing-title marketing-title-small">' +
        escapeHtml(MARKETING_UI.leaderboardErrorTitle) +
        "</h1>" +
        '<p class="intel-error">' +
        escapeHtml(state.leaderboardError) +
        "</p>" +
        '<p class="marketing-body">' +
        escapeHtml(MARKETING_UI.leaderboardSetupHint) +
        "</p>" +
        "</section>" +
        getMarketingFooterHtml() +
        "</div>"
      );
    }

    var countiesHtml = buildLeaderboardCountyOptionsHtml();
    var townshipsHtml = buildLeaderboardTownOptionsHtml();
    var catPills = getLeaderboardCategoryOptions().map(function (cat) {
      var active = state.leaderboardCategoryF === cat ? " is-active" : "";
      return (
        '<button type="button" class="lb-cat-pill' +
        active +
        '" data-lb-cat="' +
        escapeHtml(cat) +
        '">' +
        escapeHtml(cat) +
        "</button>"
      );
    }).join("");

    var stateOpts = getLeaderboardStateOptions().map(function (s) {
      return (
        '<option value="' +
        escapeHtml(s) +
        '"' +
        (state.leaderboardStateF === s ? " selected" : "") +
        ">" +
        escapeHtml(s) +
        "</option>"
      );
    }).join("");

    var filtered = getLeaderboardSalonsFiltered();

    return (
      '<div class="marketing-page lb-page">' +
      getMarketingNavHtml() +
      '<section class="lb-hero">' +
      '<p class="marketing-section-kicker">' +
      escapeHtml(MARKETING_UI.leaderboardHeroKicker) +
      "</p>" +
      '<h1 class="marketing-title">' +
      escapeHtml(MARKETING_UI.leaderboardHeroTitlePrefix) +
      '<span class="lb-hero-accent">' +
      escapeHtml(MARKETING_UI.leaderboardHeroTitleAccent) +
      "</span>" +
      escapeHtml(MARKETING_UI.leaderboardHeroTitleSuffix) +
      "</h1>" +
      '<p class="marketing-body marketing-body-wide lb-hero-sub">' +
      escapeHtml(MARKETING_UI.leaderboardHeroBody) +
      "</p>" +
      '<form id="leaderboardSearchForm" class="lb-search-form" role="search">' +
      '<div class="lb-search-inner">' +
      '<span class="lb-search-icon" aria-hidden="true">🔍</span>' +
      '<input id="leaderboardSearch" class="lb-search-input" type="search" name="q" placeholder="' +
      escapeHtml(MARKETING_UI.leaderboardSearchPlaceholder) +
      '" autocomplete="off" value="' +
      escapeHtml(state.leaderboardSearchQuery) +
      '" aria-label="' +
      escapeHtml(MARKETING_UI.leaderboardSearchAria) +
      '" />' +
      "</div>" +
      '<button type="submit" id="leaderboardSearchSubmit" class="lb-search-btn">' +
      escapeHtml(MARKETING_UI.leaderboardSearchButton) +
      "</button>" +
      "</form>" +
      '<p id="leaderboardLivePill" class="lb-live-pill">' +
      escapeHtml(MARKETING_UI.leaderboardLive) +
      "</p>" +
      '<div class="lb-hero-banner">' +
      '<p class="lb-preview-inline"><strong>' +
      escapeHtml(MARKETING_UI.leaderboardDirectoryKicker) +
      "</strong> " +
      escapeHtml(MARKETING_UI.leaderboardDirectoryBody) +
      ' <a class="landing-link" href="/login?next=' +
      encodeURIComponent("/leaderboard") +
      '">' +
      escapeHtml(MARKETING_UI.leaderboardSignInFull) +
      "</a>" +
      escapeHtml(MARKETING_UI.leaderboardDirectoryScorecardSuffix) +
      ' · <a class="landing-link" href="/leaderboard?state=NJ&county=Middlesex&town=Edison">' +
      escapeHtml(MARKETING_UI.leaderboardDirectorySampleHrefLabel) +
      "</a></p>" +
      '<button type="button" class="lb-hero-request" id="lbOpenRequestModal">' +
      escapeHtml(MARKETING_UI.leaderboardRequestListing) +
      "</button>" +
      "</div>" +
      "</section>" +
      '<section class="lb-toolbar card">' +
      '<div class="lb-toolbar-row">' +
      '<label class="lb-select-wrap">' +
      escapeHtml(MARKETING_UI.leaderboardState) +
      '<select id="leaderboardState" class="lb-select">' +
      stateOpts +
      "</select></label>" +
      '<label class="lb-select-wrap">' +
      escapeHtml(MARKETING_UI.leaderboardCounty) +
      '<select id="leaderboardCounty" class="lb-select">' +
      countiesHtml +
      "</select></label>" +
      '<label class="lb-select-wrap">' +
      escapeHtml(MARKETING_UI.leaderboardTownship) +
      '<select id="leaderboardTownship" class="lb-select">' +
      townshipsHtml +
      "</select></label>" +
      '<span class="lb-count">' +
      escapeHtml(String(filtered.length)) +
      " " +
      escapeHtml(MARKETING_UI.leaderboardSalonCount) +
      "</span></div>" +
      '<div class="lb-cat-row">' +
      catPills +
      "</div></section>" +
      (state.leaderboardRequestToast
        ? '<div class="lb-toast card" role="status">' + escapeHtml(state.leaderboardRequestToast) + "</div>"
        : "") +
      '<div class="lb-layout lb-layout--full">' +
      '<div class="lb-main">' +
      buildLeaderboardListBlockHtml() +
      "</div></div>" +
      buildLeaderboardRequestModalHtml() +
      getMarketingFooterHtml() +
      "</div>"
    );
  }

  function renderLeaderboardDetailPage() {
    if (!state.leaderboardDetail) {
      if (state.leaderboardLoading) {
        return (
          '<div class="marketing-page lb-page">' +
          getMarketingNavHtml() +
          '<p class="marketing-body">' +
          escapeHtml(MARKETING_UI.leaderboardScorecardLoading) +
          "</p>" +
          getMarketingFooterHtml() +
          "</div>"
        );
      }
      return (
        '<div class="marketing-page lb-page">' +
        getMarketingNavHtml() +
        '<section class="card lb-detail-error"><p>' +
        escapeHtml(state.leaderboardError || MARKETING_UI.leaderboardNotFound) +
        '</p><p><a class="landing-link" href="/leaderboard">' +
        escapeHtml(MARKETING_UI.leaderboardBack) +
        "</a></p></section>" +
        getMarketingFooterHtml() +
        "</div>"
      );
    }

    var salon = state.leaderboardDetail;
    var a = getLeaderboardAssessmentVisual(salon);
    var ac = a.color;
    var al = a.light;
    var abr = a.border;
    var am = a.mid || ac;
    var issues = generateLeaderboardIssues(salon);
    var ranked = rankSalonInCounty(salon, getLeaderboardSalonsInSameCounty(salon));

    var locPref = state.leaderboardLocale === "zh" ? "zh" : "en";
    var localeBarHtml =
      '<div class="lb-locale-bar" role="group" aria-label="AI summary language">' +
      '<span class="lb-locale-label">' +
      escapeHtml(locPref === "zh" ? "语言" : "Language") +
      '</span><div class="lb-locale-seg">' +
      '<button type="button" class="lb-locale-btn' +
      (locPref === "en" ? " is-active" : "") +
      '" data-lb-locale="en" aria-pressed="' +
      (locPref === "en" ? "true" : "false") +
      '">English</button>' +
      '<button type="button" class="lb-locale-btn' +
      (locPref === "zh" ? " is-active" : "") +
      '" data-lb-locale="zh" aria-pressed="' +
      (locPref === "zh" ? "true" : "false") +
      '">中文</button>' +
      "</div></div>";

    var growthReportHtml = buildLeaderboardGrowthReportHtml(salon, ranked, issues, a, locPref, ac, al, abr, am);

    return (
      '<div class="marketing-page lb-page lb-detail-page">' +
      getMarketingNavHtml() +
      '<div class="lb-detail-page-inner lb-detail-page-inner--report">' +
      '<div class="lb-detail-shell lb-detail-shell--report">' +
      '<div class="lb-detail-topbar">' +
      '<a class="ghost lb-back" href="/leaderboard">← ' +
      escapeHtml(MARKETING_UI.leaderboardTopLink) +
      "</a>" +
      '<span class="lb-detail-date">' +
      escapeHtml(
        new Date().toLocaleDateString(state.lang === "zh" ? "zh-CN" : "en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      ) +
      "</span></div>" +
      localeBarHtml +
      '<div class="lb-rep-body">' +
      growthReportHtml +
      "</div>" +
      '<footer class="lb-detail-cta lb-detail-cta--minimal" style="background:' +
      escapeHtml(ac) +
      '"><p>' +
      (locPref === "zh" ? "需要人工拆解你的 Google 漏斗？" : "Want a human teardown of your Google funnel?") +
      '</p><a class="cta lb-detail-phone-cta" href="' +
      escapeHtml(MARKETING_COPY.digitalHumanPhoneHref || "tel:8776003082") +
      '">877-600-3082</a>' +
      '<a class="ghost landing-link" style="color:#fff;border-color:rgba(255,255,255,.4)" href="' +
      getPagePath(ROUTE_TALK) +
      '">' +
      (locPref === "zh" ? "与 Ryan 对话" : "Talk to Ryan") +
      "</a></footer></div></div>" +
      getMarketingFooterHtml() +
      "</div>"
    );
  }

  function stopLeaderboardRealtime() {
    try {
      if (state.leaderboardSupabaseClient && state.leaderboardRealtimeChannel) {
        state.leaderboardSupabaseClient.removeChannel(state.leaderboardRealtimeChannel);
      }
    } catch (e) {
      /* ignore */
    }
    state.leaderboardRealtimeChannel = null;
    state.leaderboardSupabaseClient = null;
  }

  async function getLeaderboardFetchHeaders() {
    try {
      var cfgRes = await fetch("/api/runtime-config", { cache: "no-store" });
      var cfg = await cfgRes.json().catch(function () {
        return null;
      });
      if (!cfgRes.ok || !cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return {};
      if (!window.supabase || typeof window.supabase.createClient !== "function") return {};
      var client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      var sessionPromise = client.auth.getSession().catch(function () {
        return { data: { session: null } };
      });
      var timeoutMs = 3500;
      var timeoutPromise = new Promise(function (resolve) {
        setTimeout(function () {
          resolve({ data: { session: null } });
        }, timeoutMs);
      });
      var sessionRes = await Promise.race([sessionPromise, timeoutPromise]);
      var session = sessionRes && sessionRes.data && sessionRes.data.session;
      if (!session || !session.access_token) return {};
      return { Authorization: "Bearer " + session.access_token };
    } catch (e) {
      return {};
    }
  }

  /** Geo query for API list (state + county only; township filtered client-side so dropdown can list all towns). */
  function buildLeaderboardListQuerySuffix() {
    var st = String(state.leaderboardStateF || "").trim();
    var co = String(state.leaderboardCountyF || "").trim();
    if (st && st !== "All States" && co && co !== "All Counties") {
      return "?state=" + encodeURIComponent(st) + "&county=" + encodeURIComponent(co);
    }
    return "";
  }

  /** County-scoped list for scorecard rank context — avoids loading the entire directory when opening /leaderboard/:slug. */
  function buildLeaderboardContextQueryFromSalon(salon) {
    var st = String((salon && salon.state) || "").trim();
    var co = String((salon && salon.county) || "").trim();
    if (st && co) {
      return "?state=" + encodeURIComponent(st) + "&county=" + encodeURIComponent(co);
    }
    return "";
  }

  function loadScorecardContextSalons(authHeaders) {
    var salon = state.leaderboardDetail;
    if (!salon) return Promise.resolve();
    var qs = buildLeaderboardContextQueryFromSalon(salon);
    if (!qs) return Promise.resolve();
    return fetch("/api/leaderboard/salons" + qs, {
      cache: "no-store",
      headers: Object.assign({}, authHeaders || {}),
    })
      .then(function (res) {
        return res.json().then(function (payload) {
          return { res: res, payload: payload };
        });
      })
      .then(function (pair) {
        if (!pair.res.ok || !pair.payload || !Array.isArray(pair.payload.salons)) return;
        state.leaderboardSalons = pair.payload.salons;
        state.leaderboardPreviewScope = pair.payload.previewScope === "county" ? "county" : "global";
        renderLandingContent();
      })
      .catch(function () {});
  }

  /** Full query string for /leaderboard URL (includes township when set). */
  function buildLeaderboardPageSearch() {
    var st = String(state.leaderboardStateF || "").trim();
    var co = String(state.leaderboardCountyF || "").trim();
    var tw = String(state.leaderboardTownF || "").trim();
    var parts = [];
    if (st && st !== "All States") parts.push("state=" + encodeURIComponent(st));
    if (co && co !== "All Counties") parts.push("county=" + encodeURIComponent(co));
    if (tw && tw !== "All Townships") parts.push("town=" + encodeURIComponent(tw));
    return parts.length ? "?" + parts.join("&") : "";
  }

  function syncLeaderboardListUrl() {
    if (!isLeaderboardListRoute()) return;
    var suffix = buildLeaderboardPageSearch();
    if (window.location.pathname === "/leaderboard" && (window.location.search || "") !== suffix) {
      window.history.replaceState({}, "", "/leaderboard" + suffix);
    }
  }

  async function reloadLeaderboardGeoList() {
    if (!isLeaderboardListRoute()) return;
    try {
      var authHeaders = await getLeaderboardFetchHeaders();
      var response = await fetch("/api/leaderboard/salons" + buildLeaderboardListQuerySuffix(), {
        cache: "no-store",
        headers: Object.assign({}, authHeaders),
      });
      var payload = await response.json().catch(function () {
        return null;
      });
      if (!response.ok) return;
      state.leaderboardSalons = Array.isArray(payload && payload.salons) ? payload.salons : [];
      state.leaderboardVisibility = "full";
      state.leaderboardPreviewScope = payload.previewScope === "county" ? "county" : "global";
      state.leaderboardListSource = "geo";
      normalizeLeaderboardTownFilter();
      syncLeaderboardListUrl();
    } catch (e) {
      console.warn("[leaderboard] reload geo list", e);
    }
  }

  async function runLeaderboardSearchFetch() {
    if (!isLeaderboardListRoute()) return;
    var q = String(state.leaderboardSearchQuery || "").trim().slice(0, 120);
    if (!q) {
      await reloadLeaderboardGeoList();
      return;
    }
    try {
      var authHeaders = await getLeaderboardFetchHeaders();
      var response = await fetch("/api/leaderboard/salons?q=" + encodeURIComponent(q), {
        cache: "no-store",
        headers: Object.assign({}, authHeaders),
      });
      var payload = await response.json().catch(function () {
        return null;
      });
      if (!response.ok) return;
      state.leaderboardSalons = Array.isArray(payload && payload.salons) ? payload.salons : [];
      state.leaderboardVisibility = "full";
      state.leaderboardPreviewScope = "global";
      state.leaderboardListSource = "search";
      state.leaderboardListPage = 1;
    } catch (e) {
      console.warn("[leaderboard] search fetch", e);
    }
  }

  async function startLeaderboardRealtime() {
    stopLeaderboardRealtime();
    if (!isLeaderboardRoute()) return;
    try {
      var res = await fetch("/api/runtime-config", { cache: "no-store" });
      var cfg = await res.json().catch(function () {
        return null;
      });
      if (!res.ok || !cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
      if (!window.supabase || typeof window.supabase.createClient !== "function") return;
      var client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      state.leaderboardSupabaseClient = client;
      var channel = client
        .channel("salon-ai-leaderboard-rt")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "salon_ai_leaderboard" },
          function () {
            reloadLeaderboardDataQuiet().catch(function () {});
          },
        )
        .subscribe();
      state.leaderboardRealtimeChannel = channel;
    } catch (e) {
      console.warn("[leaderboard] realtime", e);
    }
  }

  async function reloadLeaderboardDataQuiet() {
    if (!isLeaderboardRoute()) return;
    try {
      if (isLeaderboardListRoute()) {
        var authHeaders = await getLeaderboardFetchHeaders();
        var response = await fetch("/api/leaderboard/salons" + buildLeaderboardListQuerySuffix(), {
          cache: "no-store",
          headers: Object.assign({}, authHeaders),
        });
        var payload = await response.json().catch(function () {
          return null;
        });
        if (!response.ok) return;
        state.leaderboardSalons = Array.isArray(payload && payload.salons) ? payload.salons : [];
        state.leaderboardVisibility = "full";
        if (payload.previewLimit != null) state.leaderboardPreviewLimit = Number(payload.previewLimit) || LEADERBOARD_PAGE_SIZE;
        state.leaderboardPreviewScope = payload.previewScope === "county" ? "county" : "global";
        state.leaderboardListSource = "geo";
        normalizeLeaderboardTownFilter();
        syncLeaderboardListUrl();
        refreshLeaderboardGrid();
        var pill = document.getElementById("leaderboardLivePill");
        if (pill) pill.textContent = MARKETING_UI.leaderboardLiveUpdated;
      } else if (isLeaderboardSalonRoute()) {
        var slugQ = String(state.storeSlug || "").trim();
        var r2q = await fetch("/api/leaderboard/salons?slug=" + encodeURIComponent(slugQ), {
          cache: "no-store",
        });
        var p2q = await r2q.json().catch(function () {
          return null;
        });
        if (r2q.ok && p2q && p2q.salon) {
          state.leaderboardDetail = p2q.salon;
          state.leaderboardVisibility = "full";
          if (p2q.previewLimit != null) state.leaderboardPreviewLimit = Number(p2q.previewLimit) || LEADERBOARD_PAGE_SIZE;
          renderLandingContent();
          getLeaderboardFetchHeaders().then(function (authHeaders) {
            loadScorecardContextSalons(authHeaders);
          });
        }
      }
    } catch (e) {
      /* ignore */
    }
  }

  async function loadLeaderboardPlatform() {
    if (!isLeaderboardRoute()) return;

    state.leaderboardError = "";
    try {
      if (isLeaderboardListRoute()) {
        var authHeaders = await getLeaderboardFetchHeaders();
        var response = await fetch("/api/leaderboard/salons" + buildLeaderboardListQuerySuffix(), {
          cache: "no-store",
          headers: Object.assign({}, authHeaders),
        });
        var payload = await response.json().catch(function () {
          return null;
        });
        if (!response.ok) {
          var msg =
            payload && payload.error && payload.error.message
              ? payload.error.message
              : "Could not load leaderboard (" + response.status + ").";
          throw new Error(msg);
        }
        state.leaderboardSalons = Array.isArray(payload && payload.salons) ? payload.salons : [];
        state.leaderboardVisibility = "full";
        state.leaderboardPreviewLimit =
          payload.previewLimit != null ? Number(payload.previewLimit) || LEADERBOARD_PAGE_SIZE : LEADERBOARD_PAGE_SIZE;
        state.leaderboardPreviewScope = payload.previewScope === "county" ? "county" : "global";
        state.leaderboardListSource = "geo";
        normalizeLeaderboardTownFilter();
        syncLeaderboardListUrl();
      } else {
        var slug = String(state.storeSlug || "").trim();
        if (!slug) {
          throw new Error("Missing restaurant.");
        }
        var slugUrl = "/api/leaderboard/salons?slug=" + encodeURIComponent(slug);
        var r2 = await fetch(slugUrl, { cache: "no-store" });
        var p2 = await r2.json().catch(function () {
          return null;
        });
        if (!r2.ok) {
          var code = p2 && p2.error && p2.error.code ? String(p2.error.code) : "";
          var msg2 =
            p2 && p2.error && p2.error.message ? p2.error.message : "Could not load restaurant (" + r2.status + ").";
          if (code === "LEADERBOARD_PREVIEW_ONLY" || r2.status === 404) {
            throw new Error(
              state.lang === "zh" ? "未在榜单上找到该餐厅。请从排行榜返回或更换链接。" : "We could not load this scorecard. Go back to the leaderboard or try another link.",
            );
          }
          throw new Error(msg2);
        }
        state.leaderboardDetail = p2.salon;
        state.leaderboardVisibility = "full";
        if (p2.previewLimit != null) state.leaderboardPreviewLimit = Number(p2.previewLimit) || LEADERBOARD_PAGE_SIZE;
        if (!state.leaderboardDetail) {
          throw new Error(MARKETING_UI.leaderboardNotFound);
        }
        state.leaderboardLoading = false;
        getLeaderboardFetchHeaders().then(function (authHeaders) {
          loadScorecardContextSalons(authHeaders);
        });
        startLeaderboardRealtime().catch(function (e) {
          console.warn("[leaderboard] realtime", e);
        });
      }
      if (isLeaderboardListRoute()) {
        await startLeaderboardRealtime();
      }
    } catch (err) {
      console.error(err);
      state.leaderboardError = (err && err.message) || "Unexpected leaderboard error.";
    } finally {
      state.leaderboardLoading = false;
    }
  }

  function bindLeaderboardUiDelegation() {
    if (state.leaderboardListDelegationBound) return;
    state.leaderboardListDelegationBound = true;
    document.addEventListener("input", function (ev) {
      if (!ev || !ev.target || ev.target.id !== "leaderboardSearch") return;
      state.leaderboardSearchQuery = ev.target.value;
      state.leaderboardListPage = 1;
      var qIn = String(state.leaderboardSearchQuery || "").trim();
      if (!qIn && state.leaderboardListSource === "search") {
        reloadLeaderboardGeoList().then(function () {
          renderLandingContent();
        });
        return;
      }
      refreshLeaderboardGrid();
    });
    document.addEventListener("submit", function (ev) {
      var form = ev && ev.target;
      if (!form || form.id !== "leaderboardSearchForm") return;
      if (!isLeaderboardListRoute()) return;
      ev.preventDefault();
      var inp = document.getElementById("leaderboardSearch");
      state.leaderboardSearchQuery = inp && inp.value != null ? inp.value : "";
      state.leaderboardListPage = 1;
      var qSub = String(state.leaderboardSearchQuery || "").trim();
      if (!qSub) {
        reloadLeaderboardGeoList().then(function () {
          renderLandingContent();
        });
        return;
      }
      runLeaderboardSearchFetch().then(function () {
        renderLandingContent();
      });
    });
    document.addEventListener("change", function (ev) {
      if (!ev || !ev.target) return;
      if (ev.target.id === "leaderboardState") {
        state.leaderboardStateF = ev.target.value;
        state.leaderboardCountyF = "All Counties";
        state.leaderboardTownF = "All Townships";
        state.leaderboardListPage = 1;
        state.leaderboardLoading = true;
        renderLandingContent();
        loadLeaderboardPlatform()
          .then(function () {
            renderLandingContent();
            syncLeaderboardListUrl();
          })
          .catch(function (e) {
            console.error(e);
            state.leaderboardError = (e && e.message) || "Could not reload leaderboard.";
            renderLandingContent();
          });
        return;
      }
      if (ev.target.id === "leaderboardCounty") {
        state.leaderboardCountyF = ev.target.value;
        state.leaderboardTownF = "All Townships";
        state.leaderboardListPage = 1;
        state.leaderboardLoading = true;
        renderLandingContent();
        loadLeaderboardPlatform()
          .then(function () {
            renderLandingContent();
            syncLeaderboardListUrl();
          })
          .catch(function (e) {
            console.error(e);
            state.leaderboardError = (e && e.message) || "Could not reload leaderboard.";
            renderLandingContent();
          });
        return;
      }
      if (ev.target.id === "leaderboardTownship") {
        state.leaderboardTownF = ev.target.value;
        state.leaderboardListPage = 1;
        syncLeaderboardListUrl();
        refreshLeaderboardGrid();
        return;
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (!ev || ev.key !== "Escape") return;
      if (state.leaderboardRequestModalOpen && isLeaderboardListRoute()) {
        state.leaderboardRequestModalOpen = false;
        renderLandingContent();
        return;
      }
      if (isLeaderboardListRoute()) {
        closeAllLeaderboardCardMenus();
      }
    });
    document.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var pageBtn = t.closest("[data-lb-page]");
      if (pageBtn && isLeaderboardListRoute()) {
        if (pageBtn.disabled) return;
        var dir = pageBtn.getAttribute("data-lb-page") || "";
        var all = getLeaderboardSalonsFiltered();
        var totalPages = Math.max(1, Math.ceil(all.length / LEADERBOARD_PAGE_SIZE));
        if (dir === "prev" && state.leaderboardListPage > 1) {
          state.leaderboardListPage -= 1;
          refreshLeaderboardGrid();
        } else if (dir === "next" && state.leaderboardListPage < totalPages) {
          state.leaderboardListPage += 1;
          refreshLeaderboardGrid();
        }
        return;
      }
      if (t.id === "lbOpenRequestModal" || (t.closest && t.closest("#lbOpenRequestModal"))) {
        state.leaderboardRequestModalOpen = true;
        renderLandingContent();
        return;
      }
      if (t.closest("[data-lb-close-request-modal]")) {
        state.leaderboardRequestModalOpen = false;
        renderLandingContent();
        return;
      }
      var menuBtn = t.closest("[data-lb-card-menu-btn]");
      if (menuBtn && isLeaderboardListRoute()) {
        ev.preventDefault();
        var wrap = menuBtn.closest(".lb-card-menu-wrap");
        if (!wrap) return;
        var pop = wrap.querySelector("[data-lb-card-menu-popover]");
        var others = document.querySelectorAll(".lb-card-menu-wrap");
        for (var mi = 0; mi < others.length; mi += 1) {
          var w = others[mi];
          if (w === wrap) continue;
          w.classList.remove("is-open");
          var b0 = w.querySelector("[data-lb-card-menu-btn]");
          var p0 = w.querySelector("[data-lb-card-menu-popover]");
          if (b0) b0.setAttribute("aria-expanded", "false");
          if (p0) p0.hidden = true;
        }
        var nextOpen = !wrap.classList.contains("is-open");
        wrap.classList.toggle("is-open", nextOpen);
        menuBtn.setAttribute("aria-expanded", nextOpen ? "true" : "false");
        if (pop) pop.hidden = !nextOpen;
        return;
      }
      var shareBtn = t.closest("[data-lb-share-salon]");
      if (shareBtn && isLeaderboardListRoute()) {
        ev.preventDefault();
        var shareUrl0 = shareBtn.getAttribute("data-lb-share-url") || "";
        var shareTitle0 = shareBtn.getAttribute("data-lb-share-title") || "";
        shareOrCopyLeaderboardSalon(shareUrl0, shareTitle0);
        return;
      }
      var locPick = t.closest("[data-lb-locale]");
      if (locPick && isLeaderboardSalonRoute()) {
        var nl = String(locPick.getAttribute("data-lb-locale") || "").toLowerCase();
        if (nl === "en" || nl === "zh") {
          state.leaderboardLocale = nl;
          try {
            localStorage.setItem("leaderboardLocale", nl);
          } catch (e2) {
            /* ignore */
          }
          renderLandingContent();
        }
        return;
      }
      var cat = t.closest("[data-lb-cat]");
      if (cat) {
        state.leaderboardCategoryF = cat.getAttribute("data-lb-cat") || "All Categories";
        state.leaderboardListPage = 1;
        renderLandingContent();
      }
      var tab = t.closest("[data-lb-tab]");
      if (tab) {
        state.leaderboardDetailTab = tab.getAttribute("data-lb-tab") || "overview";
        renderLandingContent();
      }
      if (isLeaderboardListRoute() && !t.closest(".lb-card-menu-wrap")) {
        closeAllLeaderboardCardMenus();
      }
    });
    document.addEventListener("submit", function (ev) {
      if (!ev || !ev.target || ev.target.id !== "leaderboardRequestForm") return;
      ev.preventDefault();
      if (state.leaderboardRequestBusy) return;
      var form = ev.target;
      var fd = new FormData(form);
      var body = {
        salon_name: fd.get("salon_name"),
        contact_name: fd.get("contact_name"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        address: fd.get("address"),
        message: fd.get("message"),
        request_kind: fd.get("request_kind") || "add_store",
      };
      var statusEl = document.getElementById("leaderboardRequestStatus");
      state.leaderboardRequestBusy = true;
      if (statusEl) statusEl.textContent = MARKETING_UI.leaderboardRequestSending;
      fetch("/api/leaderboard/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, json: j };
          });
        })
        .then(function (res) {
          if (!res.ok || !res.json || !res.json.ok) {
            var msg =
              res.json && res.json.error && res.json.error.message
                ? res.json.error.message
                : MARKETING_UI.leaderboardRequestFailed;
            throw new Error(msg);
          }
          form.reset();
          state.leaderboardRequestModalOpen = false;
          state.leaderboardRequestToast = MARKETING_UI.leaderboardRequestThanks;
          renderLandingContent();
          setTimeout(function () {
            state.leaderboardRequestToast = "";
            if (isLeaderboardListRoute()) renderLandingContent();
          }, 4500);
        })
        .catch(function (e) {
          if (statusEl) statusEl.textContent = (e && e.message) || MARKETING_UI.leaderboardRequestCouldNotSend;
        })
        .finally(function () {
          state.leaderboardRequestBusy = false;
        });
    });
  }

  function clearSmsFunnelPing() {
    if (smsFunnelPingTimer) {
      clearInterval(smsFunnelPingTimer);
      smsFunnelPingTimer = null;
    }
  }

  async function postSmsFunnelSiteEvents(slug, events, salonName) {
    var s = String(slug || "").trim();
    if (!s || !events || !events.length) return;
    try {
      if (!smsFunnelRuntimeCfg) {
        var cfgRes = await fetch("/api/runtime-config", { cache: "no-store" });
        smsFunnelRuntimeCfg = await cfgRes.json().catch(function () {
          return null;
        });
      }
      var token =
        smsFunnelRuntimeCfg && smsFunnelRuntimeCfg.smsFunnelBeaconToken
          ? String(smsFunnelRuntimeCfg.smsFunnelBeaconToken)
          : "";
      var headers = { "Content-Type": "application/json" };
      if (token) headers["X-Sms-Beacon-Token"] = token;
      var res = await fetch("/api/sms-funnel-events", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          slug: s,
          salonName: String(salonName || ""),
          events: events,
        }),
      });
      if (!res.ok) {
        var errTxt = "";
        try {
          errTxt = await res.text();
        } catch (eRead) {
          errTxt = "";
        }
        console.warn(
          "[sms-funnel-events] http_" + res.status,
          (errTxt && errTxt.slice(0, 240)) || "",
        );
        if (res.status === 403) {
          smsFunnelRuntimeCfg = null;
        }
      }
    } catch (e) {
      console.warn("[sms-funnel-events]", e);
    }
  }

  function startSmsFunnelPing(slug, salonNameForPing) {
    clearSmsFunnelPing();
    var s = String(slug || "").trim();
    if (!s) return;
    var opened = Date.now();
    var nm0 = String(salonNameForPing || "");
    smsFunnelPingTimer = setInterval(function () {
      if (!isAnalysisSalonRoute()) {
        clearSmsFunnelPing();
        return;
      }
      var sec = Math.floor((Date.now() - opened) / 1000);
      var nm =
        nm0 ||
        (state.intelDetail && state.intelDetail.salon && state.intelDetail.salon.name
          ? String(state.intelDetail.salon.name)
          : "");
      postSmsFunnelSiteEvents(s, [{ type: "report_ping", dwell_seconds: sec }], nm);
    }, 30000);
  }

  function bindSmsFunnelVisibilityOnce() {
    if (smsFunnelVisibilityBound) return;
    smsFunnelVisibilityBound = true;
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "hidden") return;
      if (!isAnalysisSalonRoute()) return;
      var s = String(state.storeSlug || "").trim();
      if (!s) return;
      var vnm =
        state.intelDetail && state.intelDetail.salon && state.intelDetail.salon.name
          ? String(state.intelDetail.salon.name)
          : "";
      postSmsFunnelSiteEvents(s, [{ type: "report_visibility_hidden" }], vnm);
    });
  }

  function resetSmsFunnelScrollMarks() {
    smsFunnelScrollMarks = {};
  }

  function bindSmsFunnelScrollOnce() {
    if (smsFunnelScrollBound) return;
    smsFunnelScrollBound = true;
    var scrollTicking = false;
    window.addEventListener(
      "scroll",
      function () {
        if (scrollTicking) return;
        scrollTicking = true;
        window.requestAnimationFrame(function () {
          scrollTicking = false;
          if (!isAnalysisSalonRoute()) return;
          var s = String(state.storeSlug || "").trim();
          if (!s) return;
          var el = document.documentElement;
          var scrollTop = el.scrollTop || (document.body && document.body.scrollTop) || 0;
          var denom = Math.max(1, el.scrollHeight - el.clientHeight);
          var pct = Math.round((scrollTop / denom) * 100);
          var milestones = [25, 50, 75, 100];
          var salonNm =
            state.intelDetail && state.intelDetail.salon && state.intelDetail.salon.name
              ? String(state.intelDetail.salon.name)
              : "";
          for (var si = 0; si < milestones.length; si += 1) {
            var m = milestones[si];
            if (pct < m || smsFunnelScrollMarks[m]) continue;
            smsFunnelScrollMarks[m] = true;
            postSmsFunnelSiteEvents(s, [{ type: "report_scroll", scroll_depth_pct: m }], salonNm).catch(function () {});
          }
        });
      },
      { passive: true },
    );
  }

  async function loadIntelPlatform() {
    if (!isAnalysisRoute()) return;

    clearSmsFunnelPing();
    state.intelError = "";
    try {
      if (isAnalysisListRoute()) {
        state.intelSalons = [];
        state.intelListSearchLoading = false;
        state.intelListPage = 1;
        state.intelListTotal = 0;
        await loadIntelSalonList();
      } else if (isAnalysisSalonRoute() || isAnalysisFullRoute()) {
        const slug = String(state.storeSlug || "").trim();
        if (!slug) {
          throw new Error("Missing restaurant slug.");
        }
        const response = await fetch("/api/intel/salons/" + encodeURIComponent(slug), { cache: "no-store" });
        const payload = await response.json().catch(function () {
          return null;
        });
        if (!response.ok) {
          const msg =
            payload && payload.error && payload.error.message
              ? payload.error.message
              : "Could not load restaurant report (" + response.status + ").";
          throw new Error(msg);
        }
        state.intelDetail = payload;
        var salonNm = "";
        if (payload && payload.salon && payload.salon.name) salonNm = String(payload.salon.name);
        bindSmsFunnelVisibilityOnce();
        bindSmsFunnelScrollOnce();
        resetSmsFunnelScrollMarks();
        postSmsFunnelSiteEvents(
          slug,
          [{ type: "report_view", path: String(window.location.pathname || "") }],
          salonNm,
        ).catch(function () {});
        startSmsFunnelPing(slug, salonNm);
      }
    } catch (err) {
      console.error(err);
      state.intelError = (err && err.message) || "Unexpected error loading reports.";
    } finally {
      state.intelLoading = false;
    }
  }

  function renderIntelBenchmarkBarRow(label, valueLabel, widthPct, tone) {
    var fillClass = "marketing-report-bar-fill";
    if (tone === "you") fillClass += " marketing-report-bar-fill-you";
    else if (tone === "median") fillClass += " marketing-report-bar-fill-median";
    else if (tone === "top") fillClass += " marketing-report-bar-fill-top";

    return (
      '<div class="marketing-report-bar-row">' +
      '<div class="marketing-report-bar-head">' +
      '<span class="marketing-report-bar-label">' +
      escapeHtml(label) +
      "</span>" +
      '<span class="marketing-report-bar-value">' +
      escapeHtml(valueLabel) +
      "</span>" +
      "</div>" +
      '<div class="marketing-report-bar-track">' +
      '<div class="' +
      fillClass +
      '" style="width:' +
      String(Math.round(widthPct)) +
      '%;"></div>' +
      "</div>" +
      "</div>"
    );
  }

  function renderIntelListPage() {
    if (state.intelLoading) {
      return (
        '<div class="marketing-page marketing-page-intel">' +
        getMarketingNavHtml() +
        '<section class="intel-report-hero card">' +
        '<p class="marketing-section-kicker">' +
        escapeHtml(MARKETING_UI.analysisKicker) +
        "</p>" +
        '<h1 class="marketing-title marketing-title-small">' +
        escapeHtml(MARKETING_UI.analysisTitle) +
        "</h1>" +
        '<p class="marketing-body">' +
        escapeHtml(MARKETING_UI.analysisLoadingBody) +
        "</p>" +
        "</section>" +
        getMarketingFooterHtml() +
        "</div>"
      );
    }

    if (state.intelError) {
      return (
        '<div class="marketing-page marketing-page-intel">' +
        getMarketingNavHtml() +
        '<section class="intel-report-hero card">' +
        '<p class="marketing-section-kicker">' +
        escapeHtml(MARKETING_UI.analysisKicker) +
        "</p>" +
        '<h1 class="marketing-title marketing-title-small">' +
        escapeHtml(MARKETING_UI.analysisTitle) +
        "</h1>" +
        '<p class="marketing-body intel-error">' +
        escapeHtml(state.intelError) +
        "</p>" +
        '<p class="marketing-body intel-error-hint">' +
        escapeHtml(MARKETING_UI.analysisFreshDbHint) +
        "</p>" +
        "</section>" +
        getMarketingFooterHtml() +
        "</div>"
      );
    }

    var rows = buildIntelTableRowsHtml(getIntelSalonsFiltered());
    var geoLine =
      '<p class="marketing-body intel-geo-label">' +
      escapeHtml(MARKETING_UI.analysisGeoLabel) +
      ' <strong>' +
      escapeHtml(intelGeoDisplayLabel()) +
      "</strong></p>";

    return (
      '<div class="marketing-page marketing-page-intel">' +
      getMarketingNavHtml() +
      '<section class="intel-report-hero card">' +
      '<p class="marketing-section-kicker">' +
      escapeHtml(MARKETING_UI.analysisKicker) +
      "</p>" +
      '<h1 class="marketing-title marketing-title-small">' +
      escapeHtml(MARKETING_UI.analysisTitle) +
      "</h1>" +
      '<p class="marketing-body marketing-body-wide">' +
      escapeHtml(MARKETING_UI.analysisBody) +
      "</p>" +
      geoLine +
      "</section>" +
      '<section class="intel-search-toolbar card">' +
      '<div class="intel-search-row">' +
      '<div class="intel-search-field">' +
      '<label class="intel-search-label" for="intelSalonSearch">' +
      escapeHtml(MARKETING_UI.analysisSearchLabel) +
      "</label>" +
      '<input id="intelSalonSearch" class="intel-search-input" type="search" autocomplete="off" placeholder="' +
      escapeHtml(MARKETING_UI.analysisSearchPlaceholder) +
      '" value="' +
      escapeHtml(state.intelSearchQuery) +
      '" />' +
      "</div>" +
      '<a class="intel-list-cta" href="' +
      getPagePath(ROUTE_TALK) +
      '">' +
      escapeHtml(MARKETING_UI.analysisTalkListing) +
      "</a>" +
      "</div>" +
      "</section>" +
      '<section class="intel-table-card card">' +
      '<div class="intel-table-wrap">' +
      '<table class="intel-table" aria-label="' +
      escapeHtml(MARKETING_UI.analysisTableLabel) +
      '">' +
      "<thead><tr>" +
      "<th>" +
      escapeHtml(MARKETING_UI.analysisThSalon) +
      "</th><th>" +
      escapeHtml(MARKETING_UI.analysisThAddress) +
      "</th><th>" +
      escapeHtml(MARKETING_UI.analysisThRating) +
      "</th><th>" +
      escapeHtml(MARKETING_UI.analysisThReviews) +
      "</th><th>" +
      escapeHtml(MARKETING_UI.analysisThScore) +
      "</th>" +
      "</tr></thead>" +
      '<tbody id="intelSalonTableBody">' +
      rows +
      "</tbody></table>" +
      "</div>" +
      buildIntelPaginationHtml() +
      "</section>" +
      getMarketingFooterHtml() +
      "</div>"
    );
  }

  function briefScoreLabel(score) {
    if (score >= 75) return MARKETING_UI.briefScoreGood;
    if (score >= 50) return MARKETING_UI.briefScoreFair;
    return MARKETING_UI.briefScoreWeak;
  }

  function briefScoreColor(score) {
    var root = document.documentElement;
    var styles = root ? getComputedStyle(root) : null;
    var pick = function (name, fallback) {
      if (!styles) return fallback;
      var v = styles.getPropertyValue(name).trim();
      return v || fallback;
    };
    if (score >= 75) return pick("--rms-score-good", "#0f6e56");
    if (score >= 50) return pick("--rms-score-fair", "#b45309");
    return pick("--rms-score-weak", "#a32d2d");
  }

  function briefPotentialLabel(level) {
    if (level === "high") return MARKETING_UI.briefPotentialHigh;
    if (level === "medium") return MARKETING_UI.briefPotentialMedium;
    return MARKETING_UI.briefPotentialLow;
  }

  function renderBriefScoreRing(score) {
    var r = 36;
    var circ = 2 * Math.PI * r;
    var offset = circ - (score / 100) * circ;
    var color = briefScoreColor(score);
    return (
      '<svg class="intel-brief-score-ring" width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">' +
      '<circle cx="44" cy="44" r="' +
      String(r) +
      '" fill="none" stroke="#F3F4F6" stroke-width="9" />' +
      '<circle cx="44" cy="44" r="' +
      String(r) +
      '" fill="none" stroke="' +
      color +
      '" stroke-width="9" stroke-dasharray="' +
      String(circ) +
      '" stroke-dashoffset="' +
      String(offset) +
      '" stroke-linecap="round" transform="rotate(-90 44 44)" />' +
      '<text x="44" y="48" text-anchor="middle" font-size="19" font-weight="500" fill="#111827">' +
      escapeHtml(String(Math.round(score))) +
      "</text>" +
      '<text x="44" y="62" text-anchor="middle" font-size="10" fill="#9CA3AF">/ 100</text>' +
      "</svg>"
    );
  }

  function renderSalonBriefReportHtml(data) {
    var generatedDate = "";
    try {
      var dateLocale = state.lang === "zh" ? "zh-CN" : "en-US";
      generatedDate = new Date(data.generatedAt).toLocaleDateString(dateLocale, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch (errBriefDate) {
      generatedDate = String(data.generatedAt || "").slice(0, 10);
    }

    var metricCards =
      '<div class="intel-brief-metrics">' +
      '<article class="intel-brief-metric"><p class="intel-brief-metric-label">★ ' +
      escapeHtml(MARKETING_UI.briefMetricRating) +
      '</p><p class="intel-brief-metric-value">' +
      escapeHtml(Number(data.rating).toFixed(1)) +
      '</p><p class="intel-brief-metric-sub">' +
      escapeHtml(MARKETING_UI.briefGoogleMaps) +
      "</p></article>" +
      '<article class="intel-brief-metric"><p class="intel-brief-metric-label">' +
      escapeHtml(MARKETING_UI.briefMetricReviews) +
      '</p><p class="intel-brief-metric-value">' +
      escapeHtml(String(data.reviewCount)) +
      '</p><p class="intel-brief-metric-sub">' +
      escapeHtml(MARKETING_UI.briefTotalReviews) +
      "</p></article>" +
      '<article class="intel-brief-metric"><p class="intel-brief-metric-label">' +
      escapeHtml(MARKETING_UI.briefMetricRank) +
      '</p><p class="intel-brief-metric-value">#' +
      escapeHtml(String(data.localRank)) +
      '</p><p class="intel-brief-metric-sub">' +
      escapeHtml(MARKETING_UI.briefLocalArea) +
      "</p></article>" +
      '<article class="intel-brief-metric"><p class="intel-brief-metric-label">' +
      escapeHtml(MARKETING_UI.briefMetricPhotos) +
      '</p><p class="intel-brief-metric-value">' +
      escapeHtml(String(data.photoCount)) +
      '</p><p class="intel-brief-metric-sub">' +
      escapeHtml(MARKETING_UI.briefOnProfile) +
      "</p></article></div>";

    var scoreRows = (data.scoreItems || [])
      .map(function (item, i, arr) {
        var label = briefScoreLabel(item.score);
        var color = briefScoreColor(item.score);
        var badgeClass =
          label === MARKETING_UI.briefScoreGood
            ? "intel-brief-badge--success"
            : label === MARKETING_UI.briefScoreFair
              ? "intel-brief-badge--warning"
              : "intel-brief-badge--danger";
        return (
          '<div class="intel-brief-score-row' +
          (i < arr.length - 1 ? " intel-brief-score-row--border" : "") +
          '"><span class="intel-brief-score-label">' +
          escapeHtml(item.label) +
          '</span><div class="intel-brief-score-right"><div class="intel-brief-bar-track"><div class="intel-brief-bar-fill" style="width:' +
          String(item.score) +
          "%;background:" +
          color +
          ';"></div></div><span class="intel-brief-score-num">' +
          escapeHtml(String(item.score)) +
          '</span><span class="intel-brief-badge ' +
          badgeClass +
          '">' +
          escapeHtml(label) +
          "</span></div></div>"
        );
      })
      .join("");

    var serviceRows = (data.services || [])
      .map(function (svc) {
        var pillClass =
          svc.level === "high"
            ? "intel-brief-potential--high"
            : svc.level === "medium"
              ? "intel-brief-potential--medium"
              : "intel-brief-potential--low";
        return (
          '<div class="intel-brief-service-row"><span>' +
          escapeHtml(svc.name) +
          '</span><span class="intel-brief-potential ' +
          pillClass +
          '">' +
          escapeHtml(briefPotentialLabel(svc.level)) +
          "</span></div>"
        );
      })
      .join("");

    var ctaBody = String(MARKETING_UI.briefCtaBody)
      .replace("{critical}", String(data.criticalIssues))
      .replace("{quickWins}", String(data.quickWins))
      .replace("{rank}", String(data.localRank));

    var ctaFeatures = [
      MARKETING_UI.briefCtaFeature1,
      MARKETING_UI.briefCtaFeature2,
      MARKETING_UI.briefCtaFeature3,
      MARKETING_UI.briefCtaFeature4,
      MARKETING_UI.briefCtaFeature5,
      MARKETING_UI.briefCtaFeature6,
    ]
      .map(function (f) {
        return '<span class="intel-brief-cta-feature"><span aria-hidden="true">✓</span> ' + escapeHtml(f) + "</span>";
      })
      .join("");

    var fullReportCheckoutUrl = FULL_REPORT_SHOPIFY_CHECKOUT_URL;

    var briefHeader =
      '<header class="intel-brief-header">' +
      '<div class="intel-brief-header-main">' +
      '<div class="intel-brief-badges"><span class="intel-brief-badge intel-brief-badge--info">' +
      escapeHtml(MARKETING_UI.briefReportKicker) +
      '</span><span class="intel-brief-preview">' +
      escapeHtml(MARKETING_UI.briefReportPreview) +
      "</span></div>" +
      "<h1>" +
      escapeHtml(data.businessName) +
      "</h1>" +
      '<p class="intel-brief-location"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg> ' +
      escapeHtml(data.location) +
      " · " +
      escapeHtml(data.category) +
      "</p></div>" +
      '<div class="intel-brief-generated"><p>' +
      escapeHtml(MARKETING_UI.briefReportGenerated) +
      "</p><p>" +
      escapeHtml(generatedDate) +
      "</p></div></header>";

    var briefOverall =
      '<p class="intel-brief-section-label">' +
      escapeHtml(MARKETING_UI.briefOverallHealth) +
      "</p>" +
      '<section class="intel-brief-overall card">' +
      '<div class="intel-brief-overall-inner">' +
      renderBriefScoreRing(data.overallScore) +
      '<div class="intel-brief-overall-copy"><p class="intel-brief-overall-title">' +
      escapeHtml(data.overallLabel) +
      "</p><p class=\"intel-brief-overall-summary\">" +
      escapeHtml(data.overallSummary) +
      '</p><div class="intel-brief-issue-badges"><span class="intel-brief-badge intel-brief-badge--danger">⚠ ' +
      escapeHtml(String(data.criticalIssues)) +
      " " +
      escapeHtml(MARKETING_UI.briefCriticalIssues) +
      '</span><span class="intel-brief-badge intel-brief-badge--warning">✦ ' +
      escapeHtml(String(data.quickWins)) +
      " " +
      escapeHtml(MARKETING_UI.briefQuickWins) +
      "</span></div></div></div></section>";

    var briefMetrics =
      '<p class="intel-brief-section-label">' +
      escapeHtml(MARKETING_UI.briefKeyMetrics) +
      "</p>" +
      metricCards;

    var briefScorecard =
      '<p class="intel-brief-section-label">' +
      escapeHtml(MARKETING_UI.briefScorecard) +
      "</p>" +
      '<section class="intel-brief-scorecard card">' +
      scoreRows +
      "</section>";

    var briefGrowth =
      '<p class="intel-brief-section-label">' +
      escapeHtml(MARKETING_UI.briefGrowthPotential) +
      "</p>" +
      '<section class="intel-brief-growth card"><div class="intel-brief-services">' +
      serviceRows +
      '</div><p class="intel-brief-locked"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> ' +
      escapeHtml(MARKETING_UI.briefGrowthLocked) +
      "</p></section>";

    var briefCompetitors =
      '<p class="intel-brief-section-label">' +
      escapeHtml(MARKETING_UI.briefCompetitors) +
      "</p>" +
      '<section class="intel-brief-competitors card">' +
      '<div class="intel-brief-competitors-blur" aria-hidden="true">' +
      '<div class="intel-brief-competitor-row"><span>Top Competitor #1</span><span>★ 4.9 · 312 reviews</span></div>' +
      '<div class="intel-brief-competitor-row"><span>Top Competitor #2</span><span>★ 4.8 · 245 reviews</span></div>' +
      '<div class="intel-brief-competitor-row"><span>Top Competitor #3</span><span>★ 4.7 · 189 reviews</span></div>' +
      "</div>" +
      '<div class="intel-brief-competitors-lock"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><p class="intel-brief-competitors-lock-title">' +
      escapeHtml(MARKETING_UI.briefCompetitorsLocked) +
      '</p><p class="intel-brief-competitors-lock-sub">' +
      escapeHtml(MARKETING_UI.briefCompetitorsSub) +
      "</p></div></section>";

    var briefCta =
      '<section class="intel-brief-cta card"><div class="intel-brief-cta-head"><span aria-hidden="true">🚀</span><div><h2>' +
      escapeHtml(MARKETING_UI.briefCtaTitle) +
      "</h2><p>" +
      escapeHtml(ctaBody) +
      '</p></div></div><div class="intel-brief-cta-features">' +
      ctaFeatures +
      '</div><p class="intel-brief-cta-price">' +
      escapeHtml(MARKETING_UI.briefCtaPrice) +
      "<span>" +
      escapeHtml(MARKETING_UI.briefCtaPriceSub) +
      "</span></p>" +
      '<div class="intel-brief-cta-actions"><a class="intel-brief-cta-btn intel-offer-pay-btn" href="/analysis-reports/' +
      escapeHtml(data.slug || "") +
      '/full">' +
      escapeHtml(MARKETING_UI.briefCtaUnlock) +
      '</a><span class="intel-brief-cta-footnote">' +
      escapeHtml(MARKETING_UI.briefCtaFootnote) +
      "</span></div></section>";

    var briefPanelIds = ["summary", "metrics", "scorecard", "growth", "competitors", "cta"];

    return (
      '<article class="intel-brief-report intel-brief-report--snap card rms-snap-wrap">' +
      '<div class="rms-mobile-scroll" data-rms-mobile-scroll>' +
      '<section class="rms-mobile-panel" data-rms-panel="summary">' +
      '<div class="rms-mobile-panel-inner">' +
      '<p class="intel-back intel-brief-back-inline rms-mobile-only"><a class="ghost landing-link" href="/analysis-reports">← ' +
      escapeHtml(MARKETING_UI.analysisAllSalons) +
      "</a></p>" +
      briefHeader +
      briefOverall +
      getRmsMobileScrollCueHtml("metrics") +
      "</div></section>" +
      '<section class="rms-mobile-panel" data-rms-panel="metrics">' +
      '<div class="rms-mobile-panel-inner">' +
      briefMetrics +
      getRmsMobileScrollCueHtml("scorecard") +
      "</div></section>" +
      '<section class="rms-mobile-panel" data-rms-panel="scorecard">' +
      '<div class="rms-mobile-panel-inner">' +
      briefScorecard +
      getRmsMobileScrollCueHtml("growth") +
      "</div></section>" +
      '<section class="rms-mobile-panel" data-rms-panel="growth">' +
      '<div class="rms-mobile-panel-inner">' +
      briefGrowth +
      getRmsMobileScrollCueHtml("competitors") +
      "</div></section>" +
      '<section class="rms-mobile-panel" data-rms-panel="competitors">' +
      '<div class="rms-mobile-panel-inner">' +
      briefCompetitors +
      getRmsMobileScrollCueHtml("cta") +
      "</div></section>" +
      '<section class="rms-mobile-panel" data-rms-panel="cta">' +
      '<div class="rms-mobile-panel-inner">' +
      briefCta +
      "</div></section></div>" +
      getRmsMobileDotsHtml(briefPanelIds, "summary") +
      "</article>"
    );
  }
  function renderIntelDetailPage() {
    if (state.intelLoading) {
      return (
        '<div class="marketing-page marketing-page-intel">' +
        getMarketingNavHtml() +
        '<section class="intel-report-hero card">' +
        '<p class="marketing-section-kicker">' +
        escapeHtml(MARKETING_UI.analysisReportKicker) +
        "</p>" +
        '<h1 class="marketing-title marketing-title-small">' +
        escapeHtml(MARKETING_UI.analysisDetailLoading) +
        "</h1>" +
        "</section>" +
        getMarketingFooterHtml() +
        "</div>"
      );
    }

    if (state.intelError || !state.intelDetail) {
      return (
        '<div class="marketing-page marketing-page-intel">' +
        getMarketingNavHtml() +
        '<section class="intel-report-hero card">' +
        '<p class="marketing-section-kicker">' +
        escapeHtml(MARKETING_UI.analysisReportKicker) +
        "</p>" +
        '<h1 class="marketing-title marketing-title-small">' +
        escapeHtml(MARKETING_UI.analysisReportUnavailable) +
        "</h1>" +
        '<p class="marketing-body">' +
        escapeHtml(state.intelError || MARKETING_UI.analysisReportLoadFailed) +
        '</p><p class="intel-back"><a class="ghost landing-link" href="/analysis-reports">' +
        escapeHtml(MARKETING_UI.analysisBackAll) +
        "</a></p>" +
        "</section>" +
        getMarketingFooterHtml() +
        "</div>"
      );
    }

    var d = state.intelDetail;
    var brief = d.briefReport;

    if (!brief) {
      return (
        '<div class="marketing-page marketing-page-intel">' +
        getMarketingNavHtml() +
        '<section class="intel-report-hero card">' +
        '<p class="marketing-section-kicker">' +
        escapeHtml(MARKETING_UI.analysisReportKicker) +
        "</p>" +
        '<h1 class="marketing-title marketing-title-small">' +
        escapeHtml(MARKETING_UI.analysisReportUnavailable) +
        "</h1>" +
        '<p class="marketing-body">' +
        escapeHtml(MARKETING_UI.analysisReportLoadFailed) +
        '</p><p class="intel-back"><a class="ghost landing-link" href="/analysis-reports">' +
        escapeHtml(MARKETING_UI.analysisBackAll) +
        "</a></p>" +
        "</section>" +
        getMarketingFooterHtml() +
        "</div>"
      );
    }

    return (
      '<div class="marketing-page marketing-page-intel marketing-page-intel-brief">' +
      getMarketingNavHtml() +
      '<p class="intel-back intel-brief-back rms-desktop-only"><a class="ghost landing-link" href="/analysis-reports">← ' +
      escapeHtml(MARKETING_UI.analysisAllSalons) +
      "</a></p>" +
      renderSalonBriefReportHtml(brief) +
      getMarketingFooterHtml() +
      "</div>"
    );

  }

  function renderIntelFullReportPage() {
    if (state.intelLoading) {
      return (
        '<div class="marketing-page marketing-page-intel marketing-page-full-report">' +
        getMarketingNavHtml() +
        '<section class="intel-report-hero card"><p class="marketing-section-kicker">' +
        escapeHtml(MARKETING_UI.analysisReportKicker) +
        "</p><h1 class=\"marketing-title marketing-title-small\">" +
        escapeHtml(MARKETING_UI.analysisDetailLoading) +
        "</h1></section>" +
        getMarketingFooterHtml() +
        "</div>"
      );
    }

    if (state.intelError || !state.intelDetail) {
      return (
        '<div class="marketing-page marketing-page-intel marketing-page-full-report">' +
        getMarketingNavHtml() +
        '<section class="intel-report-hero card"><p class="marketing-body">' +
        escapeHtml(state.intelError || MARKETING_UI.analysisReportLoadFailed) +
        '</p><p class="intel-back"><a class="ghost landing-link" href="/analysis-reports">' +
        escapeHtml(MARKETING_UI.analysisBackAll) +
        "</a></p></section>" +
        getMarketingFooterHtml() +
        "</div>"
      );
    }

    if (!state.intelDetail.fullReport) {
      return (
        '<div class="marketing-page marketing-page-intel marketing-page-full-report">' +
        getMarketingNavHtml() +
        '<section class="intel-report-hero card"><p class="marketing-body">' +
        escapeHtml(MARKETING_UI.analysisReportLoadFailed) +
        "</p></section>" +
        getMarketingFooterHtml() +
        "</div>"
      );
    }

    return (
      '<div class="marketing-page marketing-page-intel marketing-page-full-report">' +
      getMarketingNavHtml() +
      '<div id="fullReportRoot" class="full-report-root"></div>' +
      getMarketingFooterHtml() +
      "</div>"
    );
  }

  function mountIntelFullReportView() {
    if (!isAnalysisFullRoute() || !el.landingContent) return;
    if (window.RmsFullReport && typeof window.RmsFullReport.destroyCharts === "function") {
      window.RmsFullReport.destroyCharts();
    }
    var root = el.landingContent.querySelector("#fullReportRoot");
    if (!root || !window.RmsFullReport || !state.intelDetail || !state.intelDetail.fullReport) return;
    window.RmsFullReport.mount(root, state.intelDetail.fullReport, {
      slug: state.storeSlug,
      onMounted: function () {
        updateMobileSnapLayout();
        var scroller = el.landingContent.querySelector("[data-rms-mobile-scroll]");
        if (scroller) syncMobileSnapDots(scroller);
      },
    });
  }

  function getMarketingNavHtml() {
    // 5-tab nav matching rankmysalon.ai (Overview / AI Agent /
    // Local Ranking / Tools / Services). AI Agent and Tools are
    // dropdowns; Overview, Local Ranking, and Services are direct
    // links. The links array below drives the simple <a> tags;
    // the two dropdown blocks are rendered after.
    const links = [
      { key: ROUTE_LANDING, label: MARKETING_UI.navOverview, href: "/" },
      { key: ROUTE_ANALYSIS_LIST, label: MARKETING_UI.navAnalysis, href: "/analysis-reports" },
      { key: ROUTE_SERVICES, label: MARKETING_UI.navServices, href: "/services.html" },
    ];

    const dropdowns = [
      {
        id: "marketingNavAi",
        label: MARKETING_UI.navAgent,
        items: [
          { label: "Ryan \u2014 AI Growth Advisor", href: "/ai-agents/ryan" },
          { label: "Hannah \u2014 AI Front Desk Manager", href: "/ai-agents/hannah" },
          { label: "Andrew \u2014 Customer Acquisition Manager", href: "/ai-agents/andrew" },
          { label: "Sarah \u2014 Reputation Manager", href: "/ai-agents/sarah" },
          { label: "Grace \u2014 Client Success Manager", href: "/ai-agents/grace" },
        ],
      },
      {
        id: "marketingNavTools",
        label: MARKETING_UI.navTools,
        items: [
          { label: "AI Review Booster Tool", href: "/ai-review-generator" },
          { label: "Analysis Reports", href: "/analysis-reports" },
        ],
      },
    ];

    // Render the 5 nav items in Cathy's required order:
    // Overview, AI Agent, Local Ranking, Tools, Services
    const navItemsHtml = [
      linksHtmlItem(links[0]), // Overview
      dropdownsHtmlItem(dropdowns[0]), // AI Agent
      linksHtmlItem(links[1]), // Local Ranking
      dropdownsHtmlItem(dropdowns[1]), // Tools
      linksHtmlItem(links[2]), // Services
    ].join("");

    function linksHtmlItem(link) {
      var navActive = state.routeKind === link.key;
      if (link.key === ROUTE_ANALYSIS_LIST && isAnalysisRoute()) {
        navActive = true;
      }
      if (link.key === ROUTE_SERVICES && state.routeKind === ROUTE_SERVICES) {
        navActive = true;
      }
      if (link.key === ROUTE_LANDING && (state.routeKind === ROUTE_LANDING || !state.routeKind)) {
        navActive = true;
      }
      const active = navActive ? " is-active" : "";
      return (
        '<a class="marketing-nav-link' +
        active +
        '" href="' +
        (link.href || getPagePath(link.key)) +
        '">' +
        escapeHtml(link.label) +
        "</a>"
      );
    }

    function dropdownsHtmlItem(dd) {
      const itemsHtml = dd.items
        .map(function (item) {
          return (
            '<a class="marketing-dropdown-item" href="' +
            escapeHtml(item.href) +
            '" role="menuitem">' +
            escapeHtml(item.label) +
            "</a>"
          );
        })
        .join("");
      return (
        '<div class="marketing-dropdown">' +
        '<button type="button" class="marketing-nav-link marketing-dropdown-toggle" id="' +
        dd.id +
        'Btn" aria-haspopup="true" aria-expanded="false">' +
        escapeHtml(dd.label) +
        '<span class="marketing-dropdown-caret" aria-hidden="true">\u25BE</span>' +
        "</button>" +
        '<div class="marketing-dropdown-menu" id="' +
        dd.id +
        'Menu" role="menu" hidden>' +
        itemsHtml +
        "</div>" +
        "</div>"
      );
    }

    return (
      '<header class="marketing-nav-shell">' +
      '<div class="marketing-nav-main">' +
      '<a class="marketing-brand" href="/">' +
      '<span class="brand-part brand-part-rank">Rank</span>' +
      '<span class="brand-part brand-part-myrestaurant">MyRestaurant</span>' +
      "</a>" +
      '<nav class="marketing-nav" aria-label="Primary">' +
      navItemsHtml +
      "</nav>" +
      "</div>" +
      '<div class="marketing-auth-actions">' +
            '<button class="theme-toggle" type="button" aria-label="Toggle light and dark theme" onclick="toggleMarketingTheme()">' +
      '<span data-theme-icon>' +
      getMarketingThemeIcon() +
      "</span>" +
      "</button>" +
      '<button type="button" id="marketingContactOpen" class="marketing-contact-nav-btn">' +
      escapeHtml(MARKETING_UI.navContact) +
      "</button>" +
      '<a class="ghost landing-link marketing-auth-link" href="/login">' +
      escapeHtml(MARKETING_UI.navSignIn) +
      "</a>" +
      '<div class="marketing-lang-wrap" data-marketing-lang-wrap>' +
      '<button type="button" class="ghost landing-link marketing-auth-link marketing-lang-toggle" data-marketing-lang-btn aria-haspopup="true" aria-expanded="false" aria-label="' +
      escapeHtml("Language · " + getMarketingSiteLangDisplayLabel()) +
      '" id="marketingLangBtn">' +
      '<span class="marketing-lang-btn-label">' +
      escapeHtml(getMarketingSiteLangDisplayLabel()) +
      '</span><span class="marketing-lang-btn-caret" aria-hidden="true">▾</span>' +
      "</button>" +
      '<ul class="marketing-lang-menu hidden" data-marketing-lang-menu role="menu" aria-labelledby="marketingLangBtn" aria-hidden="true">' +
      getMarketingLangMenuHtml() +
      "</ul>" +
      "</div>" +
      "</div>" +
      "</header>" +
      getMarketingContactModalHtml()
    );
  }

  function getMarketingFooterHtml() {
    return (
      '<footer class="marketing-footer">' +
      '<div class="marketing-footer-wrapper">' +
      '<div class="marketing-footer-left">' +
      '<a href="/" class="marketing-footer-logo-link">' +
      '<span class="footer-logo-part footer-logo-360">360</span>' +
      '<span class="footer-logo-part footer-logo-ai">AI</span>' +
      '<span class="footer-logo-part footer-logo-media">Media</span>' +
      "</a>" +
      '<div class="marketing-footer-info">' +
      '<p class="footer-company-name">RankMyRestaurant</p>' +
      '<p class="footer-address">' +
      escapeHtml(MARKETING_UI.footerAddressSalon) +
      "</p>" +
      '<p class="footer-address">' +
      escapeHtml(MARKETING_UI.footerAddressAutomation) +
      "</p>" +
      "</div>" +
      "</div>" +
      '<div class="marketing-footer-right">' +
      '<div class="marketing-footer-column">' +
      '<h3 class="footer-column-title">' +
      escapeHtml(MARKETING_UI.footerProduct) +
      "</h3>" +
      '<ul class="footer-column-list">' +
      '<li class="footer-column-header">' +
      '<a href="https://www.rankmyrestaurant.ai/stores/xiebao-edison" class="footer-link" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(MARKETING_UI.footerProductHeader) +
      "</a></li>" +
      '<li><a href="/price" class="footer-link">' +
      escapeHtml(MARKETING_UI.footerReviewsManager) +
      "</a></li>" +
      '<li><a href="/price" class="footer-link">' +
      escapeHtml(MARKETING_UI.footerResponseManager) +
      "</a></li>" +
      '<li><a href="/price" class="footer-link">' +
      escapeHtml(MARKETING_UI.footerAnalytics) +
      "</a></li>" +
      '<li><a href="/price" class="footer-link">' +
      escapeHtml(MARKETING_UI.footerReports) +
      "</a></li>" +
      "</ul>" +
      "</div>" +
      '<div class="marketing-footer-column">' +
      '<h3 class="footer-column-title">' +
      escapeHtml(MARKETING_UI.footerFeatures) +
      "</h3>" +
      '<ul class="footer-column-list">' +
      '<li class="footer-column-header">' +
      escapeHtml(MARKETING_UI.footerFeaturesHeader) +
      "</li>" +
      '<li><a href="/button.html" class="footer-link">' +
      escapeHtml(MARKETING_UI.footerAiVoiceAgent) +
      "</a></li>" +
      '<li><a href="/price" class="footer-link">' +
      escapeHtml(MARKETING_UI.footerSmartFollowUp) +
      "</a></li>" +
      '<li><a href="/price" class="footer-link">' +
      escapeHtml(MARKETING_UI.footerClientAcquisition) +
      "</a></li>" +
      '<li><a href="/price" class="footer-link">' +
      escapeHtml(MARKETING_UI.footerBookingSystem) +
      "</a></li>" +
      "</ul>" +
      "</div>" +
      '<div class="marketing-footer-column">' +
      '<h3 class="footer-column-title">' +
      escapeHtml(MARKETING_UI.footerCompany) +
      "</h3>" +
      '<ul class="footer-column-list">' +
      '<li><a href="/about-us" class="footer-link">' +
      escapeHtml(MARKETING_UI.footerAboutUs) +
      "</a></li>" +
      '<li><a href="/sms-consent" class="footer-link">' +
      escapeHtml(MARKETING_UI.footerSmsConsent) +
      "</a></li>" +
      '<li><a href="/terms" class="footer-link">' +
      escapeHtml(MARKETING_UI.footerTerms) +
      "</a></li>" +
      '<li><a href="/privacy" class="footer-link">' +
      escapeHtml(MARKETING_UI.footerPrivacy) +
      "</a></li>" +
      "</ul>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="marketing-footer-bottom">' +
      '<p class="footer-copyright">' +
      escapeHtml(MARKETING_UI.footerCopyright) +
      "</p>" +
      "</div>" +
      "</footer>"
    );
  }

  function getMarketingLeadFormHtml(formId, feedbackId) {
    return (
      '<form id="' +
      escapeHtml(formId) +
      '" class="about-page-form" data-marketing-lead-form novalidate>' +
      '<div class="about-page-form-grid">' +
      '<label class="about-page-form-field">' +
      '<span class="about-page-form-label">' +
      escapeHtml(MARKETING_UI.formNameLabel) +
      "</span>" +
      '<input class="about-page-form-control" type="text" name="name" placeholder="' +
      escapeHtml(MARKETING_UI.formNamePlaceholder) +
      '" required>' +
      "</label>" +
      '<label class="about-page-form-field">' +
      '<span class="about-page-form-label">' +
      escapeHtml(MARKETING_UI.formEmailLabel) +
      "</span>" +
      '<input class="about-page-form-control" type="email" name="email" placeholder="' +
      escapeHtml(MARKETING_UI.formEmailPlaceholder) +
      '" required>' +
      "</label>" +
      '<label class="about-page-form-field">' +
      '<span class="about-page-form-label">' +
      escapeHtml(MARKETING_UI.formPhoneLabel) +
      "</span>" +
      '<input class="about-page-form-control" type="tel" name="phone" placeholder="' +
      escapeHtml(MARKETING_UI.formPhonePlaceholder) +
      '" required>' +
      "</label>" +
      '<label class="about-page-form-field">' +
      '<span class="about-page-form-label">' +
      escapeHtml(MARKETING_UI.formCompanyLabel) +
      "</span>" +
      '<input class="about-page-form-control" type="text" name="company" placeholder="' +
      escapeHtml(MARKETING_UI.formCompanyPlaceholder) +
      '">' +
      "</label>" +
      '<label class="about-page-form-field about-page-form-field-full">' +
      '<span class="about-page-form-label">' +
      escapeHtml(MARKETING_UI.formServiceLabel) +
      "</span>" +
      '<select class="about-page-form-control about-page-form-select" name="service">' +
      '<option value="">' +
      escapeHtml(MARKETING_UI.formServicePlaceholder) +
      "</option>" +
      ABOUT_PAGE_CONTENT.serviceOptions
        .map(function (item) {
          return '<option value="' + escapeHtml(item) + '">' + escapeHtml(item) + "</option>";
        })
        .join("") +
      "</select>" +
      "</label>" +
      '<label class="about-page-form-field about-page-form-field-full">' +
      '<span class="about-page-form-label">' +
      escapeHtml(MARKETING_UI.formMessageLabel) +
      "</span>" +
      '<textarea class="about-page-form-control about-page-form-textarea" name="message" rows="5" placeholder="' +
      escapeHtml(MARKETING_UI.formMessagePlaceholder) +
      '" required></textarea>' +
      "</label>" +
      "</div>" +
      '<div class="about-page-form-footer">' +
      '<label class="about-page-form-consent-check">' +
      '<input type="checkbox" name="sms_consent" required>' +
      '<span>' +
      escapeHtml(MARKETING_UI.formSmsConsentCheckbox) +
      "</span>" +
      "</label>" +
      '<p class="about-page-form-consent">' +
      escapeHtml(MARKETING_UI.formSmsConsentNotice) +
      " " +
      escapeHtml(MARKETING_UI.formSmsConsentLinksPrefix) +
      ' <a href="/sms-consent" class="landing-link">' +
      escapeHtml(MARKETING_UI.formSmsConsentLinkSms) +
      "</a>, " +
      '<a href="/privacy" class="landing-link">' +
      escapeHtml(MARKETING_UI.formSmsConsentLinkPrivacy) +
      "</a>, " +
      '<a href="/terms" class="landing-link">' +
      escapeHtml(MARKETING_UI.formSmsConsentLinkTerms) +
      "</a>." +
      "</p>" +
      '<button class="cta about-page-submit-btn" type="submit">' +
      escapeHtml(MARKETING_UI.formSubmit) +
      "</button>" +
      '<p id="' +
      escapeHtml(feedbackId) +
      '" data-lead-feedback class="about-page-form-feedback" aria-live="polite"></p>' +
      "</div>" +
      "</form>"
    );
  }

  function getHeroBriefFormHtml(options) {
    var opts = options || {};
    var formId = opts.formId || "heroBriefForm";
    var feedbackId = opts.feedbackId || "heroBriefFeedback";
    return (
      '<form id="' +
      escapeHtml(formId) +
      '" class="marketing-hero-brief-form" data-marketing-lead-form novalidate>' +
      '<div class="marketing-hero-brief-fields">' +
      '<label class="marketing-hero-brief-field">' +
      '<span class="marketing-hero-brief-label">' +
      escapeHtml(MARKETING_UI.heroBriefSalonLabel) +
      "</span>" +
      '<input class="marketing-hero-brief-input" type="text" name="salon_name" autocomplete="organization" placeholder="' +
      escapeHtml(MARKETING_UI.heroBriefSalonPlaceholder) +
      '" required>' +
      "</label>" +
      '<label class="marketing-hero-brief-field">' +
      '<span class="marketing-hero-brief-label">' +
      escapeHtml(MARKETING_UI.heroBriefContactLabel) +
      "</span>" +
      '<input class="marketing-hero-brief-input" type="text" name="contact" autocapitalize="off" placeholder="' +
      escapeHtml(MARKETING_UI.heroBriefContactPlaceholder) +
      '" required>' +
      "</label>" +
      "</div>" +
      '<label class="marketing-hero-brief-consent">' +
      '<input type="checkbox" name="sms_consent">' +
      "<span>" +
      escapeHtml(MARKETING_UI.heroBriefSmsConsentCheckbox) +
      "</span>" +
      "</label>" +
      '<p class="marketing-hero-brief-consent-note">' +
      escapeHtml(MARKETING_UI.formSmsConsentNotice) +
      " " +
      escapeHtml(MARKETING_UI.formSmsConsentLinksPrefix) +
      ' <a href="/sms-consent" class="marketing-hero-brief-inline-link">' +
      escapeHtml(MARKETING_UI.formSmsConsentLinkSms) +
      "</a>, " +
      '<a href="/privacy" class="marketing-hero-brief-inline-link">' +
      escapeHtml(MARKETING_UI.formSmsConsentLinkPrivacy) +
      "</a>, " +
      '<a href="/terms" class="marketing-hero-brief-inline-link">' +
      escapeHtml(MARKETING_UI.formSmsConsentLinkTerms) +
      "</a>." +
      "</p>" +
      '<button type="submit" class="marketing-hero-brief-submit">' +
      escapeHtml(MARKETING_UI.heroBriefSubmit) +
      "</button>" +
      '<p id="' +
      escapeHtml(feedbackId) +
      '" data-lead-feedback data-feedback-class="marketing-hero-brief-feedback" aria-live="polite"></p>' +
      "</form>"
    );
  }

  function getMarketingContactModalHtml() {
    return (
      '<div id="marketingContactModal" class="marketing-contact-modal" role="dialog" aria-modal="true" aria-labelledby="marketingContactModalTitle" aria-hidden="true">' +
      '<div class="marketing-contact-modal-backdrop" tabindex="-1" data-contact-modal-dismiss></div>' +
      '<div class="marketing-contact-modal-panel">' +
      '<div class="marketing-contact-modal-toolbar">' +
      '<h2 id="marketingContactModalTitle" class="marketing-contact-modal-title">' +
      escapeHtml(MARKETING_UI.contactModalTitle) +
      "</h2>" +
      '<button type="button" class="marketing-contact-modal-close" aria-label="' +
      escapeHtml(MARKETING_UI.contactModalClose) +
      '" data-contact-modal-dismiss>&times;</button>' +
      "</div>" +
      '<p class="marketing-contact-modal-lead">' +
      escapeHtml(MARKETING_UI.contactModalLead) +
      "</p>" +
      '<div class="about-page-cta-form-shell marketing-contact-modal-form-shell">' +
      getMarketingLeadFormHtml("contactModalLeadForm", "contactModalLeadFeedback") +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function parseCurrencyAmount(value) {
    var normalized = String(value || "").replace(/[^0-9.]/g, "");
    var amount = Number(normalized);
    return Number.isFinite(amount) ? amount : 0;
  }

  function formatUsdAmount(amount) {
    var numeric = Number(amount);
    if (!Number.isFinite(numeric)) return "$0";
    var isWhole = Math.abs(numeric - Math.round(numeric)) < 0.0001;
    return "$" + (isWhole ? String(Math.round(numeric)) : numeric.toFixed(2));
  }

  function getPricingSummaryModel() {
    var monthlyAmount = parseCurrencyAmount(MARKETING_COPY.pricingAmount);
    var setupAmount = parseCurrencyAmount(MARKETING_COPY.pricingSetupAmount);
    return {
      title: MARKETING_UI.pricingSummaryTitle,
      body: MARKETING_UI.pricingSummaryBody,
      items: [
        {
          title: MARKETING_UI.pricingSummaryPlanTitle,
          detail: MARKETING_UI.pricingSummaryPlanDetail,
          amount: formatUsdAmount(monthlyAmount) + " " + String(MARKETING_COPY.pricingPeriod || "").trim(),
        },
        {
          title: MARKETING_COPY.pricingSetupTitle + MARKETING_UI.pricingSummarySetupDeviceSuffix,
          detail: MARKETING_UI.pricingSummarySetupDetail,
          amount: formatUsdAmount(setupAmount),
        },
      ],
      dueToday: formatUsdAmount(monthlyAmount + setupAmount),
      recurring: formatUsdAmount(monthlyAmount) + " " + String(MARKETING_COPY.pricingPeriod || "").trim(),
    };
  }

  var shopifyConfig = null;
  var isShopifyCheckoutPending = false;

  function initShopify() {
    var rawShopifyConfig = config.shopify || {};
    if (
      !rawShopifyConfig.domain ||
      rawShopifyConfig.domain === "YOUR_STORE.myshopify.com" ||
      !rawShopifyConfig.setupVariantId ||
      rawShopifyConfig.setupVariantId === "YOUR_SETUP_VARIANT_ID" ||
      !rawShopifyConfig.monthlyVariantId ||
      rawShopifyConfig.monthlyVariantId === "YOUR_MONTHLY_VARIANT_ID" ||
      !rawShopifyConfig.monthlySellingPlanId ||
      rawShopifyConfig.monthlySellingPlanId === "YOUR_MONTHLY_SELLING_PLAN_ID"
    ) {
      shopifyConfig = null;
      return;
    }
    shopifyConfig = {
      domain: String(rawShopifyConfig.domain).replace(/^https?:\/\//, "").replace(/\/+$/, ""),
      storefrontApiVersion: rawShopifyConfig.storefrontApiVersion || "2026-04",
      setupVariantId: rawShopifyConfig.setupVariantId,
      monthlyVariantId: rawShopifyConfig.monthlyVariantId,
      monthlySellingPlanId: rawShopifyConfig.monthlySellingPlanId,
    };
  }

  function setPricingButtonsBusy(isBusy) {
    var pricingButtons = Array.prototype.slice.call(document.querySelectorAll(".pricing-buy-btn"));
    pricingButtons.forEach(function (btn) {
      btn.disabled = isBusy;
      btn.textContent = isBusy ? MARKETING_UI.pricingBusyLoading : MARKETING_COPY.pricingCtaLabel;
    });
    if (el.pricingSummaryCheckoutBtn) {
      el.pricingSummaryCheckoutBtn.disabled = isBusy;
      el.pricingSummaryCheckoutBtn.textContent = isBusy
        ? MARKETING_UI.pricingBusyRedirecting
        : MARKETING_UI.pricingSummaryCheckout;
    }
    if (el.pricingSummaryBackBtn) {
      el.pricingSummaryBackBtn.disabled = isBusy;
    }
    if (el.pricingSummaryCloseBtn) {
      el.pricingSummaryCloseBtn.disabled = isBusy;
    }
  }

  function renderPricingSummary() {
    if (!el.pricingSummaryBackdrop) return;

    var isOpen = !!state.isPricingSummaryOpen && isMarketingRoute();
    var summary = getPricingSummaryModel();

    document.body.classList.toggle("has-pricing-summary", isOpen);
    el.pricingSummaryBackdrop.classList.toggle("is-open", isOpen);
    el.pricingSummaryBackdrop.setAttribute("aria-hidden", isOpen ? "false" : "true");

    if (el.pricingSummaryTitle) el.pricingSummaryTitle.textContent = summary.title;
    if (el.pricingSummaryBody) el.pricingSummaryBody.textContent = summary.body;
    var pricingKicker = el.pricingSummaryDialog
      ? el.pricingSummaryDialog.querySelector(".pricing-summary-kicker")
      : null;
    var pricingSecurity = el.pricingSummaryDialog
      ? el.pricingSummaryDialog.querySelector(".pricing-summary-security-note")
      : null;
    var pricingTotalLabels = el.pricingSummaryDialog
      ? el.pricingSummaryDialog.querySelectorAll(".pricing-summary-total-row span")
      : [];
    if (pricingKicker) pricingKicker.textContent = MARKETING_UI.pricingSummaryKicker;
    if (pricingSecurity) pricingSecurity.textContent = MARKETING_UI.pricingSummarySecurity;
    if (pricingTotalLabels[0]) pricingTotalLabels[0].textContent = MARKETING_UI.pricingSummaryDueTodayLabel;
    if (pricingTotalLabels[1]) pricingTotalLabels[1].textContent = MARKETING_UI.pricingSummaryRecurringLabel;
    if (el.pricingSummaryCloseBtn) {
      el.pricingSummaryCloseBtn.setAttribute("aria-label", MARKETING_UI.pricingSummaryClose);
    }
    if (el.pricingSummaryBackBtn) el.pricingSummaryBackBtn.textContent = MARKETING_UI.pricingSummaryBack;
    if (el.pricingSummaryCheckoutBtn) el.pricingSummaryCheckoutBtn.textContent = MARKETING_UI.pricingSummaryCheckout;
    if (el.pricingSummaryLines) {
      el.pricingSummaryLines.innerHTML = summary.items
        .map(function (item) {
          return (
            '<article class="pricing-summary-line">' +
            '<div class="pricing-summary-line-copy">' +
            '<h3>' +
            escapeHtml(item.title) +
            "</h3>" +
            '<p>' +
            escapeHtml(item.detail) +
            "</p>" +
            "</div>" +
            '<strong class="pricing-summary-line-amount">' +
            escapeHtml(item.amount) +
            "</strong>" +
            "</article>"
          );
        })
        .join("");
    }
    if (el.pricingSummaryDueToday) el.pricingSummaryDueToday.textContent = summary.dueToday;
    if (el.pricingSummaryRecurring) el.pricingSummaryRecurring.textContent = summary.recurring;
  }

  function openPricingSummary() {
    if (!isMarketingRoute() || isShopifyCheckoutPending) return;
    state.isPricingSummaryOpen = true;
    renderPricingSummary();
    trackEvent("pricing_summary_opened", analyticsParams());
  }

  function closePricingSummary() {
    if (isShopifyCheckoutPending) return;
    state.isPricingSummaryOpen = false;
    renderPricingSummary();
    trackEvent("pricing_summary_closed", analyticsParams());
  }

  async function createPricingCheckoutUrl() {
    if (!shopifyConfig) {
      throw new Error(MARKETING_UI.shopifyNotConfiguredShort);
    }

    var response = await fetch("/api/shopify/create-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain: shopifyConfig.domain,
        storefrontApiVersion: shopifyConfig.storefrontApiVersion,
        setupVariantId: shopifyConfig.setupVariantId,
        monthlyVariantId: shopifyConfig.monthlyVariantId,
        monthlySellingPlanId: shopifyConfig.monthlySellingPlanId,
      }),
    });

    if (!response.ok) {
      var errorPayload = await response.json().catch(function () {
        return null;
      });
      var errorMessage =
        errorPayload && errorPayload.error && errorPayload.error.message
          ? errorPayload.error.message
          : MARKETING_UI.shopifyCartFailedPrefix + response.status + ".";
      throw new Error(errorMessage);
    }

    var payload = await response.json();
    if (!payload || !payload.checkoutUrl) {
      throw new Error(MARKETING_UI.shopifyCheckoutMissing);
    }

    return payload.checkoutUrl;
  }

  async function handlePricingBuy() {
    if (isShopifyCheckoutPending) return;

    if (!shopifyConfig) {
      alert(MARKETING_UI.shopifyNotConfigured);
      trackEvent("checkout_config_missing", analyticsParams());
      return;
    }

    trackEvent("checkout_started", analyticsParams());

    isShopifyCheckoutPending = true;
    setPricingButtonsBusy(true);

    try {
      var checkoutUrl = await createPricingCheckoutUrl();
      trackEvent("checkout_redirect", analyticsParams());
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error("Shopify checkout error:", err);
      alert((err && err.message) || MARKETING_UI.shopifyStartFailed);
      trackEvent("checkout_failed", analyticsParams({
        message: (err && err.message) || "",
      }));
    } finally {
      isShopifyCheckoutPending = false;
      if (document.visibilityState !== "hidden") {
        setPricingButtonsBusy(false);
      }
    }
  }

  function bindPricingEvents() {
    document.addEventListener("click", function (e) {
      var pricingButton = e.target.closest(".pricing-buy-btn");
      if (pricingButton) {
        e.preventDefault();
        openPricingSummary();
        return;
      }

      if (e.target === el.pricingSummaryBackdrop) {
        closePricingSummary();
        return;
      }

      if (e.target.closest("#pricingSummaryCloseBtn") || e.target.closest("#pricingSummaryBackBtn")) {
        closePricingSummary();
        return;
      }

      if (e.target.closest("#pricingSummaryCheckoutBtn")) {
        handlePricingBuy();
        return;
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (!state.isPricingSummaryOpen) return;
      closePricingSummary();
    });
  }

  function bindMarketingLanguageEvents() {
    document.addEventListener("click", function (event) {
      var opt = event.target && event.target.closest ? event.target.closest("[data-marketing-lang]") : null;
      if (opt) {
        var lang = opt.getAttribute("data-marketing-lang");
        if (lang && isSiteLangSupported(lang)) {
          event.preventDefault();
          setMarketingSiteLang(lang);
        }
        return;
      }
      var btn = event.target && event.target.closest ? event.target.closest("[data-marketing-lang-btn]") : null;
      if (btn) {
        var wrap = btn.closest("[data-marketing-lang-wrap]");
        if (!wrap) return;
        event.preventDefault();
        event.stopPropagation();
        var isOpen = wrap.getAttribute("data-open") === "true";
        closeAllMarketingLangMenus();
        setMarketingLangMenuOpen(wrap, !isOpen);
        return;
      }
      if (!event.target.closest || !event.target.closest("[data-marketing-lang-wrap]")) {
        closeAllMarketingLangMenus();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      closeAllMarketingLangMenus();
    });
  }

  function bindMarketingNavDropdowns() {
    function closeAllMarketingNavDropdowns() {
      var menus = document.querySelectorAll(".marketing-dropdown-menu");
      for (var i = 0; i < menus.length; i += 1) {
        menus[i].setAttribute("hidden", "");
        var wrap = menus[i].closest(".marketing-dropdown");
        if (wrap) {
          var btn = wrap.querySelector(".marketing-dropdown-toggle");
          if (btn) btn.setAttribute("aria-expanded", "false");
        }
      }
    }
    function openMarketingNavDropdown(id) {
      closeAllMarketingNavDropdowns();
      var menu = document.getElementById(id);
      if (!menu) return;
      menu.removeAttribute("hidden");
      var wrap = menu.closest(".marketing-dropdown");
      if (wrap) {
        var btn = wrap.querySelector(".marketing-dropdown-toggle");
        if (btn) btn.setAttribute("aria-expanded", "true");
      }
    }
    document.addEventListener("click", function (event) {
      var t = event.target;
      if (!t || !t.closest) return;
      var btn = t.closest(".marketing-dropdown-toggle");
      if (btn) {
        event.preventDefault();
        event.stopPropagation();
        var menu = btn.parentElement ? btn.parentElement.querySelector(".marketing-dropdown-menu") : null;
        if (!menu) return;
        var isOpen = btn.getAttribute("aria-expanded") === "true";
        if (isOpen) {
          closeAllMarketingNavDropdowns();
        } else {
          openMarketingNavDropdown(menu.id);
        }
        return;
      }
      if (!t.closest(".marketing-dropdown")) {
        closeAllMarketingNavDropdowns();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeAllMarketingNavDropdowns();
      }
    });
  }

  function bindMarketingFormEvents() {
    document.addEventListener("submit", function (event) {
      var form = event.target && event.target.closest ? event.target.closest("form[data-marketing-lead-form]") : null;
      if (!form) return;
      event.preventDefault();
      void handleMarketingLeadFormSubmit(form);
    });
  }

  function bindMarketingContactModalEvents() {
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest("#marketingContactOpen")) {
        event.preventDefault();
        openMarketingContactModal();
        return;
      }
      if (target.closest("[data-contact-modal-dismiss]")) {
        var modal = getMarketingContactModalEl();
        if (modal && modal.classList.contains("is-open")) {
          event.preventDefault();
          closeMarketingContactModal();
        }
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var modal = getMarketingContactModalEl();
      if (!modal || !modal.classList.contains("is-open")) return;
      closeMarketingContactModal();
    });
  }

  function getPricingGuaranteeHtml(itemClassName, dividerClassName) {
    var guarantees = MARKETING_COPY.pricingGuarantees || [];
    return guarantees
      .map(function (item, index) {
        var separator =
          index < guarantees.length - 1
            ? '<span class="' + dividerClassName + '" aria-hidden="true">|</span>'
            : "";
        return (
          '<span class="' + itemClassName + '">' +
          escapeHtml(item) +
          "</span>" +
          separator
        );
      })
      .join("");
  }

  /** Homepage Insights grid — placeholder clips share one video ID until content is finalized. */
  var MARKETING_INSIGHTS_YOUTUBE_ID = "u8f0ldy7H0o";

  function getMarketingInsightsSectionHtml() {
    var vid = MARKETING_INSIGHTS_YOUTUBE_ID;
    var watchUrl = "https://www.youtube.com/watch?v=" + encodeURIComponent(vid);
    var thumbUrl = "https://i.ytimg.com/vi/" + encodeURIComponent(vid) + "/hqdefault.jpg";
    var cards = [];
    for (var i = 0; i < 4; i++) {
      var cap = MARKETING_COPY.insightsVideoLabel + " " + (i + 1);
      cards.push(
        '<li class="marketing-insights-item">' +
          '<a class="marketing-insights-card" href="' +
          watchUrl +
          '" target="_blank" rel="noopener noreferrer" aria-label="' +
          escapeHtml(cap + " — " + MARKETING_COPY.insightsTitle) +
          '">' +
          '<span class="marketing-insights-thumb-wrap">' +
          '<img class="marketing-insights-thumb" src="' +
          thumbUrl +
          '" width="480" height="360" loading="lazy" decoding="async" alt="' +
          escapeHtml(cap) +
          '">' +
          '<span class="marketing-insights-play-overlay" aria-hidden="true">' +
          '<span class="marketing-insights-play-btn"></span>' +
          "</span>" +
          "</span>" +
          '<span class="marketing-insights-caption">' +
          escapeHtml(cap) +
          "</span>" +
          "</a>" +
          "</li>",
      );
    }
    return (
      '<section class="marketing-section marketing-insights card">' +
      '<div class="marketing-insights-head">' +
      '<h2 class="marketing-section-title">' +
      escapeHtml(MARKETING_COPY.insightsTitle) +
      "</h2>" +
      '<p class="marketing-insights-lead">' +
      escapeHtml(MARKETING_COPY.insightsSubtitle) +
      "</p>" +
      "</div>" +
      '<ul class="marketing-insights-grid">' +
      cards.join("") +
      "</ul>" +
      "</section>"
    );
  }

  function getApiErrorMessage(payload, fallback) {
    if (payload && payload.error && typeof payload.error === "object" && payload.error.message) {
      return payload.error.message;
    }
    if (payload && payload.details && typeof payload.details === "object") {
      if (payload.details.error && typeof payload.details.error === "string" && payload.details.error) {
        return payload.details.error;
      }
      if (payload.details.message && typeof payload.details.message === "string" && payload.details.message) {
        return payload.details.message;
      }
    }
    if (payload && typeof payload.message === "string" && payload.message) {
      return payload.message;
    }
    if (payload && typeof payload.error === "string" && payload.error) {
      return payload.error;
    }
    return fallback;
  }

  function isMobileViewport() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function getRmsMobileScrollCueHtml(nextPanel) {
    return (
      '<button type="button" class="rms-mobile-scroll-cue" data-rms-scroll-to="' +
      escapeHtml(nextPanel || "story") +
      '" aria-label="' +
      escapeHtml(MARKETING_UI.mobileScrollCue) +
      '">' +
      escapeHtml(MARKETING_UI.mobileScrollCue) +
      "</button>"
    );
  }

  function getRmsMobileDotsHtml(panelIds, activeId) {
    if (!panelIds || !panelIds.length) return "";
    return (
      '<nav class="rms-mobile-dots rms-mobile-only" aria-label="' +
      escapeHtml(MARKETING_UI.mobileScrollCue) +
      '">' +
      panelIds
        .map(function (id) {
          return (
            '<button type="button" class="rms-mobile-dot' +
            (id === activeId ? " is-active" : "") +
            '" data-rms-scroll-to="' +
            escapeHtml(id) +
            '" aria-label="' +
            escapeHtml(id) +
            '"></button>'
          );
        })
        .join("") +
      "</nav>"
    );
  }

  function updateMobileSnapLayout() {
    var mobile = isMobileViewport();
    document.body.classList.toggle("rms-viewport-mobile", mobile);
    if (!mobile) return;
    if (document.body.classList.contains("route-analysis-full")) {
      document.documentElement.style.setProperty("--rms-mobile-nav-offset", "0px");
      return;
    }
    var page = document.querySelector(
      ".marketing-page-overview, .marketing-page-intel-brief, .marketing-page-full-report",
    );
    if (!page) return;
    var nav = page.querySelector(".marketing-nav-shell");
    if (nav) {
      document.documentElement.style.setProperty(
        "--rms-mobile-nav-offset",
        String(nav.offsetHeight + 16) + "px",
      );
    }
  }

  function syncMobileSnapDots(scroller) {
    if (!scroller || !isMobileViewport()) return;
    var wrap = scroller.closest(".rms-snap-wrap");
    if (!wrap) return;
    var dots = wrap.querySelectorAll(".rms-mobile-dot[data-rms-scroll-to]");
    if (!dots.length) return;
    var panels = scroller.querySelectorAll(".rms-mobile-panel[data-rms-panel]");
    if (!panels.length) return;
    var scrollTop = scroller.scrollTop;
    var active = panels[0].getAttribute("data-rms-panel") || "";
    var best = Infinity;
    panels.forEach(function (panel) {
      var dist = Math.abs(panel.offsetTop - scrollTop);
      if (dist < best) {
        best = dist;
        active = panel.getAttribute("data-rms-panel") || active;
      }
    });
    dots.forEach(function (dot) {
      var id = dot.getAttribute("data-rms-scroll-to");
      dot.classList.toggle("is-active", id === active);
    });
  }

  function bindMobileSnapScrollEvents() {
    if (state.mobileSnapBound) return;
    state.mobileSnapBound = true;
    window.addEventListener(
      "resize",
      function () {
        updateMobileSnapLayout();
      },
      { passive: true },
    );
    if (!el.landingContent) return;
    el.landingContent.addEventListener("click", function (event) {
      var cue = event.target.closest("[data-rms-scroll-to]");
      if (!cue) return;
      var panelId = cue.getAttribute("data-rms-scroll-to");
      var wrap = cue.closest(".rms-snap-wrap");
      if (!wrap || !panelId) return;
      var scroller = wrap.querySelector("[data-rms-mobile-scroll]");
      var panel = scroller && scroller.querySelector('[data-rms-panel="' + panelId + '"]');
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    el.landingContent.addEventListener(
      "scroll",
      function (event) {
        var target = event.target;
        if (!target || !target.getAttribute || target.getAttribute("data-rms-mobile-scroll") === null) return;
        syncMobileSnapDots(target);
      },
      true,
    );
  }

  function getLandingPhoneMockupHtml() {
    return (
      '<div class="landing-phone-stage" aria-hidden="true">' +
      '<div class="landing-phone-glow"></div>' +
      '<div class="landing-phone-device">' +
      '<div class="landing-phone-notch"></div>' +
      '<div class="landing-phone-screen">' +
      '<div class="landing-phone-maps-bar">' +
      '<span class="landing-phone-maps-dot"></span>' +
      '<span class="landing-phone-maps-dot"></span>' +
      '<span class="landing-phone-maps-dot"></span>' +
      "<span>Google Maps</span>" +
      "</div>" +
      '<div class="landing-phone-restaurant">' +
      '<div class="landing-phone-restaurant-name">' +
      escapeHtml(MARKETING_COPY.landingPhoneRestaurant) +
      "</div>" +
      '<div class="landing-phone-restaurant-meta">4.8 ★★★★★ (324)</div>' +
      '<div class="landing-phone-restaurant-tags">Italian · $$ · Open now</div>' +
      "</div>" +
      '<div class="landing-phone-map-preview"><span class="landing-phone-map-pin"></span></div>' +
      "</div>" +
      '<div class="landing-phone-rank-card">' +
      '<span class="landing-phone-rank-badge">' +
      escapeHtml(MARKETING_COPY.landingPhoneRankBadge) +
      "</span>" +
      '<span class="landing-phone-rank-label">' +
      escapeHtml(MARKETING_COPY.landingPhoneRankLabel) +
      "</span>" +
      "</div>" +
      '<div class="landing-phone-notif">' +
      '<span class="landing-phone-notif-star">★</span>' +
      escapeHtml(MARKETING_COPY.landingPhoneNotif) +
      "</div>" +
      "</div></div>"
    );
  }

  function getLandingHeroSectionHtml(options) {
    var opts = options || {};
    var leadAnchor = opts.leadAnchor || "landing-lead";
    return (
      '<section class="landing-hero landing-reveal" aria-label="Hero">' +
      '<div class="landing-hero-grid">' +
      '<div class="landing-hero-copy">' +
      "<h1 class=\"landing-hero-title\">" +
      escapeHtml(MARKETING_COPY.heroTitleLead) +
      ' <span class="landing-hero-title-accent">' +
      escapeHtml(MARKETING_COPY.heroTitleAccent) +
      "</span></h1>" +
      '<p class="landing-hero-sub">' +
      escapeHtml(MARKETING_COPY.heroBody) +
      "</p>" +
      '<ul class="landing-hero-benefits">' +
      '<li class="landing-hero-benefit"><span class="landing-hero-benefit-icon" aria-hidden="true">✓</span>' +
      escapeHtml(MARKETING_COPY.landingBenefitRank) +
      "</li>" +
      '<li class="landing-hero-benefit"><span class="landing-hero-benefit-icon" aria-hidden="true">✓</span>' +
      escapeHtml(MARKETING_COPY.landingBenefitCalls) +
      "</li>" +
      '<li class="landing-hero-benefit"><span class="landing-hero-benefit-icon" aria-hidden="true">✓</span>' +
      escapeHtml(MARKETING_COPY.landingBenefitReviews) +
      "</li>" +
      "</ul>" +
      '<div class="landing-hero-ctas">' +
      '<a class="landing-cta-primary" href="#' +
      escapeHtml(leadAnchor) +
      '">' +
      escapeHtml(MARKETING_COPY.landingCtaPrimary) +
      "</a>" +
      '<a class="landing-cta-secondary" href="#landing-ryan">' +
      escapeHtml(MARKETING_COPY.landingCtaSecondary) +
      "</a>" +
      "</div>" +
      '<ul class="landing-hero-trust-row">' +
      "<li>" +
      escapeHtml(MARKETING_COPY.landingTrustFree) +
      "</li>" +
      "<li>" +
      escapeHtml(MARKETING_COPY.landingTrustNoObligation) +
      "</li>" +
      "<li>" +
      escapeHtml(MARKETING_COPY.landingTrustFast) +
      "</li>" +
      "</ul>" +
      "</div>" +
      getLandingPhoneMockupHtml() +
      "</div></section>"
    );
  }

  function getLandingStatsSectionHtml() {
    return (
      '<section class="landing-stats landing-reveal" aria-label="Results">' +
      '<div class="landing-stats-card">' +
      '<div class="landing-stat">' +
      '<div class="landing-stat-value landing-stat-value--accent">' +
      escapeHtml(MARKETING_COPY.landingStatGrowth) +
      "</div>" +
      '<div class="landing-stat-label">' +
      escapeHtml(MARKETING_COPY.landingStatGrowthLabel) +
      "</div></div>" +
      '<div class="landing-stat">' +
      '<div class="landing-stat-value">' +
      escapeHtml(MARKETING_COPY.landingStatBookings) +
      "</div>" +
      '<div class="landing-stat-label">' +
      escapeHtml(MARKETING_COPY.landingStatBookingsLabel) +
      "</div></div>" +
      '<div class="landing-stat">' +
      '<div class="landing-stat-value landing-stat-value--green">' +
      escapeHtml(MARKETING_COPY.landingStatReviews) +
      "</div>" +
      '<div class="landing-stat-label">' +
      escapeHtml(MARKETING_COPY.landingStatReviewsLabel) +
      "</div></div>" +
      '<div class="landing-stat">' +
      '<div class="landing-stat-value">' +
      escapeHtml(MARKETING_COPY.landingStatTraffic) +
      "</div>" +
      '<div class="landing-stat-label">' +
      escapeHtml(MARKETING_COPY.landingStatTrafficLabel) +
      "</div></div>" +
      "</div></section>"
    );
  }

  function getLandingLeadSectionHtml(options) {
    var opts = options || {};
    var sectionId = opts.sectionId || "landing-lead";
    return (
      '<section id="' +
      escapeHtml(sectionId) +
      '" class="landing-lead landing-reveal" aria-label="Free report">' +
      '<div class="landing-lead-card">' +
      (opts.hideTitle
        ? ""
        : '<h2 class="landing-lead-title">' + escapeHtml(MARKETING_COPY.landingLeadTitle) + "</h2>") +
      getHeroBriefFormHtml({
        formId: opts.formId,
        feedbackId: opts.feedbackId,
      }) +
      "</div></section>"
    );
  }

  function getLandingTrustSectionHtml() {
    return (
      '<section class="landing-trust landing-reveal" aria-label="Trusted by restaurants">' +
      '<div class="landing-trust-logos">' +
      '<span class="landing-trust-logo">Restaurants</span>' +
      '<span class="landing-trust-logo landing-trust-logo--google">Google</span>' +
      '<span class="landing-trust-logo landing-trust-logo--yelp">Yelp</span>' +
      '<span class="landing-trust-logo landing-trust-logo--trip">TripAdvisor</span>' +
      "<span class=\"landing-trust-logo\">Facebook</span>" +
      "<span class=\"landing-trust-logo\">Instagram</span>" +
      "</div>" +
      '<div class="landing-trust-rating">' +
      '<span class="landing-trust-stars" aria-hidden="true">★★★★☆</span>' +
      '<span class="landing-trust-score">' +
      escapeHtml(MARKETING_COPY.landingSocialProof) +
      "</span>" +
      '<span class="landing-trust-count">' +
      escapeHtml(MARKETING_COPY.landingSocialCount) +
      "</span>" +
      "</div></section>"
    );
  }

  function getLandingRyanSectionHtml(digitalHumanPoints) {
    return (
      '<section id="landing-ryan" class="marketing-section marketing-digital-human card landing-reveal">' +
      '<div class="marketing-digital-grid">' +
      '<div class="marketing-digital-copy">' +
      '<div class="marketing-section-head marketing-section-head-compact">' +
      '<p class="marketing-section-kicker">' +
      escapeHtml(MARKETING_COPY.digitalHumanOverviewKicker || "") +
      "</p>" +
      '<h2 class="marketing-section-title">' +
      escapeHtml(MARKETING_COPY.digitalHumanOverviewTitle) +
      "</h2>" +
      "</div>" +
      '<h3 class="marketing-digital-heading">' +
      escapeHtml(MARKETING_COPY.digitalHumanOverviewHeading) +
      "</h3>" +
      '<p class="marketing-digital-body">' +
      escapeHtml(MARKETING_COPY.digitalHumanOverviewBody) +
      "</p>" +
      '<div class="marketing-digital-points">' +
      digitalHumanPoints +
      "</div>" +
      '<div class="marketing-digital-actions">' +
      '<a class="cta landing-link" href="' +
      getPagePath(ROUTE_TALK) +
      '">' +
      escapeHtml(MARKETING_COPY.digitalHumanCtaLabel) +
      "</a>" +
      '<a class="marketing-digital-alt-link" href="' +
      escapeHtml(MARKETING_COPY.digitalHumanPhoneHref) +
      '">' +
      escapeHtml(MARKETING_COPY.digitalHumanPhoneLabel) +
      "</a>" +
      "</div>" +
      "</div>" +
      '<div class="marketing-digital-media">' +
      '<video class="marketing-digital-video" src="' +
      DIGITAL_HUMAN_VIDEO_PATH +
      '" autoplay muted loop playsinline preload="auto" poster="' +
      DIGITAL_HUMAN_POSTER_PATH +
      '"></video>' +
      '<div class="marketing-digital-overlay">' +
      '<span class="marketing-digital-badge">' +
      escapeHtml(MARKETING_COPY.digitalHumanOverviewStageLabel || "") +
      "</span>" +
      '<div class="marketing-digital-overlay-card">' +
      "<strong>" +
      escapeHtml(MARKETING_COPY.digitalHumanOverviewStageTitle || "") +
      "</strong>" +
      "<p>" +
      escapeHtml(MARKETING_COPY.digitalHumanOverviewStageBody || "") +
      "</p>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>"
    );
  }

  function initLandingPageMotion() {
    if (!isLandingRoute() || !el.landingContent) return;
    var nodes = el.landingContent.querySelectorAll(".landing-reveal");
    if (!nodes.length) return;
    if (!("IntersectionObserver" in window)) {
      nodes.forEach(function (node) {
        node.classList.add("is-visible");
      });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    nodes.forEach(function (node) {
      observer.observe(node);
    });
  }

  function renderOverviewContent() {
    var digitalHumanPoints = (MARKETING_COPY.digitalHumanOverviewPoints || [])
      .map(function (item) {
        return '<span class="marketing-digital-point">' + escapeHtml(item) + "</span>";
      })
      .join("");
    return (
      '<div class="marketing-page marketing-page-overview">' +
      getMarketingNavHtml() +
      '<div class="rms-overview-desktop rms-desktop-only">' +
      getLandingHeroSectionHtml() +
      getLandingStatsSectionHtml() +
      getLandingLeadSectionHtml() +
      getLandingTrustSectionHtml() +
      getLandingRyanSectionHtml(digitalHumanPoints) +
      getMarketingFooterHtml() +
      "</div>" +
      '<div class="rms-overview-mobile rms-mobile-only rms-snap-wrap">' +
      '<div class="rms-mobile-scroll" data-rms-mobile-scroll>' +
      '<section class="rms-mobile-panel rms-mobile-panel--hero" data-rms-panel="hero">' +
      '<div class="rms-mobile-panel-inner">' +
      getLandingHeroSectionHtml({ leadAnchor: "landing-lead-mobile" }) +
      getRmsMobileScrollCueHtml("stats") +
      "</div></section>" +
      '<section class="rms-mobile-panel rms-mobile-panel--stats" data-rms-panel="stats">' +
      '<div class="rms-mobile-panel-inner">' +
      '<p class="rms-mobile-panel-label">' +
      escapeHtml(MARKETING_UI.mobilePanelStory) +
      "</p>" +
      getLandingStatsSectionHtml() +
      getRmsMobileScrollCueHtml("lead") +
      "</div></section>" +
      '<section class="rms-mobile-panel rms-mobile-panel--lead" data-rms-panel="lead">' +
      '<div class="rms-mobile-panel-inner">' +
      '<p class="rms-mobile-panel-lead-kicker">' +
      escapeHtml(MARKETING_COPY.landingTrustFree) +
      " · " +
      escapeHtml(MARKETING_COPY.landingTrustFast) +
      "</p>" +
      '<h2 class="rms-mobile-panel-lead-title">' +
      escapeHtml(MARKETING_UI.mobilePanelLeadTitle) +
      "</h2>" +
      '<p class="rms-mobile-panel-lead-sub">' +
      escapeHtml(MARKETING_UI.mobilePanelLeadSub) +
      "</p>" +
      getLandingLeadSectionHtml({
        sectionId: "landing-lead-mobile",
        formId: "heroBriefFormMobile",
        feedbackId: "heroBriefFeedbackMobile",
        hideTitle: true,
      }) +
      getRmsMobileScrollCueHtml("trust") +
      "</div></section>" +
      '<section class="rms-mobile-panel rms-mobile-panel--trust" data-rms-panel="trust">' +
      '<div class="rms-mobile-panel-inner">' +
      '<p class="rms-mobile-panel-label">' +
      escapeHtml(MARKETING_UI.mobilePanelTrust) +
      "</p>" +
      getLandingTrustSectionHtml() +
      getRmsMobileScrollCueHtml("digital") +
      "</div></section>" +
      '<section class="rms-mobile-panel rms-mobile-panel--digital" data-rms-panel="digital">' +
      '<div class="rms-mobile-panel-inner">' +
      '<p class="rms-mobile-panel-label">' +
      escapeHtml(MARKETING_UI.mobilePanelDigital) +
      "</p>" +
      getLandingRyanSectionHtml(digitalHumanPoints) +
      getRmsMobileScrollCueHtml("footer") +
      "</div></section>" +
      '<section class="rms-mobile-panel rms-mobile-panel--footer" data-rms-panel="footer">' +
      '<div class="rms-mobile-panel-inner">' +
      getMarketingFooterHtml() +
      "</div></section></div>" +
      getRmsMobileDotsHtml(["hero", "stats", "lead", "trust", "digital", "footer"], "hero") +
      "</div></div>"
    );
  }

function renderServicesContent() {
  return (
    '<div class="marketing-page services-page">' +

    getMarketingNavHtml() +

    '<section class="services-hero">' +
      '<div class="services-hero-inner">' +
        '<p class="services-kicker">AI DINER ACQUISITION SYSTEMS</p>' +
        '<h1 class="services-main-title">Scale Your Restaurant With Automated Diner Growth</h1>' +
        '<p class="services-subtitle">AI-powered review systems, social media growth, phone automation, and direct mail campaigns designed to increase reservations, calls, orders, and local visibility.</p>' +
      '</div>' +
    '</section>' +

    '<section class="services-wrapper">' +

      /* ========================== */ +
      /* TIER 1 */ +
      /* ========================== */ +

      '<div class="tier-section">' +

        '<div class="tier-header">' +
          '<span class="tier-badge">Tier 1</span>' +
          '<h2>Google Client Growth System</h2>' +
          '<p>Turn Google Maps into your #1 diner acquisition channel.</p>' +
        '</div>' +

        '<div class="services-grid">' +

          '<div class="service-card">' +
            '<div class="service-top">' +
              '<h3>AI Review Generator</h3>' +
              '<span class="setup-fee">+$199 setup</span>' +
            '</div>' +
            '<div class="pricing-row">' +
              '<span class="monthly-price">$29/mo</span>' +
              '<span class="annual-price">$200/year</span>' +
            '</div>' +
            '<p class="service-description">Generate more 5-star reviews automatically with QR + NFC powered review collection.</p>' +
            '<button class="service-btn">Learn More</button>' +
          '</div>' +

          '<div class="service-card">' +
            '<div class="service-top">' +
              '<h3>AI SMS Review Booster</h3>' +
              '<span class="setup-fee">+$299 setup</span>' +
            '</div>' +
            '<div class="pricing-row">' +
              '<span class="monthly-price">$99/mo</span>' +
              '<span class="annual-price">$999/year</span>' +
            '</div>' +
            '<p class="service-description">Automatically text diners after visits, reservations, or orders and boost your Google ranking with more reviews.</p>' +
            '<button class="service-btn">Learn More</button>' +
          '</div>' +

          '<div class="service-card featured-service">' +
            '<div class="service-top">' +
              '<h3>The Conversion Accelerator</h3>' +
            '</div>' +
            '<div class="pricing-row">' +
              '<span class="one-time-price">$999 one time</span>' +
            '</div>' +
            '<p class="service-description">High-converting website, menu, reservation, and ordering improvements built for restaurants.</p>' +
            '<button class="service-btn">Learn More</button>' +
          '</div>' +

        '</div>' +
      '</div>' +


      /* ========================== */ +
      /* TIER 2 */ +
      /* ========================== */ +

      '<div class="tier-section">' +

        '<div class="tier-header">' +
          '<span class="tier-badge">Tier 2</span>' +
          '<h2>Social Media Growth Engine</h2>' +
          '<p>Dominate Instagram, TikTok, and short-form restaurant marketing.</p>' +
        '</div>' +

        '<div class="services-grid">' +

          '<div class="service-card">' +
            '<h3>Starter</h3>' +
            '<div class="pricing-row">' +
              '<span class="monthly-price">$699/mo</span>' +
              '<span class="annual-price">$6999/year</span>' +
            '</div>' +
            '<p class="service-description">Entry-level social media growth system for restaurants ready to scale.</p>' +
            '<button class="service-btn">Learn More</button>' +
          '</div>' +

          '<div class="service-card">' +
            '<h3>Standard</h3>' +
            '<div class="pricing-row">' +
              '<span class="monthly-price">$999/mo</span>' +
              '<span class="annual-price">$9999/year</span>' +
            '</div>' +
            '<p class="service-description">Higher content volume, platform management, and aggressive restaurant growth strategy.</p>' +
            '<button class="service-btn">Learn More</button>' +
          '</div>' +

          '<div class="service-card featured-service">' +
            '<h3>Professional</h3>' +
            '<div class="pricing-row">' +
              '<span class="monthly-price">$1499/mo</span>' +
              '<span class="annual-price">$14999/year</span>' +
            '</div>' +
            '<p class="service-description">Full-scale restaurant brand growth engine with premium strategy and execution.</p>' +
            '<button class="service-btn">Learn More</button>' +
          '</div>' +

        '</div>' +
      '</div>' +


      /* ========================== */ +
      /* TIER 3 */ +
      /* ========================== */ +

      '<div class="tier-section">' +

        '<div class="tier-header">' +
          '<span class="tier-badge">Tier 3</span>' +
          '<h2>Phone Client Growth System</h2>' +
          '<p>Automate calls, lead follow-up, reservation questions, and diner communication.</p>' +
        '</div>' +

        '<div class="services-grid">' +

          '<div class="service-card">' +
            '<div class="service-top">' +
              '<h3>AI Front Desk</h3>' +
              '<span class="setup-fee">+$299 setup</span>' +
            '</div>' +
            '<div class="pricing-row">' +
              '<span class="monthly-price">$99/mo</span>' +
              '<span class="annual-price">$999/year</span>' +
            '</div>' +
            '<p class="service-description">AI host that answers calls, handles common questions, captures leads, and routes reservations or orders.</p>' +
            '<button class="service-btn">Learn More</button>' +
          '</div>' +

          '<div class="service-card featured-service">' +
            '<div class="service-top">' +
              '<h3>SMS Growth Suite</h3>' +
              '<span class="setup-fee">+$299 setup</span>' +
            '</div>' +
            '<div class="pricing-row">' +
              '<span class="monthly-price">$199/mo</span>' +
              '<span class="annual-price">$1999/year</span>' +
            '</div>' +
            '<p class="service-description">Automated SMS campaigns for promotions, reminders, and reactivation marketing.</p>' +
            '<button class="service-btn">Learn More</button>' +
          '</div>' +

        '</div>' +
      '</div>' +


      /* ========================== */ +
      /* TIER 4 */ +
      /* ========================== */ +

      '<div class="tier-section">' +

        '<div class="tier-header">' +
          '<span class="tier-badge">Tier 4</span>' +
          '<h2>Local Client Mail Campaign</h2>' +
          '<p>Offline direct mail campaigns designed to dominate local neighborhoods.</p>' +
        '</div>' +

        '<div class="services-grid single-grid">' +

          '<div class="service-card featured-service">' +
            '<div class="service-top">' +
              '<h3>Design & Mail Campaign</h3>' +
              '<span class="setup-fee">+$499 setup</span>' +
            '</div>' +
            '<div class="pricing-row">' +
              '<span class="monthly-price">$99 add-on</span>' +
            '</div>' +
            '<p class="service-description">Premium local mail marketing campaign with postcard design and distribution support.</p>' +
            '<button class="service-btn">Learn More</button>' +
          '</div>' +

        '</div>' +
      '</div>' +

    '</section>' +


    '<style>' +

      '.services-page{' +
        'background:#050505;' +
        'color:white;' +
        'min-height:100vh;' +
      '}' +

      '.services-hero{' +
        'padding:140px 24px 80px;' +
        'border-bottom:1px solid rgba(255,255,255,0.08);' +
      '}' +

      '.services-hero-inner{' +
        'max-width:1200px;' +
        'margin:0 auto;' +
      '}' +

      '.services-kicker{' +
        'font-size:12px;' +
        'letter-spacing:2px;' +
        'text-transform:uppercase;' +
        'color:#c7a86d;' +
        'margin-bottom:24px;' +
        'font-weight:700;' +
      '}' +

      '.services-main-title{' +
        'font-size:72px;' +
        'line-height:1.05;' +
        'max-width:900px;' +
        'margin-bottom:24px;' +
        'font-weight:700;' +
      '}' +

      '.services-subtitle{' +
        'max-width:760px;' +
        'font-size:20px;' +
        'line-height:1.7;' +
        'color:rgba(255,255,255,0.72);' +
      '}' +

      '.services-wrapper{' +
        'max-width:1280px;' +
        'margin:0 auto;' +
        'padding:80px 24px 120px;' +
      '}' +

      '.tier-section{' +
        'margin-bottom:120px;' +
      '}' +

      '.tier-header{' +
        'margin-bottom:40px;' +
      '}' +

      '.tier-badge{' +
        'display:inline-block;' +
        'padding:8px 16px;' +
        'border-radius:999px;' +
        'background:#c7a86d;' +
        'color:black;' +
        'font-size:12px;' +
        'font-weight:700;' +
        'margin-bottom:20px;' +
        'text-transform:uppercase;' +
      '}' +

      '.tier-header h2{' +
        'font-size:42px;' +
        'margin-bottom:14px;' +
      '}' +

      '.tier-header p{' +
        'font-size:18px;' +
        'color:rgba(255,255,255,0.65);' +
      '}' +

      '.services-grid{' +
        'display:grid;' +
        'grid-template-columns:repeat(3,1fr);' +
        'gap:24px;' +
      '}' +

      '.single-grid{' +
        'grid-template-columns:1fr;' +
        'max-width:520px;' +
      '}' +

      '.service-card{' +
        'background:#101010;' +
        'border:1px solid rgba(255,255,255,0.08);' +
        'border-radius:28px;' +
        'padding:32px;' +
        'transition:all 0.25s ease;' +
      '}' +

      '.service-card:hover{' +
        'transform:translateY(-4px);' +
        'border-color:#c7a86d;' +
      '}' +

      '.featured-service{' +
        'background:linear-gradient(180deg,#171717,#0c0c0c);' +
      '}' +

      '.service-top{' +
        'display:flex;' +
        'justify-content:space-between;' +
        'align-items:center;' +
        'gap:16px;' +
        'margin-bottom:24px;' +
      '}' +

      '.service-card h3{' +
        'font-size:28px;' +
        'line-height:1.2;' +
        'margin:0;' +
      '}' +

      '.setup-fee{' +
        'font-size:12px;' +
        'opacity:0.45;' +
        'white-space:nowrap;' +
      '}' +

      '.pricing-row{' +
        'display:flex;' +
        'flex-direction:column;' +
        'gap:10px;' +
        'margin-bottom:24px;' +
      '}' +

      '.monthly-price{' +
        'font-size:34px;' +
        'font-weight:700;' +
      '}' +

      '.annual-price{' +
        'font-size:18px;' +
        'color:#c7a86d;' +
        'font-weight:600;' +
      '}' +

      '.one-time-price{' +
        'font-size:34px;' +
        'font-weight:700;' +
        'color:#c7a86d;' +
      '}' +

      '.service-description{' +
        'font-size:16px;' +
        'line-height:1.7;' +
        'color:rgba(255,255,255,0.7);' +
        'margin-bottom:32px;' +
      '}' +

      '.service-btn{' +
        'width:100%;' +
        'height:54px;' +
        'border:none;' +
        'border-radius:14px;' +
        'background:#c7a86d;' +
        'color:black;' +
        'font-size:15px;' +
        'font-weight:700;' +
        'cursor:pointer;' +
        'transition:all 0.2s ease;' +
      '}' +

      '.service-btn:hover{' +
        'opacity:0.92;' +
        'transform:translateY(-1px);' +
      '}' +

      '@media (max-width: 1100px){' +
        '.services-grid{' +
          'grid-template-columns:1fr 1fr;' +
        '}' +
      '}' +

      '@media (max-width: 768px){' +

        '.services-hero{' +
          'padding:120px 20px 70px;' +
        '}' +

        '.services-main-title{' +
          'font-size:42px;' +
        '}' +

        '.services-subtitle{' +
          'font-size:16px;' +
        '}' +

        '.services-grid{' +
          'grid-template-columns:1fr;' +
        '}' +

        '.service-card{' +
          'min-height:100vh;' +
          'display:flex;' +
          'flex-direction:column;' +
          'justify-content:center;' +
        '}' +

        '.tier-header h2{' +
          'font-size:32px;' +
        '}' +

      '}' +

    '</style>' +

    '</div>'
  );
}

  function renderPriceContent() {
    return (
      '<div class="marketing-page marketing-page-price">' +
      getMarketingNavHtml() +
      '<section class="pricing-page-shell card">' +
      '<div class="pricing-page-top">' +
      '<p class="marketing-section-kicker pricing-page-kicker">' +
      escapeHtml(MARKETING_UI.pricingKicker) +
      "</p>" +
      '<h1 class="pricing-page-title">' +
      escapeHtml(MARKETING_COPY.priceTitle) +
      "</h1>" +
      '<p class="pricing-page-body">' +
      escapeHtml(MARKETING_UI.pricingBody) +
      "</p>" +
      "</div>" +
      '<div class="pricing-page-plans">' +
      '<div class="pricing-page-plan-card">' +
      '<span class="pricing-page-plan-badge">' +
      escapeHtml(MARKETING_UI.pricingMonthly) +
      "</span>" +
      '<div class="pricing-page-plan-price">' +
      '<span class="pricing-page-amount-value">' +
      escapeHtml(MARKETING_COPY.pricingAmount) +
      "</span>" +
      '<span class="pricing-page-period">' +
      escapeHtml(MARKETING_COPY.pricingPeriod) +
      "</span>" +
      "</div>" +
      '<p class="pricing-page-plan-detail">' +
      escapeHtml(MARKETING_UI.pricingMonthlyDetail) +
      "</p>" +
      '<button class="cta pricing-buy-btn pricing-page-cta" type="button">' +
      escapeHtml(MARKETING_COPY.pricingCtaLabel) +
      "</button>" +
      "</div>" +
      '<div class="pricing-page-plan-card pricing-page-plan-annual">' +
      '<span class="pricing-page-plan-badge pricing-page-plan-badge-highlight">' +
      escapeHtml(MARKETING_UI.pricingAnnualBadge) +
      "</span>" +
      '<div class="pricing-page-plan-price">' +
      '<span class="pricing-page-amount-value">' +
      escapeHtml(MARKETING_COPY.pricingAnnualAmount) +
      "</span>" +
      '<span class="pricing-page-period">' +
      escapeHtml(MARKETING_COPY.pricingAnnualPeriod) +
      "</span>" +
      "</div>" +
      '<p class="pricing-page-plan-detail">' +
      escapeHtml(MARKETING_UI.pricingAnnualDetailPrefix) +
      " " +
      escapeHtml(MARKETING_COPY.pricingAnnualSaveNote) +
      ".</p>" +
      '<button class="cta pricing-buy-btn pricing-page-cta" type="button">' +
      escapeHtml(MARKETING_COPY.pricingCtaLabel) +
      "</button>" +
      "</div>" +
      "</div>" +
      '<div class="pricing-page-guarantees">' +
      getPricingGuaranteeHtml("pricing-page-guarantee", "pricing-page-divider") +
      "</div>" +
      "</section>" +
      '<section class="pricing-page-extras">' +
      '<div class="pricing-page-extras-grid">' +
      '<aside class="pricing-page-setup-card" aria-label="One-time professional setup fee">' +
      '<p class="pricing-page-setup-badge">' +
      escapeHtml(MARKETING_COPY.pricingSetupBadge) +
      "</p>" +
      '<h2 class="pricing-page-setup-title">' +
      escapeHtml(MARKETING_COPY.pricingSetupTitle) +
      "</h2>" +
      '<p class="pricing-page-setup-amount">' +
      escapeHtml(MARKETING_COPY.pricingSetupAmount) +
      "</p>" +
      '<p class="pricing-page-setup-copy">' +
      escapeHtml(MARKETING_UI.pricingSetupCopy) +
      "</p>" +
      '<p class="pricing-page-setup-includes">' +
      escapeHtml(MARKETING_COPY.pricingSetupIncludes) +
      "</p>" +
      "</aside>" +
      '<aside class="pricing-page-setup-card pricing-page-addon-card" aria-label="Extra NFC device">' +
      '<p class="pricing-page-setup-badge">' +
      escapeHtml(MARKETING_COPY.pricingExtraDeviceBadge) +
      "</p>" +
      '<h2 class="pricing-page-setup-title">' +
      escapeHtml(MARKETING_COPY.pricingExtraDeviceTitle) +
      "</h2>" +
      '<p class="pricing-page-setup-amount">' +
      escapeHtml(MARKETING_COPY.pricingExtraDeviceAmount) +
      '<span class="pricing-page-setup-amount-unit">' +
      escapeHtml(MARKETING_UI.pricingExtraAmountUnit) +
      "</span>" +
      "</p>" +
      '<p class="pricing-page-setup-copy">' +
      escapeHtml(MARKETING_COPY.pricingExtraDeviceCopy) +
      "</p>" +
      "</aside>" +
      "</div>" +
      "</section>" +
      getMarketingFooterHtml() +
      "</div>"
    );
  }

  function renderPlaceholderContent(title, body, cards) {
    const resolvedCards = Array.isArray(cards) ? cards : [];

    return (
      '<div class="marketing-page marketing-page-placeholder">' +
      getMarketingNavHtml() +
      '<section class="marketing-placeholder card">' +
      '<p class="marketing-section-kicker">Placeholder</p>' +
      '<h1 class="marketing-title marketing-title-small">' +
      escapeHtml(title) +
      "</h1>" +
      '<p class="marketing-body marketing-body-wide">' +
      escapeHtml(body) +
      "</p>" +
      '<div class="marketing-placeholder-grid">' +
      resolvedCards
        .map(function (card) {
          return (
            '<article class="marketing-placeholder-card">' +
            '<h2>' +
            escapeHtml(card.title) +
            "</h2>" +
            '<p>' +
            escapeHtml(card.body) +
            "</p>" +
            "</article>"
          );
        })
        .join("") +
      "</div>" +
      "</section>" +
      getMarketingFooterHtml() +
      "</div>"
    );
  }

  function renderAboutContent() {
    return (
      '<div class="marketing-page marketing-page-about">' +
      getMarketingNavHtml() +
      '<section class="about-page-hero card">' +
      '<div class="about-page-hero-copy">' +
      '<p class="marketing-section-kicker">' +
      escapeHtml(ABOUT_PAGE_CONTENT.kicker) +
      "</p>" +
      '<h1 class="marketing-title marketing-title-small">' +
      escapeHtml(ABOUT_PAGE_CONTENT.title) +
      "</h1>" +
      '<p class="about-page-hero-tagline">' +
      escapeHtml(ABOUT_PAGE_CONTENT.tagline) +
      "</p>" +
      '<p class="marketing-body marketing-body-wide about-page-hero-body">' +
      escapeHtml(ABOUT_PAGE_CONTENT.intro) +
      "</p>" +
      '<p class="about-page-summary">' +
      escapeHtml(ABOUT_PAGE_CONTENT.summary) +
      "</p>" +
      "</div>" +
      '<div class="about-page-pillar-grid">' +
      ABOUT_PAGE_CONTENT.pillars
        .map(function (card) {
          return (
            '<article class="about-page-pillar-card">' +
            '<h2>' +
            escapeHtml(card.title) +
            "</h2>" +
            '<p class="about-page-card-copy">' +
            escapeHtml(card.body) +
            "</p>" +
            "</article>"
          );
        })
        .join("") +
      "</div>" +
      "</section>" +
      '<section class="about-page-section card">' +
      '<div class="about-page-section-head">' +
      '<p class="marketing-section-kicker">' +
      escapeHtml(ABOUT_PAGE_CONTENT.storyKicker) +
      "</p>" +
      '<h2 class="marketing-section-title">' +
      escapeHtml(ABOUT_PAGE_CONTENT.storyTitle) +
      "</h2>" +
      '<p class="about-page-section-copy">' +
      escapeHtml(ABOUT_PAGE_CONTENT.storyBody) +
      "</p>" +
      "</div>" +
      '<div class="about-page-strength-block">' +
      '<div class="about-page-subhead">' +
      '<p class="marketing-section-kicker">' +
      escapeHtml(ABOUT_PAGE_CONTENT.strengthsKicker) +
      "</p>" +
      '<h3 class="about-page-subtitle">' +
      escapeHtml(ABOUT_PAGE_CONTENT.strengthsTitle) +
      "</h3>" +
      "</div>" +
      '<div class="about-page-strength-grid">' +
      ABOUT_PAGE_CONTENT.strengths
        .map(function (card) {
          return (
            '<article class="about-page-info-card">' +
            '<h4>' +
            escapeHtml(card.title) +
            "</h4>" +
            '<p class="about-page-card-copy">' +
            escapeHtml(card.body) +
            "</p>" +
            "</article>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="about-page-section card">' +
      '<div class="about-page-subhead">' +
      '<p class="marketing-section-kicker">' +
      escapeHtml(ABOUT_PAGE_CONTENT.teamKicker) +
      "</p>" +
      '<h2 class="marketing-section-title">' +
      escapeHtml(ABOUT_PAGE_CONTENT.teamTitle) +
      "</h2>" +
      "</div>" +
      '<div class="about-page-team-grid">' +
      ABOUT_PAGE_CONTENT.team
        .map(function (person) {
          return (
            '<article class="about-page-team-card">' +
            '<p class="about-page-team-name">' +
            escapeHtml(person.name) +
            "</p>" +
            '<p class="about-page-team-role">' +
            escapeHtml(person.role) +
            "</p>" +
            '<p class="about-page-card-copy">' +
            escapeHtml(person.body) +
            "</p>" +
            "</article>"
          );
        })
        .join("") +
      "</div>" +
      "</section>" +
      '<section class="about-page-section card">' +
      '<div class="about-page-subhead">' +
      '<p class="marketing-section-kicker">' +
      escapeHtml(ABOUT_PAGE_CONTENT.edgeKicker) +
      "</p>" +
      '<h2 class="marketing-section-title">' +
      escapeHtml(ABOUT_PAGE_CONTENT.edgeTitle) +
      "</h2>" +
      "</div>" +
      '<div class="about-page-edge-grid">' +
      ABOUT_PAGE_CONTENT.edge
        .map(function (item) {
          return (
            '<article class="about-page-info-card">' +
            '<h4>' +
            escapeHtml(item.title) +
            "</h4>" +
            '<p class="about-page-card-copy">' +
            escapeHtml(item.body) +
            "</p>" +
            "</article>"
          );
        })
        .join("") +
      "</div>" +
      "</section>" +
      '<section class="about-page-cta card">' +
      '<div class="about-page-cta-copy">' +
      '<p class="marketing-section-kicker">' +
      escapeHtml(ABOUT_PAGE_CONTENT.ctaKicker) +
      "</p>" +
      '<h2 class="about-page-cta-title">' +
      escapeHtml(ABOUT_PAGE_CONTENT.ctaTitle) +
      "</h2>" +
      '<p class="about-page-cta-body">' +
      escapeHtml(ABOUT_PAGE_CONTENT.ctaBody) +
      "</p>" +
      '<div class="about-page-cta-meta">' +
      '<p class="about-page-cta-note">' +
      escapeHtml(ABOUT_PAGE_CONTENT.ctaNote) +
      "</p>" +
      '<div class="about-page-cta-highlight-grid">' +
      ABOUT_PAGE_CONTENT.ctaHighlights
        .map(function (item) {
          return (
            '<div class="about-page-cta-highlight-item">' +
            '<span class="about-page-cta-highlight-dot" aria-hidden="true"></span>' +
            '<span class="about-page-cta-highlight-text">' +
            escapeHtml(item) +
            "</span>" +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      '<div class="about-page-cta-links">' +
      '<a class="about-page-cta-link" href="mailto:info@360AIMedia.com">info@360AIMedia.com</a>' +
      '<a class="about-page-cta-link" href="tel:+19178919292">+1 (917) 891-9292</a>' +
      "</div>" +
      "</div>" +
      '<div class="about-page-cta-form-shell">' +
      getMarketingLeadFormHtml("aboutLeadForm", "aboutLeadFeedback") +
      "</div>" +
      "</section>" +
      getMarketingFooterHtml() +
      "</div>"
    );
  }

  function setMarketingLeadFormFeedback(form, message, tone) {
    if (!form) return;
    var feedback = form.querySelector("[data-lead-feedback]");
    if (!feedback) return;
    feedback.textContent = message || "";
    var baseClass = feedback.getAttribute("data-feedback-class") || "about-page-form-feedback";
    feedback.className = baseClass + (tone ? " is-" + tone : "");
  }

  async function handleMarketingLeadFormSubmit(form) {
    if (!form) return;
    if (typeof form.reportValidity === "function" && !form.reportValidity()) return;

    var formData = new FormData(form);

    if (form.classList.contains("marketing-hero-brief-form")) {
      var salonName = String(formData.get("salon_name") || "").trim();
      var contactRaw = String(formData.get("contact") || "").trim();
      var smsConsent = String(formData.get("sms_consent") || "").toLowerCase() === "on";
      var email = "";
      var phone = "";
      if (contactRaw.indexOf("@") >= 0) {
        email = contactRaw;
      } else {
        phone = contactRaw;
      }
      var emailOk = email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      var digits = phone.replace(/\D/g, "");
      var phoneOk = digits.length >= 7;

      if (!salonName || !contactRaw) {
        setMarketingLeadFormFeedback(form, MARKETING_UI.heroBriefFieldsRequired, "error");
        return;
      }
      if (email.length > 0 && !emailOk) {
        setMarketingLeadFormFeedback(form, MARKETING_UI.heroBriefInvalidEmail, "error");
        return;
      }
      if (!emailOk && !phoneOk) {
        setMarketingLeadFormFeedback(form, MARKETING_UI.heroBriefInvalidPhone, "error");
        return;
      }
      if (phoneOk && !smsConsent) {
        setMarketingLeadFormFeedback(form, MARKETING_UI.formSmsConsentRequired, "error");
        return;
      }

      setMarketingLeadFormFeedback(form, MARKETING_UI.formSending, "ok");

      try {
        await fetchJson("/api/contact-leads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: salonName,
            email: emailOk ? email : "",
            phone: phoneOk ? phone : "",
            message: "Requested brief Google Maps visibility report (homepage).",
            service: "Brief visibility report",
            source: "hero_brief",
            smsConsent: phoneOk ? smsConsent : false,
          }),
        });
        form.reset();
        setMarketingLeadFormFeedback(form, MARKETING_UI.heroBriefSuccess, "ok");
      } catch (error) {
        console.error("Marketing lead form failed", error);
        var hint =
          error && error.message ? String(error.message) : MARKETING_UI.formFailure;
        var code = error && error.code ? String(error.code) : "";
        setMarketingLeadFormFeedback(form, code ? hint + " [" + code + "]" : hint, "error");
      }
      return;
    }

    var name = String(formData.get("name") || "").trim();
    var email = String(formData.get("email") || "").trim();
    var phone = String(formData.get("phone") || "").trim();
    var company = String(formData.get("company") || "").trim();
    var service = String(formData.get("service") || "").trim() || "Not specified";
    var message = String(formData.get("message") || "").trim();
    var smsConsent = String(formData.get("sms_consent") || "").toLowerCase() === "on";
    var source = form.id === "contactModalLeadForm" ? "contact_modal" : "about_page";
    if (!smsConsent) {
      setMarketingLeadFormFeedback(form, MARKETING_UI.formSmsConsentRequired, "error");
      return;
    }

    setMarketingLeadFormFeedback(form, MARKETING_UI.formSending, "ok");

    try {
      await fetchJson("/api/contact-leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name,
          email: email,
          phone: phone,
          company: company,
          service: service,
          message: message,
          source: source,
          smsConsent: smsConsent,
        }),
      });
      form.reset();
      setMarketingLeadFormFeedback(form, MARKETING_UI.formSuccess, "ok");
      if (form.id === "contactModalLeadForm") {
        window.setTimeout(function () {
          closeMarketingContactModal();
        }, 1400);
      }
    } catch (error) {
      console.error("Marketing lead form failed", error);
      var hint =
        error && error.message
          ? String(error.message)
          : MARKETING_UI.formFailure;
      var code = error && error.code ? String(error.code) : "";
      setMarketingLeadFormFeedback(form, code ? hint + " [" + code + "]" : hint, "error");
    }
  }

  function getMarketingContactModalEl() {
    return document.getElementById("marketingContactModal");
  }

  function openMarketingContactModal() {
    var modal = getMarketingContactModalEl();
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("marketing-contact-modal-open");
    var firstInput = modal.querySelector("input[name=\"name\"]");
    if (firstInput && typeof firstInput.focus === "function") {
      window.setTimeout(function () {
        firstInput.focus();
      }, 50);
    }
  }

  function closeMarketingContactModal() {
    var modal = getMarketingContactModalEl();
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("marketing-contact-modal-open");
  }

  function renderAssistantContent() {
    const telHref = escapeHtml(MARKETING_COPY.digitalHumanPhoneHref || "tel:8776003082");
    return (
      '<div class="marketing-page marketing-page-assistant">' +
      getMarketingNavHtml() +
      '<section class="assistant-shell">' +
      '<div class="assistant-panel card assistant-panel--call">' +
      '<div class="assistant-panel-head">' +
      '<p class="marketing-section-kicker">' +
      escapeHtml(MARKETING_UI.assistantKicker) +
      "</p>" +
      '<h1 class="marketing-title marketing-title-small">' +
      escapeHtml(MARKETING_COPY.digitalHumanTitle) +
      "</h1>" +
      '<p class="assistant-voice-intro">' +
      escapeHtml(MARKETING_UI.assistantVoiceIntro) +
      "</p>" +
      "</div>" +
      '<div class="assistant-call-actions">' +
      '<a class="cta landing-link assistant-call-cta" href="' +
      telHref +
      '">' +
      escapeHtml(MARKETING_UI.assistantCallCta) +
      "</a>" +
      '<p class="assistant-call-alt">' +
      escapeHtml(MARKETING_COPY.digitalHumanPhoneLabel) +
      "</p>" +
      '<a class="ghost landing-link assistant-back-link" href="/">' +
      escapeHtml(MARKETING_UI.assistantBack) +
      "</a>" +
      "</div>" +
      "</div>" +
      '<div class="assistant-stage card assistant-stage--call">' +
      '<div class="assistant-call-visual">' +
      '<img class="assistant-call-poster" src="' +
      escapeHtml(DIGITAL_HUMAN_POSTER_PATH) +
      '" alt="' +
      escapeHtml(MARKETING_COPY.digitalHumanTitle) +
      '">' +
      "</div>" +
      "</div>" +
      "</section>" +
      getMarketingFooterHtml() +
      "</div>"
    );
  }

  function renderLegalContent(kind) {
    var page = LEGAL_PAGE_CONTENT[kind] || LEGAL_PAGE_CONTENT.privacy;
    return (
      '<div class="marketing-page marketing-page-legal">' +
      getMarketingNavHtml() +
      '<section class="legal-page-shell card">' +
      '<p class="marketing-section-kicker">Legal</p>' +
      '<h1 class="marketing-title marketing-title-small">' +
      escapeHtml(page.title) +
      "</h1>" +
      '<p class="legal-page-updated">' +
      escapeHtml(page.updatedAt) +
      "</p>" +
      '<p class="marketing-body marketing-body-wide legal-page-intro">' +
      escapeHtml(page.intro) +
      "</p>" +
      page.sections
        .map(function (section) {
          return (
            '<article class="legal-page-section">' +
            '<h2 class="legal-page-title">' +
            escapeHtml(section.title) +
            "</h2>" +
            '<ul class="legal-page-list">' +
            (section.bullets || [])
              .map(function (item) {
                return "<li>" + escapeHtml(item) + "</li>";
              })
              .join("") +
            "</ul>" +
            "</article>"
          );
        })
        .join("") +
      "</section>" +
      getMarketingFooterHtml() +
      "</div>"
    );
  }

  function renderLandingContent() {
    if (!el.landingContent) return;

    if (window.RmsFullReport && typeof window.RmsFullReport.destroyCharts === "function") {
      window.RmsFullReport.destroyCharts();
    }

    if (isLandingRoute()) {
      el.landingContent.innerHTML = renderOverviewContent();
      requestAnimationFrame(function () {
        updateMobileSnapLayout();
        var scroller = el.landingContent && el.landingContent.querySelector("[data-rms-mobile-scroll]");
        if (scroller) syncMobileSnapDots(scroller);
        initLandingPageMotion();
      });
      return;
    }

    if (isPriceRoute()) {
      el.landingContent.innerHTML = renderPriceContent();
      return;
    }

    if (isServicesRoute()) {
      el.landingContent.innerHTML = renderServicesContent();
      return;
    }

    if (isAboutRoute()) {
      el.landingContent.innerHTML = renderAboutContent();
      return;
    }

    if (isSmsConsentRoute()) {
      el.landingContent.innerHTML = renderLegalContent("sms");
      return;
    }

    if (isPrivacyRoute()) {
      el.landingContent.innerHTML = renderLegalContent("privacy");
      return;
    }

    if (isTermsRoute()) {
      el.landingContent.innerHTML = renderLegalContent("terms");
      return;
    }

    if (isAssistantRoute()) {
      el.landingContent.innerHTML = renderAssistantContent();
      return;
    }

    if (isLeaderboardListRoute()) {
      el.landingContent.innerHTML = renderLeaderboardListPage();
      return;
    }

    if (isLeaderboardSalonRoute()) {
      el.landingContent.innerHTML = renderLeaderboardDetailPage();
      return;
    }

    if (isAnalysisListRoute()) {
      el.landingContent.innerHTML = renderIntelListPage();
      return;
    }

    if (isAnalysisFullRoute()) {
      el.landingContent.innerHTML = renderIntelFullReportPage();
      requestAnimationFrame(function () {
        mountIntelFullReportView();
      });
      return;
    }

    if (isAnalysisSalonRoute()) {
      el.landingContent.innerHTML = renderIntelDetailPage();
      requestAnimationFrame(function () {
        updateMobileSnapLayout();
        var scroller = el.landingContent && el.landingContent.querySelector("[data-rms-mobile-scroll]");
        if (scroller) syncMobileSnapDots(scroller);
      });
      return;
    }

    el.landingContent.innerHTML = "";
  }

  function cleanupAssistantCall() {}

  function initializeAssistantPage() {
    if (!isAssistantRoute()) return;
    if (state.assistant.initialized) return;
    state.assistant.initialized = true;
  }

  function renderRouteView() {
    const store = isStoreRoute();
    const marketing = isMarketingRoute();
    const assistant = isAssistantRoute();
    const portal = isPortalRoute();

    document.body.classList.toggle("route-landing", isLandingRoute());
    document.body.classList.toggle("route-store", store);
    if (!store) {
      document.body.classList.remove("store-visit-ready", "store-has-receipt", "store-bootstrap-gated");
    } else {
      document.body.classList.toggle(
        "store-bootstrap-gated",
        !!state.storeBootstrapFailure || !!state.storeBootstrapPending,
      );
    }
    document.body.classList.toggle("route-marketing", marketing);
    document.body.classList.toggle("route-assistant", assistant);
    document.body.classList.toggle("route-portal", portal);
    document.body.classList.toggle("route-price", isPriceRoute());
    document.body.classList.toggle("route-about", isAboutRoute());
    document.body.classList.toggle("route-legal", isLegalRoute());
    document.body.classList.toggle("route-analysis", isAnalysisRoute());
    document.body.classList.toggle("route-analysis-list", isAnalysisListRoute());
    document.body.classList.toggle("route-analysis-salon", isAnalysisSalonRoute());
    document.body.classList.toggle("route-analysis-full", isAnalysisFullRoute());
    document.body.classList.toggle("route-leaderboard", isLeaderboardRoute());
    document.body.classList.toggle("route-leaderboard-list", isLeaderboardListRoute());
    document.body.classList.toggle("route-leaderboard-salon", isLeaderboardSalonRoute());
    if (el.appShell) el.appShell.classList.toggle("landing-mode", marketing);
    if (el.pageHero) el.pageHero.classList.toggle("hidden", !store);
    if (el.landingContent) el.landingContent.classList.toggle("hidden", !marketing);
    if (el.portalContent) el.portalContent.classList.toggle("hidden", !portal);
    if (el.layout) el.layout.classList.toggle("hidden", !store);
    if (el.visitSheetBackdrop) el.visitSheetBackdrop.classList.toggle("hidden", !store);
    if (!marketing) {
      state.isPricingSummaryOpen = false;
    }
    if (el.pricingSummaryBackdrop) el.pricingSummaryBackdrop.classList.toggle("hidden", !marketing);
    renderPricingSummary();
    trackPageView();

    if (marketing) {
      renderLandingContent();
      return;
    }

    if (el.landingContent) el.landingContent.innerHTML = "";
    if (!portal && el.portalContent) el.portalContent.innerHTML = "";
  }

  function getAltDishName(item) {
    return state.lang === "zh" ? item.en : item.zh;
  }

  function getDishName(item) {
    return state.lang === "zh" ? item.zh : item.en;
  }

  function getDishOptionLabel(item) {
    const primary = getDishName(item);
    const secondary = getAltDishName(item);
    if (!secondary || secondary === primary) return primary;
    return primary + " · " + secondary;
  }

  function isLikelyMobileDevice() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
      return navigator.userAgentData.mobile;
    }

    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  }

  function getBrowserReviewUrl() {
    return String(config.googleReviewUrl || "").trim();
  }

  function getMapsPlaceUrl() {
    return String(config.googleReviewFallbackUrl || "").trim() || getBrowserReviewUrl();
  }

  function getReviewRouteSet() {
    const browserUrl = getBrowserReviewUrl();
    const mapsUrl = getMapsPlaceUrl();
    const prefersMapsApp = isLikelyMobileDevice();
    const primaryUrl = prefersMapsApp ? mapsUrl || browserUrl : browserUrl || mapsUrl;
    const secondaryUrl = prefersMapsApp
      ? browserUrl && browserUrl !== primaryUrl ? browserUrl : ""
      : mapsUrl && mapsUrl !== primaryUrl ? mapsUrl : "";

    return {
      browserUrl: browserUrl,
      mapsUrl: mapsUrl,
      primaryUrl: primaryUrl,
      secondaryUrl: secondaryUrl,
    };
  }

  function getPrimaryReviewUrl() {
    return getReviewRouteSet().primaryUrl;
  }

  function getFallbackReviewUrl() {
    return getReviewRouteSet().secondaryUrl;
  }

  function getManualOpenText(url) {
    if (!url) return "";

    const routes = getReviewRouteSet();
    if (url === routes.mapsUrl) return t("manualOpenMaps");
    if (url === routes.browserUrl) return t("manualOpenBrowser");
    return t("manualOpen");
  }

  function updateManualOpenLink(overrideUrl, forceVisible) {
    const resolvedUrl = String(overrideUrl || getFallbackReviewUrl() || "").trim();
    const shouldShow =
      !!resolvedUrl &&
      ((forceVisible && !!overrideUrl) || (state.hasAttemptedReviewOpen && state.generatedReviews.length > 0));

    if (shouldShow) {
      el.manualOpenLink.href = resolvedUrl;
      el.manualOpenLink.textContent = getManualOpenText(resolvedUrl);
      el.manualOpenLink.classList.remove("hidden");
      return;
    }

    el.manualOpenLink.href = "#";
    el.manualOpenLink.textContent = "";
    el.manualOpenLink.classList.add("hidden");
  }

  function setStatus(target, msg, type, link) {
    const visibleMessage = msg || "";
    target.textContent = visibleMessage;
    target.classList.remove("ok", "error", "working");
    if (type === "ok" || type === "error" || type === "working") target.classList.add(type);
    if (target === el.reviewsStatus) {
      updateManualOpenLink(link, type === "error");
    }
  }

  function clearReviewsStatus() {
    setStatus(el.reviewsStatus, "", "", "");
  }

  function clearReceiptStatus() {
    setStatus(el.receiptStatus, "", "", "");
  }

  function getVisitSheetSelectionKey() {
    return state.isVisitSheetOpen ? state.visitSheetDraftTier : state.visitTier;
  }

  function canDismissVisitSheet() {
    return !!state.visitTier;
  }

  function resetVisitSheetDrag() {
    state.visitSheetDrag.active = false;
    state.visitSheetDrag.pointerId = null;
    state.visitSheetDrag.startY = 0;
    state.visitSheetDrag.lastY = 0;
    state.visitSheetDrag.startedAt = 0;
    el.visitSheetBackdrop.classList.remove("is-dragging");
    el.visitSheetBackdrop.style.removeProperty("--visit-sheet-drag-progress");
    el.visitSheetBackdrop.style.removeProperty("--visit-sheet-drag-y");
    el.visitSheetBackdrop.style.removeProperty("--visit-sheet-drag-scale");
  }

  function updateVisitSheetDrag(dragY) {
    const clampedDragY = Math.max(0, Number(dragY) || 0);
    const progress = Math.min(clampedDragY / 220, 1);
    const scaleOffset = Math.min(progress * 0.035, 0.035);
    el.visitSheetBackdrop.style.setProperty("--visit-sheet-drag-progress", progress.toFixed(3));
    el.visitSheetBackdrop.style.setProperty("--visit-sheet-drag-y", clampedDragY.toFixed(1) + "px");
    el.visitSheetBackdrop.style.setProperty("--visit-sheet-drag-scale", scaleOffset.toFixed(4));
  }

  function getReceiptMetaText() {
    if (state.isRecognizing) return "";
    if (!state.lastRecognitionMode) return "";

    const dishIds = Array.from(state.recognizedDishIds).sort(function (a, b) {
      return a - b;
    });

    if (dishIds.length === 1) {
      const item = state.dishMap.get(dishIds[0]);
      if (!item) return "";
      return formatText(t("receiptDetectedSingle"), { dish: getDishName(item) });
    }

    if (dishIds.length > 1) {
      return formatText(t("receiptDetectedMulti"), { count: dishIds.length });
    }

    if (state.uncertainTexts && state.uncertainTexts.length > 0) {
      return t("receiptDetectedUncertain");
    }

    return t("receiptDetectedNone");
  }

  function renderReceiptMeta() {
    setNodeText(el.receiptMeta, getReceiptMetaText());
  }

  function openVisitSheet(refreshAfterSelection) {
    clearVisitSheetDelay();
    resetVisitSheetDrag();
    state.isVisitSheetOpen = true;
    state.visitSheetDraftTier = state.visitTier || "";
    state.shouldRefreshAfterVisitSheet = refreshAfterSelection !== false;
    renderVisitSheet();
    renderReviewContext();
  }

  function closeVisitSheet() {
    resetVisitSheetDrag();
    state.isVisitSheetOpen = false;
    state.visitSheetDraftTier = state.visitTier || "";
    renderVisitSheet();
    renderReviewContext();
  }

  function clearVisitSheetDelay() {
    if (state.visitSheetDelayId) {
      window.clearTimeout(state.visitSheetDelayId);
      state.visitSheetDelayId = null;
    }
  }

  function scheduleVisitSheetOpen(refreshAfterSelection, delayMs) {
    clearVisitSheetDelay();
    state.visitSheetDelayId = window.setTimeout(function () {
      state.visitSheetDelayId = null;
      openVisitSheet(refreshAfterSelection);
    }, Math.max(0, Number(delayMs) || 0));
  }

  function ensureVisitTierSelected() {
    if (state.visitTier) return true;
    openVisitSheet(true);
    setStatus(el.reviewsStatus, t("visitRequired"), "working");
    return false;
  }

  function needsRecognitionBeforeReviews() {
    return !!state.receiptDataUrl && !state.lastRecognitionMode && state.recognizedDishIds.size === 0;
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(function () {
      return null;
    });

    if (!response.ok) {
      const nested = data && typeof data === "object" && data.error ? data.error : null;
      const message =
        nested && nested.message
          ? nested.message
          : data && typeof data === "object" && data.message
            ? data.message
            : "HTTP " + response.status;
      const error = new Error(message);
      if (nested && nested.code) {
        error.code = nested.code;
      }
      error.status = response.status;
      throw error;
    }

    return data;
  }

  function canInteractWithStoreVisitStars() {
    var isBusy = state.isRecognizing || state.isGenerating;
    var storeUnavailable = !!state.storeBootstrapFailure || !!state.storeBootstrapPending;
    return state.storeReviewFlowStage === "gate" && !isBusy && !storeUnavailable;
  }

  function updateStoreVisitStarsVisual() {
    if (!el.storeVisitStars) return;
    var selected = Number(state.storeVisitStars) || 0;
    var hover = Number(state.storeVisitStarsHover) || 0;
    var displayCount = hover > 0 ? hover : selected;
    var tiles = el.storeVisitStars.querySelectorAll(".store-visit-star-tile");
    tiles.forEach(function (btn, idx) {
      var starVal = idx + 1;
      var filled = starVal <= displayCount;
      btn.classList.toggle("is-filled", filled);
      btn.classList.toggle("is-active", starVal === selected && selected > 0);
      btn.setAttribute("aria-checked", starVal === selected ? "true" : "false");
      btn.disabled = !canInteractWithStoreVisitStars();
    });
  }

  function ensureStoreVisitStarsMarkup() {
    if (!el.storeVisitStars || state.storeVisitStarsBound) return;
    state.storeVisitStarsBound = true;
    el.storeVisitStars.innerHTML = "";
    for (var i = 1; i <= 5; i += 1) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "store-visit-star-tile";
      button.setAttribute("data-star-value", String(i));
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", "false");
      var glyph = document.createElement("span");
      glyph.className = "store-visit-star-glyph";
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = "★";
      button.appendChild(glyph);
      el.storeVisitStars.appendChild(button);
    }
  }

  function formatReviewCount(value) {
    if (value == null || !Number.isFinite(Number(value))) return "";
    try {
      return Number(value).toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US");
    } catch (e) {
      return String(Math.round(Number(value)));
    }
  }

  function formatGoogleTrustStars(rating) {
    var r = Math.max(0, Math.min(5, Number(rating) || 0));
    var full = Math.floor(r + 0.25);
    if (full < 1 && r > 0) full = 1;
    var stars = "";
    for (var i = 1; i <= 5; i += 1) {
      stars += i <= full ? "★" : "☆";
    }
    return stars;
  }

  function getStoreLogoInitial(name) {
    var text = String(name || "").trim();
    if (!text) return "R";
    return text.charAt(0).toUpperCase();
  }

  function getStoreLogoUrl(slug) {
    return STORE_LOGO_URLS[String(slug || "").trim()] || "";
  }

  function syncStoreVisitLogoMark() {
    if (!el.storeVisitLogoMark) return;
    var logoUrl = getStoreLogoUrl(state.storeSlug);
    if (logoUrl) {
      el.storeVisitLogoMark.classList.add("store-visit-logo--image");
      el.storeVisitLogoMark.textContent = "";
      var img = el.storeVisitLogoMark.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        img.className = "store-visit-logo-img";
        img.alt = "";
        el.storeVisitLogoMark.appendChild(img);
      }
      if (img.getAttribute("src") !== logoUrl) {
        img.setAttribute("src", logoUrl);
      }
      return;
    }

    el.storeVisitLogoMark.classList.remove("store-visit-logo--image");
    var existingImg = el.storeVisitLogoMark.querySelector("img");
    if (existingImg) existingImg.remove();
    el.storeVisitLogoMark.textContent = getStoreLogoInitial(getRestaurantName());
  }

  function syncStoreVisitPresentation() {
    var name = getRestaurantName();
    syncStoreVisitLogoMark();
    setNodeText(el.storeVisitBrandName, name);
    setNodeText(el.storeVisitHeroTitle, t("storeVisitHeroTitle"));
    setNodeText(el.storeVisitHeroLead, t("storeVisitHeroLead"));
    setNodeText(el.storeVisitGoogleBadgeLabel, t("storeVisitGoogleBadgeLabel"));
    setNodeText(el.storeVisitBenefitOneTitle, t("storeVisitBenefitOneTitle"));
    setNodeText(el.storeVisitBenefitOneBody, t("storeVisitBenefitOneBody"));
    setNodeText(el.storeVisitBenefitTwoTitle, t("storeVisitBenefitTwoTitle"));
    setNodeText(el.storeVisitBenefitTwoBody, t("storeVisitBenefitTwoBody"));

    var rating = state.storeGoogleRating;
    var reviewCount = state.storeReviewCount;
    var hasRating = rating != null && Number.isFinite(Number(rating));
    var hasReviews = reviewCount != null && Number.isFinite(Number(reviewCount)) && Number(reviewCount) > 0;
    if (el.storeVisitGoogleTrust) {
      el.storeVisitGoogleTrust.classList.toggle("hidden", !hasRating && !hasReviews);
    }
    if (hasRating && el.storeVisitGoogleTrustStars) {
      el.storeVisitGoogleTrustStars.textContent = formatGoogleTrustStars(rating);
    }
    if (el.storeVisitGoogleRating) {
      el.storeVisitGoogleRating.textContent = hasRating ? formatDashNumber(rating, 1) : "";
    }
    if (el.storeVisitGoogleReviewCount) {
      if (hasReviews) {
        var countText = formatReviewCount(reviewCount);
        el.storeVisitGoogleReviewCount.textContent =
          state.lang === "zh"
            ? "（" + countText + " " + t("storeVisitGoogleReviewsLabel") + "）"
            : "(" + countText + " " + t("storeVisitGoogleReviewsLabel") + ")";
      } else {
        el.storeVisitGoogleReviewCount.textContent = "";
      }
    }
  }

  function handleStoreVisitStarSelect(starValue) {
    var n = Number(starValue);
    if (!Number.isFinite(n) || n < 1 || n > 5 || !canInteractWithStoreVisitStars()) return;

    state.storeVisitStars = n;
    state.storeVisitStarsHover = 0;
    updateStoreVisitStarsVisual();
    trackEvent("store_visit_star_selected", analyticsParams({ rating: n }));

    if (n === 5) {
      state.storeReviewSatisfaction = "yes";
      state.storeReviewFlowStage = "visit";
      setNodeText(el.storeVisitMood, "");
      renderStoreFlowCard();
      renderFlowState();
      scrollCardIntoView(el.intakeCard, 8);
      trackEvent("store_flow_yes_clicked", analyticsParams({ rating: n }));
      return;
    }

    state.storeReviewSatisfaction = "no";
    setNodeText(el.storeVisitMood, t("storeCallbackIntro"));
    window.setTimeout(function () {
      openStorePrivateFeedbackModal("callback");
    }, 0);
    trackEvent("store_flow_no_clicked", analyticsParams({ rating: n }));
  }

  function syncStoreVisitStars() {
    if (!isStoreRoute() || !el.storeVisitStars) return;
    ensureStoreVisitStarsMarkup();
    el.storeVisitStars.setAttribute("aria-label", t("storeVisitStarsLabel"));
    updateStoreVisitStarsVisual();
    if (state.storeReviewFlowStage === "gate" && !(Number(state.storeVisitStars) || 0)) {
      setNodeText(el.storeVisitMood, "");
    }
  }

  function syncStoreVisitChrome() {
    if (!isStoreRoute()) {
      if (el.storeVisitShell) el.storeVisitShell.hidden = true;
      document.body.classList.remove("store-visit-ready", "store-has-receipt", "store-bootstrap-gated");
      return;
    }

    if (state.storeBootstrapPending) {
      if (el.storeVisitShell) el.storeVisitShell.hidden = true;
      document.body.classList.remove("store-visit-ready", "store-has-receipt");
      return;
    }

    if (state.storeBootstrapFailure) {
      document.body.classList.remove("store-visit-ready", "store-has-receipt");
      if (el.storeVisitShell) {
        el.storeVisitShell.hidden = false;
        var failLabel = getRestaurantName() || slugToStorePlaceholderLabel(state.storeSlug);
        setNodeText(
          el.storeVisitBrandName,
          String(failLabel || ""),
        );
        syncStoreVisitPresentation();
        setNodeText(el.storeVisitMood, resolveBootstrapFailureCopy(state.storeBootstrapFailure));
      }
      return;
    }

    document.body.classList.add("store-visit-ready");
    if (!el.storeVisitShell) return;
    el.storeVisitShell.hidden = state.storeReviewFlowStage === "reviews";

    var name = getRestaurantName();
    syncStoreVisitPresentation();

    if (el.storeVisitServiceCard) {
      el.storeVisitServiceCard.classList.add("hidden");
    }

    renderStoreFlowCard();
    syncStoreVisitStars();
    syncStoreVisitReceiptBlock();
    if (document.body.classList.contains("store-visit-ready") && !hasActiveResultFlow() && !state.storeBootstrapFailure) {
      clearReceiptStatus();
    }
  }

  function syncStorePrivateFeedbackSubmitBtn(isSubmitting) {
    if (!el.storePrivateFeedbackSubmitBtn) return;
    var isCallbackMode = state.storePrivateFeedbackMode === "callback";
    el.storePrivateFeedbackSubmitBtn.disabled = !!isSubmitting;
    if (isSubmitting) {
      el.storePrivateFeedbackSubmitBtn.textContent = t("storePrivateSubmitting");
      return;
    }
    if (isCallbackMode) {
      el.storePrivateFeedbackSubmitBtn.innerHTML =
        "<span>" +
        escapeHtml(t("storeFlowStepContinue")) +
        '</span><span class="store-flow-nav-icon" aria-hidden="true">→</span>';
      el.storePrivateFeedbackSubmitBtn.classList.add("store-private-feedback-continue-btn");
      return;
    }
    el.storePrivateFeedbackSubmitBtn.textContent = t("storePrivateSubmitBtn");
    el.storePrivateFeedbackSubmitBtn.classList.remove("store-private-feedback-continue-btn");
  }

  function syncStorePrivateFeedbackModalCopy() {
    if (!el.storePrivateFeedbackTitle) return;
    var isCallbackMode = state.storePrivateFeedbackMode === "callback";
    if (el.storePrivateFeedbackDialog) {
      el.storePrivateFeedbackDialog.classList.toggle("is-callback-mode", isCallbackMode);
    }
    setNodeText(el.storePrivateFeedbackTitle, t(isCallbackMode ? "storeCallbackTitle" : "storePrivateModalTitle"));
    setNodeText(el.storePrivateFeedbackIntro, t(isCallbackMode ? "storeCallbackIntro" : "storePrivateModalIntro"));
    setNodeText(el.storePrivateLabelName, t("storePrivateFieldName"));
    setNodeText(el.storePrivateLabelPhone, t(isCallbackMode ? "storeCallbackPhoneLabel" : "storePrivateFieldPhone"));
    setNodeText(el.storePrivateLabelGoogle, t("storePrivateFieldGoogle"));
    setNodeText(el.storePrivateLabelMessage, t("storePrivateFieldMessage"));
    if (el.storePrivateFeedbackCancelBtn) {
      el.storePrivateFeedbackCancelBtn.classList.toggle("hidden", isCallbackMode);
      if (!isCallbackMode) {
        setNodeText(el.storePrivateFeedbackCancelBtn, t("storePrivateCancelBtn"));
      }
    }
    syncStorePrivateFeedbackSubmitBtn(false);
    setNodeText(el.storePrivateFeedbackThanksTitle, t(isCallbackMode ? "storeCallbackThanksTitle" : "storePrivateThanksTitle"));
    setNodeText(el.storePrivateFeedbackThanksBody, t(isCallbackMode ? "storeCallbackThanksBody" : "storePrivateThanksBody"));
    setNodeText(
      el.storePrivateFeedbackThanksDoneBtn,
      t(isCallbackMode ? "storeCallbackThanksDone" : "storePrivateThanksDone"),
    );
    if (el.storePrivateFeedbackCloseBtn) {
      el.storePrivateFeedbackCloseBtn.setAttribute("aria-label", state.lang === "zh" ? "关闭" : "Close");
    }
    if (el.storePrivateInputPhone) {
      if (isCallbackMode) {
        el.storePrivateInputPhone.placeholder = t("storeCallbackPlaceholderPhone");
      } else {
        el.storePrivateInputPhone.placeholder = t("storePrivateFieldPhone");
      }
      el.storePrivateInputPhone.required = isCallbackMode;
    }
    if (el.storePrivateInputName) {
      el.storePrivateInputName.required = true;
      if (isCallbackMode) {
        el.storePrivateInputName.placeholder = t("storeCallbackPlaceholderName");
      } else {
        el.storePrivateInputName.placeholder = t("storePrivateFieldName");
      }
    }
    if (el.storePrivateInputMessage) {
      el.storePrivateInputMessage.required = true;
      if (isCallbackMode) {
        el.storePrivateInputMessage.placeholder = t("storeCallbackPlaceholderMessage");
      } else {
        el.storePrivateInputMessage.placeholder = t("storePrivateFieldMessage");
      }
    }
    if (el.storePrivateInputGoogle) {
      el.storePrivateInputGoogle.required = false;
      if (isCallbackMode) {
        el.storePrivateInputGoogle.placeholder = t("storeCallbackPlaceholderGoogle");
      } else {
        el.storePrivateInputGoogle.placeholder = t("storePrivateFieldGoogle");
      }
    }
    if (el.storePrivateInputName && el.storePrivateInputName.closest) {
      var nameWrap = el.storePrivateInputName.closest("label");
      if (nameWrap) {
        nameWrap.classList.remove("hidden");
        nameWrap.classList.toggle("store-private-feedback-label--placeholder-only", isCallbackMode);
      }
    }
    if (el.storePrivateInputGoogle && el.storePrivateInputGoogle.closest) {
      var googleWrap = el.storePrivateInputGoogle.closest("label");
      if (googleWrap) {
        googleWrap.classList.remove("hidden");
        googleWrap.classList.toggle("store-private-feedback-label--placeholder-only", isCallbackMode);
      }
    }
    if (el.storePrivateInputMessage && el.storePrivateInputMessage.closest) {
      var msgWrap = el.storePrivateInputMessage.closest("label");
      if (msgWrap) {
        msgWrap.classList.remove("hidden");
        msgWrap.classList.toggle("store-private-feedback-label--placeholder-only", isCallbackMode);
      }
    }
    if (el.storePrivateInputPhone && el.storePrivateInputPhone.closest) {
      var phoneWrap = el.storePrivateInputPhone.closest("label");
      if (phoneWrap) {
        phoneWrap.classList.remove("hidden");
        phoneWrap.classList.toggle("store-private-feedback-label--placeholder-only", isCallbackMode);
      }
    }
  }

  function resetStorePrivateFeedbackPanels() {
    if (el.storePrivateFeedbackForm) {
      el.storePrivateFeedbackForm.reset();
    }
    if (el.storePrivateFeedbackFormPane) {
      el.storePrivateFeedbackFormPane.classList.remove("hidden");
    }
    if (el.storePrivateFeedbackThanksPane) {
      el.storePrivateFeedbackThanksPane.classList.add("hidden");
    }
    if (el.storePrivateFeedbackFormError) {
      el.storePrivateFeedbackFormError.textContent = "";
      el.storePrivateFeedbackFormError.classList.add("hidden");
    }
    if (el.storePrivateFeedbackDialog) {
      el.storePrivateFeedbackDialog.classList.remove("is-callback-thanks");
    }
  }

  function openStorePrivateFeedbackModal(mode) {
    if (!el.storePrivateFeedbackBackdrop || !isStoreRoute() || state.storeBootstrapFailure || state.storeBootstrapPending) return;
    state.storePrivateFeedbackMode = mode === "callback" ? "callback" : "private";
    state.storePrivateFeedbackOpenedAt = Date.now();
    resetStorePrivateFeedbackPanels();
    syncStorePrivateFeedbackModalCopy();
    el.storePrivateFeedbackBackdrop.removeAttribute("hidden");
    el.storePrivateFeedbackBackdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("store-private-feedback-open");
    window.setTimeout(function () {
      if (!el.storePrivateFeedbackBackdrop || el.storePrivateFeedbackBackdrop.hasAttribute("hidden")) return;
      el.storePrivateFeedbackBackdrop.classList.add("is-open");
      if (state.storePrivateFeedbackMode === "callback" && el.storePrivateInputName) {
        el.storePrivateInputName.focus();
      }
    }, 20);
  }

  function closeStorePrivateFeedbackModal() {
    if (!el.storePrivateFeedbackBackdrop) return;
    document.body.classList.remove("store-private-feedback-open");
    el.storePrivateFeedbackBackdrop.classList.remove("is-open");
    el.storePrivateFeedbackBackdrop.setAttribute("aria-hidden", "true");
    window.setTimeout(function () {
      if (
        el.storePrivateFeedbackBackdrop &&
        !el.storePrivateFeedbackBackdrop.classList.contains("is-open")
      ) {
        el.storePrivateFeedbackBackdrop.setAttribute("hidden", "");
      }
    }, 240);
  }

  async function handleStorePrivateFeedbackSubmit(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (!el.storePrivateFeedbackForm || !state.storeSlug) return;
    var isCallbackMode = state.storePrivateFeedbackMode === "callback";
    var name = String((el.storePrivateInputName && el.storePrivateInputName.value) || "").trim();
    var phone = String((el.storePrivateInputPhone && el.storePrivateInputPhone.value) || "").trim();
    var googleAccount = String(
      (el.storePrivateInputGoogle && el.storePrivateInputGoogle.value) || "",
    ).trim();
    var message = String(
      (el.storePrivateInputMessage && el.storePrivateInputMessage.value) || "",
    ).trim();
    var phoneDigits = phone.replace(/\D/g, "");
    if (isCallbackMode && phoneDigits.length < 7) {
      if (el.storePrivateFeedbackFormError) {
        el.storePrivateFeedbackFormError.textContent = t("storeCallbackPhoneRequired");
        el.storePrivateFeedbackFormError.classList.remove("hidden");
      }
      return;
    }
    if (isCallbackMode && !name) {
      if (el.storePrivateFeedbackFormError) {
        el.storePrivateFeedbackFormError.textContent = t("storeCallbackNameRequired");
        el.storePrivateFeedbackFormError.classList.remove("hidden");
      }
      return;
    }
    if (isCallbackMode && (!message || message.length < 4)) {
      if (el.storePrivateFeedbackFormError) {
        el.storePrivateFeedbackFormError.textContent = t("storeCallbackMessageRequired");
        el.storePrivateFeedbackFormError.classList.remove("hidden");
      }
      return;
    }
    if (!isCallbackMode && !name) {
      if (el.storePrivateFeedbackFormError) {
        el.storePrivateFeedbackFormError.textContent =
          state.lang === "zh" ? "请填写称呼。" : "Please add your name.";
        el.storePrivateFeedbackFormError.classList.remove("hidden");
      }
      return;
    }
    if (!isCallbackMode && (!message || message.length < 4)) {
      if (el.storePrivateFeedbackFormError) {
        el.storePrivateFeedbackFormError.textContent =
          state.lang === "zh" ? "请写几句具体的反馈。" : "Please add a few words about your visit.";
        el.storePrivateFeedbackFormError.classList.remove("hidden");
      }
      return;
    }
    if (el.storePrivateFeedbackFormError) {
      el.storePrivateFeedbackFormError.textContent = "";
      el.storePrivateFeedbackFormError.classList.add("hidden");
    }
    syncStorePrivateFeedbackSubmitBtn(true);
    try {
      await fetchJson(
        "/api/stores/" + encodeURIComponent(String(state.storeSlug || "").trim()) + "/private-feedback",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: isCallbackMode ? name || (state.lang === "zh" ? "匿名顾客" : "Guest") : name,
            phone: phone,
            googleAccount: isCallbackMode ? "" : googleAccount,
            message: message,
            lang: state.lang === "zh" ? "zh" : "en",
          }),
        },
      );
      if (isCallbackMode) {
        if (el.storePrivateFeedbackFormPane) {
          el.storePrivateFeedbackFormPane.classList.add("hidden");
        }
        if (el.storePrivateFeedbackThanksPane) {
          el.storePrivateFeedbackThanksPane.classList.remove("hidden");
        }
        if (el.storePrivateFeedbackDialog) {
          el.storePrivateFeedbackDialog.classList.add("is-callback-thanks");
        }
        syncStorePrivateFeedbackModalCopy();
        return;
      }
      if (el.storePrivateFeedbackFormPane) {
        el.storePrivateFeedbackFormPane.classList.add("hidden");
      }
      if (el.storePrivateFeedbackThanksPane) {
        el.storePrivateFeedbackThanksPane.classList.remove("hidden");
      }
      syncStorePrivateFeedbackModalCopy();
    } catch (err) {
      console.error(err);
      if (el.storePrivateFeedbackFormError) {
        el.storePrivateFeedbackFormError.textContent =
          (err && err.message) || t("storePrivateErrorGeneric");
        el.storePrivateFeedbackFormError.classList.remove("hidden");
      }
    } finally {
      syncStorePrivateFeedbackSubmitBtn(false);
    }
  }

  function bindStorePrivateFeedbackModalEvents() {
    if (state.storePrivateFeedbackModalBound) return;
    state.storePrivateFeedbackModalBound = true;
    if (el.storePrivateFeedbackForm) {
      el.storePrivateFeedbackForm.addEventListener("submit", handleStorePrivateFeedbackSubmit);
    }
    function closeFlow() {
      closeStorePrivateFeedbackModal();
      resetStorePrivateFeedbackPanels();
    }
    if (el.storePrivateFeedbackCloseBtn) {
      el.storePrivateFeedbackCloseBtn.addEventListener("click", closeFlow);
    }
    if (el.storePrivateFeedbackCancelBtn) {
      el.storePrivateFeedbackCancelBtn.addEventListener("click", closeFlow);
    }
    if (el.storePrivateFeedbackThanksDoneBtn) {
      el.storePrivateFeedbackThanksDoneBtn.addEventListener("click", closeFlow);
    }
    if (el.storePrivateFeedbackBackdrop) {
      el.storePrivateFeedbackBackdrop.addEventListener("click", function (e) {
        if (e.target !== el.storePrivateFeedbackBackdrop) return;
        if (Date.now() - state.storePrivateFeedbackOpenedAt < STORE_PRIVATE_FEEDBACK_OPEN_GUARD_MS) return;
        closeFlow();
      });
    }
    document.addEventListener("keydown", function storePrivateModalEsc(ev) {
      if (ev.key !== "Escape") return;
      if (
        !el.storePrivateFeedbackBackdrop ||
        el.storePrivateFeedbackBackdrop.hasAttribute("hidden") ||
        !el.storePrivateFeedbackBackdrop.classList.contains("is-open")
      ) {
        return;
      }
      closeFlow();
    });
  }

  async function bootstrapStoreContext() {
    const slug = String(state.storeSlug || "").trim();
    if (!slug) return;

    const data = await fetchJson("/api/stores/" + encodeURIComponent(slug) + "/bootstrap", {
      cache: "no-store",
    });

    state.storeSlug = slug;
    state.features = Object.assign({ servicePraise: true }, (data && data.features) || {});
    state.storeCatalogIsDefault = String((data && data.catalogStatus) || "") === "default_seed";
    state.menuRaw =
      (data && data.menuSnapshot && data.menuSnapshot.menu) || (data && data.fallbackMenu) || null;
    state.staffOptions = Array.isArray(data && data.staff) ? data.staff : [];

    if (!isServicePraiseAvailable()) {
      state.isServicePanelOpen = false;
      state.servicePraiseEnabled = false;
      state.serviceStaffLabel = "";
      state.servicePraiseKey = SERVICE_PRAISE_OPTIONS[0].key;
    }

    if (data && data.store) {
      Object.assign(config, {
        restaurantNameZh: data.store.nameZh || config.restaurantNameZh,
        restaurantNameEn: data.store.nameEn || config.restaurantNameEn,
        googleReviewUrl: data.store.googleReviewUrl || config.googleReviewUrl || "",
        googleReviewFallbackUrl: data.store.googleReviewFallbackUrl || config.googleReviewFallbackUrl || "",
      });
      var grc = data.store.googleReviewCount;
      state.storeReviewCount = grc != null && Number.isFinite(Number(grc)) ? Number(grc) : null;
      var gr = data.store.googleRating;
      state.storeGoogleRating = gr != null && Number.isFinite(Number(gr)) ? Number(gr) : null;
      state.store = data.store;
    } else {
      state.storeReviewCount = null;
      state.storeGoogleRating = null;
      state.store = null;
    }

    var storeGoogleFallback = STORE_GOOGLE_REVIEW_URLS[slug];
    if (storeGoogleFallback) {
      if (!String(config.googleReviewUrl || "").trim()) {
        config.googleReviewUrl = storeGoogleFallback.googleReviewUrl;
      }
      if (!String(config.googleReviewFallbackUrl || "").trim()) {
        config.googleReviewFallbackUrl = storeGoogleFallback.googleReviewUrl;
      }
      if (state.store && storeGoogleFallback.googlePlaceId) {
        if (!String(state.store.placeId || state.store.googlePlaceId || "").trim()) {
          state.store.googlePlaceId = storeGoogleFallback.googlePlaceId;
          state.store.placeId = storeGoogleFallback.googlePlaceId;
        }
      }
    }
    state.serviceSpotlight = data && data.serviceSpotlight && data.serviceSpotlight.name ? data.serviceSpotlight : null;
  }

  function hasActiveResultFlow() {
    return !!state.receiptDataUrl || state.isRecognizing || state.recognizedDishIds.size > 0 || state.generatedReviews.length > 0;
  }

  function hasVisibleResultStage() {
    if (isStoreRoute()) {
      return state.storeReviewFlowStage === "reviews";
    }
    return (
      !!state.lastRecognitionMode ||
      state.recognizedDishIds.size > 0 ||
      state.generatedReviews.length > 0 ||
      state.uncertainTexts.length > 0
    );
  }

  function shouldShowCorrectionToggle() {
    return false;
  }

  function isCompactMobile() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function scrollCardIntoView(target, topOffset, maxWidth) {
    if (!target) return;

    const breakpoint = Number.isFinite(Number(maxWidth)) ? Number(maxWidth) : 640;
    if (!window.matchMedia("(max-width: " + breakpoint + "px)").matches) return;

    const offset = Number.isFinite(Number(topOffset)) ? Number(topOffset) : 12;
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        const nextTop = window.scrollY + target.getBoundingClientRect().top - offset;
        window.scrollTo({
          top: Math.max(0, nextTop),
          behavior: "smooth",
        });
      });
    });
  }

  function syncStoreReviewStageChrome() {
    if (!isStoreRoute()) {
      document.body.classList.remove("store-reviews-stage", "store-review-selected", "store-loyalty-open");
      if (el.intakeCard) el.intakeCard.removeAttribute("hidden");
      if (el.layout) el.layout.classList.remove("store-reviews-only");
      return;
    }

    const reviewsStage = state.storeReviewFlowStage === "reviews";
    const loyaltyOpen = !!(el.loyaltyPromoPanel && !el.loyaltyPromoPanel.classList.contains("hidden"));
    document.body.classList.toggle("store-reviews-stage", reviewsStage);
    document.body.classList.toggle("store-review-selected", reviewsStage && !!state.selectedReviewStyleKey);
    document.body.classList.toggle("store-loyalty-open", loyaltyOpen);
    if (el.intakeCard) {
      el.intakeCard.toggleAttribute("hidden", reviewsStage);
    }
    if (el.layout) {
      el.layout.classList.toggle("store-reviews-only", reviewsStage);
    }
    if (el.storeVisitShell) {
      el.storeVisitShell.hidden = reviewsStage;
    }
  }

  function getReviewTargetUrl() {
    const routes = getReviewRouteSet();
    const targetUrl = routes.primaryUrl || routes.secondaryUrl;
    if (targetUrl) return targetUrl;
    const slugFallback = STORE_GOOGLE_REVIEW_URLS[String(state.storeSlug || "").trim()];
    return slugFallback && slugFallback.googleReviewUrl ? String(slugFallback.googleReviewUrl).trim() : "";
  }

  function focusStoreReviewsStage() {
    if (!isStoreRoute() || state.storeReviewFlowStage !== "reviews") return;
    syncStoreReviewStageChrome();
    scrollCardIntoView(el.reviewsCard, 12, 2000);
  }

  function syncAnotherSetBtn() {
    if (!el.anotherSetBtn) return;
    var label = state.isGenerating ? t("anotherSetWorking") : t("anotherSetBtn");
    el.anotherSetBtn.setAttribute("aria-label", label);
    el.anotherSetBtn.title = label;
  }

  function renderFlowState() {
    const active = hasActiveResultFlow();
    const resultStageVisible = hasVisibleResultStage();
    document.body.classList.toggle("has-results", !isStoreRoute() && active);
    document.body.classList.toggle("correction-open", false);
    document.body.classList.toggle("has-visit-sheet", state.isVisitSheetOpen);
    el.dishesCard.classList.add("hidden");
    el.reviewsCard.classList.toggle("hidden", !resultStageVisible);
    el.layout.classList.toggle("single-stage", !resultStageVisible);
    el.correctionToggle.classList.toggle("hidden", !shouldShowCorrectionToggle());
    el.correctionPanel.classList.toggle("hidden", !resultStageVisible || !state.isCorrectionOpen);
    el.anotherSetBtn.classList.toggle(
      "hidden",
      isStoreRoute() || (state.generatedReviews.length === 0 && !state.isGenerating),
    );
    el.anotherSetBtn.classList.toggle("is-loading", state.isGenerating);
    syncAnotherSetBtn();
    if (el.reviewWriteOwnBtn) {
      el.reviewWriteOwnBtn.classList.toggle(
        "hidden",
        !isStoreRoute() || state.storeReviewFlowStage !== "reviews" || state.isGenerating,
      );
    }
    el.visitSheetBackdrop.classList.toggle("is-open", state.isVisitSheetOpen);
    syncStoreReviewStageChrome();
  }

  function syncBusyControls() {
    const isBusy = state.isRecognizing || state.isGenerating;
    const storeUnavailable = isStoreRoute() && (!!state.storeBootstrapFailure || !!state.storeBootstrapPending);
    el.uploadBtn.disabled = isBusy || storeUnavailable;
    if (el.writeOwnReviewBtn) el.writeOwnReviewBtn.disabled = isBusy;
    if (el.storeVisitStars) {
      el.storeVisitStars.querySelectorAll(".store-visit-star-tile").forEach(function (btn) {
        btn.disabled = isBusy || storeUnavailable || state.storeReviewFlowStage !== "gate";
      });
    }
    el.retakeBtn.disabled = isBusy;
    el.retakeInlineBtn.disabled = isBusy;
    el.resetBtn.disabled = isBusy;
    if (el.langMenuToggle) el.langMenuToggle.disabled = isBusy;
    if (el.langOptionEn) el.langOptionEn.disabled = isBusy;
    if (el.langOptionZh) el.langOptionZh.disabled = isBusy;
    el.visitSummaryBtn.disabled = isBusy || !state.visitTier;
    el.serviceToggleBtn.disabled = isBusy || !isServicePraiseAvailable();
    el.visitContinueBtn.disabled = !getVisitSheetSelectionKey() || isBusy;
    el.serviceStaffSelect.disabled = isBusy || !isServicePraiseAvailable();
    el.serviceApplyBtn.disabled = isBusy || !isServicePraiseAvailable();
    el.serviceClearBtn.disabled = isBusy || !isServicePraiseAvailable();
    if (el.reviewWriteOwnBtn) el.reviewWriteOwnBtn.disabled = isBusy || storeUnavailable;
  }

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

  async function loadMenu() {
    const raw = state.menuRaw || await fetch("./menu.json", { cache: "no-store" }).then(function (response) {
      return response.json();
    });
    state.categories = parseMenu(raw);
    state.flatDishes = [];
    state.dishMap.clear();
    state.dishAliasMap.clear();
    state.dishProfiles.clear();

    state.categories.forEach(function (category) {
      category.items.forEach(function (item) {
        state.flatDishes.push(item);
        state.dishMap.set(item.uqid, item);
        registerDishAliases(item);
        state.dishProfiles.set(item.uqid, buildDishProfile(item));
      });
    });
  }

  function registerDishAliases(item) {
    [
      item.zh,
      item.en,
      simplifyText(item.zh),
      simplifyText(item.en),
      String(item.uqid),
    ]
      .concat(item.aliases || [])
      .forEach(function (alias) {
      const normalized = normalizeText(alias);
      if (normalized && !state.dishAliasMap.has(normalized)) {
        state.dishAliasMap.set(normalized, item.uqid);
      }
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

    return { zh: zhAnchors.slice(0, 3), en: enAnchors.slice(0, 3) };
  }

  function dishPromptLines(dishIds, lang) {
    return dishIds
      .map(function (dishId) {
        const item = state.dishMap.get(dishId);
        const profile = state.dishProfiles.get(dishId);
        if (!item || !profile) return null;
        const praise = (lang === "zh" ? profile.zh : profile.en).join(lang === "zh" ? "、" : ", ");
        return lang === "zh"
          ? "- " +
              item.zh +
              "：评论里必须自然点到这道菜（菜名太长就用食客会说的简称），夸赞可围绕「" +
              praise +
              "」"
          : '- "' +
              item.en +
              '": name this dish naturally (shorten long menu titles); anchor praise on "' +
              praise +
              '"';
      })
      .filter(Boolean)
      .join("\n");
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

  function buildCatalogText() {
    return state.flatDishes
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
      dish_type: dishType,
      dish_subtype: dishSubtype,
      primary_proteins: primaryProteins,
      primary_carbs: primaryCarbs,
      cooking_methods: cookingMethods,
      serving_vessel: servingVessel,
      visual_tags: visualTags,
      texture_tags: textureTags,
      presentation_tags: presentationTags,
      match_hints: item.match_hints || [],
      negative_hints: item.negative_hints || [],
      confidence_priority: Number(item.confidence_priority || 0),
      search_blob: blob,
      normalized_search_blob: normalizeText(blob),
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

  function scoreDishCandidates(observation) {
    const obs = normalizeObservation(observation);
    const visibleTexts = obs.visible_texts.map(normalizeText);
    const candidates = state.flatDishes.map(function (item) {
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
    });

    return candidates
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

  function buildImageAnalysisMessages() {
    return {
      system:
        "You classify restaurant-related uploads and extract structured visual clues. First decide whether the image is mainly a receipt or another restaurant-related photo. If it is not a receipt, focus only on the dominant dish, drink, menu item, dining scene, or hospitality subject. Extract only what is visually supported. Do not guess a final catalog item yet. Return JSON only.",
      user:
        "Restaurant: " +
        config.restaurantNameZh +
        " / " +
        config.restaurantNameEn +
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

  function buildPhotoResolutionMessages(observation, candidates) {
    const obs = normalizeObservation(observation);
    const candidateCatalog = buildPhotoCandidateCatalog(candidates);
    return {
      system:
        "You choose the single closest menu/catalog item for the dominant restaurant subject in a photo. You must pick from the candidate list only. If the image contains multiple possible subjects, choose the dominant one only. Even when confidence is low, pick the closest candidate and explain briefly. Return JSON only.",
      user:
        "Restaurant: " +
        config.restaurantNameZh +
        " / " +
        config.restaurantNameEn +
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
        "\n\nCandidate catalog items:\n" +
        candidateCatalog +
        "\n\nChoose exactly one dish_id from the candidate list.",
    };
  }

  function buildReceiptMessages(imageDataUrl) {
    const catalogText = buildCatalogText();
    return {
      system:
        "You read an itemized restaurant receipt and map purchasable line items to the store menu/catalog. 饭店/餐厅/饮品/套餐/小吃小票 is valid. " +
        "Line items include services, food, drinks, set meals, combos, and add-ons. Do NOT treat a restaurant-style receipt as wrong. " +
        "Fuzzy, cross-line, and cross-language matching. Ignore only tax/total/tip/payment lines. " +
        "Unmatched but readable lines MUST go in uncertain_texts, including 饭店/餐厅 rows when the catalog is unrelated. Return JSON only.",
      user:
        "Store / 门店: " +
        config.restaurantNameZh +
        " / " +
        config.restaurantNameEn +
        "\n\n" +
        "Catalog (dish_id | fields):\n" +
        catalogText +
        "\n\n" +
        "Matching guidance:\n" +
        "- No exact string match required.\n" +
        "- Restaurant/饭店: map 菜品, 飲品, 套餐, 小食, combo when the catalog has matching rows.\n" +
        "- If the catalog still contains non-restaurant demo services, map only when truly plausible and list unmatched food lines for manual selection.\n" +
        "- Merge wrapped lines; use descriptive text, not just item codes (A1/B2).\n" +
        "- In `dishes`, you may return high, medium, or *low* confidence; never use a dish_id that is not in the catalog list.\n" +
        "- Use uncertain_texts for any printed line you cannot map.\n\n" +
        "Analyze the receipt; map to catalog when plausible, and list unmatched restaurant food lines in uncertain_texts for manual selection.",
      imageDataUrl: imageDataUrl,
    };
  }

  function buildReviewMessages(retryLevel, focusAssignments, lengthAssignments) {
    const dishIds = Array.from(state.recognizedDishIds).sort(function (a, b) {
      return a - b;
    });
    const comboKey = buildComboKey(dishIds, state.lang);
    const recentTexts = getRecentReviews(comboKey);
    const dishLines = dishPromptLines(dishIds, state.lang);
    const visitTier = getVisitTierOption(state.visitTier);
    const servicePraise = buildServicePraisePayload();
    const servicePraiseOption = servicePraise ? getServicePraiseOption(servicePraise.praiseKey) : null;
    const randomFlavorLines = sampleRandom(REVIEW_SPICE_BANK[state.lang], 4);
    const variantLines = STYLE_VARIANTS.map(function (variant, index) {
      const focusRule = getFocusRule(getAssignedFocus(variant.key, focusAssignments));
      const lengthRule = getReviewLengthAssignment(variant.key, lengthAssignments, state.lang);
      if (state.lang === "zh") {
        return (
          index +
          1 +
          ". 卡片 " +
          (index + 1) +
          "（" +
          variant.zhLabel +
          "）：" +
          variant.zhRule +
          " 长度目标：" +
          lengthRule.promptLabel +
          " 本轮焦点：" +
          focusRule.zhRule
        );
      }
      return (
        index +
        1 +
        ". Card " +
        (index + 1) +
        " (" +
        variant.enLabel +
        "): " +
        variant.enRule +
        " Length target: " +
        lengthRule.promptLabel +
        " Focus this round: " +
        focusRule.enRule
      );
    }).join("\n");

    const recentBlock = recentTexts.length
      ? state.lang === "zh"
        ? "之前这台设备上出现过的相似组合评论，新的内容要明显换句式、换形容词、换开头结尾，尽量不要复用这些说法：\n" +
          recentTexts.map(function (text, index) {
            return index + 1 + ". " + text;
          }).join("\n")
        : "Previous outputs for a similar combo on this device. The new reviews should clearly change the sentence structure, descriptors, opening, and closing. Avoid reusing these phrasings:\n" +
          recentTexts.map(function (text, index) {
            return index + 1 + ". " + text;
          }).join("\n")
      : "";

    const flavorBlock =
      state.lang === "zh"
        ? "可参考但不要照抄的随机碎句：\n" +
          randomFlavorLines
            .map(function (text, index) {
              return index + 1 + ". " + text;
            })
            .join("\n")
        : "Optional short phrase sparks. Use at most one idea from here per review and do not copy them mechanically:\n" +
          randomFlavorLines
            .map(function (text, index) {
              return index + 1 + ". " + text;
            })
            .join("\n");

    if (state.lang === "zh") {
      return {
        system:
          "你在帮顾客写可直接发出的 Google Maps 短评。口语、真实、像刚吃完顺手发出去，可用流行夸法（很绝、很能打、超预期）。必须点到具体菜名。严格遵守风格与聚焦规则，只返回 JSON。",
        user:
          "店铺：" +
          config.restaurantNameZh +
          "\n" +
          "输出语言：中文\n\n" +
          "本次菜品/饮品与固定夸赞点：\n" +
          dishLines +
          "\n\n" +
          "顾客来店信息：\n" +
          "- " +
          (visitTier ? visitTier.zhLabel : "未提供") +
          "。\n" +
          (visitTier ? "- " + visitTier.zhPrompt + "\n" : "") +
          (servicePraise
            ? "- 如果本轮有 staff/服务相关评论，请明确提到" +
              servicePraise.staffLabel +
              "，重点夸“" +
              servicePraiseOption.zhLabel +
              "”。\n"
            : "") +
          "\n" +
          "三条评论规则：\n" +
          variantLines +
          "\n\n" +
          "硬性要求：\n" +
          "1. 必须输出 3 条评论，并严格使用这 3 个 style_key：review_a、review_b、review_c。\n" +
          "2. review_a 对应卡片“简洁”，review_b 对应“详细”，review_c 对应“出彩”。\n" +
          "3. 本轮三条评论里，必须刚好一条只写菜品/饮品，刚好一条提staff/服务，刚好一条提环境；但哪张卡对应哪种焦点，以本轮上面的分配为准。\n" +
          "4. 不要把staff/服务和环境同时写进同一条。\n" +
          "5. 必须自然写出至少 1 个具体菜名，最多提 1 到 2 个菜；遇到很长的菜单名时，用食客会顺口说的短叫法。\n" +
          "6. 每条都要口语、简短、像刚吃完或刚离店顺手发出去的话，允许稍微带一点吸引力，但不能像广告。\n" +
          "7. 三条正文的总体长度必须递增：review_a 最短，review_b 比 review_a 明显更长，review_c 最长；每条遵守上面卡片里的长度目标，不要把三条写得差不多长。\n" +
          "8. 可以带一点真人会说的小碎句或流行夸法，但不要三条都一个套路。\n" +
          "9. 禁止使用冒号、破折号，不要加 emoji、引号、井号。\n" +
          "10. 三条的开头和结尾都不要太像。\n" +
          (retryLevel > 0
            ? "11. 上一轮结果不够口语，这一轮务必更短、更真实，并严格遵守风格卡片与本轮焦点分配。\n"
            : "") +
          "\n" +
          flavorBlock +
          (recentBlock ? "\n\n" + recentBlock + "\n" : "\n") +
          "\n附加提醒：" +
          t("localHistoryHint"),
      };
    }

    return {
      system:
        "You write short Google Maps reviews that feel like a real diner typing right after the meal—casual, specific, a little trendy when it fits. Name the actual dish. Follow every style and focus rule exactly and return JSON only.",
      user:
        "Restaurant: " +
        config.restaurantNameEn +
        "\n" +
        "Output language: English\n\n" +
        "Dishes/drinks with fixed praise anchors:\n" +
        dishLines +
        "\n\n" +
        "Visit context:\n" +
        "- " +
        (visitTier ? visitTier.enLabel : "Not provided") +
        ".\n" +
        (visitTier ? "- " + visitTier.enPrompt + "\n" : "") +
        (servicePraise
          ? "- If this round includes the staff/service-focused review, explicitly mention " +
            servicePraise.staffLabel +
            " and highlight that they were " +
            servicePraiseOption.enLabel +
            ".\n"
          : "") +
        "\n" +
        "Three review rules:\n" +
        variantLines +
        "\n\n" +
        "Hard rules:\n" +
        "1. Output exactly 3 reviews and use these exact style_key values: review_a, review_b, review_c.\n" +
        "2. review_a is the Simple card, review_b is the Detailed card, and review_c is the Standout card.\n" +
        "3. Across the three reviews, there must be exactly one results-only review, exactly one staff review, and exactly one atmosphere review, but the card-to-focus mapping must follow this round's assignment above.\n" +
        "4. Never mention staff/service and atmosphere in the same review.\n" +
        "5. Name at least one specific dish naturally; mention 1 or 2 memorable dishes or drinks at most. Shorten long menu titles the way diners talk.\n" +
        "6. Keep every review conversational, short, and easy to post. A little trendy hype is fine, but it still has to feel personal rather than ad copy.\n" +
        "7. Overall length must increase: review_a is the shortest, review_b is clearly longer than review_a, and review_c is the longest, but review_c (Standout) must stay at 50 words or below—count full words. Follow each card's length target above and do not make all three feel the same length.\n" +
        "8. Use light real-person filler only when it helps. Do not make all three follow the same sentence pattern.\n" +
        "9. No emoji, quotes, hashtags, or bullet points.\n" +
        "10. Do not reuse the same opening or closing across the three reviews.\n" +
        (retryLevel > 0
          ? "11. The previous attempt missed the target. Make this round tighter, shorter, and more varied.\n"
          : "") +
        "\n" +
        flavorBlock +
        (recentBlock ? "\n\n" + recentBlock + "\n" : "\n") +
        "\nReminder: " +
        t("localHistoryHint"),
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
            image_kind: {
              type: "string",
              enum: ["receipt", "dish_single", "dish_multi", "unknown"],
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            readable_text_level: {
              type: "string",
              enum: ["high", "medium", "low", "none"],
            },
            dominant_subject: { type: "string" },
            visible_texts: {
              type: "array",
              items: { type: "string" },
            },
            dish_type: { type: "string" },
            dish_subtype: { type: "string" },
            primary_proteins: {
              type: "array",
              items: { type: "string" },
            },
            primary_carbs: {
              type: "array",
              items: { type: "string" },
            },
            cooking_methods: {
              type: "array",
              items: { type: "string" },
            },
            serving_vessel: { type: "string" },
            visual_tags: {
              type: "array",
              items: { type: "string" },
            },
            texture_tags: {
              type: "array",
              items: { type: "string" },
            },
            presentation_tags: {
              type: "array",
              items: { type: "string" },
            },
            match_hints: {
              type: "array",
              items: { type: "string" },
            },
            negative_hints: {
              type: "array",
              items: { type: "string" },
            },
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

  async function callModelApi(payload) {
    if (!config.openaiApiKey) {
      throw new Error(t("noApiKey"));
    }

    const response = await fetch(config.openaiBaseUrl.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + config.openaiApiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(function () {
        return {};
      });
      throw new Error(error.error && error.error.message ? error.error.message : "HTTP " + response.status);
    }

    return response.json();
  }

  function parseChoiceJson(data) {
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content || typeof content !== "string") {
      throw new Error("Empty model response");
    }
    return JSON.parse(content);
  }

  async function recognizeReceipt(imageDataUrl) {
    const prompts = buildReceiptMessages(imageDataUrl);
    const data = await callModelApi({
      model: config.openaiModel,
      temperature: 0.1,
      max_tokens: 1000,
      response_format: receiptSchema(),
      messages: [
        { role: "system", content: prompts.system },
        {
          role: "user",
          content: [
            { type: "text", text: prompts.user },
            {
              type: "image_url",
              image_url: { url: imageDataUrl },
            },
          ],
        },
      ],
    });

    return parseChoiceJson(data);
  }

  async function analyzeUploadImage(imageDataUrl) {
    const prompts = buildImageAnalysisMessages();
    const data = await callModelApi({
      model: config.openaiModel,
      temperature: 0.1,
      max_tokens: 1000,
      response_format: imageAnalysisSchema(),
      messages: [
        { role: "system", content: prompts.system },
        {
          role: "user",
          content: [
            { type: "text", text: prompts.user },
            {
              type: "image_url",
              image_url: { url: imageDataUrl },
            },
          ],
        },
      ],
    });

    return normalizeObservation(parseChoiceJson(data));
  }

  async function resolveDishPhoto(imageDataUrl, observation) {
    const candidates = scoreDishCandidates(observation);
    if (!candidates.length) {
      throw new Error("No candidate dishes available");
    }

    const candidateDishIds = candidates.map(function (candidate) {
      return candidate.item.uqid;
    });
    const prompts = buildPhotoResolutionMessages(observation, candidates);

    try {
      const data = await callModelApi({
        model: config.openaiModel,
        temperature: 0.15,
        max_tokens: 700,
        response_format: photoResolutionSchema(candidateDishIds),
        messages: [
          { role: "system", content: prompts.system },
          {
            role: "user",
            content: [
              { type: "text", text: prompts.user },
              {
                type: "image_url",
                image_url: { url: imageDataUrl },
              },
            ],
          },
        ],
      });

      const parsed = parseChoiceJson(data);
      const resolvedDishId = Number(parsed.dish_id);
      const fallbackDishId = candidates[0].item.uqid;

      return {
        dish_id: candidateDishIds.indexOf(resolvedDishId) !== -1 ? resolvedDishId : fallbackDishId,
        confidence: String(parsed.confidence || "low"),
        reason: String(parsed.reason || ""),
        candidates: candidates,
      };
    } catch (err) {
      return {
        dish_id: candidates[0].item.uqid,
        confidence: "low",
        reason: "fallback_top_candidate",
        candidates: candidates,
      };
    }
  }

  async function generateReviewsWithRetry() {
    let lastError = null;
    const focusAssignments = buildFocusAssignments();
    const lengthAssignments = buildReviewLengthAssignments(state.lang);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const prompts = buildReviewMessages(attempt, focusAssignments, lengthAssignments);
        const data = await callModelApi({
          model: config.openaiModel,
          temperature: 0.95,
          max_tokens: 1200,
          response_format: reviewSchema(),
          messages: [
            { role: "system", content: prompts.system },
            { role: "user", content: prompts.user },
          ],
        });

        const parsed = parseChoiceJson(data);
        let normalized = normalizeGeneratedReviews(parsed.reviews || [], focusAssignments);
        normalized = applyVisitContextToReviews(normalized);
        normalized = applyServicePraiseToReviews(normalized);
        validateGeneratedReviews(normalized, lengthAssignments);
        return normalized;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("Unable to generate reviews");
  }

  function normalizeGeneratedReviews(reviews, focusAssignments) {
    const styleCounts = {};
    reviews.forEach(function (review) {
      const styleKey = String(review && review.style_key || "").trim();
      if (!styleKey) return;
      styleCounts[styleKey] = (styleCounts[styleKey] || 0) + 1;
    });

    STYLE_VARIANTS.forEach(function (variant) {
      if (styleCounts[variant.key] !== 1) {
        throw new Error("Returned style keys invalid");
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

  function validateGeneratedReviews(reviews, lengthAssignments) {
    if (!Array.isArray(reviews) || reviews.length !== 3) {
      throw new Error("Invalid review count");
    }

    const servicePattern =
      state.lang === "zh"
        ? /服务|staff|店员|服务员|前台|接待|态度|热情|耐心|细心|认真|沟通|照顾周到|上菜快|出餐快|招呼|推荐|安排|点单|hospitality/i
        : /\bservice\b|\bstaff\b|\bserver\b|\bwaiter\b|\bwaitress\b|\bhost\b|\bhostess\b|\bteam\b|\battentive\b|\bpatient\b|\bfriendly\b|\bkind\b|\bcommunicat(?:ion|e|ive)\b|\bhospitality\b|\bhelpful\b|took care of us|well taken care of|easy to communicate with|quick service|fast service/i;
    const environmentPattern =
      state.lang === "zh"
        ? /环境|氛围|装修|店里|空间|座位|坐着舒服|店里很干净|环境很舒服|空间很舒服|氛围很放松|店里很安静|空间很明亮/
        : /\bambiance\b|\batmosphere\b|\bdecor\b|\benvironment\b|\bspace\b|\bsetting\b|\bdining room\b|\btable\b|\bseating\b|\bvibe(?:s)?\b|\bcozy\b|\bclean (restaurant|space|room|place|dining room)\b|\b(restaurant|space|room|place|dining room) (was |felt )?clean\b|\b(relaxing|calm|comfortable) (space|room|setting|vibe|atmosphere|restaurant|dining room)\b/i;
    const bannedPunctuationPattern = /[:：—–-]/;

    reviews.forEach(function (review) {
      if (!review.text) throw new Error("Empty review text");

      const hasService = servicePattern.test(review.text);
      const hasEnvironment = environmentPattern.test(review.text);
      const measuredLength = countReviewLengthUnits(review.text, state.lang);
      const lengthBounds = getReviewLengthBounds(state.lang);

      if (state.lang === "zh") {
        if (bannedPunctuationPattern.test(review.text)) {
          throw new Error("Chinese review used banned punctuation");
        }
      }

      if (review.focus === "none" && (hasService || hasEnvironment)) {
        throw new Error("Results-only review mentioned staff or restaurant environment");
      }

      if (review.focus === "service" && (!hasService || hasEnvironment)) {
        throw new Error("Service review focus invalid");
      }

      if (review.focus === "environment" && (!hasEnvironment || hasService)) {
        throw new Error("Ambiance review focus invalid");
      }

      if (measuredLength < lengthBounds.min || measuredLength > lengthBounds.max) {
        throw new Error("Review length out of range");
      }
    });

    const comboKey = buildComboKey(Array.from(state.recognizedDishIds), state.lang);
    const recentTexts = getRecentReviews(comboKey);
    const normalizedRecent = recentTexts.map(normalizeText);
    reviews.forEach(function (review) {
      if (normalizedRecent.indexOf(normalizeText(review.text)) !== -1) {
        throw new Error("Duplicate review text");
      }
    });
  }

  function buildComboKey(dishIds, lang) {
    const sorted = dishIds.slice().sort(function (a, b) {
      return a - b;
    });
    const servicePraise = buildServicePraisePayload();
    return [
      lang,
      state.visitTier || "no_visit",
      servicePraise ? servicePraise.praiseKey : "no_service",
      servicePraise ? normalizeText(servicePraise.staffLabel) : "no_staff",
      sorted.join("-"),
    ].join(":");
  }

  function getRecentReviews(comboKey) {
    const items = state.comboHistory[comboKey];
    if (!Array.isArray(items)) return [];
    return items.slice(-6);
  }

  function rememberReviews(reviews) {
    const comboKey = buildComboKey(Array.from(state.recognizedDishIds), state.lang);
    if (!comboKey || comboKey.endsWith(":")) return;

    const existing = Array.isArray(state.comboHistory[comboKey]) ? state.comboHistory[comboKey] : [];
    const next = existing.concat(
      reviews.map(function (review) {
        return review.text;
      }),
    );
    state.comboHistory[comboKey] = next.slice(-12);
    saveHistory();
  }

  function updateText() {
    syncDocumentHtmlLang();
    document.title = getPageTitle();
    setNodeText(el.brandName, getBrandDisplayName());
    setNodeText(el.title, getPageHeading());
    setNodeText(el.subtitle, getPageSubtitle());
    if (el.langMenuToggle) {
      el.langMenuToggle.setAttribute("aria-label", state.lang === "zh" ? "语言" : "Language");
      el.langMenuToggle.setAttribute("title", state.lang === "zh" ? "语言" : "Language");
    }
    if (el.langOptionEn) {
      el.langOptionEn.classList.toggle("is-active", state.lang === "en");
      el.langOptionEn.setAttribute("aria-pressed", state.lang === "en" ? "true" : "false");
    }
    if (el.langOptionZh) {
      el.langOptionZh.classList.toggle("is-active", state.lang === "zh");
      el.langOptionZh.setAttribute("aria-pressed", state.lang === "zh" ? "true" : "false");
    }
    renderRouteView();
    syncLinkPreviewMeta();

    if (!isStoreRoute()) {
      return;
    }

    setNodeText(el.uploadTitle, t("uploadTitle"));
    setNodeText(el.uploadHint, t("uploadHint"));
    setNodeText(el.uploadBtn, t("uploadBtn"));
    if (el.writeOwnReviewBtn) setNodeText(el.writeOwnReviewBtn, t("writeOwnReviewBtn"));
    setNodeText(el.retakeBtn, t("retakeBtn"));
    setNodeText(el.retakeInlineBtn, t("retakeInlineBtn"));
    if (el.previewEmptyText) {
      setNodeText(
        el.previewEmptyText,
        !state.storeBootstrapFailure ? t("storeReceiptScanHint") : t("previewEmpty"),
      );
    }
    setNodeText(el.dishesTitle, t("dishesTitle"));
    setNodeText(el.dishesHint, t("dishesHint"));
    setNodeText(el.correctionLabel, t("correctionLabel"));
    setNodeText(el.correctionToggle, state.isCorrectionOpen ? t("correctionToggleOpen") : t("correctionToggleClosed"));
    setNodeText(el.resetBtn, t("resetBtn"));
    setNodeText(el.reviewsTitle, t("reviewsTitle"));
    if (el.loyaltyPromoPanel && !el.loyaltyPromoPanel.classList.contains("hidden")) {
      var loyaltyC = loyaltyCopy();
      if (el.loyaltyPromoIntro) el.loyaltyPromoIntro.textContent = loyaltyC.intro;
      if (el.loyaltyPromoPhone) el.loyaltyPromoPhone.placeholder = loyaltyC.phonePlaceholder;
      syncLoyaltyPromoConsent();
      if (el.loyaltyPromoResult && !el.loyaltyPromoResult.classList.contains("hidden") && el.loyaltyPromoCodeText) {
        el.loyaltyPromoCodeText.textContent = el.loyaltyPromoCodeText.classList.contains("loyalty-promo-sent--error")
          ? loyaltyC.failed
          : loyaltyC.sentSuccess;
      }
      if (
        el.loyaltyPromoContinueBtn &&
        el.loyaltyPromoResult &&
        !el.loyaltyPromoResult.classList.contains("hidden")
      ) {
        el.loyaltyPromoContinueBtn.textContent = loyaltyC.continueGoogle;
      }
    }
    setNodeText(el.visitSheetTitle, t("visitSheetTitle"));
    setNodeText(el.visitSheetHint, t("visitSheetHint"));
    setNodeText(el.visitSummaryLabel, t("visitSummaryLabel"));
    setNodeText(el.visitSummaryAction, t("visitSummaryAction"));
    setNodeText(el.serviceToggleLabel, t("serviceToggleLabel"));
    setNodeText(el.serviceNameLabel, t("serviceNameLabel"));
    setNodeText(el.servicePraiseLabel, t("servicePraiseLabel"));
    setNodeText(el.serviceApplyBtn, t("serviceApplyBtn"));
    setNodeText(el.serviceClearBtn, t("serviceClearBtn"));
    setNodeText(el.recognizedEmptyText, t("recognizedEmpty"));
    setNodeText(el.uncertainTitle, t("uncertainTitle"));
    syncAnotherSetBtn();
    if (el.reviewWriteOwnBtn) setNodeText(el.reviewWriteOwnBtn, t("storeFlowWriteOwnBtn"));
    renderReceiptMeta();
    renderFlowState();
    renderVisitSheet();
    renderStoreFlowCard();
    renderReviewContext();
    renderDishOptions();
    renderRecognizedDishes();
    renderReviews();
    syncStoreVisitChrome();
    syncStorePrivateFeedbackModalCopy();
    syncStoreVisitPresentation();

    if (state.storeBootstrapFailure) {
      setStatus(el.receiptStatus, resolveBootstrapFailureCopy(state.storeBootstrapFailure), "error");
    } else if (state.storeCatalogIsDefault && !hasActiveResultFlow()) {
      setStatus(el.receiptStatus, t("storeCatalogDefaultHint"), "ok");
    }
  }

  function renderVisitSheet() {
    el.visitOptions.innerHTML = "";

    VISIT_TIER_OPTIONS.forEach(function (option) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "visit-option-btn";
      if (state.visitSheetDraftTier === option.key) button.classList.add("selected");
      button.textContent = state.lang === "zh" ? option.zhLabel : option.enLabel;
      button.setAttribute("aria-pressed", state.visitSheetDraftTier === option.key ? "true" : "false");
      button.addEventListener("click", function () {
        state.visitSheetDraftTier = option.key;
        renderVisitSheet();
      });
      el.visitOptions.appendChild(button);
    });

    setNodeText(
      el.visitContinueBtn,
      state.generatedReviews.length > 0 ? t("visitUpdateBtn") : t("visitContinueBtn"),
    );
    renderFlowState();
    syncBusyControls();
  }

  function renderServicePraiseOptions() {
    el.servicePraiseOptions.innerHTML = "";

    SERVICE_PRAISE_OPTIONS.forEach(function (option) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-chip";
      if (state.servicePraiseKey === option.key) button.classList.add("selected");
      button.textContent = state.lang === "zh" ? option.zhLabel : option.enLabel;
      button.setAttribute("aria-pressed", state.servicePraiseKey === option.key ? "true" : "false");
      button.addEventListener("click", function () {
        state.servicePraiseKey = option.key;
        renderReviewContext();
      });
      el.servicePraiseOptions.appendChild(button);
    });
  }

  function renderServiceStaffOptions() {
    if (!el.serviceStaffSelect) return;

    el.serviceStaffSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = t("serviceNamePlaceholder");
    el.serviceStaffSelect.appendChild(placeholder);

    state.staffOptions.forEach(function (staff) {
      const option = document.createElement("option");
      option.value = String(staff && (staff.displayName || staff.name) || "").trim();
      option.textContent = option.value;
      el.serviceStaffSelect.appendChild(option);
    });

    el.serviceStaffSelect.value = state.serviceStaffLabel;
  }

  function buildStoreFlowBackBtn(stage, isBusy) {
    return (
      '<button type="button" class="ghost compact store-flow-nav-btn store-flow-nav-back" data-store-flow-back="' +
      escapeHtml(stage) +
      '"' +
      (isBusy ? " disabled" : "") +
      '><span class="store-flow-nav-icon" aria-hidden="true">←</span><span>' +
      escapeHtml(t("storeFlowStepBack")) +
      "</span></button>"
    );
  }

  function buildStoreFlowForwardBtn(labelKey, dataAttr, disabled) {
    return (
      '<button type="button" class="cta store-flow-nav-btn store-flow-nav-forward" ' +
      dataAttr +
      (disabled ? " disabled" : "") +
      '><span>' +
      escapeHtml(t(labelKey)) +
      '</span><span class="store-flow-nav-icon" aria-hidden="true">→</span></button>'
    );
  }

  function renderStoreFlowCard() {
    if (!el.storeFlowCard) return;

    if (!isStoreRoute() || state.storeBootstrapFailure || state.storeBootstrapPending) {
      el.storeFlowCard.innerHTML = "";
      el.storeFlowCard.classList.add("hidden");
      return;
    }

    if (state.storeReviewFlowStage === "staff") {
      state.storeReviewFlowStage = "services";
    }

    var stage = state.storeReviewFlowStage;
    if (stage === "gate" || stage === "reviews") {
      el.storeFlowCard.innerHTML = "";
      el.storeFlowCard.classList.add("hidden");
      return;
    }

    var isBusy = state.isRecognizing || state.isGenerating;
    var selectedServiceIds = Array.from(state.recognizedDishIds).sort(function (a, b) {
      return a - b;
    });
    var selectedServicesHtml = selectedServiceIds
      .map(function (dishId) {
        var item = state.dishMap.get(dishId);
        if (!item) return "";
        return (
          '<button type="button" class="store-flow-chip is-selected" data-store-flow-remove-service="' +
          escapeHtml(String(dishId)) +
          '">' +
          '<span>' +
          escapeHtml(getDishName(item)) +
          '</span><span aria-hidden="true">×</span></button>'
        );
      })
      .join("");
    var html = "";

    if (stage === "visit") {
      var visitOptionsHtml = VISIT_TIER_OPTIONS.map(function (option) {
        var selected = state.visitTier === option.key;
        return (
          '<button type="button" class="store-flow-choice-btn' +
          (selected ? " is-selected" : "") +
          '" data-store-flow-visit="' +
          escapeHtml(option.key) +
          '" aria-pressed="' +
          (selected ? "true" : "false") +
          '"' +
          (isBusy ? " disabled" : "") +
          ">" +
          escapeHtml(state.lang === "zh" ? option.zhLabel : option.enLabel) +
          "</button>"
        );
      }).join("");

      html =
        '<div class="store-flow-head"><p class="store-flow-step">1 / 2</p><h3 class="store-flow-title store-flow-title--with-icon">' +
        '<span class="store-flow-title-icon" aria-hidden="true">' +
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M13.25 6.5V3.75H10.5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M2.75 9.5v2.75h2.75" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M3.6 6.2a5 5 0 0 1 8.4-1.8l1 .98M12.4 9.8a5 5 0 0 1-8.4 1.8l-1-.98" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>' +
        "</svg></span><span class=\"store-flow-title-text\">" +
        escapeHtml(t("storeFlowVisitTitle")) +
        '</span></h3></div><div class="store-flow-choice-list">' +
        visitOptionsHtml +
        '</div><div class="store-flow-actions">' +
        buildStoreFlowBackBtn("visit", isBusy) +
        buildStoreFlowForwardBtn("storeFlowStepContinue", 'data-store-flow-next="visit"', !state.visitTier || isBusy) +
        "</div>";
    } else if (stage === "services") {
      var matches = getStoreServiceMatches(state.storeServiceSearch);
      var servicesHtml = matches
        .map(function (item) {
          var selected = state.recognizedDishIds.has(item.uqid);
          return (
            '<button type="button" class="store-flow-service-btn' +
            (selected ? " is-selected" : "") +
            '" data-store-service-id="' +
            String(item.uqid) +
            '" aria-pressed="' +
            (selected ? "true" : "false") +
            '"' +
            (isBusy ? " disabled" : "") +
            ">" +
            escapeHtml(getDishOptionLabel(item)) +
            "</button>"
          );
        })
        .join("");

      html =
        '<div class="store-flow-head"><p class="store-flow-step">2 / 2</p><p class="store-flow-hint">' +
        escapeHtml(t("storeFlowServicesHint")) +
        '</p></div><label class="store-flow-search-label"><span class="hidden-accessible">' +
        escapeHtml(t("storeFlowServicesTitle")) +
        '</span><input id="storeServiceSearchInput" class="text-input store-flow-search-input" type="search" value="' +
        escapeHtml(state.storeServiceSearch || "") +
        '" placeholder="' +
        escapeHtml(t("storeFlowServicesSearchPlaceholder")) +
        '"' +
        (isBusy ? " disabled" : "") +
        " /></label>" +
        (selectedServicesHtml
          ? '<div class="store-flow-selected"><p class="store-flow-selected-label">' +
            escapeHtml(t("storeFlowServicesSelected")) +
            "</p><div class=\"store-flow-selected-chips\">" +
            selectedServicesHtml +
            "</div></div>"
          : "") +
        '<div class="store-flow-service-list">' +
        (servicesHtml || '<p class="store-flow-empty">' + escapeHtml(t("storeFlowServicesEmpty")) + "</p>") +
        '</div><div class="store-flow-actions">' +
        buildStoreFlowBackBtn("services", isBusy) +
        buildStoreFlowForwardBtn("storeFlowStepGenerate", 'data-store-flow-generate="1"', selectedServiceIds.length === 0 || isBusy) +
        "</div>";
    }

    el.storeFlowCard.innerHTML = html;
    el.storeFlowCard.classList.remove("hidden");
    syncBusyControls();
  }

  function renderReviewContext() {
    const show = isStoreRoute()
      ? state.storeReviewFlowStage === "reviews" && state.recognizedDishIds.size > 0 && !!state.visitTier
      : state.recognizedDishIds.size > 0 && !!state.visitTier;
    el.reviewContextBar.classList.toggle("hidden", !show);
    if (!show) return;

    el.visitSummaryBtn.classList.toggle("hidden", !state.visitTier);
    setNodeText(el.visitSummaryText, getVisitTierLabel(state.visitTier));
    const serviceAvailable = !isStoreRoute() && isServicePraiseAvailable();
    el.serviceModule.classList.toggle("hidden", !serviceAvailable);

    const payload = buildServicePraisePayload();
    setNodeText(
      el.serviceToggleText,
      payload ? t("serviceToggleEnabled") + " · " + payload.staffLabel : t("serviceToggle"),
    );
    setNodeText(el.serviceToggleMeta, payload ? t("visitSummaryAction") : t("serviceToggleMeta"));
    el.serviceToggleBtn.classList.toggle("has-selection", !!payload);
    el.serviceToggleBtn.setAttribute("aria-expanded", serviceAvailable && state.isServicePanelOpen ? "true" : "false");
    el.servicePanel.classList.toggle("is-open", serviceAvailable && state.isServicePanelOpen);
    el.servicePanel.setAttribute("aria-hidden", serviceAvailable && state.isServicePanelOpen ? "false" : "true");
    if (serviceAvailable) {
      renderServiceStaffOptions();
      renderServicePraiseOptions();
    } else {
      el.serviceStaffSelect.innerHTML = "";
      el.servicePraiseOptions.innerHTML = "";
    }
    syncBusyControls();
  }

  function syncStoreVisitReceiptBlock() {
    if (!el.storeVisitReceiptBlock) {
      return;
    }
    if (isStoreRoute()) {
      el.storeVisitReceiptBlock.hidden = true;
      return;
    }
    const has = !!state.receiptDataUrl;
    el.storeVisitReceiptBlock.hidden = !has && !document.body.classList.contains("store-visit-ready");
  }

  function syncIntakeActionButtons() {
    if (!isStoreRoute()) {
      return;
    }
    const has = !!state.receiptDataUrl;
    document.body.classList.toggle("store-has-receipt", has);
    if (el.uploadBtn) {
      el.uploadBtn.classList.add("hidden");
    }
    if (el.writeOwnReviewBtn) {
      el.writeOwnReviewBtn.classList.add("hidden");
    }
    if (el.retakeBtn) {
      el.retakeBtn.classList.toggle("hidden", !has);
    }
    syncStoreVisitReceiptBlock();
  }

  function renderReceiptPreview() {
    el.receiptPreview.innerHTML = "";

    if (!state.receiptDataUrl) {
      el.receiptPreview.classList.add("empty");
      if (!(isStoreRoute() && !state.storeBootstrapFailure)) {
        const text = document.createElement("p");
        text.id = "previewEmptyText";
        text.className = "empty-text";
        text.textContent = t("previewEmpty");
        el.receiptPreview.appendChild(text);
        el.previewEmptyText = text;
      }
      syncIntakeActionButtons();
      return;
    }

    el.receiptPreview.classList.remove("empty");
    const image = document.createElement("img");
    image.src = state.receiptDataUrl;
    image.alt = state.receiptName || "photo preview";
    el.receiptPreview.appendChild(image);
    syncIntakeActionButtons();
  }

  function renderDishOptions() {
    el.dishSearch.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = t("dishSearchPlaceholder");
    el.dishSearch.appendChild(placeholder);

    const sorted = state.flatDishes.slice().sort(isStoreRoute() ? sortDishesForBrowse : function (a, b) {
      return getDishName(a).localeCompare(getDishName(b), state.lang === "zh" ? "zh-Hans" : "en", {
        sensitivity: "base",
      });
    });

    sorted.forEach(function (item) {
      const option = document.createElement("option");
      option.value = String(item.uqid);
      option.textContent = getDishOptionLabel(item);
      option.disabled = state.recognizedDishIds.has(item.uqid);
      el.dishSearch.appendChild(option);
    });

    el.dishSearch.value = "";
  }

  function renderRecognizedDishes() {
    const dishIds = Array.from(state.recognizedDishIds).sort(function (a, b) {
      return a - b;
    });
    el.recognizedList.innerHTML = "";
    el.recognizedList.classList.toggle("empty", dishIds.length === 0);
    el.recognizedSummary.classList.toggle("hidden", dishIds.length === 0);
    renderReceiptMeta();
    renderFlowState();
    syncBusyControls();
    renderDishOptions();
    el.dishSearch.disabled = state.isRecognizing || state.isGenerating;
    el.correctionToggle.textContent = state.isCorrectionOpen ? t("correctionToggleOpen") : t("correctionToggleClosed");

    if (state.isRecognizing && dishIds.length === 0) {
      for (let i = 0; i < 3; i += 1) {
        const chip = document.createElement("span");
        chip.className = "dish-chip dish-chip-skeleton";
        el.recognizedList.appendChild(chip);
      }
      el.recognizedSummary.textContent = "";
    } else if (dishIds.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-text";
      empty.textContent = t("recognizedEmpty");
      el.recognizedList.appendChild(empty);
      el.recognizedSummary.textContent = "";
    } else {
      el.recognizedSummary.textContent = formatText(t("recognizedCount"), { count: dishIds.length });

      dishIds.forEach(function (dishId) {
        const item = state.dishMap.get(dishId);
        if (!item) return;

        const chip = document.createElement("span");
        chip.className = "dish-chip";

        const text = document.createElement("span");
        text.textContent = getDishName(item);
        chip.appendChild(text);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove-btn";
        removeBtn.textContent = "×";
        removeBtn.setAttribute("aria-label", "remove " + getDishName(item));
        removeBtn.addEventListener("click", function () {
          state.recognizedDishIds.delete(dishId);
          if (state.recognizedDishIds.size === 0) {
            state.isCorrectionOpen = true;
          }
          state.generatedReviews = [];
          renderRecognizedDishes();
          renderReviewContext();
          renderReviews();
          setStatus(el.receiptStatus, t("removeDishSuccess"), "ok");
          setStatus(el.reviewsStatus, t("correctionChanged"), "working");
          if (state.recognizedDishIds.size > 0) {
            if (state.visitTier) {
              refreshReviews().catch(function (err) {
                console.error("Auto refresh after removal failed", err);
              });
            } else {
              openVisitSheet(true);
            }
          }
        });
        chip.appendChild(removeBtn);
        el.recognizedList.appendChild(chip);
      });
    }

    el.uncertainWrap.classList.toggle("hidden", state.uncertainTexts.length === 0);
    el.uncertainList.innerHTML = "";
    state.uncertainTexts.forEach(function (text) {
      const li = document.createElement("li");
      li.textContent = text;
      el.uncertainList.appendChild(li);
    });
  }

  function renderReviews() {
    el.reviewsGrid.innerHTML = "";
    const reviewsEmpty = state.generatedReviews.length === 0;
    el.reviewsGrid.classList.toggle("empty", reviewsEmpty && !isStoreRoute());
    renderFlowState();
    renderReviewContext();
    syncBusyControls();
    updateManualOpenLink();
    el.anotherSetBtn.disabled = state.generatedReviews.length === 0 || state.isGenerating || state.recognizedDishIds.size === 0;
    el.anotherSetBtn.textContent = state.isGenerating ? t("anotherSetWorking") : t("anotherSetBtn");

    if (state.isGenerating) {
      for (let i = 0; i < 3; i += 1) {
        const card = document.createElement("article");
        card.className = "review-card review-card-skeleton";

        const row = document.createElement("div");
        row.className = "review-card-row";

        const radioStub = document.createElement("span");
        radioStub.className = "review-card-radio review-card-radio--stub";
        radioStub.setAttribute("aria-hidden", "true");

        const content = document.createElement("div");
        content.className = "review-card-content";

        const titleLine = document.createElement("div");
        titleLine.className = "skeleton-line skeleton-line-title";
        content.appendChild(titleLine);

        const body = document.createElement("div");
        body.className = "review-body skeleton-block";
        for (let j = 0; j < 4; j += 1) {
          const line = document.createElement("div");
          line.className = "skeleton-line";
          body.appendChild(line);
        }
        content.appendChild(body);
        row.appendChild(radioStub);
        row.appendChild(content);
        card.appendChild(row);
        el.reviewsGrid.appendChild(card);
      }
      return;
    }

    if (state.generatedReviews.length === 0) {
      if (!isStoreRoute()) {
        const empty = document.createElement("p");
        empty.className = "empty-text";
        empty.textContent = t("reviewsEmpty");
        el.reviewsGrid.appendChild(empty);
      }
      return;
    }

    state.generatedReviews.forEach(function (review) {
      const variant = STYLE_VARIANTS.find(function (item) {
        return item.key === review.styleKey;
      });
      if (!variant) return;

      const isSelected = state.selectedReviewStyleKey === review.styleKey;
      const card = document.createElement("article");
      card.className = "review-card" + (isSelected ? " is-selected" : "");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-pressed", isSelected ? "true" : "false");
      card.setAttribute("aria-label", state.lang === "zh" ? variant.zhLabel : variant.enLabel);
      card.addEventListener("click", function () {
        selectReview(review);
      });
      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectReview(review);
        }
      });

      const row = document.createElement("div");
      row.className = "review-card-row";

      const selectWrap = document.createElement("label");
      selectWrap.className = "review-card-select";

      const radioInput = document.createElement("input");
      radioInput.type = "radio";
      radioInput.name = "review-pick";
      radioInput.className = "review-card-radio-input";
      radioInput.checked = isSelected;
      radioInput.setAttribute("aria-label", state.lang === "zh" ? variant.zhLabel : variant.enLabel);
      radioInput.addEventListener("click", function (event) {
        event.stopPropagation();
        selectReview(review);
      });

      const radio = document.createElement("span");
      radio.className = "review-card-radio";
      radio.setAttribute("aria-hidden", "true");
      selectWrap.appendChild(radioInput);
      selectWrap.appendChild(radio);
      row.appendChild(selectWrap);

      const content = document.createElement("div");
      content.className = "review-card-content";

      const head = document.createElement("div");
      head.className = "review-card-head";

      const titleWrap = document.createElement("div");
      titleWrap.className = "review-card-title-wrap";

      const title = document.createElement("h3");
      title.textContent = state.lang === "zh" ? variant.zhLabel : variant.enLabel;
      titleWrap.appendChild(title);

      const subText = state.lang === "zh" ? variant.zhSubLabel : variant.enSubLabel;
      if (subText) {
        const sub = document.createElement("p");
        sub.className = "review-note";
        sub.textContent = subText;
        titleWrap.appendChild(sub);
      }

      head.appendChild(titleWrap);
      content.appendChild(head);

      const body = document.createElement("p");
      body.className = "review-body";
      body.textContent = review.text;
      content.appendChild(body);

      row.appendChild(content);
      card.appendChild(row);

      el.reviewsGrid.appendChild(card);
    });
  }

  function hideLoyaltyPromoPanel() {
    if (el.loyaltyPromoPanel) el.loyaltyPromoPanel.classList.add("hidden");
    if (el.loyaltyPromoForm) el.loyaltyPromoForm.classList.remove("hidden");
    if (el.loyaltyPromoResult) el.loyaltyPromoResult.classList.add("hidden");
    setStatus(el.loyaltyPromoStatus, "", "", "");
    syncStoreReviewStageChrome();
  }

  function clearSelectedReview() {
    state.selectedReviewStyleKey = "";
    state.selectedReviewText = "";
  }

  async function copySelectedReviewText(text, fallbackUrl) {
    try {
      await navigator.clipboard.writeText(String(text || "").trim());
      setStatus(el.reviewsStatus, t("reviewSelected"), "ok", fallbackUrl);
    } catch (err) {
      setStatus(el.reviewsStatus, t("reviewSelectedCopyFail"), "error", fallbackUrl);
    }
  }

  function selectReview(review) {
    if (!review || !review.text) return;
    const routes = getReviewRouteSet();
    const targetUrl = getReviewTargetUrl();
    const fallbackUrl = routes.secondaryUrl || routes.browserUrl || routes.mapsUrl || targetUrl;
    if (!targetUrl) {
      setStatus(el.reviewsStatus, t("noUrl"), "error", fallbackUrl);
      return;
    }

    state.selectedReviewStyleKey = review.styleKey;
    state.selectedReviewText = review.text;
    state.pendingReviewUrl = targetUrl;
    state.hasAttemptedReviewOpen = true;
    renderReviews();

    if (el.loyaltyPromoPanel && !state.loyaltyPromoDone) {
      revealLoyaltyPromo();
      void copySelectedReviewText(review.text, fallbackUrl);
      return;
    }

    void copySelectedReviewText(review.text, fallbackUrl);
    updateManualOpenLink(targetUrl, true);
  }

  function resetSession(keepLang) {
    const nextLang = keepLang ? state.lang : "en";
    state.lang = nextLang;
    state.receiptDataUrl = "";
    state.receiptName = "";
    state.recognizedDishIds.clear();
    state.uncertainTexts = [];
    state.generatedReviews = [];
    state.recognitionMeta = [];
    state.imageAnalysis = null;
    state.lastRecognitionMode = "";
    state.visitTier = "";
    state.isVisitSheetOpen = false;
    clearVisitSheetDelay();
    state.shouldRefreshAfterVisitSheet = false;
    state.isServicePanelOpen = false;
    state.servicePraiseEnabled = false;
    state.serviceStaffLabel = "";
    state.servicePraiseKey = SERVICE_PRAISE_OPTIONS[0].key;
    state.isRecognizing = false;
    state.isGenerating = false;
    state.isCorrectionOpen = false;
    state.hasAttemptedReviewOpen = false;
    state.loyaltyPromoDone = false;
    state.pendingReviewUrl = null;
    clearSelectedReview();
    hideLoyaltyPromoPanel();
    state.storeVisitStars = 0;
    state.storeVisitStarsHover = 0;
    state.storeReviewFlowStage = "gate";
    state.storeReviewSatisfaction = "";
    state.storeServiceSearch = "";
    state.storeStaffSearch = "";
    state.storePrivateFeedbackMode = "private";
    closeStorePrivateFeedbackModal();
    resetStorePrivateFeedbackPanels();
    el.receiptInput.value = "";
    el.dishSearch.value = "";
    if (el.serviceStaffSelect) el.serviceStaffSelect.value = "";
    renderReceiptPreview();
    renderRecognizedDishes();
    renderReviewContext();
    trackEvent("session_reset", analyticsParams({
      keep_language: !!keepLang,
    }));
    renderVisitSheet();
    renderReviews();
    syncStoreVisitChrome();
    clearReceiptStatus();
    clearReviewsStatus();
    if (isStoreRoute() && state.storeBootstrapFailure) {
      setStatus(el.receiptStatus, resolveBootstrapFailureCopy(state.storeBootstrapFailure), "error");
    } else if (isStoreRoute() && state.storeCatalogIsDefault && !hasActiveResultFlow()) {
      setStatus(el.receiptStatus, t("storeCatalogDefaultHint"), "ok");
    } else if (isStoreRoute() && document.body.classList.contains("store-visit-ready") && !hasActiveResultFlow()) {
      clearReceiptStatus();
    } else {
      setStatus(el.receiptStatus, t("startOverDone"), "ok");
    }
  }

  async function fileToDataUrl(file) {
    const rawDataUrl = await readFileAsDataUrl(file);
    return resizeDataUrl(rawDataUrl, 1600);
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function resizeDataUrl(dataUrl, maxSide) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.onload = function () {
        const largestSide = Math.max(image.width, image.height);
        const scale = largestSide > maxSide ? maxSide / largestSide : 1;
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      image.onerror = reject;
      image.src = dataUrl;
    });
  }

  async function handleReceiptFile(file) {
    if (!file) return;
    if (isStoreRoute() && state.storeBootstrapFailure) {
      setStatus(el.receiptStatus, resolveBootstrapFailureCopy(state.storeBootstrapFailure), "error");
      return;
    }

    state.receiptName = file.name || "upload";
    state.receiptDataUrl = await fileToDataUrl(file);
    state.isCorrectionOpen = false;
    state.recognizedDishIds.clear();
    state.uncertainTexts = [];
    state.generatedReviews = [];
    state.imageAnalysis = null;
    state.lastRecognitionMode = "";
    state.visitTier = "";
    state.visitSheetDraftTier = "";
    state.isVisitSheetOpen = false;
    resetVisitSheetDrag();
    clearVisitSheetDelay();
    state.shouldRefreshAfterVisitSheet = false;
    state.isServicePanelOpen = false;
    state.servicePraiseEnabled = false;
    state.serviceStaffLabel = "";
    state.servicePraiseKey = SERVICE_PRAISE_OPTIONS[0].key;
    renderReceiptPreview();
    renderRecognizedDishes();
    renderReviewContext();
    renderVisitSheet();
    renderReviews();
    clearReviewsStatus();
    clearReceiptStatus();
    scheduleVisitSheetOpen(true, 1000);
  }

  async function recognizeAndGenerate() {
    if (!state.receiptDataUrl) {
      setStatus(el.receiptStatus, t("noReceipt"), "error");
      return;
    }
    if (isStoreRoute() && state.storeBootstrapFailure) {
      setStatus(el.receiptStatus, resolveBootstrapFailureCopy(state.storeBootstrapFailure), "error");
      return;
    }

    state.isRecognizing = true;
    state.isGenerating = false;
    el.anotherSetBtn.disabled = true;
    renderReceiptMeta();
    renderFlowState();
    setStatus(el.receiptStatus, t("receiptWorking"), "working");
    clearReviewsStatus();

    try {
      if (state.storeSlug) {
        const result = await recognizeViaBackend(state.receiptDataUrl);
        state.imageAnalysis = result.imageAnalysis || null;
        state.recognizedDishIds = new Set(result.recognizedDishIds || []);
        state.uncertainTexts = uniqueArray(result.uncertainTexts || []);
        state.recognitionMeta = result.recognitionMeta || {};
        state.lastRecognitionMode = state.recognitionMeta.mode || "";
        state.isCorrectionOpen = state.recognizedDishIds.size === 0;

        renderRecognizedDishes();
        renderReviewContext();
        setStatus(el.receiptStatus, t("receiptDone"), "ok");

        if (state.recognizedDishIds.size === 0) {
          if (state.uncertainTexts.length > 0) {
            setStatus(el.reviewsStatus, t("receiptUnmatchedOnly"), "ok");
          } else {
            setStatus(el.reviewsStatus, t("noDishes"), "error");
            return;
          }
        }

        if (state.recognizedDishIds.size > 0) {
          if (state.visitTier) {
            refreshReviews().catch(function (err) {
              console.error("Auto refresh after recognition failed", err);
            });
          } else {
            openVisitSheet(true);
          }
        } else if (!state.visitTier) {
          openVisitSheet(true);
        }
        return;
      }

      state.lastRecognitionMode = "receipt";
      setStatus(el.receiptStatus, t("routeReceipt"), "working");

      const result = await recognizeReceipt(state.receiptDataUrl);
      const validDishIds = uniqueArray(
        (result.dishes || [])
          .map(function (item) {
            return Number(item.dish_id);
          })
          .filter(function (dishId) {
            return state.dishMap.has(dishId);
          }),
      );

      state.imageAnalysis = result && result.imageAnalysis ? result.imageAnalysis : null;
      state.recognizedDishIds = new Set(validDishIds);
      state.uncertainTexts = uniqueArray(result.uncertain_texts || []);
      state.recognitionMeta = {
        mode: "receipt",
        analysis: state.imageAnalysis,
        matches: result.dishes || [],
      };

      state.isCorrectionOpen = state.recognizedDishIds.size === 0;
      renderRecognizedDishes();
      renderReviewContext();
      setStatus(el.receiptStatus, t("receiptDone"), "ok");

      if (state.recognizedDishIds.size === 0) {
        if (state.uncertainTexts.length > 0) {
          setStatus(el.reviewsStatus, t("receiptUnmatchedOnly"), "ok");
        } else {
          setStatus(el.reviewsStatus, t("noDishes"), "error");
          return;
        }
      }

      if (state.recognizedDishIds.size > 0) {
        if (state.visitTier) {
          refreshReviews().catch(function (err) {
            console.error("Auto refresh after recognition failed", err);
          });
        } else {
          openVisitSheet(true);
        }
      } else if (!state.visitTier) {
        openVisitSheet(true);
      }
    } catch (err) {
      console.error("Receipt recognition failed", err);
      setStatus(el.receiptStatus, t("receiptFailed"), "error");
      setStatus(el.reviewsStatus, err.message || t("receiptFailed"), "error");
    } finally {
      state.isRecognizing = false;
      renderReceiptMeta();
      renderFlowState();
    }
  }

  async function refreshReviews() {
    if (isStoreRoute() && state.storeBootstrapFailure) {
      setStatus(el.reviewsStatus, resolveBootstrapFailureCopy(state.storeBootstrapFailure), "error");
      return;
    }
    if (state.recognizedDishIds.size === 0) {
      setStatus(el.reviewsStatus, t("noDishes"), "error");
      return;
    }
    if (!ensureVisitTierSelected()) {
      return;
    }

    state.isGenerating = true;
    state.hasAttemptedReviewOpen = false;
    clearSelectedReview();
    hideLoyaltyPromoPanel();
    renderRecognizedDishes();
    renderReviewContext();
    renderReviews();
    setStatus(el.reviewsStatus, t("reviewWorking"), "working");

    try {
      const reviews = state.storeSlug
        ? (await generateReviewsViaBackend()).reviews || []
        : await generateReviewsWithRetry();
      state.generatedReviews = reviews;
      rememberReviews(reviews);
      state.shouldRefreshAfterVisitSheet = false;
      renderReviews();
      renderReviewContext();
      setStatus(el.reviewsStatus, t("reviewDone"), "ok");
      if (!state.isCorrectionOpen) {
        focusStoreReviewsStage();
      }
    } catch (err) {
      console.error("Review generation failed", err);
      state.generatedReviews = [];
      renderReviews();
      setStatus(el.reviewsStatus, t("reviewFailed"), "error");
    } finally {
      state.isGenerating = false;
      renderRecognizedDishes();
      renderReviewContext();
      renderReviews();
      if (isStoreRoute() && state.storeReviewFlowStage === "reviews") {
        focusStoreReviewsStage();
      }
    }
  }

  async function recognizeViaBackend(imageDataUrl) {
    if (!state.storeSlug) return null;
    return fetchJson("/api/stores/" + encodeURIComponent(state.storeSlug) + "/recognize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageDataUrl: imageDataUrl,
      }),
    });
  }

  async function generateReviewsViaBackend() {
    if (!state.storeSlug) return null;
    const dishIds = Array.from(state.recognizedDishIds).sort(function (a, b) {
      return a - b;
    });
    const comboKey = buildComboKey(dishIds, state.lang);
    const recentTexts = getRecentReviews(comboKey);

    return fetchJson("/api/stores/" + encodeURIComponent(state.storeSlug) + "/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dishIds: dishIds,
        lang: state.lang,
        recentTexts: recentTexts,
        visitTier: state.visitTier,
        servicePraise: buildServicePraisePayload(),
      }),
    });
  }

  function addDishById(dishId) {
    if (!dishId) {
      setStatus(el.receiptStatus, t("addDishFail"), "error");
      return;
    }

    state.recognizedDishIds.add(dishId);
    state.generatedReviews = [];
    renderRecognizedDishes();
    renderReviewContext();
    renderReviews();
    setStatus(el.receiptStatus, t("addDishSuccess"), "ok");
    setStatus(el.reviewsStatus, t("correctionChanged"), "working");
    if (state.visitTier) {
      refreshReviews().catch(function (err) {
        console.error("Auto refresh after add failed", err);
      });
    } else {
      openVisitSheet(true);
    }
  }

  function openGoogleReviewWritePage() {
    const routes = getReviewRouteSet();
    const targetUrl = routes.primaryUrl || routes.secondaryUrl;
    if (!targetUrl) {
      setStatus(el.receiptStatus, t("noUrl"), "error");
      return;
    }
    window.location.href = targetUrl;
  }

  async function copyReviewAndGo(text) {
    const routes = getReviewRouteSet();
    const targetUrl = routes.primaryUrl || routes.secondaryUrl;
    const fallbackUrl = routes.secondaryUrl || targetUrl;
    if (!targetUrl) {
      setStatus(el.reviewsStatus, t("noUrl"), "error", fallbackUrl);
      return;
    }

    state.pendingReviewUrl = targetUrl;
    try {
      await navigator.clipboard.writeText(String(text || "").trim());
      state.hasAttemptedReviewOpen = true;
      setStatus(el.reviewsStatus, t("copiedAndGoing"), "working", fallbackUrl);
    } catch (err) {
      setStatus(el.reviewsStatus, t("copyFail"), "error", fallbackUrl);
    }

    if (el.loyaltyPromoPanel && !state.loyaltyPromoDone) {
      revealLoyaltyPromo();
      return;
    }
    setTimeout(function () {
      window.location.href = targetUrl;
    }, 320);
  }

  var LOYALTY_PROMO_COPY = {
    en: {
      intro: "Leave your number and we’ll text you a promo code for your next visit.",
      phonePlaceholder: "Your mobile number",
      sending: "Sending your code…",
      invalidPhone: "Enter a mobile number with at least 7 digits.",
      needConsent: "Please check the box so we can text your code.",
      failed: "Could not save right now — you can still continue to Google.",
      sentSuccess: "We've saved your number — we'll send your promo code via text soon.",
      continueGoogle: "Continue to Google review",
    },
    zh: {
      intro: "留下手机号，我们会把下次到店的优惠码发短信给你。",
      phonePlaceholder: "你的手机号",
      sending: "正在发送优惠码…",
      invalidPhone: "请输入至少 7 位的手机号。",
      needConsent: "请勾选同意，我们才能把优惠码发给你。",
      failed: "暂时无法保存 — 你仍可继续前往 Google。",
      sentSuccess: "已保存手机号 — 优惠码会通过短信发给你。",
      continueGoogle: "继续前往 Google 评价",
    },
  };

  function loyaltyCopy() {
    return LOYALTY_PROMO_COPY[state.lang === "zh" ? "zh" : "en"];
  }

  function getLoyaltyBusinessName() {
    return String(getRestaurantName() || getBrandDisplayName() || "this business").trim();
  }

  function getLoyaltyConsentText() {
    var businessName = getLoyaltyBusinessName();
    if (state.lang === "zh") {
      return "我同意接收来自" + businessName + "的短信。回复 STOP 退订。";
    }
    return "I agree to receive text messages from " + businessName + ". Reply STOP to opt out.";
  }

  function syncLoyaltyPromoConsent() {
    if (el.loyaltyPromoConsentText) {
      el.loyaltyPromoConsentText.textContent = getLoyaltyConsentText();
    }
  }

  function goToPendingReview() {
    var url = String(state.pendingReviewUrl || getFallbackReviewUrl() || "").trim();
    if (url) window.location.href = url;
  }

  function syncLoyaltyPromoSubmitBtn(isSubmitting) {
    if (!el.loyaltyPromoSubmitBtn) return;
    el.loyaltyPromoSubmitBtn.disabled = !!isSubmitting;
    if (isSubmitting) {
      el.loyaltyPromoSubmitBtn.textContent = loyaltyCopy().sending;
      return;
    }
    el.loyaltyPromoSubmitBtn.innerHTML =
      "<span>" +
      escapeHtml(t("storeFlowStepContinue")) +
      '</span><span class="store-flow-nav-icon" aria-hidden="true">→</span>';
  }

  function showLoyaltyPromoContinueState(message, options) {
    var opts = options || {};
    var c = loyaltyCopy();
    if (el.loyaltyPromoForm) el.loyaltyPromoForm.classList.add("hidden");
    if (el.loyaltyPromoCodeText) {
      el.loyaltyPromoCodeText.textContent = message;
      el.loyaltyPromoCodeText.classList.toggle("loyalty-promo-sent--error", !!opts.isError);
    }
    if (el.loyaltyPromoContinueBtn) el.loyaltyPromoContinueBtn.textContent = c.continueGoogle;
    if (el.loyaltyPromoResult) el.loyaltyPromoResult.classList.remove("hidden");
    setStatus(el.loyaltyPromoStatus, "", "", "");
    updateManualOpenLink(state.pendingReviewUrl, true);
  }

  function revealLoyaltyPromo() {
    if (!el.loyaltyPromoPanel) {
      goToPendingReview();
      return;
    }
    var c = loyaltyCopy();
    if (el.loyaltyPromoIntro) el.loyaltyPromoIntro.textContent = c.intro;
    if (el.loyaltyPromoPhone) el.loyaltyPromoPhone.placeholder = c.phonePlaceholder;
    if (el.loyaltyPromoConsent) el.loyaltyPromoConsent.checked = true;
    syncLoyaltyPromoConsent();
    syncLoyaltyPromoSubmitBtn(false);
    if (el.loyaltyPromoForm) el.loyaltyPromoForm.classList.remove("hidden");
    if (el.loyaltyPromoResult) el.loyaltyPromoResult.classList.add("hidden");
    setStatus(el.loyaltyPromoStatus, "", "", "");
    el.loyaltyPromoPanel.classList.remove("hidden");
    syncStoreReviewStageChrome();
    updateManualOpenLink(state.pendingReviewUrl, true);
    scrollCardIntoView(el.loyaltyPromoPanel, 16, 980);
  }

  async function submitLoyaltyPromo() {
    if (!el.loyaltyPromoPhone) return;
    var c = loyaltyCopy();
    var phone = String(el.loyaltyPromoPhone.value || "").trim();
    var digits = phone.replace(/\D/g, "");
    var consent = !!(el.loyaltyPromoConsent && el.loyaltyPromoConsent.checked);
    if (!consent) {
      setStatus(el.loyaltyPromoStatus, c.needConsent, "error");
      return;
    }
    if (digits.length === 0) {
      state.loyaltyPromoDone = true;
      goToPendingReview();
      return;
    }
    if (digits.length < 7) {
      setStatus(el.loyaltyPromoStatus, c.invalidPhone, "error");
      return;
    }
    syncLoyaltyPromoSubmitBtn(true);
    setStatus(el.loyaltyPromoStatus, c.sending, "working");
    try {
      var data = await fetchJson("/api/loyalty-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone,
          smsConsent: true,
          storeSlug: state.storeSlug || "",
          placeId: (state.store && (state.store.placeId || state.store.googlePlaceId)) || null,
          lang: state.lang,
        }),
      });
      state.loyaltyPromoDone = true;
      showLoyaltyPromoContinueState(c.sentSuccess);
    } catch (err) {
      showLoyaltyPromoContinueState(c.failed, { isError: true });
    } finally {
      syncLoyaltyPromoSubmitBtn(false);
    }
  }

  function setLanguageMenuOpen(open) {
    if (!el.langMenuToggle || !el.langMenuPopover) return;
    var isOpen = !!open;
    el.langMenuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    el.langMenuPopover.classList.toggle("hidden", !isOpen);
    if (el.langMenu) el.langMenu.classList.toggle("is-open", isOpen);
  }

  function switchLanguage(nextLang) {
    var resolved = nextLang === "zh" || nextLang === "en" ? nextLang : state.lang === "zh" ? "en" : "zh";
    if (resolved === state.lang) {
      setLanguageMenuOpen(false);
      return;
    }
    state.lang = resolved;
    saveLanguagePreference(state.lang);
    if (isLeaderboardRoute()) {
      state.leaderboardLocale = state.lang === "zh" ? "zh" : "en";
      try {
        localStorage.setItem("leaderboardLocale", state.leaderboardLocale);
      } catch (e) {
        /* ignore */
      }
    }
    updateText();
    renderReceiptPreview();
    if (!state.storeBootstrapFailure) {
      clearReceiptStatus();
      if (state.storeCatalogIsDefault && !hasActiveResultFlow()) {
        setStatus(el.receiptStatus, t("storeCatalogDefaultHint"), "ok");
      }
    }
    clearReviewsStatus();

    if (state.recognizedDishIds.size > 0) {
      state.generatedReviews = [];
      renderReviews();
      if (state.visitTier) {
        refreshReviews().catch(function (err) {
          console.error("Language switch review refresh failed", err);
        });
      } else {
        openVisitSheet(true);
      }
    }
    trackEvent("language_toggled", analyticsParams());
    setLanguageMenuOpen(false);
  }

  function bindEvents() {
    function openUploadPicker() {
      el.receiptInput.click();
    }

    el.uploadBtn.addEventListener("click", function () {
      trackEvent("upload_picker_opened", analyticsParams({
        source: "upload_btn",
      }));
      openUploadPicker();
    });

    if (el.writeOwnReviewBtn) {
      el.writeOwnReviewBtn.addEventListener("click", function () {
        trackEvent("write_review_clicked", analyticsParams());
        openGoogleReviewWritePage();
      });
    }

    el.retakeBtn.addEventListener("click", function () {
      trackEvent("upload_picker_opened", analyticsParams({
        source: "retake_btn",
      }));
      openUploadPicker();
    });

    el.retakeInlineBtn.addEventListener("click", function () {
      trackEvent("upload_picker_opened", analyticsParams({
        source: "retake_inline_btn",
      }));
      openUploadPicker();
    });

    el.receiptInput.addEventListener("change", function (event) {
      const file = event.target.files && event.target.files[0];
      trackEvent("receipt_selected", analyticsParams({
        has_file: !!file,
        file_type: file && file.type ? String(file.type) : "",
      }));
      handleReceiptFile(file).catch(function (err) {
        console.error("Receipt load failed", err);
        setStatus(el.receiptStatus, t("receiptFailed"), "error");
      });
    });

    el.dishSearch.addEventListener("change", function () {
      const dishId = Number(el.dishSearch.value);
      if (!Number.isFinite(dishId) || dishId <= 0) return;
      addDishById(dishId);
      el.dishSearch.value = "";
    });

    el.correctionToggle.addEventListener("click", function () {
      const opening = !state.isCorrectionOpen;
      state.isCorrectionOpen = opening;
      updateText();
      scrollCardIntoView(opening ? el.intakeCard : el.reviewsCard, opening ? 8 : 14);
    });

    el.anotherSetBtn.addEventListener("click", function () {
      trackEvent("reviews_regenerate_clicked", analyticsParams());
      refreshReviews().catch(function (err) {
        console.error("Another set generation failed", err);
      });
    });

    if (el.loyaltyPromoSubmitBtn) {
      el.loyaltyPromoSubmitBtn.addEventListener("click", function () {
        trackEvent("loyalty_promo_submit_clicked", analyticsParams());
        submitLoyaltyPromo().catch(function (err) {
          console.error("Loyalty promo signup failed", err);
        });
      });
    }
    if (el.loyaltyPromoContinueBtn) {
      el.loyaltyPromoContinueBtn.addEventListener("click", function () {
        trackEvent("loyalty_promo_continue_clicked", analyticsParams());
        state.loyaltyPromoDone = true;
        goToPendingReview();
      });
    }

    el.visitSummaryBtn.addEventListener("click", function () {
      if (isStoreRoute()) {
        state.storeReviewFlowStage = "visit";
        renderStoreFlowCard();
        renderFlowState();
        renderReviewContext();
        scrollCardIntoView(el.intakeCard, 8);
        return;
      }
      trackEvent("visit_sheet_opened", analyticsParams({
        source: "visit_summary_btn",
      }));
      openVisitSheet(true);
    });

    el.visitContinueBtn.addEventListener("click", function () {
      if (!state.visitSheetDraftTier) return;
      const visitTierChanged = state.visitTier !== state.visitSheetDraftTier;
      trackEvent("visit_tier_confirmed", analyticsParams({
        visit_tier: state.visitSheetDraftTier,
        changed: visitTierChanged,
      }));
      state.visitTier = state.visitSheetDraftTier;
      closeVisitSheet();
      renderReviewContext();
      if (!state.shouldRefreshAfterVisitSheet) return;

      if (needsRecognitionBeforeReviews()) {
        recognizeAndGenerate().catch(function (err) {
          console.error("Recognition after visit selection failed", err);
        });
        return;
      }

      if (visitTierChanged || state.recognizedDishIds.size > 0) {
        refreshReviews().catch(function (err) {
          console.error("Visit-context refresh failed", err);
        });
      }
    });

    el.visitSheetBackdrop.addEventListener("click", function (event) {
      if (event.target !== el.visitSheetBackdrop) return;
      if (!state.isVisitSheetOpen || !canDismissVisitSheet()) return;
      closeVisitSheet();
    });

    function handleVisitSheetDragStart(event) {
      if (!state.isVisitSheetOpen || !canDismissVisitSheet()) return;
      if (state.isRecognizing || state.isGenerating) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      state.visitSheetDrag.active = true;
      state.visitSheetDrag.pointerId = event.pointerId;
      state.visitSheetDrag.startY = event.clientY;
      state.visitSheetDrag.lastY = 0;
      state.visitSheetDrag.startedAt = Date.now();
      el.visitSheetBackdrop.classList.add("is-dragging");
      updateVisitSheetDrag(0);

      if (el.visitSheetDragZone && el.visitSheetDragZone.setPointerCapture) {
        el.visitSheetDragZone.setPointerCapture(event.pointerId);
      }

      event.preventDefault();
    }

    function handleVisitSheetDragMove(event) {
      if (!state.visitSheetDrag.active || event.pointerId !== state.visitSheetDrag.pointerId) return;
      const dragY = Math.max(0, event.clientY - state.visitSheetDrag.startY);
      state.visitSheetDrag.lastY = dragY;
      updateVisitSheetDrag(dragY);
    }

    function finishVisitSheetDrag(shouldClose) {
      const pointerId = state.visitSheetDrag.pointerId;
      if (el.visitSheetDragZone && pointerId != null && el.visitSheetDragZone.hasPointerCapture(pointerId)) {
        el.visitSheetDragZone.releasePointerCapture(pointerId);
      }
      resetVisitSheetDrag();
      if (shouldClose) {
        closeVisitSheet();
      }
    }

    function handleVisitSheetDragEnd(event) {
      if (!state.visitSheetDrag.active || event.pointerId !== state.visitSheetDrag.pointerId) return;
      const dragY = Math.max(0, event.clientY - state.visitSheetDrag.startY);
      const elapsedMs = Math.max(Date.now() - state.visitSheetDrag.startedAt, 1);
      const velocity = dragY / elapsedMs;
      const shouldClose = dragY > 120 || velocity > 0.65;
      finishVisitSheetDrag(shouldClose);
    }

    el.visitSheetDragZone.addEventListener("pointerdown", handleVisitSheetDragStart);
    el.visitSheetDragZone.addEventListener("pointermove", handleVisitSheetDragMove);
    el.visitSheetDragZone.addEventListener("pointerup", handleVisitSheetDragEnd);
    el.visitSheetDragZone.addEventListener("pointercancel", function () {
      finishVisitSheetDrag(false);
    });

    el.serviceToggleBtn.addEventListener("click", function () {
      if (!isServicePraiseAvailable()) return;
      state.isServicePanelOpen = !state.isServicePanelOpen;
      renderReviewContext();
    });

    el.serviceStaffSelect.addEventListener("change", function (event) {
      state.serviceStaffLabel = event.target.value;
      syncBusyControls();
    });

    el.serviceApplyBtn.addEventListener("click", function () {
      if (!isServicePraiseAvailable()) return;
      state.servicePraiseEnabled = true;
      state.isServicePanelOpen = false;
      trackEvent("service_praise_applied", analyticsParams({
        staff_label: state.serviceStaffLabel || "",
        praise_key: state.servicePraiseKey || "",
      }));
      refreshReviews().catch(function (err) {
        console.error("Service-praise refresh failed", err);
      });
    });

    el.serviceClearBtn.addEventListener("click", function () {
      if (!isServicePraiseAvailable()) return;
      const hadServicePraise = !!buildServicePraisePayload();
      state.servicePraiseEnabled = false;
      state.isServicePanelOpen = false;
      state.serviceStaffLabel = "";
      state.servicePraiseKey = SERVICE_PRAISE_OPTIONS[0].key;
      renderReviewContext();
      trackEvent("service_praise_cleared", analyticsParams());
      if (hadServicePraise && state.recognizedDishIds.size > 0) {
        refreshReviews().catch(function (err) {
          console.error("Service-praise clear refresh failed", err);
        });
      }
    });

    el.resetBtn.addEventListener("click", function () {
      resetSession(true);
    });

    if (el.langMenuToggle && el.langMenuPopover) {
      el.langMenuToggle.addEventListener("click", function () {
        var isOpen = el.langMenuToggle.getAttribute("aria-expanded") === "true";
        setLanguageMenuOpen(!isOpen);
      });
    }
    if (el.langOptionEn) {
      el.langOptionEn.addEventListener("click", function () {
        switchLanguage("en");
      });
    }
    if (el.langOptionZh) {
      el.langOptionZh.addEventListener("click", function () {
        switchLanguage("zh");
      });
    }
    document.addEventListener("click", function (event) {
      if (!el.langMenu || !el.langMenuToggle) return;
      if (el.langMenu.contains(event.target)) return;
      if (el.langMenuToggle.getAttribute("aria-expanded") === "true") {
        setLanguageMenuOpen(false);
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setLanguageMenuOpen(false);
    });

    if (el.manualOpenLink) {
      el.manualOpenLink.addEventListener("click", function () {
        trackEvent("manual_review_link_clicked", analyticsParams({
          has_attempted_auto_open: !!state.hasAttemptedReviewOpen,
        }));
      });
    }

    if (el.reviewWriteOwnBtn) {
      el.reviewWriteOwnBtn.addEventListener("click", function () {
        trackEvent("write_review_clicked", analyticsParams({
          source: "review_write_own_btn",
        }));
        openGoogleReviewWritePage();
      });
    }

    bindStoreVisitChromeEvents();
    bindStorePrivateFeedbackModalEvents();
  }

  function bindStoreVisitChromeEvents() {
    if (state.storeVisitChromeBound) return;
    state.storeVisitChromeBound = true;

    if (el.storeVisitStars) {
      el.storeVisitStars.addEventListener("click", function (event) {
        var target = event.target && event.target.closest ? event.target.closest(".store-visit-star-tile") : null;
        if (!target || !el.storeVisitStars.contains(target)) return;
        if (event.pointerType === "touch") return;
        event.stopPropagation();
        handleStoreVisitStarSelect(target.getAttribute("data-star-value"));
      });

      el.storeVisitStars.addEventListener(
        "touchend",
        function (event) {
          var target = event.target && event.target.closest ? event.target.closest(".store-visit-star-tile") : null;
          if (!target || !el.storeVisitStars.contains(target)) return;
          event.preventDefault();
          event.stopPropagation();
          handleStoreVisitStarSelect(target.getAttribute("data-star-value"));
        },
        { passive: false },
      );

      el.storeVisitStars.addEventListener("mouseover", function (event) {
        if (!canInteractWithStoreVisitStars()) return;
        var target = event.target && event.target.closest ? event.target.closest(".store-visit-star-tile") : null;
        if (!target || !el.storeVisitStars.contains(target)) return;
        state.storeVisitStarsHover = Number(target.getAttribute("data-star-value")) || 0;
        updateStoreVisitStarsVisual();
      });

      el.storeVisitStars.addEventListener("mouseleave", function () {
        if (!state.storeVisitStarsHover) return;
        state.storeVisitStarsHover = 0;
        updateStoreVisitStarsVisual();
      });
    }

    if (el.storeFlowCard) {
      el.storeFlowCard.addEventListener("click", function (event) {
        var target = event.target && event.target.closest ? event.target.closest("button") : null;
        if (!target || !el.storeFlowCard.contains(target)) return;

        var visitKey = String(target.getAttribute("data-store-flow-visit") || "").trim();
        if (visitKey) {
          state.visitTier = visitKey;
          renderStoreFlowCard();
          return;
        }

        if (target.hasAttribute("data-store-flow-staff-index")) {
          var staffIndex = String(target.getAttribute("data-store-flow-staff-index") || "").trim();
          var staffOptions = getStoreFlowStaffOptions();
          var nextStaff = staffOptions[Number(staffIndex)] || "";
          if (nextStaff) {
            if (String(state.serviceStaffLabel || "").trim() === nextStaff) {
              state.serviceStaffLabel = "";
            } else {
              state.serviceStaffLabel = nextStaff;
            }
            renderStoreFlowCard();
          }
          return;
        }

        if (target.getAttribute("data-store-flow-skip-staff") === "1") {
          state.serviceStaffLabel = "";
          state.storeStaffSearch = "";
          state.storeReviewFlowStage = "services";
          setNodeText(el.storeVisitMood, "");
          renderStoreFlowCard();
          scrollCardIntoView(el.intakeCard, 8);
          return;
        }

        var removeServiceId = Number(target.getAttribute("data-store-flow-remove-service"));
        if (Number.isFinite(removeServiceId) && removeServiceId > 0) {
          state.recognizedDishIds.delete(removeServiceId);
          renderStoreFlowCard();
          return;
        }

        var serviceId = Number(target.getAttribute("data-store-service-id"));
        if (Number.isFinite(serviceId) && serviceId > 0) {
          if (state.recognizedDishIds.has(serviceId)) {
            state.recognizedDishIds.delete(serviceId);
          } else {
            state.recognizedDishIds.add(serviceId);
          }
          renderStoreFlowCard();
          return;
        }

        var nextStage = String(target.getAttribute("data-store-flow-next") || "").trim();
        if (nextStage) {
          if (nextStage === "visit") {
            if (!state.visitTier) {
              setNodeText(el.storeVisitMood, t("storeFlowVisitRequired"));
              return;
            }
            state.storeReviewFlowStage = getStoreFlowNextStageAfterVisit();
            setNodeText(el.storeVisitMood, "");
          } else if (nextStage === "staff") {
            state.storeStaffSearch = "";
            state.storeReviewFlowStage = "services";
            setNodeText(el.storeVisitMood, "");
          }
          renderStoreFlowCard();
          scrollCardIntoView(el.intakeCard, 8);
          return;
        }

        var backStage = String(target.getAttribute("data-store-flow-back") || "").trim();
        if (backStage) {
          state.storeReviewFlowStage = getStoreFlowPreviousStage(state.storeReviewFlowStage);
          if (state.storeReviewFlowStage === "gate") {
            state.storeVisitStars = 0;
            state.storeVisitStarsHover = 0;
            setNodeText(el.storeVisitMood, "");
            syncStoreVisitStars();
          }
          renderStoreFlowCard();
          renderFlowState();
          return;
        }

        if (target.getAttribute("data-store-flow-generate") === "1") {
          if (state.recognizedDishIds.size === 0) {
            setNodeText(el.storeVisitMood, t("storeFlowServicesRequired"));
            return;
          }
          state.generatedReviews = [];
          state.lastRecognitionMode = "service_picker";
          state.storeReviewFlowStage = "reviews";
          renderStoreFlowCard();
          renderFlowState();
          renderReviews();
          focusStoreReviewsStage();
          refreshReviews().catch(function (err) {
            console.error("Store flow review generation failed", err);
          });
        }
      });

      el.storeFlowCard.addEventListener("input", function (event) {
        var target = event.target;
        if (!target) return;
        var nextValue = String(target.value || "");
        if (target.id === "storeServiceSearchInput") {
          state.storeServiceSearch = nextValue;
          renderStoreFlowCard();
          var nextInput = el.storeFlowCard.querySelector("#storeServiceSearchInput");
          if (nextInput) {
            nextInput.focus();
            if (nextInput.setSelectionRange) {
              nextInput.setSelectionRange(nextValue.length, nextValue.length);
            }
          }
          return;
        }
        if (target.id === "storeStaffSearchInput") {
          state.storeStaffSearch = nextValue;
          renderStoreFlowCard();
          var staffInput = el.storeFlowCard.querySelector("#storeStaffSearchInput");
          if (staffInput) {
            staffInput.focus();
            if (staffInput.setSelectionRange) {
              staffInput.setSelectionRange(nextValue.length, nextValue.length);
            }
          }
        }
      });
    }
  }

  async function init() {
    const route = getRouteInfo();
    state.routeKind = route.kind;
    state.storeSlug = route.slug;
    clampLangToAppLocales();

    document.addEventListener("click", function (smsEv) {
      var tg = smsEv.target;
      if (!tg || !tg.closest) return;
      var cta = tg.closest(".js-sms-funnel-cta");
      if (!cta || !isAnalysisSalonRoute()) return;
      var slug = String(state.storeSlug || "").trim();
      if (!slug) return;
      var id = String(cta.getAttribute("data-sms-funnel-cta") || cta.id || "unknown").trim();
      var salonNm =
        state.intelDetail && state.intelDetail.salon && state.intelDetail.salon.name
          ? String(state.intelDetail.salon.name)
          : "";
      postSmsFunnelSiteEvents(slug, [{ type: "report_cta_click", cta_id: id }], salonNm).catch(function () {});
    });

    if (route.kind === ROUTE_LEGACY) {
      redirectLegacyRoute(route.slug);
      return;
    }

    if (route.kind === ROUTE_ANALYSIS_LIST || route.kind === ROUTE_ANALYSIS_SALON || route.kind === ROUTE_ANALYSIS_FULL) {
      state.intelLoading = true;
      state.intelError = "";
      state.intelSalons = [];
      state.intelDetail = null;
      if (route.kind === ROUTE_ANALYSIS_LIST) {
        state.intelSearchQuery = "";
        state.intelListPage = 1;
        state.intelListTotal = 0;
        state.intelListSource = "geo";
        try {
          var __intelPs = new URLSearchParams(window.location.search || "");
          var __intelSt = (__intelPs.get("state") || "").trim();
          var __intelCity = (__intelPs.get("city") || __intelPs.get("town") || "").trim();
          if (__intelSt || __intelCity) {
            state.intelGeoState = __intelSt;
            state.intelGeoCity = __intelCity;
            state.intelGeoResolved = true;
          } else {
            state.intelGeoState = "";
            state.intelGeoCity = "";
            state.intelGeoResolved = false;
          }
        } catch (__intelE) {
          state.intelGeoState = "";
          state.intelGeoCity = "";
          state.intelGeoResolved = false;
        }
      }
    }

    if (route.kind === ROUTE_LEADERBOARD_LIST || route.kind === ROUTE_LEADERBOARD_SALON) {
      state.leaderboardLoading = true;
      state.leaderboardError = "";
      state.leaderboardSalons = [];
      state.leaderboardListSource = "geo";
      state.leaderboardDetail = null;
      state.leaderboardVisibility = "preview";
      state.leaderboardPreviewLimit = LEADERBOARD_PAGE_SIZE;
      state.leaderboardListPage = 1;
      state.leaderboardRequestModalOpen = false;
      state.leaderboardRequestToast = "";
      try {
        var __lbLoc = localStorage.getItem("leaderboardLocale");
        state.leaderboardLocale = __lbLoc === "zh" || __lbLoc === "en" ? __lbLoc : "en";
      } catch (__e) {
        state.leaderboardLocale = "en";
      }
      if (route.kind === ROUTE_LEADERBOARD_LIST) {
        state.leaderboardSearchQuery = "";
        try {
          var __lbPs = new URLSearchParams(window.location.search || "");
          var __lbSt = (__lbPs.get("state") || "").trim();
          var __lbCo = (__lbPs.get("county") || "").trim();
          var __lbTw = (__lbPs.get("town") || "").trim();
          if (__lbSt && __lbCo) {
            state.leaderboardStateF = __lbSt;
            state.leaderboardCountyF = __lbCo;
            state.leaderboardTownF = __lbTw || "All Townships";
          } else {
            state.leaderboardStateF = "All States";
            state.leaderboardCountyF = "All Counties";
            state.leaderboardTownF = "All Townships";
          }
        } catch (__lbE) {
          state.leaderboardStateF = "All States";
          state.leaderboardCountyF = "All Counties";
          state.leaderboardTownF = "All Townships";
        }
        state.leaderboardCategoryF = "All Categories";
      }
      state.leaderboardDetailTab = "overview";
    }

    if (isStoreRoute()) {
      state.storeBootstrapFailure = null;
      state.storeBootstrapPending = true;
      state.storeCatalogIsDefault = false;
      applyProvisionalStoreBranding(state.storeSlug);
    }

    updateText();

    if (isPortalRoute()) {
      return;
    }

    if (isStoreRoute()) {
      try {
        await bootstrapStoreContext();
        await loadMenu();
        state.storeBootstrapFailure = null;
      } catch (err) {
        console.error(err);
        state.storeBootstrapFailure = {
          code: String((err && err.code) || ""),
          message: String((err && err.message) || ""),
        };
        setStatus(el.receiptStatus, resolveBootstrapFailureCopy(state.storeBootstrapFailure), "error");
      } finally {
        state.storeBootstrapPending = false;
      }

      updateText();
      renderReceiptPreview();
      renderRecognizedDishes();
      renderReviews();
      bindEvents();
      syncBusyControls();
      return;
    }

    initShopify();
    bindPricingEvents();
    bindMarketingLanguageEvents();
    bindMarketingNavDropdowns();
    bindIntelListSearchDelegation();
    bindLeaderboardUiDelegation();
    bindMarketingFormEvents();
    bindMarketingContactModalEvents();
    bindMobileSnapScrollEvents();

    if (isAssistantRoute()) {
      await initializeAssistantPage();
    }

    if (isAnalysisRoute()) {
      await loadIntelPlatform();
      renderLandingContent();
    }

    if (isLeaderboardRoute()) {
      await loadLeaderboardPlatform();
      renderLandingContent();
    }

    window.addEventListener("beforeunload", function () {
      cleanupAssistantCall();
      stopLeaderboardRealtime();
    });
  }

  init().catch(function (err) {
    console.error(err);
    if (isLeaderboardRoute()) {
      state.leaderboardLoading = false;
      if (!state.leaderboardError) {
        state.leaderboardError = (err && err.message) || "Unexpected error.";
      }
      try {
        renderLandingContent();
      } catch (e2) {
        console.error(e2);
      }
    }
    if (isStoreRoute()) {
      state.storeBootstrapPending = false;
      state.storeBootstrapFailure = {
        code: String((err && err.code) || ""),
        message: String((err && err.message) || ""),
      };
      updateText();
      renderReceiptPreview();
      bindEvents();
      syncBusyControls();
      setStatus(el.receiptStatus, resolveBootstrapFailureCopy(state.storeBootstrapFailure), "error");
    }
  });
})();
