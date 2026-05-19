const { getServerEnv } = require("../../lib/server/env");
const { createAppError } = require("../../lib/server/shared");
const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../../lib/server/http");

// Server-side cart creation keeps the storefront token out of browser code.
const SHOPIFY_CART_CREATE_MUTATION = [
  "mutation CreateRankMySalonCart($input: CartInput) {",
  "  cartCreate(input: $input) {",
  "    cart {",
  "      id",
  "      checkoutUrl",
  "    }",
  "    userErrors {",
  "      field",
  "      message",
  "    }",
  "    warnings {",
  "      message",
  "    }",
  "  }",
  "}",
].join("\n");

function readRequiredString(body, key) {
  const value = body && body[key] != null ? String(body[key]).trim() : "";
  if (!value) {
    throw createAppError("INVALID_REQUEST", "Missing required field: " + key, 400);
  }
  return value;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const body = await readJsonBody(req);
    const domain = readRequiredString(body, "domain")
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");
    const storefrontApiVersion = readRequiredString(body, "storefrontApiVersion");
    const setupVariantId = readRequiredString(body, "setupVariantId");
    const monthlyVariantId = readRequiredString(body, "monthlyVariantId");
    const monthlySellingPlanId = readRequiredString(body, "monthlySellingPlanId");

    const env = getServerEnv();
    const storefrontAccessToken = String(env.shopifyStorefrontAccessToken || "").trim();
    if (!storefrontAccessToken) {
      throw createAppError(
        "SHOPIFY_CONFIG_MISSING",
        "Shopify token is not configured on server. Set SHOPIFY_STOREFRONT_ACCESS_TOKEN.",
        500,
      );
    }

    // Caller provides catalog identifiers; secret auth header is injected server-side only.
    const response = await fetch("https://" + domain + "/api/" + storefrontApiVersion + "/graphql.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontAccessToken,
      },
      body: JSON.stringify({
        query: SHOPIFY_CART_CREATE_MUTATION,
        variables: {
          input: {
            lines: [
              {
                merchandiseId: setupVariantId,
                quantity: 1,
              },
              {
                merchandiseId: monthlyVariantId,
                quantity: 1,
                sellingPlanId: monthlySellingPlanId,
              },
            ],
          },
        },
      }),
    });

    if (!response.ok) {
      throw createAppError("SHOPIFY_REQUEST_FAILED", "Shopify cart request failed with status " + response.status + ".", 502);
    }

    const payload = await response.json();
    if (payload.errors && payload.errors.length) {
      throw createAppError(
        "SHOPIFY_GRAPHQL_ERROR",
        payload.errors
          .map(function (error) {
            return error.message;
          })
          .join(" "),
        502,
      );
    }

    const cartCreatePayload = payload.data && payload.data.cartCreate;
    if (!cartCreatePayload) {
      throw createAppError("SHOPIFY_INVALID_RESPONSE", "Shopify cart response was missing.", 502);
    }

    if (cartCreatePayload.userErrors && cartCreatePayload.userErrors.length) {
      throw createAppError(
        "SHOPIFY_USER_ERROR",
        cartCreatePayload.userErrors
          .map(function (error) {
            return error.message;
          })
          .join(" "),
        400,
      );
    }

    if (cartCreatePayload.warnings && cartCreatePayload.warnings.length) {
      console.warn("Shopify cart warnings:", cartCreatePayload.warnings);
    }

    if (!cartCreatePayload.cart || !cartCreatePayload.cart.checkoutUrl) {
      throw createAppError("SHOPIFY_INVALID_RESPONSE", "Shopify cart checkout URL was missing.", 502);
    }

    return sendJson(res, 200, {
      checkoutUrl: cartCreatePayload.cart.checkoutUrl,
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
