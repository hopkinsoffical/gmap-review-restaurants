const { getServerEnv } = require("./env");

/**
 * Generate a short follow-up SMS (English) after the user opens the report page.
 * Uses OpenAI when OPENAI_API_KEY is set; otherwise a compliant static template.
 */
async function generateNurtureSmsBody({ slug, salonName }) {
  const env = getServerEnv();
  const name = String(salonName || "").trim() || "there";
  const key = String(env.openaiApiKey || "").trim();
  if (!key) {
    return (
      `Hi ${name}, it's Ryan — hope the Google report for your salon was helpful. ` +
      `Any questions? Reply here. Follow us for tips: YouTube + IG @rankmysalon. ` +
      `Want hands-on growth? Ask me about RankMySalon services. Reply STOP to opt out.`
    );
  }

  const model = env.openaiModel || "gpt-4.1-mini";
  const base = (env.openaiBaseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const url = `${base}/chat/completions`;
  const system =
    "You write concise SMS under 320 characters, one paragraph, English. " +
    "Invite a quick reply if they have questions, mention YouTube and Instagram @rankmysalon for tips, " +
    "and softly invite them to purchase RankMySalon growth services. End with: Reply STOP to opt out.";
  const user = `Salon slug: ${slug}. Greeting name: ${name}.`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 220,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI nurture failed: ${res.status} ${raw.slice(0, 200)}`);
  }
  let text = "";
  try {
    const j = JSON.parse(raw);
    text = String(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "").trim();
  } catch (e) {
    throw new Error("OpenAI nurture: invalid JSON");
  }
  if (text.length > 480) text = text.slice(0, 477) + "...";
  if (text.toLowerCase().indexOf("stop") < 0) {
    text += " Reply STOP to opt out.";
  }
  return text;
}

module.exports = {
  generateNurtureSmsBody,
};
