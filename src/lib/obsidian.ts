import { channelLabel } from "@/lib/osint";
import type { Alert, Channel, ChannelFilter, CollectResult, Source } from "@/lib/types";
import type { ZipTextFile } from "@/lib/zip";

type VaultOptions = {
  rootName?: string;
};

export function buildObsidianVault(result: CollectResult, options: VaultOptions = {}): ZipTextFile[] {
  const root = options.rootName ?? vaultRootName(result.channel);
  const generated = new Date(result.generatedAt).toISOString();
  const files: ZipTextFile[] = [];
  const alertsByChannel = groupAlertsByChannel(result.alerts);
  const tags = Array.from(new Set(result.alerts.flatMap((alert) => alert.tags))).sort();

  files.push(file(root, "README.md", readmeNote(result, generated)));
  files.push(file(root, "Dashboard.md", dashboardNote(result, generated)));
  files.push(file(root, "Canali/Bandi.md", channelNote("bandi", alertsByChannel.bandi)));
  files.push(file(root, "Canali/Normativa.md", channelNote("normativa", alertsByChannel.normativa)));
  files.push(file(root, "Fonti/_Index.md", sourcesIndex(result.sources)));
  files.push(file(root, "Tags/_Index.md", tagsIndex(tags)));
  files.push(...obsidianConfig(root));

  result.sources.forEach((source) => {
    files.push(file(root, `Fonti/${safeFileName(source.name)}.md`, sourceNote(source)));
  });

  tags.forEach((tag) => {
    files.push(file(root, `Tags/${safeFileName(tag)}.md`, tagNote(tag, result.alerts)));
  });

  result.alerts.forEach((alert) => {
    files.push(file(root, `${channelFolder(alert.channel)}/${alertFileName(alert)}.md`, alertNote(alert)));
  });

  return files;
}

export function vaultFileName(channel: ChannelFilter) {
  if (channel === "bandi") return "ragosint-bandi-obsidian.zip";
  if (channel === "normativa") return "ragosint-normativa-obsidian.zip";
  return "ragosint-obsidian-brain.zip";
}

function vaultRootName(channel: ChannelFilter) {
  if (channel === "bandi") return "RAGOSINT-Bandi";
  if (channel === "normativa") return "RAGOSINT-Normativa";
  return "RAGOSINT-Brain";
}

function file(root: string, path: string, content: string): ZipTextFile {
  return {
    path: `${root}/${path}`,
    content,
  };
}

function readmeNote(result: CollectResult, generated: string) {
  return [
    "---",
    "type: obsidian-vault-readme",
    "project: RAGOSINT",
    `channel: ${result.channel}`,
    `generated: ${generated}`,
    "---",
    "",
    "# RAGOSINT Obsidian Brain",
    "",
    "Apri questa cartella come vault in Obsidian per esplorare il grafo locale.",
    "",
    "## Punto di ingresso",
    "",
    "- [[Dashboard]]",
    "- [[Canali/Bandi|Bandi, gare e PNRR]]",
    "- [[Canali/Normativa|Normativa italiana]]",
    "- [[Fonti/_Index|Fonti]]",
    "- [[Tags/_Index|Tags]]",
    "",
    "## Flusso",
    "",
    "Fonti pubbliche -> Vercel -> normalizzazione -> note Markdown -> ZIP Obsidian -> grafo locale.",
  ].join("\n");
}

function dashboardNote(result: CollectResult, generated: string) {
  return [
    "---",
    "type: dashboard",
    "project: RAGOSINT",
    `channel: ${result.channel}`,
    `generated: ${generated}`,
    "---",
    "",
    "# Dashboard",
    "",
    `Canale: **${channelLabel(result.channel)}**`,
    `Alert indicizzati: **${result.stats.totalAlerts}**`,
    `Fonti attive: **${result.stats.activeSources}**`,
    `Score medio: **${result.stats.averageScore}**`,
    "",
    "## Canali",
    "",
    "- [[Canali/Bandi]]",
    "- [[Canali/Normativa]]",
    "",
    "## Tag principali",
    "",
    ...result.stats.topTags.map((item) => `- [[Tags/${safeFileName(item.tag)}|${item.tag}]]: ${item.count}`),
    "",
    "## Alert prioritari",
    "",
    ...result.alerts.slice(0, 40).map((alert) => `- [[${channelFolder(alert.channel)}/${alertFileName(alert)}|${escapePipes(alert.title)}]]`),
  ].join("\n");
}

function channelNote(channel: Channel, alerts: Alert[]) {
  return [
    "---",
    "type: channel",
    `channel: ${channel}`,
    "---",
    "",
    `# ${channelLabel(channel)}`,
    "",
    `Alert: ${alerts.length}`,
    "",
    ...alerts.slice(0, 120).map((alert) => `- [[${channelFolder(alert.channel)}/${alertFileName(alert)}|${escapePipes(alert.title)}]]`),
  ].join("\n");
}

function sourcesIndex(sources: Source[]) {
  return [
    "---",
    "type: source-index",
    "---",
    "",
    "# Fonti",
    "",
    ...sources.map((source) => `- [[Fonti/${safeFileName(source.name)}|${source.name}]]`),
  ].join("\n");
}

function sourceNote(source: Source) {
  return [
    "---",
    "type: source",
    `source_id: ${source.id}`,
    `channel: ${source.channel}`,
    `category: ${source.category}`,
    `trust: ${source.trust}`,
    "---",
    "",
    `# ${source.name}`,
    "",
    `Canale: [[Canali/${channelTitle(source.channel)}]]`,
    `Homepage: ${source.homepage}`,
    `Feed/API: ${source.url}`,
    `Cadenza: ${source.cadence}`,
    "",
    "## Tag fonte",
    "",
    ...source.tags.map((tag) => `- [[Tags/${safeFileName(tag)}|${tag}]]`),
  ].join("\n");
}

function tagsIndex(tags: string[]) {
  return [
    "---",
    "type: tag-index",
    "---",
    "",
    "# Tags",
    "",
    ...tags.map((tag) => `- [[Tags/${safeFileName(tag)}|${tag}]]`),
  ].join("\n");
}

function tagNote(tag: string, alerts: Alert[]) {
  const matches = alerts.filter((alert) => alert.tags.includes(tag));
  return [
    "---",
    "type: tag",
    `tag: ${yamlString(tag)}`,
    "---",
    "",
    `# ${tag}`,
    "",
    `Alert collegati: ${matches.length}`,
    "",
    ...matches.slice(0, 120).map((alert) => `- [[${channelFolder(alert.channel)}/${alertFileName(alert)}|${escapePipes(alert.title)}]]`),
  ].join("\n");
}

function alertNote(alert: Alert) {
  const tagLinks = alert.tags.map((tag) => `[[Tags/${safeFileName(tag)}|${tag}]]`).join(" ");
  return [
    "---",
    "type: alert",
    `id: ${alert.id}`,
    `channel: ${alert.channel}`,
    `kind: ${alert.kind}`,
    `score: ${alert.score}`,
    `published: ${alert.publishedAt}`,
    `source: ${yamlString(alert.sourceName)}`,
    `url: ${yamlString(alert.url)}`,
    "tags:",
    ...alert.tags.map((tag) => `  - ${yamlString(tag)}`),
    "---",
    "",
    `# ${alert.title}`,
    "",
    `Canale: [[Canali/${channelTitle(alert.channel)}]]`,
    `Fonte: [[Fonti/${safeFileName(alert.sourceName)}|${alert.sourceName}]]`,
    `Tag: ${tagLinks}`,
    "",
    "## Sintesi",
    "",
    alert.summary,
    "",
    "## Fonte originale",
    "",
    alert.url,
  ].join("\n");
}

function obsidianConfig(root: string): ZipTextFile[] {
  return [
    file(root, ".obsidian/app.json", "{}\n"),
    file(root, ".obsidian/appearance.json", JSON.stringify({ theme: "obsidian" }, null, 2)),
    file(
      root,
      ".obsidian/graph.json",
      JSON.stringify(
        {
          showTags: true,
          showAttachments: false,
          hideUnresolved: false,
          showOrphans: true,
          colorGroups: [
            { query: "path:Normativa", color: { a: 1, rgb: 3438953 } },
            { query: "path:Bandi", color: { a: 1, rgb: 16755200 } },
            { query: "path:Fonti", color: { a: 1, rgb: 4751919 } },
          ],
        },
        null,
        2,
      ),
    ),
    file(root, ".obsidian/core-plugins.json", JSON.stringify(["file-explorer", "global-search", "graph", "backlink", "page-preview", "tag-pane"], null, 2)),
  ];
}

function groupAlertsByChannel(alerts: Alert[]) {
  return {
    bandi: alerts.filter((alert) => alert.channel === "bandi"),
    normativa: alerts.filter((alert) => alert.channel === "normativa"),
  };
}

function channelFolder(channel: Channel) {
  return channel === "bandi" ? "Bandi" : "Normativa";
}

function channelTitle(channel: Channel) {
  return channel === "bandi" ? "Bandi" : "Normativa";
}

function alertFileName(alert: Alert) {
  const date = alert.publishedAt.slice(0, 10);
  return safeFileName(`${date} - ${alert.score} - ${alert.title}`).slice(0, 130);
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 160) || "Untitled";
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

function escapePipes(value: string) {
  return value.replace(/\|/g, "-");
}
