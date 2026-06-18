import { collectAlerts, parseChannel } from "@/lib/osint";
import { buildVectorStore } from "@/lib/vector";

export const revalidate = 1800;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const channel = parseChannel(url.searchParams.get("channel"));
  const result = await collectAlerts({ channel, limit: 500 });
  const store = buildVectorStore(result.alerts);

  return Response.json(
    {
      channel,
      sourceGeneratedAt: result.generatedAt,
      ...store,
    },
    {
      headers: {
        "cache-control": "s-maxage=1800, stale-while-revalidate=3600",
      },
    },
  );
}
