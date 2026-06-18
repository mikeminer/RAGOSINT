import { collectAlerts } from "@/lib/osint";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return refresh(request);
}

export async function POST(request: Request) {
  return refresh(request);
}

async function refresh(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const querySecret = new URL(request.url).searchParams.get("secret");

  if (secret && authHeader !== `Bearer ${secret}` && querySecret !== secret) {
    return Response.json({ ok: false, error: "Unauthorized refresh" }, { status: 401 });
  }

  const [all, bandi, normativa] = await Promise.all([
    collectAlerts({ channel: "all", limit: 160 }),
    collectAlerts({ channel: "bandi", limit: 100 }),
    collectAlerts({ channel: "normativa", limit: 100 }),
  ]);

  return Response.json({
    ok: true,
    refreshedAt: all.generatedAt,
    channels: {
      all: { alerts: all.stats.totalAlerts, sources: all.stats.activeSources, errors: all.errors },
      bandi: { alerts: bandi.stats.totalAlerts, sources: bandi.stats.activeSources, errors: bandi.errors },
      normativa: { alerts: normativa.stats.totalAlerts, sources: normativa.stats.activeSources, errors: normativa.errors },
    },
    topTags: all.stats.topTags,
  });
}
