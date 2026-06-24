const { createAppError } = require("../lib/server/shared");
const { generateReviewsForStore } = require("../lib/server/reviews");
const { getSlugParam, handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/server/http");
const { recognizeStoreUpload } = require("../lib/server/recognize");
const { createScanEvent, getStoreBootstrap, resolveStoreMenuPack } = require("../lib/server/store-repo");

function queryOp(req) {
  const raw = req && req.query ? req.query.op : "";
  const v = Array.isArray(raw) ? raw[0] : raw;
  return String(v || "").trim();
}

function buildBootstrapMenuPayload(menuPack) {
  if (!menuPack || !menuPack.menuJson) return { menuSnapshotPayload: null, fallbackMenu: null };
  if (menuPack.catalogStatus === "published") {
    return {
      menuSnapshotPayload: {
        menu: menuPack.menuJson,
      },
      fallbackMenu: null,
    };
  }
  return {
    menuSnapshotPayload: null,
    fallbackMenu: menuPack.menuJson,
  };
}

module.exports = async function handler(req, res) {
  const op = queryOp(req);
  if (op === "bootstrap") {
    if (req.method !== "GET") {
      return methodNotAllowed(res, ["GET"]);
    }
    try {
      const slug = getSlugParam(req);
      if (!slug) {
        throw createAppError("INVALID_SLUG", "Store slug is required", 400);
      }

      const bootstrap = await getStoreBootstrap(slug);
      if (!bootstrap || !bootstrap.store) {
        throw createAppError("STORE_NOT_FOUND", "Store not found or inactive", 404);
      }

      const menuPack = await resolveStoreMenuPack(bootstrap);
      if (!menuPack || !menuPack.menuJson) {
        throw createAppError(
          "MENU_SNAPSHOT_NOT_FOUND",
          "No published menu, service catalog, or bundled fallback menu could be loaded.",
          503,
        );
      }

      const published = bootstrap.menuSnapshot;
      const menuParts = buildBootstrapMenuPayload(menuPack);
      const menuSnapshotPayload =
        menuPack.catalogStatus === "published" && published
          ? {
              id: published.id,
              version: published.version,
              publishedAt: published.publishedAt,
              menu: menuPack.menuJson,
            }
          : menuParts.menuSnapshotPayload;

      return sendJson(res, 200, {
        store: bootstrap.store,
        staff: bootstrap.staff || [],
        menuSnapshot: menuSnapshotPayload,
        fallbackMenu: menuParts.fallbackMenu,
        catalogStatus: menuPack.catalogStatus,
        serviceSpotlight: bootstrap.serviceSpotlight || null,
        features: {
          receiptRecognition: true,
          dishPhotoRecognition: false,
          reviewGeneration: true,
          servicePraise: true,
        },
      });
    } catch (error) {
      return handleApiError(res, error);
    }
  }

  if (op === "recognize") {
    if (req.method !== "POST") {
      return methodNotAllowed(res, ["POST"]);
    }
    try {
      const slug = getSlugParam(req);
      if (!slug) {
        throw createAppError("INVALID_SLUG", "Store slug is required", 400);
      }

      const bootstrap = await getStoreBootstrap(slug);
      if (!bootstrap || !bootstrap.store) {
        throw createAppError("STORE_NOT_FOUND", "Store not found or inactive", 404);
      }

      const menuPack = await resolveStoreMenuPack(bootstrap);
      if (!menuPack || !menuPack.menuJson) {
        throw createAppError(
          "MENU_SNAPSHOT_NOT_FOUND",
          "No published menu, service catalog, or bundled fallback menu could be loaded.",
          503,
        );
      }

      const body = await readJsonBody(req);
      const imageDataUrl = String((body && body.imageDataUrl) || "").trim();
      if (!imageDataUrl) {
        throw createAppError("INVALID_IMAGE_PAYLOAD", "imageDataUrl is required", 400);
      }

      const result = await recognizeStoreUpload({
        store: bootstrap.store,
        menuJson: menuPack.menuJson,
        imageDataUrl: imageDataUrl,
      });

      await createScanEvent({
        storeId: bootstrap.store.id,
        menuSnapshotId: menuPack.menuSnapshotId,
        imageKind: result.imageAnalysis && result.imageAnalysis.image_kind,
        recognitionMode: result.recognitionMeta && result.recognitionMeta.mode,
        recognizedDishIds: result.recognizedDishIds,
        success: true,
      });

      return sendJson(res, 200, result);
    } catch (error) {
      return handleApiError(res, error);
    }
  }

  if (op === "reviews") {
    if (req.method !== "POST") {
      return methodNotAllowed(res, ["POST"]);
    }
    try {
      const slug = getSlugParam(req);
      if (!slug) {
        throw createAppError("INVALID_SLUG", "Store slug is required", 400);
      }

      const bootstrap = await getStoreBootstrap(slug);
      if (!bootstrap || !bootstrap.store) {
        throw createAppError("STORE_NOT_FOUND", "Store not found or inactive", 404);
      }

      const menuPack = await resolveStoreMenuPack(bootstrap);
      if (!menuPack || !menuPack.menuJson) {
        throw createAppError(
          "MENU_SNAPSHOT_NOT_FOUND",
          "No published menu, service catalog, or bundled fallback menu could be loaded.",
          503,
        );
      }

      const body = await readJsonBody(req);
      const reviews = await generateReviewsForStore({
        store: bootstrap.store,
        menuJson: menuPack.menuJson,
        dishIds: body.dishIds || [],
        lang: body.lang || "zh",
        recentTexts: body.recentTexts || [],
        visitTier: body.visitTier || "",
        servicePraise: body.servicePraise || null,
      });

      return sendJson(res, 200, {
        reviews: reviews,
      });
    } catch (error) {
      return handleApiError(res, error);
    }
  }

  return handleApiError(res, createAppError("INVALID_OP", "Unknown store operation", 404));
};
