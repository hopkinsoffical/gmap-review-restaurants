const { ensureLocalEnvLoaded } = require("./env");

async function postSalesAlert(payload) {
  ensureLocalEnvLoaded();
  const url = String(process.env.SALES_ALERT_WEBHOOK_URL || "").trim();
  if (!url) return { skipped: true };

  const secret = String(process.env.SALES_ALERT_WEBHOOK_SECRET || "").trim();
  const headers = { "Content-Type": "application/json" };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(
      Object.assign(
        {
          source: "sms_funnel",
          ts: new Date().toISOString(),
        },
        payload,
      ),
    ),
  });
  if (!res.ok) {
    const t = await res.text().catch(function () {
      return "";
    });
    return { ok: false, status: res.status, body: t.slice(0, 500) };
  }
  return { ok: true };
}

module.exports = {
  postSalesAlert,
};
