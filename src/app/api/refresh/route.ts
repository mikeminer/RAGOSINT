import { collectAlerts } from "@/lib/osint";
import { sendSlackDigest } from "@/lib/slack";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

export async function GET(request: Request) {
  return refresh(request);
}

export async function POST(request: Request) {
  return refresh(request);
}

async function refresh(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const querySecret = url.searchParams.get("secret");

  if (secret && authHeader !== `Bearer ${secret}` && querySecret !== secret) {
    return Response.json({ ok: false, error: "Unauthorized refresh" }, { status: 401 });
  }

  const [all, bandi, normativa] = await Promise.all([
    collectAlerts({ channel: "all", limit: 260 }),
    collectAlerts({ channel: "bandi", limit: 220 }),
    collectAlerts({ channel: "normativa", limit: 100 }),
  ]);
  const shouldNotifySlack = url.searchParams.get("notify") === "slack" || process.env.SLACK_NOTIFY_ON_REFRESH === "true";
  const slack = shouldNotifySlack ? await sendSlackDigest(all) : { ok: false, skipped: true, reason: "Slack non richiesto" };

  return Response.json({
    ok: true,
    refreshedAt: all.generatedAt,
    slack,
    channels: {
      all: { alerts: all.stats.totalAlerts, sources: all.stats.activeSources, errors: all.errors },
      bandi: { alerts: bandi.stats.totalAlerts, sources: bandi.stats.activeSources, errors: bandi.errors },
      normativa: { alerts: normativa.stats.totalAlerts, sources: normativa.stats.activeSources, errors: normativa.errors },
    },
    topTags: all.stats.topTags,
  });
}
