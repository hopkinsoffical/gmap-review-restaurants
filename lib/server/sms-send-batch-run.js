const { getServerEnv } = require("./env");
const {
  cancelMessageOptOut,
  countSentTodayForCampaign,
  fetchQueuedBatch,
  loadLeadsOptOut,
  markMessagesSending,
  updateMessageSendFailed,
  updateMessageSent,
} = require("./sms-pipeline");
const { sendCampaignSms } = require("./twilio-sms");

function statusCallbackUrl() {
  const env = getServerEnv();
  const base = String(env.appBaseUrl || "").replace(/\/+$/, "");
  if (!base) return "";
  return base + "/api/twilio/status-callback";
}

/**
 * @param {Array<{ id: string, daily_send_limit: number, messaging_service_sid?: string | null }>} campaigns
 * @param {number} batchSize
 */
async function runSmsSendBatchCampaigns(campaigns, batchSize) {
  const callback = statusCallbackUrl();
  if (!callback) {
    console.error("[sms-send-batch-run] APP_BASE_URL is missing; Twilio status callbacks will not fire.");
  }

  let slots = batchSize;
  let sent = 0;
  let campaignsOverDailyLimit = 0;
  let skippedOptOut = 0;
  let errors = 0;
  const campaignsTouched = [];
  const detail = [];

  const list = Array.isArray(campaigns) ? campaigns : [];

  for (let c = 0; c < list.length && slots > 0; c += 1) {
    const campaign = list[c];
    const sentToday = await countSentTodayForCampaign(campaign.id);
    const room = campaign.daily_send_limit - sentToday;
    if (room <= 0) {
      campaignsOverDailyLimit += 1;
      detail.push({ campaignId: campaign.id, note: "daily_limit_reached" });
      continue;
    }

    const take = Math.min(room, slots);
    const queued = await fetchQueuedBatch(campaign.id, take);
    if (!queued.length) {
      continue;
    }

    campaignsTouched.push(campaign.id);
    await markMessagesSending(
      queued.map(function (m) {
        return m.id;
      }),
    );

    const optMap = await loadLeadsOptOut(
      queued.map(function (m) {
        return m.lead_id;
      }),
    );

    for (let i = 0; i < queued.length && slots > 0; i += 1) {
      const row = queued[i];
      if (optMap.get(row.lead_id)) {
        await cancelMessageOptOut(row.id);
        skippedOptOut += 1;
        slots -= 1;
        continue;
      }

      try {
        const msg = await sendCampaignSms({
          to: row.to_phone_e164,
          body: row.body,
          messagingServiceSid: campaign.messaging_service_sid || undefined,
          statusCallback: callback || undefined,
        });
        await updateMessageSent(row.id, msg.sid);
        sent += 1;
      } catch (e) {
        errors += 1;
        const code = e && e.code ? e.code : "";
        const message = e && e.message ? String(e.message) : String(e);
        console.error("[sms-send-batch-run] Twilio error:", code, message);
        await updateMessageSendFailed(row.id, code, message);
      }
      slots -= 1;
    }
  }

  return {
    sent: sent,
    campaignsOverDailyLimit: campaignsOverDailyLimit,
    skippedOptOut: skippedOptOut,
    errors: errors,
    campaignsTouched: campaignsTouched,
    detail: detail,
  };
}

module.exports = {
  runSmsSendBatchCampaigns,
  statusCallbackUrl,
};
