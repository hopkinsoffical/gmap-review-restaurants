/**
 * PUT: save portal service catalog for one store (publish menu snapshot).
 * Routed from /api/admin/stores/:slug/services via vercel.json rewrite so the
 * handler always resolves (nested dynamic routes can 404 on some hosts).
 */
const { requireAdmin } = require("../lib/server/admin-guard");
const { createAppError } = require("../lib/server/shared");
const { getSlugParam, handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/server/http");
const { createAuditLog, getAdminStoreBySlug, replaceStoreServiceItems } = require("../lib/server/store-repo");

module.exports = async function handler(req, res) {
  if (req.method !== "PUT") {
    return methodNotAllowed(res, ["PUT"]);
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

    const body = await readJsonBody(req);
    const before = details.serviceItems || [];
    const serviceItems = await replaceStoreServiceItems(details.store.id, body && body.serviceItems);

    await createAuditLog({
      actorUserId: session.profile.id,
      entityType: "store_service_items",
      entityId: details.store.id,
      action: "admin.store.services.updated",
      beforeJson: before,
      afterJson: serviceItems,
      metadata: {
        slug: details.store.slug,
      },
    });

    return sendJson(res, 200, {
      serviceItems: serviceItems,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
