import { collectAlerts, parseChannel, searchAlerts } from "@/lib/osint";

export const revalidate = 1800;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const channel = parseChannel(url.searchParams.get("channel"));
  const result = await collectAlerts({ channel, limit: 180 });
  const matches = searchAlerts(result.alerts, q, 30);

  return Response.json({
    query: q,
    channel,
    generatedAt: result.generatedAt,
    count: matches.length,
    matches,
  });
}
