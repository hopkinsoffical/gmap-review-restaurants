const { requireAdmin } = require("../../../lib/server/admin-guard");
const { createAppError } = require("../../../lib/server/shared");
const { getSlugParam, handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../../../lib/server/http");
const { createAuditLog, getAdminStoreBySlug, updateStoreIdentity } = require("../../../lib/server/store-repo");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "PATCH") {
    return methodNotAllowed(res, ["GET", "PATCH"]);
  }

  try {
    const session = await requireAdmin(req);
    const slug = getSlugParam(req);
    if (!slug) {
      throw createAppError("INVALID_SLUG", "Store slug is required", 400);
    }

    const details = await getAdminStoreBySlug(slug);
    if (!details || !details.store) {
      throw createAppError("STORE_NOT_FOUND", "Store not found", 404);
    }

    if (req.method === "GET") {
      return sendJson(res, 200, details);
    }

    const body = await readJsonBody(req);
    const before = details.store;
    const updatedStore = await updateStoreIdentity(details.store.id, body);
    await createAuditLog({
      actorUserId: session.profile.id,
      entityType: "store",
      entityId: details.store.id,
      action: "admin.store.identity.updated",
      beforeJson: before,
      afterJson: updatedStore,
      metadata: {
        slug: updatedStore.slug,
      },
    });

    const refreshed = await getAdminStoreBySlug(slug);
    return sendJson(res, 200, {
      store: updatedStore,
      staff: refreshed && refreshed.staff ? refreshed.staff : details.staff,
      serviceItems: refreshed && refreshed.serviceItems ? refreshed.serviceItems : [],
      serviceItemsSchemaMissing: !!(refreshed && refreshed.serviceItemsSchemaMissing),
      serviceItemsPostgrestNotVisible: !!(refreshed && refreshed.serviceItemsPostgrestNotVisible),
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
