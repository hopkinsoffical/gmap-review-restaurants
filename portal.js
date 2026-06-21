(function () {
  const ROUTE_LOGIN = "login";
  const ROUTE_ADMIN = "admin";
  const ROUTE_ADMIN_STORES = "admin-stores";
  const ROUTE_ADMIN_STORE = "admin-store";
  const ROUTE_ADMIN_SMS = "admin-sms";

  /**
   * Default Ryan outreach template. Per store: set sms_leads.name (salon name) and metadata.report_url
   * (full link) or metadata.report_slug (path segment after /analysis-reports/). Optional: metadata.slug.
   */
  const SMS_BLAST_DEFAULT_MESSAGE =
    "Hi {{salon_name}}, this is Ryan. Your Google Ranking FREE Advisor!\n" +
    "Your salon looks really solid but it seems your Google reviews may not be showing that clearly enough.\n" +
    "I made a quick local Google report for you. And it's free! Join us and grow your business now!\n" +
    'Get your FREE report by sending "YES".\n' +
    "{{report_url}}\n" +
    "Reply STOP to opt out.";

  function readPortalLocale() {
    try {
      var v = sessionStorage.getItem("portalLocale");
      if (v === "zh" || v === "en") return v;
    } catch (e) {
      /* ignore */
    }
    try {
      var saved = localStorage.getItem("rankmyrestaurant-language-v1");
      if (saved === "zh" || saved === "en") return saved;
    } catch (e2) {
      /* ignore */
    }
    return "en";
  }

  const PORTAL_LOGIN_I18N = {
    en: {
      docTitleLogin: "RankMyRestaurant | Sign in",
      langSwitch: "中文",
      heroKicker: "Account access",
      heroTitle: "Admin portal sign-in",
      heroBody:
        "Use SMS (US default) or email and password. First SMS sign-in creates your admin profile. Enable Phone + SMS in Supabase for codes; use Email auth for password accounts. You can reset a forgotten password from the email panel.",
      formHeadTitle: "SMS verification",
      formHeadHint:
        "Default region is the United States: enter 10 digits, or 11 digits starting with 1. Other countries: include + and country code.",
      labelPhone: "Mobile number",
      phPhone: "4155552671 or +442012345678",
      labelOtp: "Verification code",
      phOtp: "6-digit code",
      labelFullName: "Display name (optional, first sign-up only)",
      formNote: "Tap Send code, then enter the code from your text message.",
      sendCode: "Send code",
      sendCodeBusy: "Sending…",
      verifySubmit: "Verify and sign in",
      verifyBusy: "Verifying…",
      errPhoneEmpty: "Enter your mobile number.",
      errPhoneInvalidIntl: "Invalid international number.",
      errPhoneInvalidUs: "Enter a valid US number (10 digits, or 11 starting with 1), or use +country code.",
      errOtpMissing: "Enter the SMS verification code.",
      statusSending: "Sending SMS…",
      statusSent: "Code sent. Enter it below.",
      errSendFailed: "Could not send SMS.",
      errPhoneProvider:
        "SMS is not set up yet. In the Supabase dashboard: Authentication → Providers → enable Phone, then configure an SMS channel (Twilio or Twilio Verify) with valid credentials.",
      statusVerifying: "Verifying…",
      errVerifyOtp: "Verification failed.",
      errNoSession: "Missing session after verification.",
      errVerifyGeneric: "Could not sign in.",
      errNotAdmin: "Signed in, but this account is not an admin.",
      docTitleRecovery: "RankMyRestaurant | Reset password",
      recoveryKicker: "Password reset",
      recoveryTitle: "Choose a new password",
      recoveryBody:
        "This link expires after a while. After updating, you can open the admin console. Add your /login URL to Supabase Auth redirect URLs if the email link does not work.",
      labelNewPassword: "New password",
      labelConfirmPassword: "Confirm new password",
      recoverySubmit: "Update password",
      recoveryBusy: "Saving…",
      errRecoveryMismatch: "The two passwords do not match.",
      errRecoveryWeak: "Use at least 8 characters.",
      errRecoveryFailed: "Could not update password.",
      emailSectionTitle: "Email and password",
      emailSectionHint: "Sign in with the username or email on your account.",
      labelIdentifier: "Username or email",
      phIdentifier: "you@company.com or username",
      labelPasswordEmail: "Password",
      phPasswordEmail: "At least 8 characters",
      emailSignInSubmit: "Sign in",
      emailSignInBusy: "Signing in…",
      forgotPasswordLink: "Forgot password?",
      forgotTitle: "Reset password",
      forgotHint:
        "We will email you a secure link to this site. In Supabase: Authentication → URL configuration → add your production /login URL to Redirect URLs.",
      labelResetEmail: "Email",
      forgotSubmit: "Send reset link",
      forgotBusy: "Sending…",
      forgotSent: "Check your inbox for the reset link.",
      forgotBack: "Back to sign in",
      registerLink: "Create an account",
      signInLink: "Already have an account? Sign in",
      registerTitle: "Register",
      registerHint: "Creates an admin profile. You will be signed in after registration.",
      labelRegUsername: "Username",
      phRegUsername: "letters-or-numbers-3-32",
      labelRegEmail: "Email",
      phRegEmail: "you@company.com",
      labelRegPassword: "Password",
      labelRegPasswordConfirm: "Confirm password",
      labelRegFullName: "Display name (optional)",
      registerSubmit: "Register and sign in",
      registerBusy: "Creating account…",
      errIdentifierRequired: "Enter your username or email.",
      errRegUsernameRequired: "Choose a username.",
      errPasswordRequired: "Enter your password.",
      errResetEmailRequired: "Enter your email address.",
      errResetEmailInvalid: "Enter a valid email address.",
      errSignInFailed: "Incorrect username, email, or password.",
      errRegisterPasswordMismatch: "Passwords do not match.",
      errRegisterWeak: "Password must be at least 8 characters.",
      statusForgotEmail: "Sending reset email…",
      accessKicker: "Admin console",
      accessTitle: "Sign in required",
      accessBody: "Sign in with your app account to access the admin console.",
      goSignIn: "Go to sign in",
      adminKicker: "Admin session",
      adminTitle: "You are already signed in",
      adminBody: "Continue to the admin console or sign out of this session.",
      openAdmin: "Open admin",
      signOut: "Sign out",
      signingOut: "Signing out…",
      roleLabel: "role",
      nonAdminKicker: "Role update needed",
      nonAdminTitle: "This account is not marked as admin",
      nonAdminBody: "This profile is not an admin in the database. Contact an administrator if you need access.",
      backHome: "Back to homepage",
    },
    zh: {
      docTitleLogin: "RankMyRestaurant | 登录",
      langSwitch: "English",
      heroKicker: "账户入口",
      heroTitle: "管理后台登录",
      heroBody:
        "支持短信验证码（默认美国）或邮箱密码登录；首次短信验证将创建管理员资料。请在 Supabase 配置 Phone 与短信通道，并启用邮箱账号。忘记密码可在右侧邮箱面板发起重置。",
      formHeadTitle: "短信验证",
      formHeadHint:
        "默认地区为美国：可输入 10 位号码，或以 1 开头的 11 位号码；其他国家或地区请在号码前加国际区号（+）。",
      labelPhone: "手机号码",
      phPhone: "4155552671 或 +8613800138000",
      labelOtp: "短信验证码",
      phOtp: "6 位验证码",
      labelFullName: "称呼（可选，仅首次注册）",
      formNote: "先点击发送验证码，收到短信后填写验证码再提交。",
      sendCode: "发送验证码",
      sendCodeBusy: "发送中…",
      verifySubmit: "验证并登录",
      verifyBusy: "验证中…",
      errPhoneEmpty: "请输入手机号码。",
      errPhoneInvalidIntl: "国际号码格式不正确。",
      errPhoneInvalidUs: "请输入有效的美国号码（10 位，或以 1 开头的 11 位），或使用带 + 的国际格式。",
      errOtpMissing: "请输入短信验证码。",
      statusSending: "正在发送短信…",
      statusSent: "验证码已发送，请在下方填写。",
      errSendFailed: "短信发送失败。",
      errPhoneProvider:
        "短信登录尚未配置：在 Supabase 控制台打开 Authentication → Providers，启用 Phone，并配置短信通道（Twilio 或 Twilio Verify）及有效凭据。",
      statusVerifying: "正在验证…",
      errVerifyOtp: "验证失败。",
      errNoSession: "验证后未获取到登录会话。",
      errVerifyGeneric: "无法完成登录。",
      errNotAdmin: "已登录，但该账号不是管理员。",
      docTitleRecovery: "RankMyRestaurant | 重置密码",
      recoveryKicker: "密码重置",
      recoveryTitle: "设置新密码",
      recoveryBody:
        "重置链接在一段时间内有效。保存后可进入管理后台。若邮件链接无效，请在 Supabase Authentication → URL 配置中将本站 /login 加入 Redirect URLs。",
      labelNewPassword: "新密码",
      labelConfirmPassword: "确认新密码",
      recoverySubmit: "更新密码",
      recoveryBusy: "保存中…",
      errRecoveryMismatch: "两次输入的密码不一致。",
      errRecoveryWeak: "请至少使用 8 位字符。",
      errRecoveryFailed: "无法更新密码。",
      emailSectionTitle: "邮箱与密码",
      emailSectionHint: "使用账号绑定的用户名或邮箱登录。",
      labelIdentifier: "用户名或邮箱",
      phIdentifier: "you@company.com 或用户名",
      labelPasswordEmail: "密码",
      phPasswordEmail: "至少 8 位",
      emailSignInSubmit: "登录",
      emailSignInBusy: "登录中…",
      forgotPasswordLink: "忘记密码？",
      forgotTitle: "找回密码",
      forgotHint:
        "我们将向您的邮箱发送安全链接。请在 Supabase：Authentication → URL 配置 → Redirect URLs 中加入生产环境的 /login 地址。",
      labelResetEmail: "邮箱",
      forgotSubmit: "发送重置链接",
      forgotBusy: "发送中…",
      forgotSent: "请查收邮件中的重置链接。",
      forgotBack: "返回登录",
      registerLink: "注册新账号",
      signInLink: "已有账号？去登录",
      registerTitle: "注册",
      registerHint: "将创建管理员资料，注册完成后自动登录。",
      labelRegUsername: "用户名",
      phRegUsername: "字母或数字，3–32 位",
      labelRegEmail: "邮箱",
      phRegEmail: "you@company.com",
      labelRegPassword: "密码",
      labelRegPasswordConfirm: "确认密码",
      labelRegFullName: "称呼（可选）",
      registerSubmit: "注册并登录",
      registerBusy: "创建账号中…",
      errIdentifierRequired: "请输入用户名或邮箱。",
      errRegUsernameRequired: "请设置用户名。",
      errPasswordRequired: "请输入密码。",
      errResetEmailRequired: "请输入邮箱地址。",
      errResetEmailInvalid: "请输入有效的邮箱地址。",
      errSignInFailed: "用户名、邮箱或密码不正确。",
      errRegisterPasswordMismatch: "两次密码不一致。",
      errRegisterWeak: "密码至少需要 8 位。",
      statusForgotEmail: "正在发送重置邮件…",
      accessKicker: "管理后台",
      accessTitle: "需要登录",
      accessBody: "请使用应用账号登录后访问管理后台。",
      goSignIn: "前往登录",
      adminKicker: "管理员会话",
      adminTitle: "您已登录",
      adminBody: "可进入管理后台，或退出当前会话。",
      openAdmin: "进入管理后台",
      signOut: "退出登录",
      signingOut: "正在退出…",
      roleLabel: "角色",
      nonAdminKicker: "权限提示",
      nonAdminTitle: "该账号不是管理员",
      nonAdminBody: "当前资料在数据库中不是管理员角色。如需权限请联系管理员。",
      backHome: "返回首页",
    },
  };

  const portalRoot = document.getElementById("portalContent");
  if (!portalRoot) return;

  function readSafeNextPath() {
    try {
      var params = new URLSearchParams(window.location.search || "");
      var raw = String(params.get("next") || "").trim();
      if (!raw) return "";
      var lower = raw.toLowerCase();
      if (lower.indexOf("http://") === 0 || lower.indexOf("https://") === 0) return "";
      if (raw.indexOf("//") === 0) return "";
      if (raw.charAt(0) !== "/") return "";
      return raw;
    } catch (e) {
      return "";
    }
  }

  function redirectAfterSuccessfulAuth() {
    var next = readSafeNextPath();
    if (next) {
      window.location.assign(next);
      return true;
    }
    if (isAdmin()) {
      window.location.assign("/admin");
      return true;
    }
    return false;
  }

  const route = getPortalRoute(window.location.pathname);
  if (!route) return;

  const state = {
    route: route,
    runtimeConfig: null,
    client: null,
    authSubscription: null,
    session: null,
    user: null,
    stores: [],
    storeDetails: null,
    smsCampaigns: [],
    initializing: true,
    routeLoading: false,
    fatalError: "",
    createStoreOpen: false,
    portalLocale: readPortalLocale(),
    emailRegisterMode: false,
    emailForgotOpen: false,
    passwordRecovery: false,
    storeFilter: "",
    messages: {
      page: null,
      identity: null,
      keywords: null,
      staff: null,
      services: null,
    },
  };

  function getPortalRoute(pathname) {
    const normalizedPath = String(pathname || "/").replace(/\/+$/, "") || "/";
    if (normalizedPath === "/login") {
      return { kind: ROUTE_LOGIN, slug: "" };
    }
    if (normalizedPath === "/admin") {
      return { kind: ROUTE_ADMIN, slug: "" };
    }
    if (normalizedPath === "/admin/stores") {
      return { kind: ROUTE_ADMIN_STORES, slug: "" };
    }
    if (normalizedPath === "/admin/sms") {
      return { kind: ROUTE_ADMIN_SMS, slug: "" };
    }

    const storeMatch = normalizedPath.match(/^\/admin\/stores\/([^/]+)$/);
    if (storeMatch) {
      return {
        kind: ROUTE_ADMIN_STORE,
        slug: decodeURIComponent(storeMatch[1]),
      };
    }

    return null;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function portalLoginT(key) {
    const pack = PORTAL_LOGIN_I18N[state.portalLocale] || PORTAL_LOGIN_I18N.en;
    const v = pack[key];
    if (v != null && v !== "") return v;
    return PORTAL_LOGIN_I18N.en[key] || String(key);
  }

  function friendlyPhoneSmsError(error) {
    const raw = error && error.message ? String(error.message) : String(error || "");
    const lower = raw.toLowerCase();
    if (lower.indexOf("unsupported phone provider") !== -1) {
      return portalLoginT("errPhoneProvider");
    }
    return raw || portalLoginT("errSendFailed");
  }

  function friendlyEmailAuthError(error) {
    const raw = error && error.message ? String(error.message) : String(error || "");
    const lower = raw.toLowerCase();
    if (
      lower.indexOf("invalid login credentials") !== -1 ||
      lower.indexOf("invalid email or password") !== -1
    ) {
      return portalLoginT("errSignInFailed");
    }
    return raw || portalLoginT("errSignInFailed");
  }

  function isValidEmailShape(value) {
    const s = String(value || "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function setDocumentTitle() {
    if (state.route.kind === ROUTE_LOGIN) {
      if (state.passwordRecovery) {
        document.title = portalLoginT("docTitleRecovery");
        return;
      }
      document.title = portalLoginT("docTitleLogin");
      return;
    }
    if (state.route.kind === ROUTE_ADMIN) {
      document.title = "RankMyRestaurant | Admin";
      return;
    }
    if (state.route.kind === ROUTE_ADMIN_STORES) {
      document.title = "RankMyRestaurant | Admin Stores";
      return;
    }
    if (state.route.kind === ROUTE_ADMIN_STORE) {
      const store = state.storeDetails && state.storeDetails.store;
      const label = store ? store.nameEn || store.nameZh || store.slug : "Store Editor";
      document.title = "RankMyRestaurant | " + label;
    }
    if (state.route.kind === ROUTE_ADMIN_SMS) {
      document.title = "RankMyRestaurant | SMS campaigns";
    }
  }

  function isAuthenticated() {
    return !!state.user;
  }

  function isAdmin() {
    return !!state.user && state.user.globalRole === "admin";
  }

  function getAccessToken() {
    return state.session && state.session.access_token ? state.session.access_token : "";
  }

  function getMessageHtml(message) {
    if (!message || !message.text) return "";
    return (
      '<div class="portal-status is-' +
      escapeHtml(message.type || "info") +
      '">' +
      escapeHtml(message.text) +
      "</div>"
    );
  }

  function setInlineStatus(key, message, type) {
    const node = portalRoot.querySelector('[data-status="' + key + '"]');
    if (!node) return;
    node.className = "portal-status is-" + (type || "info");
    node.textContent = message || "";
  }

  function clearInlineStatus(key) {
    setInlineStatus(key, "", "info");
  }

  function setBusy(submitter, busy, idleLabel, busyLabel) {
    if (!submitter) return;
    if (busy) {
      submitter.dataset.idleLabel = idleLabel || submitter.textContent || "";
      submitter.disabled = true;
      submitter.textContent = busyLabel || "Working...";
      return;
    }

    submitter.disabled = false;
    submitter.textContent = submitter.dataset.idleLabel || idleLabel || submitter.textContent;
  }

  async function fetchJson(url, options, settings) {
    const requestOptions = Object.assign(
      {
        headers: {},
      },
      options || {},
    );
    const requestSettings = Object.assign(
      {
        includeAuth: false,
      },
      settings || {},
    );

    const headers = Object.assign({}, requestOptions.headers || {});
    if (requestSettings.includeAuth) {
      const accessToken = getAccessToken();
      if (accessToken) {
        headers.Authorization = "Bearer " + accessToken;
      }
    }

    requestOptions.headers = headers;
    const response = await fetch(url, requestOptions);
    const data = await response.json().catch(function () {
      return null;
    });

    if (!response.ok) {
      const error = new Error(
        data && data.error && data.error.message
          ? data.error.message
          : "HTTP " + response.status,
      );
      error.status = response.status;
      error.code = data && data.error ? data.error.code : "";
      throw error;
    }

    return data;
  }

  async function loadRuntimeConfig() {
    state.runtimeConfig = await fetchJson("/api/runtime-config", {
      cache: "no-store",
    });
  }

  async function ensureSupabaseClient() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase browser client failed to load.");
    }
    if (!state.runtimeConfig || !state.runtimeConfig.supabaseUrl || !state.runtimeConfig.supabaseAnonKey) {
      throw new Error("Supabase browser auth is not configured.");
    }

    state.client = window.supabase.createClient(
      state.runtimeConfig.supabaseUrl,
      state.runtimeConfig.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      },
    );

    if (!state.authSubscription && state.client.auth && state.client.auth.onAuthStateChange) {
      state.authSubscription = state.client.auth.onAuthStateChange(function (event, session) {
        state.session = session || null;
        if (event === "PASSWORD_RECOVERY") {
          state.passwordRecovery = true;
          state.emailForgotOpen = false;
          state.emailRegisterMode = false;
          render();
          return;
        }
        if (!session && event === "SIGNED_OUT") {
          state.user = null;
          state.passwordRecovery = false;
          state.emailForgotOpen = false;
          state.emailRegisterMode = false;
          render();
        }
      });
    }
  }

  async function signOutLocal() {
    if (state.client) {
      await state.client.auth.signOut().catch(function () {
        return null;
      });
    }
    state.session = null;
    state.user = null;
    state.passwordRecovery = false;
    state.emailForgotOpen = false;
    state.emailRegisterMode = false;
  }

  async function refreshCurrentUser() {
    if (!state.client) return;

    const sessionResult = await state.client.auth.getSession();
    state.session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
    if (!state.session) {
      state.user = null;
      return;
    }

    try {
      const payload = await fetchJson(
        "/api/auth/session",
        {
          cache: "no-store",
        },
        { includeAuth: true },
      );
      state.user = payload && payload.user ? payload.user : null;
    } catch (error) {
      if (error && error.status === 401) {
        await signOutLocal();
        return;
      }
      throw error;
    }
  }

  async function ensureAdminRouteData() {
    if (!isAdmin()) return;

    state.routeLoading = true;
    render();

    try {
      if (state.route.kind === ROUTE_ADMIN || state.route.kind === ROUTE_ADMIN_STORES) {
        const payload = await fetchJson(
          "/api/admin/stores",
          {
            cache: "no-store",
          },
          { includeAuth: true },
        );
        state.stores = Array.isArray(payload && payload.stores) ? payload.stores : [];
      }

      if (state.route.kind === ROUTE_ADMIN_STORE) {
        const payload = await fetchJson(
          "/api/admin/stores/" + encodeURIComponent(state.route.slug),
          {
            cache: "no-store",
          },
          { includeAuth: true },
        );
        state.storeDetails = payload || null;
      }

      if (state.route.kind === ROUTE_ADMIN_SMS) {
        const payload = await fetchJson(
          "/api/admin/sms-campaigns",
          {
            cache: "no-store",
          },
          { includeAuth: true },
        );
        state.smsCampaigns = Array.isArray(payload && payload.campaigns) ? payload.campaigns : [];
      }
    } finally {
      state.routeLoading = false;
    }
  }

  function renderLoadingShell(title, body) {
    return (
      '<section class="portal-page">' +
      '<article class="portal-card portal-card-hero">' +
      '<p class="portal-kicker">RankMyRestaurant Portal</p>' +
      '<h1 class="portal-title">' +
      escapeHtml(title) +
      "</h1>" +
      '<p class="portal-body">' +
      escapeHtml(body) +
      "</p>" +
      '<div class="portal-loading">Loading...</div>' +
      "</article>" +
      "</section>"
    );
  }

  function renderFatalError() {
    return (
      '<section class="portal-page">' +
      '<article class="portal-card portal-card-hero">' +
      '<p class="portal-kicker">Setup Required</p>' +
      '<h1 class="portal-title">Portal is not ready yet</h1>' +
      '<p class="portal-body">' +
      escapeHtml(state.fatalError || "Unexpected startup error.") +
      "</p>" +
      '<div class="portal-actions">' +
      '<a class="ghost landing-link" href="/">Back to homepage</a>' +
      "</div>" +
      "</article>" +
      "</section>"
    );
  }

  function renderAccessGate() {
    return (
      '<section class="portal-page">' +
      '<article class="portal-card portal-card-hero">' +
      '<p class="portal-kicker">' +
      escapeHtml(portalLoginT("accessKicker")) +
      "</p>" +
      '<h1 class="portal-title">' +
      escapeHtml(portalLoginT("accessTitle")) +
      "</h1>" +
      '<p class="portal-body">' +
      escapeHtml(portalLoginT("accessBody")) +
      "</p>" +
      '<div class="portal-actions">' +
      '<a class="cta landing-link" href="/login">' +
      escapeHtml(portalLoginT("goSignIn")) +
      "</a>" +
      '<a class="ghost landing-link" href="/">' +
      escapeHtml(portalLoginT("backHome")) +
      "</a>" +
      "</div>" +
      "</article>" +
      "</section>"
    );
  }

  function renderNonAdminPlaceholder() {
    return (
      '<section class="portal-page">' +
      '<article class="portal-card portal-card-hero">' +
      '<div class="portal-lang-bar">' +
      '<button type="button" class="ghost compact" data-action="toggle-portal-locale">' +
      escapeHtml(portalLoginT("langSwitch")) +
      "</button>" +
      "</div>" +
      '<p class="portal-kicker">' +
      escapeHtml(portalLoginT("nonAdminKicker")) +
      "</p>" +
      '<h1 class="portal-title">' +
      escapeHtml(portalLoginT("nonAdminTitle")) +
      "</h1>" +
      '<p class="portal-body">' +
      escapeHtml(portalLoginT("nonAdminBody")) +
      "</p>" +
      '<div class="portal-actions">' +
      '<button class="ghost" type="button" data-action="sign-out">' +
      escapeHtml(portalLoginT("signOut")) +
      "</button>" +
      '<a class="ghost landing-link" href="/">' +
      escapeHtml(portalLoginT("backHome")) +
      "</a>" +
      "</div>" +
      "</article>" +
      "</section>"
    );
  }

  function portalIdentityLabel(user) {
    if (!user) return "";
    const phone = String(user.phone || "").trim();
    if (phone) return phone;
    return String(user.email || "").trim();
  }

  function renderLoginEmailPanel() {
    if (state.emailForgotOpen) {
      return (
        '<form class="portal-card portal-form-card" data-form="email-forgot">' +
        '<div class="portal-section-head">' +
        "<div><h2>" +
        escapeHtml(portalLoginT("forgotTitle")) +
        "</h2><p>" +
        escapeHtml(portalLoginT("forgotHint")) +
        "</p></div>" +
        "</div>" +
        '<div class="portal-form-grid portal-form-grid-stack">' +
        '<label class="portal-label">' +
        escapeHtml(portalLoginT("labelResetEmail")) +
        '<input class="portal-input" type="email" name="resetEmail" autocomplete="email" required placeholder="' +
        escapeHtml(portalLoginT("phRegEmail")) +
        '" /></label>' +
        "</div>" +
        '<div class="portal-status" data-status="auth-email"></div>' +
        '<div class="portal-actions">' +
        '<button type="button" class="ghost" data-action="email-forgot-back">' +
        escapeHtml(portalLoginT("forgotBack")) +
        "</button>" +
        '<button class="cta" type="submit">' +
        escapeHtml(portalLoginT("forgotSubmit")) +
        "</button>" +
        "</div>" +
        "</form>"
      );
    }

    if (state.emailRegisterMode) {
      return (
        '<form class="portal-card portal-form-card" data-form="email-register">' +
        '<div class="portal-section-head">' +
        "<div><h2>" +
        escapeHtml(portalLoginT("registerTitle")) +
        "</h2><p>" +
        escapeHtml(portalLoginT("registerHint")) +
        "</p></div>" +
        "</div>" +
        '<div class="portal-form-grid portal-form-grid-stack">' +
        '<label class="portal-label">' +
        escapeHtml(portalLoginT("labelRegUsername")) +
        '<input class="portal-input" type="text" name="username" autocomplete="username" minlength="3" maxlength="32" required placeholder="' +
        escapeHtml(portalLoginT("phRegUsername")) +
        '" /></label>' +
        '<label class="portal-label">' +
        escapeHtml(portalLoginT("labelRegEmail")) +
        '<input class="portal-input" type="email" name="email" autocomplete="email" required placeholder="' +
        escapeHtml(portalLoginT("phRegEmail")) +
        '" /></label>' +
        '<label class="portal-label">' +
        escapeHtml(portalLoginT("labelRegPassword")) +
        '<input class="portal-input" type="password" name="password" autocomplete="new-password" minlength="8" required /></label>' +
        '<label class="portal-label">' +
        escapeHtml(portalLoginT("labelRegPasswordConfirm")) +
        '<input class="portal-input" type="password" name="passwordConfirm" autocomplete="new-password" minlength="8" required /></label>' +
        '<label class="portal-label">' +
        escapeHtml(portalLoginT("labelRegFullName")) +
        '<input class="portal-input" type="text" name="fullName" autocomplete="name" /></label>' +
        "</div>" +
        '<div class="portal-status" data-status="auth-email"></div>' +
        '<div class="portal-actions">' +
        '<button type="button" class="ghost" data-action="toggle-email-register">' +
        escapeHtml(portalLoginT("signInLink")) +
        "</button>" +
        '<button class="cta" type="submit">' +
        escapeHtml(portalLoginT("registerSubmit")) +
        "</button>" +
        "</div>" +
        "</form>"
      );
    }

    return (
      '<form class="portal-card portal-form-card" data-form="email-signin">' +
      '<div class="portal-section-head">' +
      "<div><h2>" +
      escapeHtml(portalLoginT("emailSectionTitle")) +
      "</h2><p>" +
      escapeHtml(portalLoginT("emailSectionHint")) +
      "</p></div>" +
      "</div>" +
      '<div class="portal-form-grid portal-form-grid-stack">' +
      '<label class="portal-label">' +
      escapeHtml(portalLoginT("labelIdentifier")) +
      '<input class="portal-input" type="text" name="identifier" autocomplete="username" required placeholder="' +
      escapeHtml(portalLoginT("phIdentifier")) +
      '" /></label>' +
      '<label class="portal-label">' +
      escapeHtml(portalLoginT("labelPasswordEmail")) +
      '<input class="portal-input" type="password" name="password" autocomplete="current-password" required placeholder="' +
      escapeHtml(portalLoginT("phPasswordEmail")) +
      '" /></label>' +
      "</div>" +
      '<div class="portal-forgot-bar">' +
      '<button type="button" class="portal-text-link" data-action="toggle-email-forgot">' +
      escapeHtml(portalLoginT("forgotPasswordLink")) +
      "</button>" +
      "</div>" +
      '<div class="portal-status" data-status="auth-email"></div>' +
      '<div class="portal-actions">' +
      '<button class="cta" type="submit">' +
      escapeHtml(portalLoginT("emailSignInSubmit")) +
      "</button>" +
      "</div>" +
      '<div class="portal-note" style="margin-top:10px">' +
      '<button type="button" class="portal-text-link" data-action="toggle-email-register">' +
      escapeHtml(portalLoginT("registerLink")) +
      "</button>" +
      "</div>" +
      "</form>"
    );
  }

  function renderLoginPage() {
    if (state.passwordRecovery) {
      return (
        '<section class="portal-page">' +
        '<article class="portal-card portal-card-hero">' +
        '<div class="portal-lang-bar">' +
        '<button type="button" class="ghost compact" data-action="toggle-portal-locale">' +
        escapeHtml(portalLoginT("langSwitch")) +
        "</button>" +
        "</div>" +
        '<p class="portal-kicker">' +
        escapeHtml(portalLoginT("recoveryKicker")) +
        "</p>" +
        '<h1 class="portal-title">' +
        escapeHtml(portalLoginT("recoveryTitle")) +
        "</h1>" +
        '<p class="portal-body">' +
        escapeHtml(portalLoginT("recoveryBody")) +
        "</p>" +
        "</article>" +
        '<div class="portal-grid portal-grid-auth">' +
        '<form class="portal-card portal-form-card portal-span-full" data-form="password-recovery">' +
        '<div class="portal-form-grid portal-form-grid-stack">' +
        '<label class="portal-label">' +
        escapeHtml(portalLoginT("labelNewPassword")) +
        '<input class="portal-input" type="password" name="newPassword" autocomplete="new-password" minlength="8" required /></label>' +
        '<label class="portal-label">' +
        escapeHtml(portalLoginT("labelConfirmPassword")) +
        '<input class="portal-input" type="password" name="newPasswordConfirm" autocomplete="new-password" minlength="8" required /></label>' +
        "</div>" +
        '<div class="portal-status" data-status="auth-recovery"></div>' +
        '<div class="portal-actions">' +
        '<button type="button" class="ghost" data-action="sign-out">' +
        escapeHtml(portalLoginT("signOut")) +
        "</button>" +
        '<button class="cta" type="submit">' +
        escapeHtml(portalLoginT("recoverySubmit")) +
        "</button>" +
        "</div>" +
        "</form>" +
        "</div>" +
        "</section>"
      );
    }

    if (isAuthenticated() && isAdmin()) {
      return (
        '<section class="portal-page">' +
        '<article class="portal-card portal-card-hero">' +
        '<div class="portal-lang-bar">' +
        '<button type="button" class="ghost compact" data-action="toggle-portal-locale">' +
        escapeHtml(portalLoginT("langSwitch")) +
        "</button>" +
        "</div>" +
        '<p class="portal-kicker">' +
        escapeHtml(portalLoginT("adminKicker")) +
        "</p>" +
        '<h1 class="portal-title">' +
        escapeHtml(portalLoginT("adminTitle")) +
        "</h1>" +
        '<p class="portal-body">' +
        escapeHtml(portalLoginT("adminBody")) +
        "</p>" +
        '<div class="portal-meta-list">' +
        '<span class="portal-meta-pill">' +
        escapeHtml(portalIdentityLabel(state.user)) +
        "</span>" +
        '<span class="portal-meta-pill">' +
        escapeHtml(portalLoginT("roleLabel")) +
        ": " +
        escapeHtml(state.user.globalRole) +
        "</span>" +
        "</div>" +
        '<div class="portal-actions">' +
        '<a class="cta landing-link" href="/admin">' +
        escapeHtml(portalLoginT("openAdmin")) +
        "</a>" +
        '<button class="ghost" type="button" data-action="sign-out">' +
        escapeHtml(portalLoginT("signOut")) +
        "</button>" +
        "</div>" +
        "</article>" +
        "</section>"
      );
    }

    if (isAuthenticated()) {
      return renderNonAdminPlaceholder();
    }

    return (
      '<section class="portal-page">' +
      '<article class="portal-card portal-card-hero">' +
      '<div class="portal-lang-bar">' +
      '<button type="button" class="ghost compact" data-action="toggle-portal-locale">' +
      escapeHtml(portalLoginT("langSwitch")) +
      "</button>" +
      "</div>" +
      '<p class="portal-kicker">' +
      escapeHtml(portalLoginT("heroKicker")) +
      "</p>" +
      '<h1 class="portal-title">' +
      escapeHtml(portalLoginT("heroTitle")) +
      "</h1>" +
      '<p class="portal-body">' +
      escapeHtml(portalLoginT("heroBody")) +
      "</p>" +
      "</article>" +
      '<div class="portal-grid portal-grid-auth">' +
      '<form class="portal-card portal-form-card" data-form="phone-auth">' +
      '<div class="portal-section-head">' +
      "<div><h2>" +
      escapeHtml(portalLoginT("formHeadTitle")) +
      "</h2><p>" +
      escapeHtml(portalLoginT("formHeadHint")) +
      "</p></div>" +
      "</div>" +
      '<div class="portal-form-grid">' +
      '<label class="portal-label">' +
      escapeHtml(portalLoginT("labelPhone")) +
      '<input class="portal-input" type="tel" name="phone" autocomplete="tel" inputmode="tel" placeholder="' +
      escapeHtml(portalLoginT("phPhone")) +
      '" required /></label>' +
      '<label class="portal-label">' +
      escapeHtml(portalLoginT("labelOtp")) +
      '<input class="portal-input" type="text" name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="' +
      escapeHtml(portalLoginT("phOtp")) +
      '" required /></label>' +
      '<label class="portal-label">' +
      escapeHtml(portalLoginT("labelFullName")) +
      '<input class="portal-input" type="text" name="fullName" autocomplete="name" /></label>' +
      "</div>" +
      '<div class="portal-note">' +
      escapeHtml(portalLoginT("formNote")) +
      "</div>" +
      '<div class="portal-status" data-status="auth-phone"></div>' +
      '<div class="portal-actions">' +
      '<button type="button" class="ghost" data-action="send-phone-otp">' +
      escapeHtml(portalLoginT("sendCode")) +
      "</button>" +
      '<button class="cta" type="submit">' +
      escapeHtml(portalLoginT("verifySubmit")) +
      "</button>" +
      "</div>" +
      "</form>" +
      renderLoginEmailPanel() +
      "</div>" +
      "</section>"
    );
  }

  function renderAdminDashboard() {
    if (!isAuthenticated()) return renderAccessGate();
    if (!isAdmin()) return renderNonAdminPlaceholder();
    if (state.routeLoading) {
      return renderLoadingShell("Loading admin dashboard", "Fetching your store workspace.");
    }

    const storeCount = Array.isArray(state.stores) ? state.stores.length : 0;
    return (
      '<section class="portal-page">' +
      '<article class="portal-card portal-card-hero">' +
      '<p class="portal-kicker">Admin Console</p>' +
      '<h1 class="portal-title">Internal operations workspace</h1>' +
      '<p class="portal-body">Use the admin console to edit store identity, review keywords, and staff configuration.</p>' +
      getMessageHtml(state.messages.page) +
      '<div class="portal-summary-grid">' +
      '<article class="portal-summary-card"><span class="portal-summary-label">Stores</span><strong>' +
      escapeHtml(String(storeCount)) +
      "</strong></article>" +
      '<article class="portal-summary-card"><span class="portal-summary-label">Signed in as</span><strong>' +
      escapeHtml(portalIdentityLabel(state.user)) +
      "</strong></article>" +
      "</div>" +
      '<div class="portal-actions">' +
      '<a class="cta landing-link" href="/admin/stores">Open stores</a>' +
      '<a class="ghost landing-link" href="/admin/sms">SMS campaigns</a>' +
      '<button class="ghost" type="button" data-action="sign-out">Sign out</button>' +
      "</div>" +
      "</article>" +
      "</section>"
    );
  }

  function renderCreateStoreCard() {
    return (
      '<form class="portal-card portal-form-card" data-form="create-store">' +
      '<div class="portal-section-head">' +
      '<div><h2>Add store</h2><p>Create the store record here, then finish keywords and staff inside the existing editor.</p></div>' +
      '<button class="ghost compact" type="button" data-action="cancel-create-store">Cancel</button>' +
      "</div>" +
      '<div class="portal-note">Slug becomes the URL path for this store and stays fixed in v1. New stores should usually stay inactive until a published service catalog exists.</div>' +
      '<div class="portal-form-grid">' +
      '<label class="portal-label">Store slug<input class="portal-input" type="text" name="slug" placeholder="xiebao-edison" autocomplete="off" required /></label>' +
      '<label class="portal-label">Chinese/store name<input class="portal-input" type="text" name="nameZh" placeholder="蟹宝 Edison" required /></label>' +
      '<label class="portal-label">English name<input class="portal-input" type="text" name="nameEn" placeholder="Xiebao Edison" required /></label>' +
      '<label class="portal-label">Google review URL<input class="portal-input" type="url" name="googleReviewUrl" placeholder="https://maps.app.goo.gl/..." /></label>' +
      '<label class="portal-label">Fallback review URL<input class="portal-input" type="url" name="googleReviewFallbackUrl" placeholder="https://maps.app.goo.gl/..." /></label>' +
      '<label class="portal-label">Google Place ID<input class="portal-input" type="text" name="googlePlaceId" placeholder="ChIJ… (optional)" autocomplete="off" /></label>' +
      "</div>" +
      '<div class="portal-inline-actions">' +
      '<label class="portal-checkbox"><input type="checkbox" name="isActive" checked />Active immediately</label>' +
      "</div>" +
      '<div class="portal-status" data-status="create-store"></div>' +
      '<div class="portal-actions">' +
      '<button class="cta" type="submit">Create store</button>' +
      '<button class="ghost" type="button" data-action="cancel-create-store">Cancel</button>' +
      "</div>" +
      "</form>"
    );
  }

  function renderSmsCampaignDashboard() {
    if (!isAuthenticated()) return renderAccessGate();
    if (!isAdmin()) return renderNonAdminPlaceholder();
    if (state.routeLoading) {
      return renderLoadingShell("SMS campaigns", "Loading delivery and reply metrics.");
    }

    const blastForm =
      '<form class="portal-card portal-form-card" data-form="sms-blast">' +
      '<div class="portal-section-head">' +
      "<div><h2 class=\"portal-title portal-title-small\">Send to phone numbers</h2>" +
      '<p class="portal-body">Internal tool: paste numbers (one per line, or comma-separated). US numbers can be 10 digits. Creates an <strong>active</strong> campaign, queues one SMS per recipient, then optionally sends immediately via Twilio.</p></div>' +
      "</div>" +
      '<label class="portal-label">Phone numbers<textarea class="portal-input" name="phones" rows="6" placeholder="+15551234567&#10;2015550199, 3105559876" required></textarea></label>' +
      '<label class="portal-label">Message<textarea class="portal-input" name="message" rows="5" placeholder="Hi {{salon_name}}, …" required>' +
      escapeHtml(SMS_BLAST_DEFAULT_MESSAGE) +
      "</textarea></label>" +
      '<p class="portal-note"><code>sms_leads.name</code> = salon name → <code>{{salon_name}}</code> or <code>{{name}}</code>. Link: <code>{{report_url}}</code> or <code>metadata.report_slug</code>; optional <code>{{slug}}</code>. Phone-only leads need name/metadata set in Supabase first. Replies <code>YES</code>/<code>Y</code> logged. Max 1200 chars, 200 numbers. Ensure consent / compliance.</p>' +
      '<div class="portal-inline-actions">' +
      '<label class="portal-checkbox"><input type="checkbox" name="sendNow" checked />Send immediately (Twilio)</label>' +
      "</div>" +
      '<div class="portal-status" data-status="sms-blast"></div>' +
      '<div class="portal-actions">' +
      '<button class="cta" type="submit">Queue &amp; send</button>' +
      "</div>" +
      "</form>";

    const rows = Array.isArray(state.smsCampaigns) ? state.smsCampaigns : [];
    const cards = rows
      .map(function (row) {
        const c = row.campaign || {};
        const s = row.stats || {};
        return (
          '<article class="portal-card portal-sms-campaign-card">' +
          '<div class="portal-section-head">' +
          "<div><h2 class=\"portal-title portal-title-small\">" +
          escapeHtml(c.name || "Campaign") +
          '</h2><p class="portal-body">Status <strong>' +
          escapeHtml(c.status || "") +
          "</strong> · Daily send limit " +
          escapeHtml(String(c.daily_send_limit != null ? c.daily_send_limit : "")) +
          "</p></div>" +
          "</div>" +
          '<div class="portal-summary-grid">' +
          '<article class="portal-summary-card"><span class="portal-summary-label">Sent</span><strong>' +
          escapeHtml(String(s.sent != null ? s.sent : 0)) +
          "</strong></article>" +
          '<article class="portal-summary-card"><span class="portal-summary-label">Delivered</span><strong>' +
          escapeHtml(String(s.delivered != null ? s.delivered : 0)) +
          "</strong></article>" +
          '<article class="portal-summary-card"><span class="portal-summary-label">Failed</span><strong>' +
          escapeHtml(String(s.failed != null ? s.failed : 0)) +
          "</strong></article>" +
          '<article class="portal-summary-card"><span class="portal-summary-label">Replied</span><strong>' +
          escapeHtml(String(s.replied != null ? s.replied : 0)) +
          "</strong></article>" +
          '<article class="portal-summary-card"><span class="portal-summary-label">Unsubscribed</span><strong>' +
          escapeHtml(String(s.unsubscribedLeads != null ? s.unsubscribedLeads : 0)) +
          "</strong></article>" +
          '<article class="portal-summary-card"><span class="portal-summary-label">Queued</span><strong>' +
          escapeHtml(String(s.queued != null ? s.queued : 0)) +
          "</strong></article>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    return (
      '<section class="portal-page">' +
      blastForm +
      '<article class="portal-card">' +
      '<div class="portal-section-head">' +
      '<div><p class="portal-kicker">Admin Console</p><h1 class="portal-title portal-title-small">SMS campaigns</h1><p class="portal-body">RankMyRestaurant bulk SMS via Twilio Messaging Service. Metrics aggregate <code>sms_messages</code> and opt-outs on <code>sms_leads</code>.</p></div>' +
      '<div class="portal-actions portal-actions-tight">' +
      '<a class="ghost landing-link" href="/admin">Back to dashboard</a>' +
      '<button class="ghost" type="button" data-action="sign-out">Sign out</button>' +
      "</div>" +
      "</div>" +
      (cards ||
        '<div class="portal-empty">No campaign history yet. Use the form above or run <code>sql/026_sms_campaign_pipeline.sql</code> then API flows.</div>') +
      "</article>" +
      "</section>"
    );
  }

  function renderStoresList() {
    if (!isAuthenticated()) return renderAccessGate();
    if (!isAdmin()) return renderNonAdminPlaceholder();
    if (state.routeLoading) {
      return renderLoadingShell("Loading stores", "Fetching the editable store list.");
    }

    const stores = Array.isArray(state.stores) ? state.stores : [];
    return (
      '<section class="portal-page">' +
      '<article class="portal-card">' +
      '<div class="portal-section-head">' +
      '<div><p class="portal-kicker">Admin Console</p><h1 class="portal-title portal-title-small">Stores</h1></div>' +
      '<div class="portal-actions portal-actions-tight">' +
      '<button class="cta" type="button" data-action="toggle-create-store">' +
      (state.createStoreOpen ? "Close add store" : "Add store") +
      "</button>" +
      '<a class="ghost landing-link" href="/admin">Back to dashboard</a>' +
      '<button class="ghost" type="button" data-action="sign-out">Sign out</button>' +
      "</div>" +
      "</div>" +
      '<p class="portal-body">Search stores, then open the editor for identity, keywords, and staff. Use the add-store button to create a new location.</p>' +
      '<label class="portal-label portal-label-inline">Search stores<input class="portal-input" type="search" id="portalStoreFilter" placeholder="Search by slug or name" value="' +
      escapeHtml(state.storeFilter) +
      '" /></label>' +
      '<div class="portal-store-list">' +
      (stores.length
        ? stores
            .map(function (store) {
              return (
                '<article class="portal-store-card" data-store-card data-search-text="' +
                escapeHtml([store.slug, store.nameEn, store.nameZh].join(" ").toLowerCase()) +
                '">' +
                '<div class="portal-store-copy">' +
                '<h2>' +
                escapeHtml(store.nameEn || store.nameZh || store.slug) +
                "</h2>" +
                '<p>' +
                escapeHtml(store.nameZh || "") +
                "</p>" +
                '<div class="portal-meta-list">' +
                '<span class="portal-meta-pill">/' +
                escapeHtml(store.slug) +
                "</span>" +
                '<span class="portal-meta-pill">' +
                (store.isActive ? "active" : "inactive") +
                "</span>" +
                "</div>" +
                "</div>" +
                '<div class="portal-store-actions">' +
                '<a class="cta landing-link" href="/admin/stores/' +
                encodeURIComponent(store.slug) +
                '">Open editor</a>' +
                "</div>" +
                "</article>"
              );
            })
            .join("")
        : '<div class="portal-empty">No stores are available yet.</div>') +
      "</div>" +
      "</article>" +
      (state.createStoreOpen ? renderCreateStoreCard() : "") +
      "</section>"
    );
  }

  function buildKeywordRowHtml(keyword) {
    const item = keyword || {};
    return (
      '<article class="portal-repeat-row" data-keyword-row>' +
      '<div class="portal-repeat-grid">' +
      '<label class="portal-label">Key<input class="portal-input" type="text" name="key" value="' +
      escapeHtml(item.key || "") +
      '" placeholder="clean" /></label>' +
      '<label class="portal-label">Chinese text<input class="portal-input" type="text" name="textZh" value="' +
      escapeHtml(item.textZh || "") +
      '" placeholder="干净" /></label>' +
      '<label class="portal-label">English text<input class="portal-input" type="text" name="textEn" value="' +
      escapeHtml(item.textEn || "") +
      '" placeholder="clean" /></label>' +
      '<label class="portal-label">Weight<input class="portal-input" type="number" min="0" step="1" name="weight" value="' +
      escapeHtml(item.weight == null ? "1" : String(item.weight)) +
      '" /></label>' +
      "</div>" +
      '<div class="portal-inline-actions">' +
      '<label class="portal-checkbox"><input type="checkbox" name="enabled" ' +
      (item.enabled !== false ? "checked" : "") +
      ' />Enabled</label>' +
      '<button class="ghost compact" type="button" data-action="remove-keyword-row">Remove</button>' +
      "</div>" +
      "</article>"
    );
  }

  function buildServiceRowHtml(item) {
    const row = item || {};
    const priceVal = row.price != null && row.price !== "" ? String(row.price) : "";
    const dishUqidVal = row.dishUqid != null && Number(row.dishUqid) > 0 ? String(row.dishUqid) : "";
    return (
      '<article class="portal-repeat-row" data-service-row data-service-id="' +
      escapeHtml(row.id || "") +
      '">' +
      '<input type="hidden" name="dishUqid" value="' +
      escapeHtml(dishUqidVal) +
      '" />' +
      '<div class="portal-repeat-grid">' +
      '<label class="portal-label">Item name<input class="portal-input" type="text" name="name" value="' +
      escapeHtml(row.name || "") +
      '" placeholder="Gel manicure" /></label>' +
      '<label class="portal-label">Item type<input class="portal-input" type="text" name="itemType" value="' +
      escapeHtml(row.itemType || "") +
      '" placeholder="Manicure" /></label>' +
      '<label class="portal-label">Price<input class="portal-input" type="number" step="0.01" min="0" name="price" value="' +
      escapeHtml(priceVal) +
      '" /></label>' +
      '<label class="portal-label">Description<textarea class="portal-input" name="description" rows="2" style="resize:vertical;min-height:44px">' +
      escapeHtml(row.description || "") +
      "</textarea></label>" +
      "</div>" +
      '<div class="portal-inline-actions">' +
      '<label class="portal-checkbox"><input type="checkbox" name="isActive" ' +
      (row.isActive !== false ? "checked" : "") +
      ' />Active</label>' +
      '<button class="ghost compact" type="button" data-action="remove-service-row">Remove</button>' +
      "</div>" +
      "</article>"
    );
  }

  function buildStaffRowHtml(staff, sortOrder) {
    const item = staff || {};
    const resolvedSortOrder = Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : Number(sortOrder) || 0;
    return (
      '<article class="portal-repeat-row" data-staff-row data-staff-id="' +
      escapeHtml(item.id || "") +
      '">' +
      '<div class="portal-repeat-grid">' +
      '<label class="portal-label">Internal name<input class="portal-input" type="text" name="name" value="' +
      escapeHtml(item.name || "") +
      '" placeholder="jenny" /></label>' +
      '<label class="portal-label">Display name<input class="portal-input" type="text" name="displayName" value="' +
      escapeHtml(item.displayName || "") +
      '" placeholder="Jenny" /></label>' +
      '<label class="portal-label">Sort order<input class="portal-input" type="number" step="1" name="sortOrder" value="' +
      escapeHtml(String(resolvedSortOrder)) +
      '" /></label>' +
      "</div>" +
      '<div class="portal-inline-actions">' +
      '<label class="portal-checkbox"><input type="checkbox" name="isActive" ' +
      (item.isActive !== false ? "checked" : "") +
      ' />Active</label>' +
      '<button class="ghost compact" type="button" data-action="remove-staff-row">Remove</button>' +
      "</div>" +
      "</article>"
    );
  }

  function formatPrivateFeedbackDate(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch (e) {
      return "";
    }
  }

  function buildPrivateFeedbackPanelHtml(rows, schemaMissing) {
    const list = Array.isArray(rows) ? rows : [];
    if (schemaMissing) {
      return (
        '<article class="portal-card">' +
        '<div class="portal-section-head">' +
        "<div><h2>Private guest feedback</h2><p>Submissions from the public store page when guests choose to message you privately (not posted on Google).</p></div>" +
        "</div>" +
        '<div class="portal-alert portal-alert-warn" role="alert">' +
        "The <code>store_private_feedback</code> table is not available yet. In Supabase SQL Editor, run <code>sql/030_store_private_feedback.sql</code> from the repo, then reload the API schema under Project Settings → API." +
        "</div>" +
        "</article>"
      );
    }
    if (!list.length) {
      return (
        '<article class="portal-card">' +
        '<div class="portal-section-head">' +
        "<div><h2>Private guest feedback</h2><p>Messages from the “Share feedback privately” button on the public <code>/stores/&lt;slug&gt;</code> page.</p></div>" +
        "</div>" +
        '<p class="portal-private-empty">No private messages yet.</p>' +
        "</article>"
      );
    }
    const thead =
      "<thead><tr><th>Date</th><th>Name</th><th>Phone</th><th>Google</th><th>Message</th></tr></thead>";
    const bodyRows = list
      .map(function (row) {
        const msg = String(row.body || "");
        const msgShort = msg.length > 220 ? msg.slice(0, 220) + "…" : msg;
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(formatPrivateFeedbackDate(row.createdAt)) +
          "</td>" +
          "<td>" +
          escapeHtml(row.name || "") +
          "</td>" +
          "<td>" +
          escapeHtml(row.phone || "") +
          "</td>" +
          "<td>" +
          escapeHtml(row.googleAccount || "") +
          "</td>" +
          '<td class="pf-msg" title="' +
          escapeHtml(msg) +
          '">' +
          escapeHtml(msgShort) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
    return (
      '<article class="portal-card">' +
      '<div class="portal-section-head">' +
      "<div><h2>Private guest feedback</h2><p>Inbox for private notes from the store landing page. These are not Google reviews.</p></div>" +
      "</div>" +
      '<div class="portal-private-feedback-table-wrap">' +
      '<table class="portal-private-feedback-table">' +
      thead +
      "<tbody>" +
      bodyRows +
      "</tbody></table></div></article>"
    );
  }

  function renderStoreEditor() {
    if (!isAuthenticated()) return renderAccessGate();
    if (!isAdmin()) return renderNonAdminPlaceholder();
    if (state.routeLoading || !state.storeDetails || !state.storeDetails.store) {
      return renderLoadingShell("Loading store editor", "Fetching the editable store record.");
    }

    const store = state.storeDetails.store;
    const keywords = Array.isArray(store.reviewKeywords) ? store.reviewKeywords : [];
    const staff = Array.isArray(state.storeDetails.staff) ? state.storeDetails.staff : [];
    const serviceItems = Array.isArray(state.storeDetails.serviceItems) ? state.storeDetails.serviceItems : [];
    const serviceItemsSchemaMissing = !!state.storeDetails.serviceItemsSchemaMissing;
    const serviceItemsPostgrestNotVisible = !!state.storeDetails.serviceItemsPostgrestNotVisible;
    const privateFeedback = Array.isArray(state.storeDetails.privateFeedback)
      ? state.storeDetails.privateFeedback
      : [];
    const privateFeedbackSchemaMissing = !!state.storeDetails.privateFeedbackSchemaMissing;

    return (
      '<section class="portal-page portal-page-store">' +
      '<article class="portal-card portal-card-hero">' +
      '<div class="portal-breadcrumbs">' +
      '<a class="portal-breadcrumb" href="/admin">Admin</a>' +
      '<span>/</span>' +
      '<a class="portal-breadcrumb" href="/admin/stores">Stores</a>' +
      '<span>/</span>' +
      '<span>' +
      escapeHtml(store.slug) +
      "</span>" +
      "</div>" +
      '<p class="portal-kicker">Store Editor</p>' +
      '<h1 class="portal-title">' +
      escapeHtml(store.nameEn || store.nameZh || store.slug) +
      "</h1>" +
      '<p class="portal-body">Edit store identity, review-keyword phrases, staff, and the optional service catalog. Saving services publishes the live service catalog for the public store page; you may clear all service rows to remove the published menu.</p>' +
      '<div class="portal-actions portal-actions-tight">' +
      '<a class="ghost landing-link" href="/admin/stores">Back to stores</a>' +
      '<button class="ghost" type="button" data-action="sign-out">Sign out</button>' +
      "</div>" +
      "</article>" +
      buildPrivateFeedbackPanelHtml(privateFeedback, privateFeedbackSchemaMissing) +

      '<form class="portal-card portal-form-card" data-form="identity">' +
      '<div class="portal-section-head">' +
      '<div><h2>Store identity</h2><p>Update the store names and Google review entry points.</p></div>' +
      "</div>" +
      getMessageHtml(state.messages.identity) +
      '<div class="portal-form-grid">' +
      '<label class="portal-label">Chinese/store name<input class="portal-input" type="text" name="nameZh" value="' +
      escapeHtml(store.nameZh || "") +
      '" required /></label>' +
      '<label class="portal-label">English name<input class="portal-input" type="text" name="nameEn" value="' +
      escapeHtml(store.nameEn || "") +
      '" required /></label>' +
      '<label class="portal-label">Google review URL<input class="portal-input" type="url" name="googleReviewUrl" value="' +
      escapeHtml(store.googleReviewUrl || "") +
      '" /></label>' +
      '<label class="portal-label">Fallback review URL<input class="portal-input" type="url" name="googleReviewFallbackUrl" value="' +
      escapeHtml(store.googleReviewFallbackUrl || "") +
      '" /></label>' +
      '<label class="portal-label">Google Place ID<input class="portal-input" type="text" name="googlePlaceId" placeholder="ChIJ… (optional)" autocomplete="off" value="' +
      escapeHtml(store.googlePlaceId || "") +
      '" /></label>' +
      "</div>" +
      '<div class="portal-inline-actions">' +
      '<label class="portal-checkbox"><input type="checkbox" name="isActive" ' +
      (store.isActive ? "checked" : "") +
      ' />Store is active</label>' +
      "</div>" +
      '<div class="portal-note">Guests can use the store page before you publish a custom catalog. Turn the store active when you are ready, then add your real services below so receipt recognition and review wording match your menu.</div>' +
      '<div class="portal-status" data-status="identity"></div>' +
      '<div class="portal-actions"><button class="cta" type="submit">Save store identity</button></div>' +
      "</form>" +

      '<form class="portal-card portal-form-card" data-form="keywords">' +
      '<div class="portal-section-head">' +
      '<div><h2>Review keywords</h2><p>Keep known keys stable where possible so phrase generation quality does not regress.</p></div>' +
      '<button class="ghost compact" type="button" data-action="add-keyword-row">Add keyword</button>' +
      "</div>" +
      getMessageHtml(state.messages.keywords) +
      '<div class="portal-note">Recommended keys include: clean, detailed, gentle, polished, relaxing, natural, glossy, precise, lasting, welcoming.</div>' +
      '<div id="portalKeywordRows" class="portal-repeat-list">' +
      (keywords.length ? keywords.map(buildKeywordRowHtml).join("") : buildKeywordRowHtml({ enabled: true, weight: 1 })) +
      "</div>" +
      '<div class="portal-status" data-status="keywords"></div>' +
      '<div class="portal-actions"><button class="cta" type="submit">Save keywords</button></div>' +
      "</form>" +

      '<form class="portal-card portal-form-card" data-form="staff">' +
      '<div class="portal-section-head">' +
      '<div><h2>Staff list</h2><p>Adjust display names, sort order, and active state. Missing rows are treated as removed from the active roster.</p></div>' +
      '<button class="ghost compact" type="button" data-action="add-staff-row">Add staff</button>' +
      "</div>" +
      getMessageHtml(state.messages.staff) +
      '<div id="portalStaffRows" class="portal-repeat-list">' +
      (staff.length
        ? staff
            .map(function (item, index) {
              return buildStaffRowHtml(item, index);
            })
            .join("")
        : buildStaffRowHtml({ isActive: true }, 0)) +
      "</div>" +
      '<div class="portal-status" data-status="staff"></div>' +
      '<div class="portal-actions"><button class="cta" type="submit">Save staff</button></div>' +
      "</form>" +

      '<form class="portal-card portal-form-card" data-form="services">' +
      '<div class="portal-section-head">' +
      '<div><h2>Service catalog</h2><p>Add the services that appear on receipts. Rows without a name are skipped. When at least one row is active and named, we publish it for the public store page; saving with no active named rows removes the published menu.</p></div>' +
      '<button class="ghost compact" type="button" data-action="add-service-row">Add service</button>' +
      "</div>" +
      getMessageHtml(state.messages.services) +
      (serviceItemsPostgrestNotVisible
        ? '<div class="portal-alert portal-alert-warn" role="alert">Supabase API cannot see <code>public.store_service_items</code> yet (PostgREST schema cache). In Dashboard: <strong>Project Settings → API → Reload schema cache</strong> first. If you never created the table, run <code>sql/007_store_service_items.sql</code> in SQL Editor, then reload schema again.</div>'
        : serviceItemsSchemaMissing
          ? '<div class="portal-alert portal-alert-warn" role="alert">The <code>store_service_items</code> table is missing in Postgres. In Supabase SQL Editor, run <code>sql/007_store_service_items.sql</code> from the repo (after <code>sql/001_schema.sql</code> on a fresh project). Then reload the API schema under Settings → API.</div>'
          : "") +
      '<div id="portalServiceRows" class="portal-repeat-list">' +
      (serviceItems.length
        ? serviceItems.map(buildServiceRowHtml).join("")
        : buildServiceRowHtml({ isActive: true })) +
      "</div>" +
      '<div class="portal-status" data-status="services"></div>' +
      '<div class="portal-actions"><button class="cta" type="submit">Save services</button></div>' +
      "</form>" +
      "</section>"
    );
  }

  function render() {
    setDocumentTitle();

    if (state.fatalError) {
      portalRoot.innerHTML = renderFatalError();
      return;
    }

    if (state.initializing) {
      portalRoot.innerHTML = renderLoadingShell("Preparing portal", "Loading runtime config and session state.");
      return;
    }

    if (state.route.kind === ROUTE_LOGIN) {
      portalRoot.innerHTML = renderLoginPage();
      return;
    }

    if (state.route.kind === ROUTE_ADMIN) {
      portalRoot.innerHTML = renderAdminDashboard();
      return;
    }

    if (state.route.kind === ROUTE_ADMIN_STORES) {
      portalRoot.innerHTML = renderStoresList();
      applyStoreFilter();
      return;
    }

    if (state.route.kind === ROUTE_ADMIN_SMS) {
      portalRoot.innerHTML = renderSmsCampaignDashboard();
      return;
    }

    if (state.route.kind === ROUTE_ADMIN_STORE) {
      portalRoot.innerHTML = renderStoreEditor();
      return;
    }
  }

  function collectKeywordRows() {
    return Array.from(portalRoot.querySelectorAll("[data-keyword-row]"))
      .map(function (row) {
        return {
          key: row.querySelector('[name="key"]').value,
          textZh: row.querySelector('[name="textZh"]').value,
          textEn: row.querySelector('[name="textEn"]').value,
          enabled: row.querySelector('[name="enabled"]').checked,
          weight: Number(row.querySelector('[name="weight"]').value || 0),
        };
      })
      .filter(function (item) {
        return item.key || item.textZh || item.textEn;
      });
  }

  function collectStaffRows() {
    return Array.from(portalRoot.querySelectorAll("[data-staff-row]"))
      .map(function (row, index) {
        return {
          id: row.dataset.staffId || "",
          name: row.querySelector('[name="name"]').value,
          displayName: row.querySelector('[name="displayName"]').value,
          sortOrder: Number(row.querySelector('[name="sortOrder"]').value || index),
          isActive: row.querySelector('[name="isActive"]').checked,
        };
      })
      .filter(function (item) {
        return item.name || item.displayName;
      });
  }

  function collectServiceRows() {
    return Array.from(portalRoot.querySelectorAll("[data-service-row]")).map(function (row, index) {
      const dishInput = row.querySelector('[name="dishUqid"]');
      const nameInput = row.querySelector('[name="name"]');
      const typeInput = row.querySelector('[name="itemType"]');
      const priceInput = row.querySelector('[name="price"]');
      const desc = row.querySelector('[name="description"]');
      const activeBox = row.querySelector('[name="isActive"]');
      const dishRaw = dishInput ? String(dishInput.value || "").trim() : "";
      const dishParsed = Number(dishRaw);
      return {
        id: row.dataset.serviceId || "",
        dishUqid: Number.isFinite(dishParsed) && dishParsed > 0 ? dishParsed : 0,
        name: nameInput ? String(nameInput.value || "") : "",
        itemType: typeInput ? String(typeInput.value || "") : "",
        price: priceInput ? String(priceInput.value || "") : "",
        description: desc ? String(desc.value || "") : "",
        isActive: activeBox ? !!activeBox.checked : true,
        sortOrder: index,
      };
    });
  }

  function appendKeywordRow() {
    const container = portalRoot.querySelector("#portalKeywordRows");
    if (!container) return;
    container.insertAdjacentHTML("beforeend", buildKeywordRowHtml({ enabled: true, weight: 1 }));
  }

  function appendStaffRow() {
    const container = portalRoot.querySelector("#portalStaffRows");
    if (!container) return;
    const nextIndex = container.querySelectorAll("[data-staff-row]").length;
    container.insertAdjacentHTML("beforeend", buildStaffRowHtml({ isActive: true }, nextIndex));
  }

  function appendServiceRow() {
    const container = portalRoot.querySelector("#portalServiceRows");
    if (!container) return;
    container.insertAdjacentHTML("beforeend", buildServiceRowHtml({ isActive: true }));
  }

  function normalizePhoneInput(raw) {
    const compact = String(raw || "").replace(/\s+/g, "");
    if (!compact) {
      throw new Error(portalLoginT("errPhoneEmpty"));
    }
    if (compact.charAt(0) === "+") {
      if (!/^\+[1-9]\d{7,14}$/.test(compact)) {
        throw new Error(portalLoginT("errPhoneInvalidIntl"));
      }
      return compact;
    }
    if (/^[2-9]\d{2}[2-9]\d{6}$/.test(compact)) {
      return "+1" + compact;
    }
    if (/^1[2-9]\d{2}[2-9]\d{6}$/.test(compact)) {
      return "+1" + compact.slice(1);
    }
    throw new Error(portalLoginT("errPhoneInvalidUs"));
  }

  async function handleSendPhoneOtp(form, submitter) {
    clearInlineStatus("auth-phone");
    let phone;
    try {
      phone = normalizePhoneInput(form.phone && form.phone.value ? form.phone.value : "");
    } catch (err) {
      setInlineStatus("auth-phone", err.message || portalLoginT("errPhoneInvalidUs"), "error");
      return;
    }

    setBusy(submitter, true, portalLoginT("sendCode"), portalLoginT("sendCodeBusy"));
    setInlineStatus("auth-phone", portalLoginT("statusSending"), "working");

    try {
      const otpResult = await state.client.auth.signInWithOtp({
        phone: phone,
        options: {
          shouldCreateUser: true,
        },
      });

      if (otpResult.error) {
        throw new Error(friendlyPhoneSmsError(otpResult.error));
      }

      setInlineStatus("auth-phone", portalLoginT("statusSent"), "ok");
    } catch (error) {
      setInlineStatus("auth-phone", friendlyPhoneSmsError(error), "error");
    } finally {
      setBusy(submitter, false, portalLoginT("sendCode"));
    }
  }

  async function handleVerifyPhoneAuth(form, submitter) {
    clearInlineStatus("auth-phone");
    let phone;
    try {
      phone = normalizePhoneInput(form.phone && form.phone.value ? form.phone.value : "");
    } catch (err) {
      setInlineStatus("auth-phone", err.message || portalLoginT("errPhoneInvalidUs"), "error");
      return;
    }

    const otp = String(form.otp && form.otp.value ? form.otp.value : "").trim().replace(/\s+/g, "");
    if (!/^\d{4,10}$/.test(otp)) {
      setInlineStatus("auth-phone", portalLoginT("errOtpMissing"), "error");
      return;
    }

    setBusy(submitter, true, portalLoginT("verifySubmit"), portalLoginT("verifyBusy"));
    setInlineStatus("auth-phone", portalLoginT("statusVerifying"), "working");

    try {
      const verifyResult = await state.client.auth.verifyOtp({
        phone: phone,
        token: otp,
        type: "sms",
      });

      if (verifyResult.error) {
        throw new Error(verifyResult.error.message || portalLoginT("errVerifyOtp"));
      }

      const session = verifyResult.data && verifyResult.data.session ? verifyResult.data.session : null;
      if (!session || !session.access_token) {
        throw new Error(portalLoginT("errNoSession"));
      }

      state.session = session;

      const fullName = String(form.fullName && form.fullName.value ? form.fullName.value : "").trim();
      await fetchJson(
        "/api/auth/bootstrap-phone-profile",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: fullName,
          }),
        },
        { includeAuth: true },
      );

      await refreshCurrentUser();
      if (redirectAfterSuccessfulAuth()) return;

      window.location.assign("/");
    } catch (error) {
      setInlineStatus("auth-phone", error.message || portalLoginT("errVerifyGeneric"), "error");
      await signOutLocal();
    } finally {
      setBusy(submitter, false, portalLoginT("verifySubmit"));
    }
  }

  async function handleEmailSignIn(form, submitter) {
    clearInlineStatus("auth-email");
    const identifier = String(form.identifier && form.identifier.value ? form.identifier.value : "").trim();
    const password = String(form.password && form.password.value ? form.password.value : "");
    if (!identifier) {
      setInlineStatus("auth-email", portalLoginT("errIdentifierRequired"), "error");
      return;
    }
    if (!password) {
      setInlineStatus("auth-email", portalLoginT("errPasswordRequired"), "error");
      return;
    }

    setBusy(submitter, true, portalLoginT("emailSignInSubmit"), portalLoginT("emailSignInBusy"));
    try {
      let email = identifier;
      if (identifier.indexOf("@") < 0) {
        const resolved = await fetchJson("/api/auth/resolve-identifier", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ identifier: identifier }),
        });
        email = resolved && resolved.email ? String(resolved.email).trim().toLowerCase() : "";
      } else {
        email = identifier.trim().toLowerCase();
      }

      if (!email || !isValidEmailShape(email)) {
        setInlineStatus("auth-email", portalLoginT("errResetEmailInvalid"), "error");
        return;
      }

      const signInResult = await state.client.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (signInResult.error) {
        throw signInResult.error;
      }

      state.session = signInResult.data && signInResult.data.session ? signInResult.data.session : null;
      await refreshCurrentUser();
      if (redirectAfterSuccessfulAuth()) return;

      window.location.assign("/");
    } catch (error) {
      setInlineStatus("auth-email", friendlyEmailAuthError(error), "error");
    } finally {
      setBusy(submitter, false, portalLoginT("emailSignInSubmit"));
    }
  }

  async function handleEmailRegister(form, submitter) {
    clearInlineStatus("auth-email");
    const username = String(form.username && form.username.value ? form.username.value : "").trim();
    const email = String(form.email && form.email.value ? form.email.value : "").trim().toLowerCase();
    const password = String(form.password && form.password.value ? form.password.value : "");
    const passwordConfirm = String(
      form.passwordConfirm && form.passwordConfirm.value ? form.passwordConfirm.value : "",
    );
    const fullName = String(form.fullName && form.fullName.value ? form.fullName.value : "").trim();

    if (!username) {
      setInlineStatus("auth-email", portalLoginT("errRegUsernameRequired"), "error");
      return;
    }
    if (!email || !isValidEmailShape(email)) {
      setInlineStatus("auth-email", portalLoginT("errResetEmailInvalid"), "error");
      return;
    }
    if (password.length < 8) {
      setInlineStatus("auth-email", portalLoginT("errRegisterWeak"), "error");
      return;
    }
    if (password !== passwordConfirm) {
      setInlineStatus("auth-email", portalLoginT("errRegisterPasswordMismatch"), "error");
      return;
    }

    setBusy(submitter, true, portalLoginT("registerSubmit"), portalLoginT("registerBusy"));
    try {
      await fetchJson("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          username: username,
          password: password,
          fullName: fullName,
        }),
      });

      const signInResult = await state.client.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (signInResult.error) {
        throw signInResult.error;
      }

      state.session = signInResult.data && signInResult.data.session ? signInResult.data.session : null;
      state.emailRegisterMode = false;
      await refreshCurrentUser();
      if (redirectAfterSuccessfulAuth()) return;

      window.location.assign("/");
    } catch (error) {
      const msg = error && error.message ? String(error.message) : portalLoginT("errVerifyGeneric");
      setInlineStatus("auth-email", msg, "error");
    } finally {
      setBusy(submitter, false, portalLoginT("registerSubmit"));
    }
  }

  async function handleEmailForgot(form, submitter) {
    clearInlineStatus("auth-email");
    const email = String(form.resetEmail && form.resetEmail.value ? form.resetEmail.value : "")
      .trim()
      .toLowerCase();
    if (!email) {
      setInlineStatus("auth-email", portalLoginT("errResetEmailRequired"), "error");
      return;
    }
    if (!isValidEmailShape(email)) {
      setInlineStatus("auth-email", portalLoginT("errResetEmailInvalid"), "error");
      return;
    }

    const redirectTo = window.location.origin + "/login";

    setBusy(submitter, true, portalLoginT("forgotSubmit"), portalLoginT("forgotBusy"));
    setInlineStatus("auth-email", portalLoginT("statusForgotEmail"), "working");

    try {
      const resetResult = await state.client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo,
      });
      if (resetResult && resetResult.error) {
        throw resetResult.error;
      }
      setInlineStatus("auth-email", portalLoginT("forgotSent"), "ok");
    } catch (error) {
      const raw = error && error.message ? String(error.message) : "";
      setInlineStatus("auth-email", raw || portalLoginT("errSendFailed"), "error");
    } finally {
      setBusy(submitter, false, portalLoginT("forgotSubmit"));
    }
  }

  async function handlePasswordRecovery(form, submitter) {
    clearInlineStatus("auth-recovery");
    const p1 = String(form.newPassword && form.newPassword.value ? form.newPassword.value : "");
    const p2 = String(
      form.newPasswordConfirm && form.newPasswordConfirm.value ? form.newPasswordConfirm.value : "",
    );

    if (p1.length < 8) {
      setInlineStatus("auth-recovery", portalLoginT("errRecoveryWeak"), "error");
      return;
    }
    if (p1 !== p2) {
      setInlineStatus("auth-recovery", portalLoginT("errRecoveryMismatch"), "error");
      return;
    }

    setBusy(submitter, true, portalLoginT("recoverySubmit"), portalLoginT("recoveryBusy"));
    try {
      const updateResult = await state.client.auth.updateUser({ password: p1 });
      if (updateResult && updateResult.error) {
        throw updateResult.error;
      }
      state.passwordRecovery = false;
      try {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
        }
      } catch (e) {
        /* ignore */
      }
      await refreshCurrentUser();
      if (redirectAfterSuccessfulAuth()) return;

      window.location.assign("/");
    } catch (error) {
      setInlineStatus(
        "auth-recovery",
        (error && error.message ? String(error.message) : "") || portalLoginT("errRecoveryFailed"),
        "error",
      );
    } finally {
      setBusy(submitter, false, portalLoginT("recoverySubmit"));
    }
  }

  async function handleCreateStore(form, submitter) {
    clearInlineStatus("create-store");
    setBusy(submitter, true, "Create store", "Creating...");
    setInlineStatus("create-store", "Creating store record...", "working");

    try {
      const payload = await fetchJson(
        "/api/admin/stores",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slug: form.slug.value,
            nameZh: form.nameZh.value,
            nameEn: form.nameEn.value,
            googleReviewUrl: form.googleReviewUrl.value,
            googleReviewFallbackUrl: form.googleReviewFallbackUrl.value,
            googlePlaceId: form.googlePlaceId.value,
            isActive: form.isActive.checked,
          }),
        },
        { includeAuth: true },
      );

      if (payload && payload.store && payload.store.slug) {
        window.location.assign("/admin/stores/" + encodeURIComponent(payload.store.slug));
        return;
      }

      throw new Error("Store was created, but the editor route could not be opened.");
    } catch (error) {
      setInlineStatus("create-store", error.message || "Unable to create the store.", "error");
    } finally {
      setBusy(submitter, false, "Create store");
    }
  }

  async function handleSmsBlast(form, submitter) {
    clearInlineStatus("sms-blast");
    setBusy(submitter, true, "Queue & send", "Working…");
    setInlineStatus("sms-blast", "Submitting…", "working");

    try {
      const phones = form.phones ? String(form.phones.value || "") : "";
      const message = form.message ? String(form.message.value || "") : "";
      const sendNow = form.sendNow && form.sendNow.checked;

      const payload = await fetchJson(
        "/api/admin/sms-send-phones",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phones: phones,
            message: message,
            sendImmediately: sendNow,
          }),
        },
        { includeAuth: true },
      );

      var parts = [];
      parts.push("Campaign: " + (payload.campaignName || payload.campaignId || ""));
      parts.push("queued " + (payload.queued != null ? payload.queued : 0));
      if (payload.skippedOptOut) parts.push("skipped opt-out " + payload.skippedOptOut);
      if (payload.invalidTokenCount) parts.push("invalid tokens " + payload.invalidTokenCount);
      if (payload.sendResult) {
        parts.push(
          "sent " +
            (payload.sendResult.sent != null ? payload.sendResult.sent : 0) +
            (payload.sendResult.errors ? " · errors " + payload.sendResult.errors : ""),
        );
      } else if (!sendNow) {
        parts.push("queue only — run send-batch or wait for cron");
      }

      setInlineStatus("sms-blast", parts.join(" · "), "ok");
      form.message.value = "";
      form.phones.value = "";

      state.routeLoading = true;
      render();
      await ensureAdminRouteData();
      state.routeLoading = false;
      render();
    } catch (error) {
      setInlineStatus("sms-blast", error && error.message ? String(error.message) : "Request failed.", "error");
    } finally {
      setBusy(submitter, false, "Queue & send");
    }
  }

  async function handleIdentitySave(form, submitter) {
    clearInlineStatus("identity");
    setBusy(submitter, true, "Save store identity", "Saving...");
    setInlineStatus("identity", "Saving store identity...", "working");

    try {
      const payload = await fetchJson(
        "/api/admin/stores/" + encodeURIComponent(state.route.slug),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nameZh: form.nameZh.value,
            nameEn: form.nameEn.value,
            googleReviewUrl: form.googleReviewUrl.value,
            googleReviewFallbackUrl: form.googleReviewFallbackUrl.value,
            googlePlaceId: form.googlePlaceId.value,
            isActive: form.isActive.checked,
          }),
        },
        { includeAuth: true },
      );

      state.storeDetails = Object.assign({}, state.storeDetails, payload);
      state.messages.identity = {
        type: "ok",
        text: "Store identity saved.",
      };
      render();
    } catch (error) {
      setInlineStatus("identity", error.message || "Unable to save store identity.", "error");
    } finally {
      setBusy(submitter, false, "Save store identity");
    }
  }

  async function handleKeywordsSave(submitter) {
    clearInlineStatus("keywords");
    setBusy(submitter, true, "Save keywords", "Saving...");
    setInlineStatus("keywords", "Saving review keywords...", "working");

    try {
      const payload = await fetchJson(
        "/api/admin/stores/" + encodeURIComponent(state.route.slug) + "/keywords",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reviewKeywords: collectKeywordRows(),
          }),
        },
        { includeAuth: true },
      );

      state.storeDetails.store = payload.store;
      state.messages.keywords = {
        type: "ok",
        text: "Review keywords saved.",
      };
      render();
    } catch (error) {
      setInlineStatus("keywords", error.message || "Unable to save review keywords.", "error");
    } finally {
      setBusy(submitter, false, "Save keywords");
    }
  }

  async function handleServicesSave(submitter) {
    clearInlineStatus("services");
    setBusy(submitter, true, "Save services", "Saving...");
    setInlineStatus("services", "Saving service catalog and publishing snapshot...", "working");

    try {
      const payload = await fetchJson(
        "/api/admin-store-services?slug=" + encodeURIComponent(state.route.slug),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            serviceItems: collectServiceRows(),
          }),
        },
        { includeAuth: true },
      );

      let refreshedDetails = null;
      try {
        refreshedDetails = await fetchJson(
          "/api/admin/stores/" + encodeURIComponent(state.route.slug),
          {
            cache: "no-store",
          },
          { includeAuth: true },
        );
      } catch (reloadErr) {
        console.error(reloadErr);
      }
      if (refreshedDetails && refreshedDetails.store) {
        state.storeDetails = refreshedDetails;
      } else {
        state.storeDetails.serviceItems = payload.serviceItems || [];
      }

      state.messages.services = {
        type: "ok",
        text:
          Array.isArray(payload.serviceItems) && payload.serviceItems.length
            ? "Service catalog saved and published. Reload the public store page so customers pick up the new menu."
            : "Service catalog cleared; published menu was unpublished.",
      };
      render();
    } catch (error) {
      const code = error && error.code ? String(error.code) : "";
      const base = error && error.message ? String(error.message) : "Unable to save service catalog.";
      setInlineStatus("services", code ? base + " [" + code + "]" : base, "error");
    } finally {
      setBusy(submitter, false, "Save services");
    }
  }

  async function handleStaffSave(submitter) {
    clearInlineStatus("staff");
    setBusy(submitter, true, "Save staff", "Saving...");
    setInlineStatus("staff", "Saving staff list...", "working");

    try {
      const payload = await fetchJson(
        "/api/admin/stores/" + encodeURIComponent(state.route.slug) + "/staff",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            staff: collectStaffRows(),
          }),
        },
        { includeAuth: true },
      );

      state.storeDetails.staff = payload.staff || [];
      state.messages.staff = {
        type: "ok",
        text: "Staff list saved.",
      };
      render();
    } catch (error) {
      setInlineStatus("staff", error.message || "Unable to save staff list.", "error");
    } finally {
      setBusy(submitter, false, "Save staff");
    }
  }

  async function handleSubmit(event) {
    const form = event.target;
    if (!form || form.tagName !== "FORM") return;
    if (!form.dataset.form) return;

    event.preventDefault();
    const submitter = event.submitter || form.querySelector('[type="submit"]');

    if (form.dataset.form === "password-recovery") {
      await handlePasswordRecovery(form, submitter);
      return;
    }

    if (form.dataset.form === "email-signin") {
      await handleEmailSignIn(form, submitter);
      return;
    }

    if (form.dataset.form === "email-register") {
      await handleEmailRegister(form, submitter);
      return;
    }

    if (form.dataset.form === "email-forgot") {
      await handleEmailForgot(form, submitter);
      return;
    }

    if (form.dataset.form === "phone-auth") {
      await handleVerifyPhoneAuth(form, submitter);
      return;
    }

    if (form.dataset.form === "create-store") {
      await handleCreateStore(form, submitter);
      return;
    }

    if (form.dataset.form === "sms-blast") {
      await handleSmsBlast(form, submitter);
      return;
    }

    if (form.dataset.form === "identity") {
      await handleIdentitySave(form, submitter);
      return;
    }

    if (form.dataset.form === "keywords") {
      await handleKeywordsSave(submitter);
      return;
    }

    if (form.dataset.form === "staff") {
      await handleStaffSave(submitter);
      return;
    }

    if (form.dataset.form === "services") {
      await handleServicesSave(submitter);
    }
  }

  async function handleClick(event) {
    const signOutButton = event.target.closest('[data-action="sign-out"]');
    if (signOutButton) {
      event.preventDefault();
      signOutButton.disabled = true;
      signOutButton.textContent = portalLoginT("signingOut");
      await signOutLocal();
      render();
      return;
    }

    const addKeywordButton = event.target.closest('[data-action="add-keyword-row"]');
    if (addKeywordButton) {
      event.preventDefault();
      appendKeywordRow();
      return;
    }

    const removeKeywordButton = event.target.closest('[data-action="remove-keyword-row"]');
    if (removeKeywordButton) {
      event.preventDefault();
      const row = removeKeywordButton.closest("[data-keyword-row]");
      if (row) row.remove();
      return;
    }

    const addStaffButton = event.target.closest('[data-action="add-staff-row"]');
    if (addStaffButton) {
      event.preventDefault();
      appendStaffRow();
      return;
    }

    const removeStaffButton = event.target.closest('[data-action="remove-staff-row"]');
    if (removeStaffButton) {
      event.preventDefault();
      const row = removeStaffButton.closest("[data-staff-row]");
      if (row) row.remove();
      return;
    }

    const addServiceButton = event.target.closest('[data-action="add-service-row"]');
    if (addServiceButton) {
      event.preventDefault();
      appendServiceRow();
      return;
    }

    const removeServiceButton = event.target.closest('[data-action="remove-service-row"]');
    if (removeServiceButton) {
      event.preventDefault();
      const row = removeServiceButton.closest("[data-service-row]");
      if (row) row.remove();
      return;
    }

    const toggleCreateStoreButton = event.target.closest('[data-action="toggle-create-store"]');
    if (toggleCreateStoreButton) {
      event.preventDefault();
      state.createStoreOpen = !state.createStoreOpen;
      render();
      if (state.createStoreOpen) {
        const slugInput = portalRoot.querySelector('[data-form="create-store"] [name="slug"]');
        if (slugInput) slugInput.focus();
      }
      return;
    }

    const cancelCreateStoreButton = event.target.closest('[data-action="cancel-create-store"]');
    if (cancelCreateStoreButton) {
      event.preventDefault();
      state.createStoreOpen = false;
      render();
    }

    const sendPhoneOtpBtn = event.target.closest('[data-action="send-phone-otp"]');
    if (sendPhoneOtpBtn) {
      event.preventDefault();
      const form = sendPhoneOtpBtn.closest('form[data-form="phone-auth"]');
      if (!form) return;
      handleSendPhoneOtp(form, sendPhoneOtpBtn).catch(function (error) {
        console.error(error);
      });
      return;
    }

    const toggleEmailForgotBtn = event.target.closest('[data-action="toggle-email-forgot"]');
    if (toggleEmailForgotBtn) {
      event.preventDefault();
      state.emailForgotOpen = true;
      state.emailRegisterMode = false;
      render();
      return;
    }

    const emailForgotBackBtn = event.target.closest('[data-action="email-forgot-back"]');
    if (emailForgotBackBtn) {
      event.preventDefault();
      state.emailForgotOpen = false;
      render();
      return;
    }

    const toggleEmailRegisterBtn = event.target.closest('[data-action="toggle-email-register"]');
    if (toggleEmailRegisterBtn) {
      event.preventDefault();
      state.emailRegisterMode = !state.emailRegisterMode;
      state.emailForgotOpen = false;
      render();
      return;
    }

    const toggleLocaleBtn = event.target.closest('[data-action="toggle-portal-locale"]');
    if (toggleLocaleBtn) {
      event.preventDefault();
      state.portalLocale = state.portalLocale === "zh" ? "en" : "zh";
      try {
        sessionStorage.setItem("portalLocale", state.portalLocale);
      } catch (e) {
        /* ignore */
      }
      try {
        localStorage.setItem("rankmyrestaurant-language-v1", state.portalLocale);
      } catch (e2) {
        /* ignore */
      }
      render();
      return;
    }
  }

  function handleInput(event) {
    if (event.target && event.target.id === "portalStoreFilter") {
      state.storeFilter = event.target.value || "";
      applyStoreFilter();
    }
  }

  function applyStoreFilter() {
    const cards = Array.from(portalRoot.querySelectorAll("[data-store-card]"));
    if (!cards.length) return;

    const needle = String(state.storeFilter || "").trim().toLowerCase();
    let visibleCount = 0;
    cards.forEach(function (card) {
      const haystack = String(card.getAttribute("data-search-text") || "").toLowerCase();
      const matches = !needle || haystack.indexOf(needle) >= 0;
      card.classList.toggle("hidden", !matches);
      if (matches) visibleCount += 1;
    });

    let empty = portalRoot.querySelector("#portalStoreFilterEmpty");
    if (!empty) {
      empty = document.createElement("div");
      empty.id = "portalStoreFilterEmpty";
      empty.className = "portal-empty hidden";
      empty.textContent = "No stores matched this search.";
      const list = portalRoot.querySelector(".portal-store-list");
      if (list) list.appendChild(empty);
    }

    if (empty) {
      empty.classList.toggle("hidden", visibleCount !== 0);
    }
  }

  async function init() {
    var portalInitialHash = "";
    try {
      portalInitialHash = window.location.hash || "";
    } catch (e) {
      portalInitialHash = "";
    }

    portalRoot.addEventListener("submit", function (event) {
      handleSubmit(event).catch(function (error) {
        console.error(error);
      });
    });
    portalRoot.addEventListener("click", function (event) {
      handleClick(event).catch(function (error) {
        console.error(error);
      });
    });
    portalRoot.addEventListener("input", handleInput);

    try {
      render();
      await loadRuntimeConfig();
      await ensureSupabaseClient();
      if (state.route.kind === ROUTE_LOGIN && portalInitialHash.indexOf("type=recovery") !== -1) {
        state.passwordRecovery = true;
      }
      await refreshCurrentUser();
      state.initializing = false;
      await ensureAdminRouteData();
      render();
    } catch (error) {
      console.error(error);
      state.initializing = false;
      state.fatalError = error && error.message ? error.message : "Unexpected portal startup error.";
      render();
    }
  }

  init();
})();
