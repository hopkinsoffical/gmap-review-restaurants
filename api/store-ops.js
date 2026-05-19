const { createAppError } = require("../lib/server/shared");
const { getDefaultSalonMenuJsonSafe } = require("../lib/server/default-menu");
const { generateReviewsForStore } = require("../lib/server/reviews");
const { getSlugParam, handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/server/http");
const { recognizeStoreUpload } = require("../lib/server/recognize");
const { createScanEvent, getStoreBootstrap } = require("../lib/server/store-repo");

function queryOp(req) {
  const raw = req && req.query ? req.query.op : "";
  const v = Array.isArray(raw) ? raw[0] : raw;
  return String(v || "").trim();
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

      const published = bootstrap.menuSnapshot;
      const publishedMenu =
        published && published.menu && typeof published.menu === "object" ? published.menu : null;
      const menuSnapshotPayload =
        published && publishedMenu
          ? {
              id: published.id,
              version: published.version,
              publishedAt: published.publishedAt,
              menu: publishedMenu,
            }
          : null;
      const fallbackMenu = menuSnapshotPayload ? null : getDefaultSalonMenuJsonSafe();

      return sendJson(res, 200, {
        store: bootstrap.store,
        staff: bootstrap.staff || [],
        menuSnapshot: menuSnapshotPayload,
        fallbackMenu: fallbackMenu,
        catalogStatus: menuSnapshotPayload ? "published" : "default_seed",
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

      const menuJson =
        (bootstrap.menuSnapshot && bootstrap.menuSnapshot.menu) || getDefaultSalonMenuJsonSafe();
      if (!menuJson) {
        throw createAppError(
          "MENU_SNAPSHOT_NOT_FOUND",
          "No published service catalog and bundled menu.json could not be loaded.",
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
        menuJson: menuJson,
        imageDataUrl: imageDataUrl,
      });

      await createScanEvent({
        storeId: bootstrap.store.id,
        menuSnapshotId: (bootstrap.menuSnapshot && bootstrap.menuSnapshot.id) || null,
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

      const menuJson =
        (bootstrap.menuSnapshot && bootstrap.menuSnapshot.menu) || getDefaultSalonMenuJsonSafe();
      if (!menuJson) {
        throw createAppError(
          "MENU_SNAPSHOT_NOT_FOUND",
          "No published service catalog and bundled menu.json could not be loaded.",
          503,
        );
      }

      const body = await readJsonBody(req);
      const reviews = await generateReviewsForStore({
        store: bootstrap.store,
        menuJson: menuJson,
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
