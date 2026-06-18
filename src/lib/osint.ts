import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import seedAlerts from "@/data/seed-alerts.json";
import sources from "@/data/sources.json";
import type { Alert, AlertKind, Channel, ChannelFilter, CollectOptions, CollectResult, Source } from "@/lib/types";

const parser = new XMLParser({
  attributeNamePrefix: "@",
  cdataPropName: "__cdata",
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

const CHANNELS: Channel[] = ["bandi", "normativa"];

const TAG_RULES: { tag: string; terms: string[] }[] = [
  { tag: "normativa", terms: ["legge", "decreto", "delibera", "regolamento", "ordinanza", "provvedimento"] },
  { tag: "privacy", terms: ["privacy", "gdpr", "protezione dei dati", "garante"] },
  { tag: "lavoro", terms: ["lavoro", "contratto collettivo", "inps", "inail"] },
  { tag: "tributi", terms: ["tribut", "agenzia delle entrate", "imposta", "fiscale"] },
  { tag: "pnrr", terms: ["pnrr", "next generation eu", "missione", "m1c", "m2c", "m3c", "m4c", "m5c", "m6c"] },
  { tag: "digitale", terms: ["digitale", "digitalizzazione", "cloud", "software", "piattaforma", "dati", "interoperabilita"] },
  { tag: "cyber", terms: ["cyber", "sicurezza informatica", "security", "csirt", "soc"] },
  { tag: "ai", terms: ["intelligenza artificiale", "artificial intelligence", "machine learning", "ai "] },
  { tag: "gare", terms: ["gara", "appalto", "affidamento", "procedura aperta", "procedura negoziata"] },
  { tag: "scadenza", terms: ["scadenza", "termine", "entro il", "presentazione domande"] },
  { tag: "comuni", terms: ["comune", "comuni", "enti locali", "provincia", "citta metropolitana"] },
  { tag: "sanita", terms: ["sanita", "salute", "asl", "azienda sanitaria", "ospedale"] },
  { tag: "scuola", terms: ["scuola", "istruzione", "universita", "ricerca", "its"] },
  { tag: "cultura", terms: ["cultura", "patrimonio", "museo", "archivio", "biblioteca"] },
];

export function getSources(channel: ChannelFilter = "all"): Source[] {
  const allSources = sources as Source[];
  if (channel === "all") {
    return allSources;
  }
  return allSources.filter((source) => source.channel === channel);
}

export function parseChannel(value: string | null | undefined): ChannelFilter {
  return value === "bandi" || value === "normativa" ? value : "all";
}

export function channelLabel(channel: ChannelFilter) {
  if (channel === "bandi") return "Bandi, gare e PNRR";
  if (channel === "normativa") return "Normativa italiana";
  return "OSINT pubblico";
}

export async function collectAlerts(input: number | CollectOptions = 80): Promise<CollectResult> {
  const options = typeof input === "number" ? { limit: input, channel: "all" as ChannelFilter } : input;
  const limit = options.limit ?? 80;
  const channel = options.channel ?? "all";
  const activeSources = getSources(channel).filter((source) => source.enabled);
  const settled = await Promise.allSettled(activeSources.map((source) => fetchSource(source)));
  const errors: CollectResult["errors"] = [];
  const fetchedAlerts: Alert[] = [];

  settled.forEach((result, index) => {
    const source = activeSources[index];
    if (result.status === "fulfilled") {
      fetchedAlerts.push(...result.value);
      return;
    }

    errors.push({
      sourceId: source.id,
      message: result.reason instanceof Error ? result.reason.message : "Errore sconosciuto",
    });
  });

  const fallbackAlerts = (seedAlerts as Alert[]).filter((alert) => channel === "all" || alert.channel === channel);
  const alerts = dedupeAlerts(fetchedAlerts.length > 0 ? fetchedAlerts : fallbackAlerts)
    .sort((a, b) => b.score - a.score || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, limit);

  return {
    generatedAt: new Date().toISOString(),
    channel,
    alerts,
    sources: activeSources,
    errors,
    stats: buildStats(alerts, activeSources.length),
  };
}

export function searchAlerts(alerts: Alert[], query: string, limit = 20): Alert[] {
  const terms = tokenize(query);
  if (terms.length === 0) {
    return alerts.slice(0, limit);
  }

  return alerts
    .map((alert) => {
      const haystack = normalizeText(`${alert.title} ${alert.summary} ${alert.channel} ${alert.tags.join(" ")}`);
      const matchScore = terms.reduce((score, term) => score + (haystack.includes(term) ? 20 : 0), 0);
      return { alert, matchScore };
    })
    .filter((item) => item.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore || b.alert.score - a.alert.score)
    .slice(0, limit)
    .map((item) => item.alert);
}

export function buildRssFeed(result: CollectResult, siteUrl: string) {
  const baseUrl = siteUrl.replace(/\/$/, "");
  const feedPath = result.channel === "all" ? "/feed.xml" : `/feed/${result.channel}.xml`;
  const items = result.alerts
    .map((alert) => {
      const pubDate = new Date(alert.publishedAt).toUTCString();
      const categories = alert.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join("");

      return `<item>
  <title>${escapeXml(alert.title)}</title>
  <link>${escapeXml(alert.url)}</link>
  <guid isPermaLink="false">${escapeXml(alert.id)}</guid>
  <pubDate>${pubDate}</pubDate>
  <source url="${escapeXml(alert.url)}">${escapeXml(alert.sourceName)}</source>
  <category>${escapeXml(alert.channel)}</category>
  ${categories}
  <description>${escapeXml(alert.summary)}</description>
</item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>RAGOSINT - ${escapeXml(channelLabel(result.channel))}</title>
  <link>${escapeXml(baseUrl)}</link>
  <description>Pipeline OSINT/RAG-ready per recuperare fonti pubbliche italiane, indicizzarle e trasformarle in intelligence operativa.</description>
  <language>it</language>
  <lastBuildDate>${new Date(result.generatedAt).toUTCString()}</lastBuildDate>
  <ttl>60</ttl>
  <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${escapeXml(baseUrl + feedPath)}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;
}

export function buildMarkdownReport(result: CollectResult) {
  const lines = [
    `# RAGOSINT - ${channelLabel(result.channel)} Report`,
    "",
    `Generato: ${formatDateTime(result.generatedAt)}`,
    `Canale: ${result.channel}`,
    `Fonti attive: ${result.stats.activeSources}`,
    `Alert indicizzati: ${result.stats.totalAlerts}`,
    "",
    "## Tag principali",
    "",
    ...result.stats.topTags.map((item) => `- ${item.tag}: ${item.count}`),
    "",
    "## Alert prioritari",
    "",
    ...result.alerts.slice(0, 30).map((alert, index) => [
      `### ${index + 1}. ${alert.title}`,
      "",
      `- Canale: ${alert.channel}`,
      `- Fonte: ${alert.sourceName}`,
      `- Tipo: ${alert.kind}`,
      `- Score: ${alert.score}`,
      `- Pubblicato: ${formatDateTime(alert.publishedAt)}`,
      `- Tag: ${alert.tags.join(", ")}`,
      `- URL: ${alert.url}`,
      "",
      alert.summary,
      "",
    ].join("\n")),
  ];

  if (result.errors.length > 0) {
    lines.push("## Errori fonti", "");
    lines.push(...result.errors.map((error) => `- ${error.sourceId}: ${error.message}`));
  }

  return lines.join("\n");
}

async function fetchSource(source: Source): Promise<Alert[]> {
  if (source.type !== "rss") {
    return [];
  }

  const response = await fetch(source.url, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "user-agent": "ragosint/0.1 (+https://rssmonitorbandi.vercel.app)",
    },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} da ${source.name}`);
  }

  const xml = await response.text();
  return parseRss(xml, source);
}

function parseRss(xml: string, source: Source): Alert[] {
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel ?? parsed?.feed;
  const rawItems = asArray(channel?.item ?? channel?.entry);

  return rawItems
    .map((item) => normalizeRssItem(item as Record<string, unknown>, source))
    .filter((alert): alert is Alert => Boolean(alert));
}

function normalizeRssItem(item: Record<string, unknown>, source: Source): Alert | null {
  const title = cleanText(readValue(item.title));
  const summary = cleanText(
    readValue(item.description) ||
      readValue(item.summary) ||
      readValue(item["content:encoded"]) ||
      readValue(item.content),
  );
  const rawUrl = readLink(item.link) || readValue(item.guid) || source.homepage;
  const url = normalizeUrl(rawUrl, source.homepage);
  const publishedAt = normalizeDate(
    readValue(item.pubDate) ||
      readValue(item.published) ||
      readValue(item.updated) ||
      readValue(item["dc:date"]),
  );

  if (!title || !url) {
    return null;
  }

  const fullText = `${title} ${summary}`;
  const tags = inferTags(fullText, source.tags);
  const kind = inferKind(fullText, source);

  return {
    id: hashId(`${source.id}:${url}:${title}`),
    title,
    summary: summary || "Nessuna descrizione disponibile dalla fonte.",
    url,
    channel: source.channel,
    sourceId: source.id,
    sourceName: source.name,
    publishedAt,
    tags,
    kind,
    score: scoreAlert(fullText, tags, kind, source.channel),
  };
}

function inferTags(text: string, sourceTags: string[]) {
  const normalized = normalizeText(text);
  const tags = new Set(sourceTags);

  TAG_RULES.forEach((rule) => {
    if (rule.terms.some((term) => normalized.includes(normalizeText(term)))) {
      tags.add(rule.tag);
    }
  });

  return Array.from(tags).slice(0, 10);
}

function inferKind(text: string, source: Source): AlertKind {
  const normalized = normalizeText(`${source.category} ${text}`);
  if (source.channel === "normativa") return "normativa";
  if (normalized.includes("aggiudicazione") || normalized.includes("esito")) return "esito";
  if (normalized.includes("gara") || normalized.includes("appalto") || normalized.includes("affidamento")) return "gara";
  if (normalized.includes("bando")) return "bando";
  if (normalized.includes("pnrr")) return "pnrr";
  if (normalized.includes("avviso")) return "avviso";
  return "news";
}

function scoreAlert(text: string, tags: string[], kind: AlertKind, channel: Channel) {
  const normalized = normalizeText(text);
  let score = 25;

  if (channel === "normativa") score += 15;
  if (tags.includes("normativa")) score += 10;
  if (tags.includes("pnrr")) score += 20;
  if (tags.includes("digitale") || tags.includes("cyber") || tags.includes("ai")) score += 18;
  if (tags.includes("gare") || kind === "gara" || kind === "bando") score += 12;
  if (tags.includes("scadenza")) score += 8;
  if (normalized.includes("comune") || normalized.includes("enti locali")) score += 6;
  if (normalized.includes("manifestazione di interesse")) score += 6;
  if (normalized.includes("decreto legge") || normalized.includes("decreto legislativo")) score += 8;
  if (kind === "esito") score -= 8;

  return Math.max(1, Math.min(100, score));
}

function buildStats(alerts: Alert[], activeSources: number): CollectResult["stats"] {
  const tagCounts = new Map<string, number>();
  alerts.forEach((alert) => alert.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)));

  const topTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const averageScore =
    alerts.length === 0 ? 0 : Math.round(alerts.reduce((sum, alert) => sum + alert.score, 0) / alerts.length);

  return {
    totalAlerts: alerts.length,
    activeSources,
    topTags,
    averageScore,
  };
}

function dedupeAlerts(alerts: Alert[]) {
  const seen = new Map<string, Alert>();

  alerts.forEach((alert) => {
    const key = normalizeText(`${alert.channel}:${alert.url || alert.title}`);
    const current = seen.get(key);
    if (!current || alert.score > current.score) {
      seen.set(key, alert);
    }
  });

  return Array.from(seen.values());
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function readValue(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return readValue(record.__cdata ?? record["#text"] ?? record["@href"]);
  }
  return "";
}

function readLink(value: unknown): string {
  if (Array.isArray(value)) {
    const alternate = value.find((entry) => (entry as Record<string, unknown>)["@rel"] === "alternate") ?? value[0];
    return readLink(alternate);
  }

  return readValue(value);
}

function normalizeUrl(url: string, base: string) {
  try {
    return new URL(url, base).href;
  } catch {
    return base;
  }
}

function normalizeDate(value: string) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function cleanText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((term) => term.length > 2);
}

function hashId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function escapeXml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

export { CHANNELS };
