import { collectAlerts, parseChannel } from "@/lib/osint";

export const revalidate = 1800;

export async function GET(request: Request) {
  const channel = parseChannel(new URL(request.url).searchParams.get("channel"));
  const result = await collectAlerts({ channel, limit: 120 });

  return Response.json(result, {
    headers: {
      "cache-control": "s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
