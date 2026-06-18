import { buildRssFeed, collectAlerts } from "@/lib/osint";
import { buildObsidianVault, vaultFileName } from "@/lib/obsidian";
import type { ChannelFilter } from "@/lib/types";
import { createZip } from "@/lib/zip";

export async function rssResponse(channel: ChannelFilter = "all") {
  const limit = channel === "all" ? 260 : channel === "normativa" ? 120 : 220;
  const result = await collectAlerts({ channel, limit });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ragosint.vercel.app";

  return new Response(buildRssFeed(result, siteUrl), {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}

export async function brainZipResponse(channel: ChannelFilter = "all") {
  const limit = channel === "all" ? 500 : 350;
  const result = await collectAlerts({ channel, limit });
  const files = buildObsidianVault(result);
  const zip = createZip(files);
  const filename = vaultFileName(channel);

  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
