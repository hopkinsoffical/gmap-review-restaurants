const { requireAdmin } = require("../../../../lib/server/admin-guard");
const { createAppError } = require("../../../../lib/server/shared");
const { getSlugParam, handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../../../../lib/server/http");
const { createAuditLog, getAdminStoreBySlug, replaceStoreKeywords } = require("../../../../lib/server/store-repo");

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
    const before = details.store.reviewKeywords || [];
    const updatedStore = await replaceStoreKeywords(details.store.id, body && body.reviewKeywords);

    await createAuditLog({
      actorUserId: session.profile.id,
      entityType: "store_review_keywords",
      entityId: details.store.id,
      action: "admin.store.keywords.updated",
      beforeJson: before,
      afterJson: updatedStore.reviewKeywords,
      metadata: {
        slug: updatedStore.slug,
      },
    });

    return sendJson(res, 200, {
      reviewKeywords: updatedStore.reviewKeywords,
      store: updatedStore,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
