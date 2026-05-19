const { createAppError } = require("./shared");

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendError(res, status, code, message, details) {
  const payload = {
    error: {
      code: code,
      message: message,
    },
  };

  if (details) {
    payload.error.details = details;
  }

  sendJson(res, status, payload);
}

function methodNotAllowed(res, allowedMethods) {
  const methods = Array.isArray(allowedMethods) ? allowedMethods : [allowedMethods];
  res.setHeader("Allow", methods.join(", "));
  sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed");
}

function getSlugParam(req) {
  const raw = req && req.query ? req.query.slug : "";
  const fromQuery = Array.isArray(raw) ? String(raw[0] || "").trim() : String(raw || "").trim();
  if (fromQuery) {
    return fromQuery;
  }

  const url = req && req.url ? String(req.url) : "";
  if (!url) {
    return "";
  }
  let onlyPath = url.split("?")[0] || "";
  if (onlyPath.indexOf("://") >= 0) {
    try {
      onlyPath = new URL(onlyPath).pathname || "";
    } catch (e) {
      onlyPath = "";
    }
  } else if (onlyPath && onlyPath.charAt(0) !== "/") {
    onlyPath = "/" + onlyPath;
  }
  const adminMatch = onlyPath.match(/^\/api\/admin\/stores\/([^/?#]+)/);
  if (adminMatch) {
    return decodeURIComponent(adminMatch[1] || "").trim();
  }
  const storeMatch = onlyPath.match(/^\/api\/stores\/([^/?#]+)/);
  if (storeMatch) {
    return decodeURIComponent(storeMatch[1] || "").trim();
  }
  return "";
}

async function readRawBody(req) {
  if (!req || req.body == null) {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "object") return JSON.stringify(req.body);
  return String(req.body || "");
}

async function readJsonBody(req) {
  if (req && req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  const raw = await readRawBody(req);
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw createAppError("INVALID_JSON", "Request body must be valid JSON", 400);
  }
}

/**
 * application/x-www-form-urlencoded (e.g. Twilio webhooks).
 */
async function readFormBody(req) {
  const raw = await readRawBody(req);
  const obj = Object.create(null);
  if (!raw) return obj;

  const params = new URLSearchParams(raw);
  params.forEach(function (value, key) {
    obj[key] = value;
  });
  return obj;
}

function handleApiError(res, error) {
  const status = Number(error && error.status) || 500;
  const code = String((error && error.code) || "INTERNAL_ERROR");
  const message = error && error.message ? error.message : "Unexpected server error";

  if (status >= 500) {
    console.error(error);
  }

  sendError(res, status, code, message);
}

module.exports = {
  getSlugParam,
  handleApiError,
  methodNotAllowed,
  readFormBody,
  readJsonBody,
  readRawBody,
  sendError,
  sendJson,
};
