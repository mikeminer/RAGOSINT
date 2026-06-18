import type { CollectResult } from "@/lib/types";

export async function sendSlackDigest(result: CollectResult, webhookUrl = process.env.SLACK_WEBHOOK_URL) {
  if (!webhookUrl) {
    return { ok: false, skipped: true, reason: "SLACK_WEBHOOK_URL non configurato" };
  }

  const topAlerts = result.alerts.slice(0, 8);
  const text = [
    `RAGOSINT ${result.channel}: ${result.stats.totalAlerts} alert da ${result.stats.activeSources} fonti`,
    ...topAlerts.map((alert) => `- [${alert.channel}] ${alert.title} (${alert.sourceName}) ${alert.url}`),
  ].join("\n");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  return {
    ok: response.ok,
    status: response.status,
    skipped: false,
  };
}
