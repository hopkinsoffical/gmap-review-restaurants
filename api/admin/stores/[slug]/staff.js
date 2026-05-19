const { requireAdmin } = require("../../../../lib/server/admin-guard");
const { createAppError } = require("../../../../lib/server/shared");
const { getSlugParam, handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../../../../lib/server/http");
const { createAuditLog, getAdminStoreBySlug, replaceStoreStaff } = require("../../../../lib/server/store-repo");

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
    const before = details.staff || [];
    const staff = await replaceStoreStaff(details.store.id, body && body.staff);

    await createAuditLog({
      actorUserId: session.profile.id,
      entityType: "store_staff",
      entityId: details.store.id,
      action: "admin.store.staff.updated",
      beforeJson: before,
      afterJson: staff,
      metadata: {
        slug: details.store.slug,
      },
    });

    return sendJson(res, 200, {
      staff: staff,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
