import { collectAlerts, parseChannel } from "@/lib/osint";
import { semanticSearch } from "@/lib/vector";

export const revalidate = 1800;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const channel = parseChannel(url.searchParams.get("channel"));
  const limit = parseLimit(url.searchParams.get("limit"), 20, 60);
  const result = await collectAlerts({ channel, limit: 260 });
  const matches = q.trim() ? semanticSearch(result.alerts, q, channel, limit) : [];

  return Response.json({
    query: q,
    channel,
    generatedAt: result.generatedAt,
    count: matches.length,
    model: "ragosint-hash-embedding-v1",
    matches,
  });
}

function parseLimit(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}
