const { getServerEnv } = require("./env");
const { createAppError } = require("./shared");

async function callOpenAIChat(payload) {
  const env = getServerEnv();
  const requestBody = Object.assign({}, payload || {});
  const timeoutMs = Number(requestBody.timeout_ms);
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timeoutId = null;

  if (!env.openaiApiKey) {
    throw createAppError("ENV_MISSING", "Missing required environment variable: OPENAI_API_KEY", 500);
  }

  if (requestBody.model == null || requestBody.model === "") {
    requestBody.model = env.openaiModel;
  }

  Object.keys(requestBody).forEach(function (key) {
    if (requestBody[key] === undefined) {
      delete requestBody[key];
    }
  });
  delete requestBody.timeout_ms;

  try {
    if (controller && Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timeoutId = setTimeout(function () {
        controller.abort();
      }, timeoutMs);
    }

    const response = await fetch(env.openaiBaseUrl.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + env.openaiApiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller ? controller.signal : undefined,
    });

    const data = await response.json().catch(function () {
      return null;
    });

    if (!response.ok) {
      const apiMessage = data && data.error && data.error.message;
      throw createAppError(
        "OPENAI_REQUEST_FAILED",
        apiMessage || "OpenAI request failed with HTTP " + response.status,
        502,
      );
    }

    return data;
  } catch (error) {
    if (error && (error.name === "AbortError" || error.code === "ABORT_ERR")) {
      throw createAppError("OPENAI_TIMEOUT", "OpenAI request timed out", 502);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function parseChatCompletionJson(data) {
  const content =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;

  if (!content || typeof content !== "string") {
    throw createAppError("OPENAI_EMPTY_RESPONSE", "OpenAI returned an empty response", 502);
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw createAppError("OPENAI_INVALID_JSON", "OpenAI did not return valid JSON", 502);
  }
}

module.exports = {
  callOpenAIChat,
  parseChatCompletionJson,
};
