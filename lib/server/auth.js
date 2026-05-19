const { createAppError } = require("./shared");
const { getSupabaseAdmin } = require("./supabase");

const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{1,30}[a-zA-Z0-9])?$/;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validateEmail(value) {
  const normalized = normalizeEmail(value);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw createAppError("INVALID_EMAIL", "Enter a valid email address", 400);
  }
  return normalized;
}

function validateUsername(value) {
  const normalized = normalizeUsername(value);
  if (!normalized) {
    throw createAppError("INVALID_USERNAME", "Username is required", 400);
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    throw createAppError(
      "INVALID_USERNAME",
      "Username must be 3-32 characters and use letters, numbers, dots, underscores, or hyphens",
      400,
    );
  }
  return normalized;
}

function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 8) {
    throw createAppError("INVALID_PASSWORD", "Password must be at least 8 characters", 400);
  }
  return password;
}

function mapUserProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    phone: row.phone || "",
    username: row.username,
    globalRole: row.global_role,
    status: row.status,
    shopifyCustomerGid: row.shopify_customer_gid || "",
    fullName: row.full_name || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getAuthorizationHeader(req) {
  if (!req || !req.headers) return "";
  return String(req.headers.authorization || req.headers.Authorization || "").trim();
}

function extractBearerToken(req) {
  const header = getAuthorizationHeader(req);
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

async function getUserProfileById(userId) {
  const supabase = getSupabaseAdmin();
  const result = await supabase.from("user_profiles").select("*").eq("id", userId).limit(1).maybeSingle();
  if (result.error) throw result.error;
  return mapUserProfile(result.data);
}

async function ensureUsernameAvailable(username) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("user_profiles")
    .select("id")
    .eq("username", validateUsername(username))
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  if (result.data) {
    throw createAppError("USERNAME_TAKEN", "That username is already taken", 409);
  }
}

async function ensureEmailAvailable(email) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", validateEmail(email))
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  if (result.data) {
    throw createAppError("EMAIL_TAKEN", "That email is already registered", 409);
  }
}

async function resolveIdentifierToEmail(identifier) {
  const rawIdentifier = String(identifier || "").trim();
  if (!rawIdentifier) {
    throw createAppError("INVALID_IDENTIFIER", "Username or email is required", 400);
  }

  if (rawIdentifier.indexOf("@") >= 0) {
    return validateEmail(rawIdentifier);
  }

  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("user_profiles")
    .select("email")
    .eq("username", validateUsername(rawIdentifier))
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  if (!result.data || !result.data.email) {
    throw createAppError("INVALID_CREDENTIALS", "Invalid username/email or password", 401);
  }

  return normalizeEmail(result.data.email);
}

async function registerUser(payload) {
  const email = validateEmail(payload && payload.email);
  const username = validateUsername(payload && payload.username);
  const password = validatePassword(payload && payload.password);
  const fullName = String((payload && payload.fullName) || "").trim();
  const supabase = getSupabaseAdmin();

  await Promise.all([ensureEmailAvailable(email), ensureUsernameAvailable(username)]);

  const createResult = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: {
      username: username,
      full_name: fullName || null,
    },
  });

  if (createResult.error || !createResult.data || !createResult.data.user) {
    if (createResult.error && /already registered|already exists|duplicate/i.test(createResult.error.message || "")) {
      throw createAppError("EMAIL_TAKEN", "That email is already registered", 409);
    }
    throw createAppError(
      "AUTH_CREATE_FAILED",
      (createResult.error && createResult.error.message) || "Unable to create user",
      500,
    );
  }

  const authUser = createResult.data.user;
  const insertResult = await supabase
    .from("user_profiles")
    .insert({
      id: authUser.id,
      email: email,
      username: username,
      global_role: "admin",
      status: "active",
      full_name: fullName || null,
    })
    .select("*")
    .single();

  if (insertResult.error || !insertResult.data) {
    await supabase.auth.admin.deleteUser(authUser.id).catch(function () {
      return null;
    });

    if (insertResult.error && /duplicate/i.test(insertResult.error.message || "")) {
      throw createAppError("PROFILE_CONFLICT", "That username or email is already registered", 409);
    }

    throw createAppError(
      "PROFILE_CREATE_FAILED",
      (insertResult.error && insertResult.error.message) || "Unable to create user profile",
      500,
    );
  }

  return mapUserProfile(insertResult.data);
}

async function bootstrapPhoneUserProfile(accessToken, body) {
  const token = String(accessToken || "").trim();
  if (!token) {
    throw createAppError("UNAUTHORIZED", "Authentication is required", 401);
  }

  const supabase = getSupabaseAdmin();
  const userResult = await supabase.auth.getUser(token);
  if (userResult.error || !userResult.data || !userResult.data.user) {
    throw createAppError("UNAUTHORIZED", "Your session is invalid or expired", 401);
  }

  const authUser = userResult.data.user;
  const phone = String(authUser.phone || "").trim();
  if (!phone) {
    throw createAppError("PHONE_REQUIRED", "This account has no phone number on file", 400);
  }

  const existing = await getUserProfileById(authUser.id);
  if (existing) {
    return existing;
  }

  const fullName = String((body && body.fullName) || "").trim();
  const compactId = authUser.id.replace(/-/g, "");
  const syntheticEmail = validateEmail(compactId + "@phone.rankmysalon.local");
  const username = validateUsername("u" + compactId.slice(0, 15));

  const insertResult = await supabase
    .from("user_profiles")
    .insert({
      id: authUser.id,
      email: syntheticEmail,
      username: username,
      phone: phone,
      global_role: "admin",
      status: "active",
      full_name: fullName || null,
    })
    .select("*")
    .single();

  if (insertResult.error || !insertResult.data) {
    throw createAppError(
      "PROFILE_CREATE_FAILED",
      (insertResult.error && insertResult.error.message) || "Unable to create user profile",
      500,
    );
  }

  return mapUserProfile(insertResult.data);
}

async function verifyAccessToken(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) {
    throw createAppError("UNAUTHORIZED", "Authentication is required", 401);
  }

  const supabase = getSupabaseAdmin();
  const result = await supabase.auth.getUser(token);
  if (result.error || !result.data || !result.data.user) {
    throw createAppError("UNAUTHORIZED", "Your session is invalid or expired", 401);
  }

  const profile = await getUserProfileById(result.data.user.id);
  if (!profile) {
    throw createAppError("PROFILE_NOT_FOUND", "User profile not found", 403);
  }
  if (profile.status !== "active") {
    throw createAppError("ACCOUNT_DISABLED", "This account is disabled", 403);
  }

  return {
    accessToken: token,
    authUser: result.data.user,
    profile: profile,
  };
}

module.exports = {
  bootstrapPhoneUserProfile,
  extractBearerToken,
  getUserProfileById,
  mapUserProfile,
  registerUser,
  resolveIdentifierToEmail,
  validateEmail,
  validatePassword,
  validateUsername,
  verifyAccessToken,
};
