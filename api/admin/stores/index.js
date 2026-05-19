const { requireAdmin } = require("../../../lib/server/admin-guard");
const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../../../lib/server/http");
const { createAuditLog, createStoreForAdmin, listStoresForAdmin } = require("../../../lib/server/store-repo");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  try {
    const session = await requireAdmin(req);

    if (req.method === "GET") {
      const stores = await listStoresForAdmin();
      return sendJson(res, 200, {
        stores: stores,
      });
    }

    const body = await readJsonBody(req);
    const store = await createStoreForAdmin(body);
    await createAuditLog({
      actorUserId: session.profile.id,
      entityType: "store",
      entityId: store.id,
      action: "admin.store.created",
      afterJson: store,
      metadata: {
        slug: store.slug,
      },
    });

    return sendJson(res, 201, {
      store: store,
      staff: [],
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
