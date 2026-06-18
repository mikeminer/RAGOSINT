import { buildMarkdownReport, collectAlerts, parseChannel } from "@/lib/osint";

export const revalidate = 1800;

export async function GET(request: Request) {
  const channel = parseChannel(new URL(request.url).searchParams.get("channel"));
  const result = await collectAlerts({ channel, limit: channel === "normativa" ? 120 : 220 });

  return new Response(buildMarkdownReport(result), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
