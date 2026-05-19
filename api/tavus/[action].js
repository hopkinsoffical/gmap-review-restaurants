const { handleApiError, methodNotAllowed, readJsonBody, sendJson } = require("../../lib/server/http");
const { buildConversationPayload, buildPersonaPayload, callTavusApi } = require("../../lib/server/tavus");

function getAction(req) {
  const raw = req && req.query ? req.query.action : "";
  return Array.isArray(raw) ? String(raw[0] || "").trim() : String(raw || "").trim();
}

module.exports = async function handler(req, res) {
  const action = getAction(req);

  try {
    if (action === "list-personas") {
      if (req.method !== "GET") {
        return methodNotAllowed(res, ["GET"]);
      }
      const result = await callTavusApi("/personas", { method: "GET" });
      return sendJson(res, result.status, result.data);
    }

    if (action === "create-persona") {
      if (req.method !== "POST") {
        return methodNotAllowed(res, ["POST"]);
      }
      const body = await readJsonBody(req);
      const payload = buildPersonaPayload(body);
      const result = await callTavusApi("/personas", {
        method: "POST",
        body: payload,
      });
      if (!result.ok) {
        return sendJson(res, result.status, {
          error: "Failed to create persona",
          details: result.data,
        });
      }
      return sendJson(res, 200, {
        success: true,
        persona_id: result.data.persona_id,
        persona_name: result.data.persona_name,
        default_replica_id: result.data.default_replica_id || result.data.replica_id || "",
        status: result.data.status,
      });
    }

    if (action === "create-conversation") {
      if (req.method !== "POST") {
        return methodNotAllowed(res, ["POST"]);
      }
      const body = await readJsonBody(req);
      const payload = buildConversationPayload(body);
      const result = await callTavusApi("/conversations", {
        method: "POST",
        body: payload,
      });
      if (!result.ok) {
        return sendJson(res, result.status, {
          error: "Failed to create conversation",
          details: result.data,
        });
      }
      return sendJson(res, 200, {
        success: true,
        conversation_id: result.data.conversation_id,
        conversation_url: result.data.conversation_url,
        status: result.data.status,
      });
    }

    return sendJson(res, 404, {
      error: {
        code: "NOT_FOUND",
        message: "Unknown Tavus action",
      },
    });
  } catch (error) {
    return handleApiError(res, error);
  }
};
