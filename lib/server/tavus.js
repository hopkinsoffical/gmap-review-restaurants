const { ensureLocalEnvLoaded } = require("./env");
const { createAppError } = require("./shared");

const TAVUS_API_BASE = "https://tavusapi.com/v2";
const DEFAULT_REPLICA_ID = "rf4703150052";

function getTavusEnv() {
  ensureLocalEnvLoaded();

  const tavusApiKey = String(process.env.TAVUS_API_KEY || "").trim();
  const backendUrl = String(process.env.PIPECAT_BACKEND_URL || "").trim().replace(/\/+$/, "");

  if (!tavusApiKey) {
    throw createAppError("ENV_MISSING", "Missing required environment variable: TAVUS_API_KEY", 500);
  }

  return {
    tavusApiKey,
    backendUrl,
  };
}

async function callTavusApi(path, options) {
  const env = getTavusEnv();
  const response = await fetch(TAVUS_API_BASE + path, {
    method: (options && options.method) || "GET",
    headers: Object.assign(
      {
        "Content-Type": "application/json",
        "x-api-key": env.tavusApiKey,
      },
      (options && options.headers) || {},
    ),
    body: options && options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(function () {
    return {};
  });

  return {
    ok: response.ok,
    status: response.status,
    data,
    env,
  };
}

function buildPersonaPayload(body) {
  const env = getTavusEnv();
  if (!env.backendUrl) {
    throw createAppError("ENV_MISSING", "Missing required environment variable: PIPECAT_BACKEND_URL", 500);
  }

  return {
    persona_name: body && body.persona_name ? body.persona_name : "Ryan",
    system_prompt:
      body && body.system_prompt
        ? body.system_prompt
        : "You are Ryan, a professional voice consultant for VoiceForce. Help customers understand our solutions. Always refer to yourself as Ryan, never as AI Assistant.",
    context:
      body && body.context
        ? body.context
        : "Focus on understanding customer needs through thoughtful questions.",
    default_replica_id: DEFAULT_REPLICA_ID,
    layers: {
      llm: {
        base_url: env.backendUrl,
        model: "gpt-4o-mini",
        api_key: "not-required",
      },
    },
  };
}

function buildConversationPayload(body) {
  const personaId = String((body && body.persona_id) || "").trim();
  if (!personaId) {
    throw createAppError("INVALID_PERSONA_ID", "persona_id is required", 400);
  }
  const replicaId = String((body && body.replica_id) || "").trim();

  const payload = {
    persona_id: personaId,
    conversation_name: (body && body.conversation_name) || "Customer Consultation",
    properties: {
      enable_recording: false,
      enable_transcription: true,
      max_call_duration: 3600,
      participant_left_timeout: 30,
    },
  };
  if (replicaId) {
    payload.replica_id = replicaId;
  }
  return payload;
}

module.exports = {
  buildConversationPayload,
  buildPersonaPayload,
  callTavusApi,
  getTavusEnv,
};
