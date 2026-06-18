import { collectAlerts, parseChannel } from "@/lib/osint";
import { sendSlackDigest } from "@/lib/slack";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return notifySlack(request);
}

export async function POST(request: Request) {
  return notifySlack(request);
}

async function notifySlack(request: Request) {
  const url = new URL(request.url);
  const channel = parseChannel(url.searchParams.get("channel"));
  const secret = process.env.SLACK_NOTIFY_SECRET;
  const authHeader = request.headers.get("authorization");
  const querySecret = url.searchParams.get("secret");

  if (secret && authHeader !== `Bearer ${secret}` && querySecret !== secret) {
    return Response.json({ ok: false, error: "Unauthorized Slack notification" }, { status: 401 });
  }

  const result = await collectAlerts({ channel, limit: 60 });
  const slack = await sendSlackDigest(result);

  return Response.json({
    ok: slack.ok,
    channel,
    generatedAt: result.generatedAt,
    alerts: result.stats.totalAlerts,
    slack,
  });
}
