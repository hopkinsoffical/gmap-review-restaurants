const { normalizeText } = require("./shared");
const { createAppError } = require("./shared");
const { getSupabaseAdmin } = require("./supabase");

const STORE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeStoreSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateStoreSlug(value) {
  const normalized = normalizeStoreSlug(value);
  if (!normalized) {
    throw createAppError("INVALID_STORE_SLUG", "Store slug is required", 400);
  }
  if (!STORE_SLUG_PATTERN.test(normalized)) {
    throw createAppError(
      "INVALID_STORE_SLUG",
      "Store slug must use lowercase letters, numbers, and hyphens only",
      400,
    );
  }
  return normalized;
}

function hasStoreActiveFlag(payload) {
  const next = payload && typeof payload === "object" ? payload : {};
  return Object.prototype.hasOwnProperty.call(next, "isActive") || Object.prototype.hasOwnProperty.call(next, "is_active");
}

function readStoreActiveFlag(payload, fallbackValue) {
  const next = payload && typeof payload === "object" ? payload : {};
  if (Object.prototype.hasOwnProperty.call(next, "isActive")) {
    return next.isActive !== false;
  }
  if (Object.prototype.hasOwnProperty.call(next, "is_active")) {
    return next.is_active !== false;
  }
  return fallbackValue !== false;
}

function normalizeReviewKeyword(item, index) {
  if (!item || typeof item !== "object") return null;

  const textZh = String(item.text_zh || item.textZh || "").trim();
  const textEn = String(item.text_en || item.textEn || "").trim();
  if (!textZh && !textEn) return null;

  const explicitKey = String(item.key || "").trim();
  return {
    key: explicitKey || normalizeText(textEn || textZh) || "keyword_" + index,
    textZh: textZh,
    textEn: textEn,
    enabled: item.enabled !== false,
    weight: Number.isFinite(Number(item.weight)) ? Number(item.weight) : 1,
  };
}

function normalizeReviewKeywords(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(function (item, index) {
      return normalizeReviewKeyword(item, index + 1);
    })
    .filter(Boolean);
}

function mapStore(row) {
  if (!row) return null;
  const intelReport = row.intel_report && typeof row.intel_report === "object" && !Array.isArray(row.intel_report) ? row.intel_report : {};
  return {
    id: row.id,
    slug: row.slug,
    nameZh: row.name_zh,
    nameEn: row.name_en,
    googleReviewUrl: row.google_review_url,
    googleReviewFallbackUrl: row.google_review_fallback_url || "",
    googlePlaceId: String(row.google_place_id != null ? row.google_place_id : "").trim(),
    reviewKeywords: normalizeReviewKeywords(row.review_keywords),
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    address: String(row.address != null ? row.address : "").trim(),
    city: String(row.city != null ? row.city : "").trim(),
    township: String(row.township != null ? row.township : "").trim(),
    googleRating: row.google_rating != null && Number.isFinite(Number(row.google_rating)) ? Number(row.google_rating) : null,
    googleReviewCount:
      row.google_review_count != null && Number.isFinite(Number(row.google_review_count)) ? Number(row.google_review_count) : null,
    marketingScore: row.marketing_score != null && Number.isFinite(Number(row.marketing_score)) ? Number(row.marketing_score) : null,
    intelListed: !!row.intel_listed,
    intelReport: intelReport,
  };
}

function coerceMenuJsonColumn(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch (e) {
    console.warn("[store-repo] menu_json is not valid JSON object", e && e.message ? e.message : e);
    return null;
  }
}

function mapMenuSnapshot(row) {
  if (!row) return null;
  return {
    id: row.id,
    storeId: row.store_id,
    version: row.version,
    menu: coerceMenuJsonColumn(row.menu_json),
    sourceType: row.source_type,
    sourceNote: row.source_note || "",
    isPublished: !!row.is_published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStaff(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name || row.name,
    sortOrder: Number(row.sort_order || 0),
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeStoreIdentity(payload) {
  const next = payload && typeof payload === "object" ? payload : {};
  const nameZh = String(next.nameZh || "").trim();
  const nameEn = String(next.nameEn || "").trim();
  const googleReviewUrl = String(next.googleReviewUrl || "").trim();
  const googleReviewFallbackUrl = String(next.googleReviewFallbackUrl || "").trim();
  const googlePlaceId = String(
    next.googlePlaceId != null ? next.googlePlaceId : next.google_place_id != null ? next.google_place_id : "",
  ).trim();

  if (!nameZh) {
    throw createAppError("INVALID_STORE_NAME", "Chinese/store display name is required", 400);
  }
  if (!nameEn) {
    throw createAppError("INVALID_STORE_NAME", "English store name is required", 400);
  }

  return {
    name_zh: nameZh,
    name_en: nameEn,
    google_review_url: googleReviewUrl,
    google_review_fallback_url: googleReviewFallbackUrl || null,
    google_place_id: googlePlaceId || null,
  };
}

async function ensureStoreSlugAvailable(slug) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("stores")
    .select("id")
    .eq("slug", validateStoreSlug(slug))
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  if (result.data) {
    throw createAppError("STORE_SLUG_TAKEN", "That store slug is already in use", 409);
  }
}

function sanitizeStaffItem(item, index) {
  const source = item && typeof item === "object" ? item : {};
  const nameRaw = String(source.name || "").trim();
  const displayName = String(source.displayName || source.display_name || "").trim();
  if (!nameRaw && !displayName) {
    return null;
  }
  const name = nameRaw || displayName;
  const sortOrder = Number.isFinite(Number(source.sortOrder))
    ? Number(source.sortOrder)
    : Number.isFinite(Number(source.sort_order))
      ? Number(source.sort_order)
      : index;

  return {
    id: source.id ? String(source.id).trim() : "",
    name: name,
    display_name: displayName || name,
    sort_order: sortOrder,
    is_active: source.isActive !== false && source.is_active !== false,
  };
}

function assertUniqueStaffNames(items) {
  const seen = new Set();
  items.forEach(function (item) {
    const key = String(item.name || "").trim().toLowerCase();
    if (!key) return;
    if (seen.has(key)) {
      throw createAppError("DUPLICATE_STAFF_NAME", "Staff names must be unique within a store", 400);
    }
    seen.add(key);
  });
}

async function getStoreBySlug(slug, options) {
  const settings = Object.assign(
    {
      activeOnly: false,
    },
    options || {},
  );

  const supabase = getSupabaseAdmin();
  let query = supabase.from("stores").select("*").eq("slug", slug).limit(1);
  if (settings.activeOnly) {
    query = query.eq("is_active", true);
  }

  const result = await query.maybeSingle();
  if (result.error) throw result.error;
  return mapStore(result.data);
}

async function getStoreById(storeId) {
  const supabase = getSupabaseAdmin();
  const result = await supabase.from("stores").select("*").eq("id", storeId).limit(1).maybeSingle();
  if (result.error) throw result.error;
  return mapStore(result.data);
}

async function getStaffByStoreId(storeId, options) {
  const settings = Object.assign(
    {
      activeOnly: false,
    },
    options || {},
  );

  const supabase = getSupabaseAdmin();
  let query = supabase.from("store_staff").select("*").eq("store_id", storeId);
  if (settings.activeOnly) {
    query = query.eq("is_active", true);
  }

  const result = await query
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });

  if (result.error) throw result.error;
  return (result.data || []).map(mapStaff).filter(Boolean);
}

async function getActiveStoreBySlug(slug) {
  return getStoreBySlug(slug, { activeOnly: true });
}

async function getPublishedMenuSnapshotByStoreId(storeId) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("store_menu_snapshots")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_published", true)
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  return mapMenuSnapshot(result.data);
}

async function getActiveStaffByStoreId(storeId) {
  return getStaffByStoreId(storeId, { activeOnly: true });
}

async function getStoreBootstrap(slug) {
  const store = await getActiveStoreBySlug(slug);
  if (!store) return null;

  const [menuSnapshot, staff] = await Promise.all([
    getPublishedMenuSnapshotByStoreId(store.id),
    getActiveStaffByStoreId(store.id),
  ]);

  let serviceSpotlight = null;
  try {
    const servicePack = await listServiceItemsByStoreIdWithStatus(store.id);
    const items = Array.isArray(servicePack.items) ? servicePack.items : [];
    const preferred = items.filter((row) => row && row.isActive);
    const pool = preferred.length ? preferred : items;
    const first = pool[0];
    const nm = first && String(first.name || "").trim();
    if (nm) {
      serviceSpotlight = {
        name: nm,
        itemType: String((first && first.itemType) || "").trim(),
      };
    }
  } catch (err) {
    console.warn("[store-repo] getStoreBootstrap service spotlight skipped:", err && err.message ? err.message : err);
  }

  return {
    menuSnapshot: menuSnapshot,
    staff: staff,
    store: store,
    serviceSpotlight: serviceSpotlight,
  };
}

async function createScanEvent(payload) {
  const supabase = getSupabaseAdmin();
  const result = await supabase.from("scan_events").insert({
    store_id: payload.storeId,
    menu_snapshot_id: payload.menuSnapshotId || null,
    image_kind: payload.imageKind || null,
    recognition_mode: payload.recognitionMode || null,
    recognized_dish_ids: payload.recognizedDishIds || [],
    success: payload.success !== false,
    error_code: payload.errorCode || null,
  });

  if (result.error) {
    console.warn("Failed to create scan event", result.error);
  }
}

async function listStoresForAdmin() {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("stores")
    .select("*")
    .order("updated_at", { ascending: false })
    .order("name_en", { ascending: true });

  if (result.error) throw result.error;
  return (result.data || []).map(mapStore).filter(Boolean);
}

function mapPrivateFeedbackRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    storeId: row.store_id,
    name: String(row.name || ""),
    phone: String(row.phone || ""),
    googleAccount: String(row.google_account || ""),
    body: String(row.body || ""),
    lang: String(row.lang || ""),
    createdAt: row.created_at,
  };
}

function isStorePrivateFeedbackTableMissingError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  const raw = String(error.message || error.details || "");
  const lower = raw.toLowerCase();
  if (lower.indexOf("store_private_feedback") < 0) return false;
  if (code === "42P01") return true;
  if (code === "PGRST205") return true;
  if (/relation\s+["']?public\.store_private_feedback["']?\s+does\s+not\s+exist/i.test(raw)) return true;
  if (lower.indexOf("schema cache") >= 0) return true;
  return false;
}

async function listStorePrivateFeedbackByStoreId(storeId, limit) {
  const supabase = getSupabaseAdmin();
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const result = await supabase
    .from("store_private_feedback")
    .select("id, store_id, name, phone, google_account, body, lang, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(lim);
  if (result.error) throw result.error;
  return (result.data || []).map(mapPrivateFeedbackRow).filter(Boolean);
}

async function insertStorePrivateFeedback(payload) {
  const supabase = getSupabaseAdmin();
  const insertResult = await supabase
    .from("store_private_feedback")
    .insert({
      store_id: payload.storeId,
      name: payload.name,
      phone: payload.phone || null,
      google_account: payload.googleAccount || null,
      body: payload.body,
      lang: payload.lang || null,
      user_agent: payload.userAgent || null,
      client_ip: payload.clientIp || null,
    })
    .select("id")
    .single();
  if (insertResult.error) {
    if (isStorePrivateFeedbackTableMissingError(insertResult.error)) {
      throw createAppError(
        "STORE_PRIVATE_FEEDBACK_TABLE_MISSING",
        "Database table store_private_feedback is missing. Run sql/030_store_private_feedback.sql in Supabase, then reload the API schema.",
        503,
      );
    }
    throw insertResult.error;
  }
  return insertResult.data || null;
}

async function getAdminStoreBySlug(slug) {
  const store = await getStoreBySlug(slug, { activeOnly: false });
  if (!store) return null;

  const staff = await getStaffByStoreId(store.id, { activeOnly: false });
  let servicePack;
  try {
    servicePack = await listServiceItemsByStoreIdWithStatus(store.id);
  } catch (err) {
    if (err && err.code === "SERVICE_ITEMS_POSTGREST_NOT_VISIBLE") {
      servicePack = { items: [], tableMissing: false, postgrestNotVisible: true };
    } else {
      throw err;
    }
  }

  let privateFeedback = [];
  let privateFeedbackSchemaMissing = false;
  try {
    privateFeedback = await listStorePrivateFeedbackByStoreId(store.id, 200);
  } catch (err) {
    if (isStorePrivateFeedbackTableMissingError(err)) {
      privateFeedbackSchemaMissing = true;
      privateFeedback = [];
    } else {
      throw err;
    }
  }

  return {
    store: store,
    staff: staff,
    serviceItems: servicePack.items,
    serviceItemsSchemaMissing: !!servicePack.tableMissing,
    serviceItemsPostgrestNotVisible: !!servicePack.postgrestNotVisible,
    privateFeedback: privateFeedback,
    privateFeedbackSchemaMissing: !!privateFeedbackSchemaMissing,
  };
}

async function updateStoreIdentity(storeId, payload) {
  const nextValues = sanitizeStoreIdentity(payload);
  if (hasStoreActiveFlag(payload)) {
    nextValues.is_active = readStoreActiveFlag(payload, true);
  }
  const supabase = getSupabaseAdmin();
  const result = await supabase.from("stores").update(nextValues).eq("id", storeId).select("*").single();
  if (result.error) throw result.error;
  return mapStore(result.data);
}

async function createStoreForAdmin(payload) {
  const supabase = getSupabaseAdmin();
  const slug = validateStoreSlug(payload && payload.slug);
  await ensureStoreSlugAvailable(slug);

  const insertPayload = Object.assign(
    {
      slug: slug,
      review_keywords: normalizeReviewKeywords(payload && payload.reviewKeywords),
      // Default to active so new stores are reachable at /stores/:slug; admins can still uncheck "Active immediately".
      is_active: readStoreActiveFlag(payload, true),
    },
    sanitizeStoreIdentity(payload),
  );

  const result = await supabase.from("stores").insert(insertPayload).select("*").single();
  if (result.error) {
    if (/duplicate|unique/i.test(result.error.message || "")) {
      throw createAppError("STORE_SLUG_TAKEN", "That store slug is already in use", 409);
    }
    throw result.error;
  }
  return mapStore(result.data);
}

async function replaceStoreKeywords(storeId, reviewKeywords) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("stores")
    .update({
      review_keywords: normalizeReviewKeywords(reviewKeywords),
    })
    .eq("id", storeId)
    .select("*")
    .single();

  if (result.error) throw result.error;
  return mapStore(result.data);
}

async function replaceStoreStaff(storeId, staffItems) {
  const nextItems = (Array.isArray(staffItems) ? staffItems : [])
    .map(function (item, index) {
      return sanitizeStaffItem(item, index);
    })
    .filter(Boolean);
  assertUniqueStaffNames(nextItems);

  const supabase = getSupabaseAdmin();
  const existingResult = await supabase.from("store_staff").select("*").eq("store_id", storeId);
  if (existingResult.error) throw existingResult.error;

  const existingRows = existingResult.data || [];
  const existingById = new Map();
  const existingByName = new Map();
  existingRows.forEach(function (row) {
    existingById.set(row.id, row);
    existingByName.set(String(row.name || "").trim().toLowerCase(), row);
  });

  const seenIds = new Set();
  const finalRows = [];

  for (let index = 0; index < nextItems.length; index += 1) {
    const item = nextItems[index];
    const payload = {
      name: item.name,
      display_name: item.display_name,
      sort_order: index,
      is_active: item.is_active,
    };

    const matchedExistingRow = item.id && existingById.has(item.id)
      ? existingById.get(item.id)
      : existingByName.get(String(item.name || "").trim().toLowerCase());

    if (matchedExistingRow) {
      const updateResult = await supabase
        .from("store_staff")
        .update(payload)
        .eq("id", matchedExistingRow.id)
        .eq("store_id", storeId)
        .select("*")
        .single();

      if (updateResult.error) throw updateResult.error;
      seenIds.add(matchedExistingRow.id);
      finalRows.push(updateResult.data);
      continue;
    }

    const insertResult = await supabase
      .from("store_staff")
      .insert(
        Object.assign(
          {
            store_id: storeId,
          },
          payload,
        ),
      )
      .select("*")
      .single();

    if (insertResult.error) throw insertResult.error;
    seenIds.add(insertResult.data.id);
    finalRows.push(insertResult.data);
  }

  for (let index = 0; index < existingRows.length; index += 1) {
    const row = existingRows[index];
    if (seenIds.has(row.id)) continue;

    if (row.is_active) {
      const deactivateResult = await supabase
        .from("store_staff")
        .update({
          is_active: false,
        })
        .eq("id", row.id)
        .eq("store_id", storeId)
        .select("*")
        .single();

      if (deactivateResult.error) throw deactivateResult.error;
      finalRows.push(deactivateResult.data);
      continue;
    }

    finalRows.push(row);
  }

  return finalRows
    .map(mapStaff)
    .filter(Boolean)
    .sort(function (left, right) {
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
      return left.displayName.localeCompare(right.displayName);
    });
}

function isAdminPortalMenuSource(sourceType) {
  const st = String(sourceType || "")
    .trim()
    .toLowerCase();
  return st === "admin_portal" || st === "admin_service_catalog";
}

function slugifyItemTypeKey(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return raw || "service";
}

function mapServiceItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    dishUqid: Number(row.dish_uqid),
    name: row.name,
    itemType: row.item_type || "",
    price: row.price != null ? Number(row.price) : 0,
    description: row.description || "",
    isActive: !!row.is_active,
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

let warnedStoreServiceItemsTableMissing = false;
let warnedStoreServiceItemsPostgrestNotVisible = false;

function isPostgrestStoreServiceItemsNotVisibleError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  const raw = String(error.message || error.details || error.hint || "");
  const msg = raw.toLowerCase();
  if (msg.indexOf("store_service_items") < 0) return false;
  if (code === "PGRST205") return true;
  if (msg.indexOf("schema cache") >= 0) return true;
  return false;
}

function throwIfPostgrestStoreServiceItemsNotVisible(error) {
  if (!isPostgrestStoreServiceItemsNotVisibleError(error)) return;
  if (!warnedStoreServiceItemsPostgrestNotVisible) {
    warnedStoreServiceItemsPostgrestNotVisible = true;
    console.warn(
      "[store-repo] store_service_items is not visible to PostgREST (PGRST205 / schema cache). Reload schema under Project Settings → API, or run sql/007 if the table was never created.",
    );
  }
  throw createAppError(
    "SERVICE_ITEMS_POSTGREST_NOT_VISIBLE",
    "PostgREST cannot expose public.store_service_items yet (often right after DDL). In Supabase: Project Settings → API → Reload schema cache. If this is a new database and the table was never created, run sql/007_store_service_items.sql in SQL Editor (fresh projects also need public.stores and public.set_updated_at() from sql/001_schema.sql). [SERVICE_ITEMS_POSTGREST_NOT_VISIBLE]",
    503,
  );
}

function isMissingStoreServiceItemsTableError(error) {
  if (!error || typeof error !== "object") return false;
  if (isPostgrestStoreServiceItemsNotVisibleError(error)) return false;
  const code = String(error.code || "");
  const raw = String(error.message || error.details || "");
  const msg = raw.toLowerCase();
  if (msg.indexOf("store_service_items") < 0) return false;
  if (/\bcolumn\s+"[^"]+"\s+of\s+relation\s+"[^"]*store_service_items/i.test(raw)) {
    return false;
  }
  if (msg.indexOf("permission denied") >= 0) {
    return false;
  }
  if (msg.indexOf("row-level security") >= 0 || msg.indexOf("rls") >= 0) {
    return false;
  }
  if (code === "42P01") return true;
  if (
    /relation\s+["']?public\.store_service_items["']?\s+does\s+not\s+exist/i.test(raw) ||
    /relation\s+["']?store_service_items["']?\s+does\s+not\s+exist/i.test(raw)
  ) {
    return true;
  }
  if (msg.indexOf("does not exist") >= 0) {
    return (
      /relation\s+["']?public\.store_service_items["']?\s+does\s+not\s+exist/i.test(raw) ||
      /relation\s+["']?store_service_items["']?\s+does\s+not\s+exist/i.test(raw)
    );
  }
  return false;
}

function throwIfMissingStoreServiceItemsTable(error) {
  if (isMissingStoreServiceItemsTableError(error)) {
    throw createAppError(
      "SERVICE_ITEMS_TABLE_MISSING",
      "The public.store_service_items table is missing in Postgres. In Supabase SQL Editor, run sql/007_store_service_items.sql from this repository (requires public.stores and public.set_updated_at() from sql/001_schema.sql if this is a new project). [SERVICE_ITEMS_TABLE_MISSING]",
      503,
    );
  }
}

function formatSupabaseUserMessage(error) {
  if (!error || typeof error !== "object") return "";
  const parts = [error.message, error.details, error.hint].filter(function (p) {
    return p && String(p).trim();
  });
  return parts.join(" — ");
}

function throwStoreServiceItemsWriteError(phase, error) {
  throwIfPostgrestStoreServiceItemsNotVisible(error);
  throwIfMissingStoreServiceItemsTable(error);
  const raw = String((error && (error.message || error.details)) || "").toLowerCase();
  if (
    raw.indexOf("row-level security") >= 0 ||
    raw.indexOf("violates row-level security") >= 0 ||
    raw.indexOf("new row violates") >= 0 ||
    String(error && error.code) === "42501"
  ) {
    throw createAppError(
      "SERVICE_ITEMS_RLS_DENIED",
      phase +
        " store_service_items was blocked (RLS or permissions). Confirm Vercel uses SUPABASE_SERVICE_ROLE_KEY (service_role secret), not the anon key. If the table has RLS enabled, run sql/011_store_service_items_rls_service_role.sql in Supabase SQL Editor.",
      403,
    );
  }
  const detail = formatSupabaseUserMessage(error) || "Unknown database error";
  const pg = String(error.code || "");
  const message =
    pg === "23505"
      ? "Duplicate dish id for this store (unique store_id + dish_uqid). " + detail
      : phase + " store_service_items failed: " + detail;
  throw createAppError("SERVICE_ITEMS_WRITE_FAILED", message, pg === "23505" ? 409 : 500);
}

async function listServiceItemsByStoreIdWithStatus(storeId) {
  const supabase = getSupabaseAdmin();
  const result = await supabase
    .from("store_service_items")
    .select("*")
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true })
    .order("dish_uqid", { ascending: true });

  if (result.error) {
    throwIfPostgrestStoreServiceItemsNotVisible(result.error);
    if (isMissingStoreServiceItemsTableError(result.error)) {
      if (!warnedStoreServiceItemsTableMissing) {
        warnedStoreServiceItemsTableMissing = true;
        console.warn(
          "[store-repo] store_service_items table is missing; returning empty service list until sql/007_store_service_items.sql is applied.",
        );
      }
      return { items: [], tableMissing: true, postgrestNotVisible: false };
    }
    throw result.error;
  }
  return {
    items: (result.data || []).map(mapServiceItem).filter(Boolean),
    tableMissing: false,
    postgrestNotVisible: false,
  };
}

async function listServiceItemsByStoreId(storeId) {
  const pack = await listServiceItemsByStoreIdWithStatus(storeId);
  return pack.items;
}

async function assertCanPublishPortalServiceCatalog(storeId, incomingNamedRowCount) {
  const incoming = Number(incomingNamedRowCount) || 0;
  const [published, existingPack] = await Promise.all([
    getPublishedMenuSnapshotByStoreId(storeId),
    listServiceItemsByStoreIdWithStatus(storeId),
  ]);
  const existingItems = existingPack.items;

  if (!published) {
    return;
  }
  if (isAdminPortalMenuSource(published.sourceType)) {
    return;
  }
  // First portal save: DB rows are still empty while the admin posts a new catalog — allow takeover.
  if (incoming > 0) {
    return;
  }
  if (Array.isArray(existingItems) && existingItems.length > 0) {
    return;
  }

  throw createAppError(
    "MENU_SOURCE_READONLY",
    "This store already has a published menu from another source. Add at least one named service line here and save to replace it, or clear all rows to unpublish.",
    409,
  );
}

function sanitizeServiceItemPayload(item) {
  const source = item && typeof item === "object" ? item : {};
  const name = String(source.name || "").trim();
  const itemType = String(source.itemType || source.item_type || "").trim();
  const description = String(source.description || "").trim();
  const priceRaw = source.price != null ? Number(source.price) : NaN;
  const price = Number.isFinite(priceRaw) && priceRaw >= 0 ? Math.round(priceRaw * 100) / 100 : 0;
  const dishUqidRaw = source.dishUqid != null ? Number(source.dishUqid) : source.dish_uqid != null ? Number(source.dish_uqid) : NaN;
  const dishUqid = Number.isFinite(dishUqidRaw) && dishUqidRaw > 0 ? dishUqidRaw : 0;

  return {
    name: name,
    itemType: itemType,
    price: price,
    description: description,
    is_active: source.isActive !== false && source.is_active !== false,
    dishUqid: dishUqid,
  };
}

function buildMenuJsonFromPortalServiceItems(items) {
  const categoryName = "Services";
  const dishes = (items || [])
    .filter(function (item) {
      return item && item.isActive !== false && String(item.name || "").trim();
    })
    .sort(function (a, b) {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return (a.dishUqid || 0) - (b.dishUqid || 0);
    })
    .map(function (item) {
      const typeKey = slugifyItemTypeKey(item.itemType);
      const uqid = Number(item.dishUqid);
      const name = String(item.name || "").trim();
      return {
        uqid: uqid,
        n: name,
        zh: name,
        en: name,
        id: uqid,
        pp: Number(item.price) || 0,
        ingr: item.description || "",
        aliases: [],
        dish_type: typeKey,
        dish_subtype: typeKey,
      };
    });

  const inner = {
    message: "service catalog",
    format: {
      uqid: 0,
      n: "",
      zh: "",
      id: "",
      pp: 0,
      ingr: "service details",
    },
  };
  inner[categoryName] = dishes;

  return {
    results: [
      {
        toolCallId: "admin-service-catalog",
        result: inner,
      },
    ],
  };
}

async function unpublishAllPublishedMenuSnapshotsForStore(storeId) {
  const supabase = getSupabaseAdmin();
  const unpublishResult = await supabase
    .from("store_menu_snapshots")
    .update({
      is_published: false,
      published_at: null,
    })
    .eq("store_id", storeId)
    .eq("is_published", true);

  if (unpublishResult.error) {
    throw unpublishResult.error;
  }
}

async function publishPublishedMenuSnapshotFromPortalServices(storeId) {
  const items = await listServiceItemsByStoreId(storeId);
  const activeCatalog = items.filter(function (item) {
    return item.isActive && String(item.name || "").trim();
  });
  if (activeCatalog.length === 0) {
    throw createAppError("INVALID_SERVICE_ITEMS", "At least one active service item with a name is required.", 400);
  }

  const supabase = getSupabaseAdmin();
  const menuJson = buildMenuJsonFromPortalServiceItems(activeCatalog);

  await unpublishAllPublishedMenuSnapshotsForStore(storeId);

  const versionResult = await supabase
    .from("store_menu_snapshots")
    .select("version")
    .eq("store_id", storeId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionResult.error) {
    throw versionResult.error;
  }

  const nextVersion = versionResult.data && versionResult.data.version ? Number(versionResult.data.version) + 1 : 1;

  const insertResult = await supabase
    .from("store_menu_snapshots")
    .insert({
      store_id: storeId,
      version: nextVersion,
      menu_json: menuJson,
      source_type: "admin_portal",
      source_note: "Published from RankMyRestaurant admin service catalog",
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .select("id, version")
    .single();

  if (insertResult.error) {
    throw insertResult.error;
  }
}

async function replaceStoreServiceItems(storeId, rawItems) {
  const raw = Array.isArray(rawItems) ? rawItems : [];
  const nextItems = raw
    .map(function (item) {
      return sanitizeServiceItemPayload(item);
    })
    .filter(function (item) {
      return !!item.name;
    });

  const hadRowsWithDataButNoName = raw.some(function (row) {
    const s = sanitizeServiceItemPayload(row);
    return (
      !s.name &&
      !!(
        String(s.itemType || "").trim() ||
        String(s.description || "").trim() ||
        s.price > 0 ||
        s.dishUqid > 0
      )
    );
  });
  if (hadRowsWithDataButNoName) {
    throw createAppError(
      "SERVICE_ITEMS_NAME_REQUIRED",
      "Item name is required for each row that has a price, description, type, or dish id. Fill in names or clear those fields before saving.",
      400,
    );
  }

  await assertCanPublishPortalServiceCatalog(storeId, nextItems.length);

  const supabase = getSupabaseAdmin();
  const deleteResult = await supabase.from("store_service_items").delete().eq("store_id", storeId);
  if (deleteResult.error) {
    throwStoreServiceItemsWriteError("Delete", deleteResult.error);
  }

  if (!nextItems.length) {
    await unpublishAllPublishedMenuSnapshotsForStore(storeId);
    return listServiceItemsByStoreId(storeId);
  }

  let nextUqid = Math.max(
    0,
    ...nextItems.map(function (item) {
      return Number(item.dishUqid) || 0;
    }),
  );

  const usedUqids = new Set();
  const insertRows = nextItems.map(function (item, index) {
    let dishUqid = Number(item.dishUqid) || 0;
    if (dishUqid < 1) {
      nextUqid += 1;
      dishUqid = nextUqid;
    } else {
      nextUqid = Math.max(nextUqid, dishUqid);
    }
    while (usedUqids.has(dishUqid)) {
      nextUqid += 1;
      dishUqid = nextUqid;
    }
    usedUqids.add(dishUqid);
    return {
      store_id: storeId,
      dish_uqid: dishUqid,
      name: item.name,
      item_type: item.itemType,
      price: item.price,
      description: item.description,
      sort_order: index,
      is_active: item.is_active,
    };
  });

  const insertResult = await supabase.from("store_service_items").insert(insertRows).select("*");
  if (insertResult.error) {
    throwStoreServiceItemsWriteError("Insert", insertResult.error);
  }

  const shouldPublishSnapshot = nextItems.some(function (item) {
    return item.is_active && String(item.name || "").trim();
  });
  if (!shouldPublishSnapshot) {
    await unpublishAllPublishedMenuSnapshotsForStore(storeId);
    return listServiceItemsByStoreId(storeId);
  }

  try {
    await publishPublishedMenuSnapshotFromPortalServices(storeId);
  } catch (publishError) {
    const inner =
      publishError && publishError.message
        ? publishError.message
        : formatSupabaseUserMessage(publishError) || String(publishError || "");
    const status = Number(publishError && publishError.status) || 500;
    throw createAppError(
      "SERVICE_MENU_PUBLISH_FAILED",
      "Service rows were saved, but publishing the live menu snapshot failed: " + inner,
      status >= 400 && status < 600 ? status : 502,
    );
  }
  return listServiceItemsByStoreId(storeId);
}

async function createAuditLog(payload) {
  const supabase = getSupabaseAdmin();
  const insertResult = await supabase.from("audit_logs").insert({
    actor_user_id: payload.actorUserId || null,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    action: payload.action,
    before_json: payload.beforeJson || null,
    after_json: payload.afterJson || null,
    metadata: payload.metadata || {},
  });

  if (insertResult.error) {
    console.warn("Failed to create audit log", insertResult.error);
  }
}

module.exports = {
  createAuditLog,
  createScanEvent,
  createStoreForAdmin,
  getActiveStoreBySlug,
  getAdminStoreBySlug,
  getStoreBootstrap,
  insertStorePrivateFeedback,
  listStoresForAdmin,
  replaceStoreKeywords,
  replaceStoreServiceItems,
  replaceStoreStaff,
  updateStoreIdentity,
};
