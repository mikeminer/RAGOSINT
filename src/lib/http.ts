import { buildRssFeed, collectAlerts } from "@/lib/osint";
import type { ChannelFilter } from "@/lib/types";

export async function rssResponse(channel: ChannelFilter = "all") {
  const result = await collectAlerts({ channel, limit: 120 });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rssmonitorbandi.vercel.app";

  return new Response(buildRssFeed(result, siteUrl), {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
