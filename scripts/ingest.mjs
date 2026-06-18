import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";

const root = new URL("../", import.meta.url);
const sources = JSON.parse(await readFile(new URL("src/data/sources.json", root), "utf8"));
const parser = new XMLParser({
  attributeNamePrefix: "@",
  cdataPropName: "__cdata",
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

const enabledSources = sources.filter((source) => source.enabled && source.type === "rss");
const settled = await Promise.allSettled(enabledSources.map(fetchSource));
const errors = [];
const alerts = [];

settled.forEach((result, index) => {
  const source = enabledSources[index];
  if (result.status === "fulfilled") {
    alerts.push(...result.value);
  } else {
    errors.push({ sourceId: source.id, channel: source.channel, message: result.reason?.message ?? "Errore sconosciuto" });
  }
});

const deduped = dedupe(alerts)
  .sort((a, b) => b.score - a.score || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  .slice(0, 700);

const generatedAt = new Date().toISOString();
const knowledgeDir = new URL("data/knowledge/", root);
const brainDir = new URL("brain/", root);

await mkdir(knowledgeDir, { recursive: true });
await mkdir(brainDir, { recursive: true });

const byChannel = {
  all: deduped,
  bandi: deduped.filter((alert) => alert.channel === "bandi"),
  normativa: deduped.filter((alert) => alert.channel === "normativa"),
};

await writeFile(new URL("items.json", knowledgeDir), JSON.stringify(snapshot("all", byChannel.all), null, 2));
await writeFile(new URL("bandi.json", knowledgeDir), JSON.stringify(snapshot("bandi", byChannel.bandi), null, 2));
await writeFile(new URL("normativa.json", knowledgeDir), JSON.stringify(snapshot("normativa", byChannel.normativa), null, 2));
await writeFile(
  new URL("index.json", knowledgeDir),
  JSON.stringify({ generatedAt, chunks: byChannel.all.map(toChunk) }, null, 2),
);

await writeFile(new URL("RAGOSINT - Index.md", brainDir), toIndexMarkdown(generatedAt, byChannel));
await writeFile(new URL("RAGOSINT - Bandi.md", brainDir), toMarkdown("bandi", generatedAt, byChannel.bandi));
await writeFile(new URL("RAGOSINT - Normativa.md", brainDir), toMarkdown("normativa", generatedAt, byChannel.normativa));
await rm(new URL("RSS Monitor Bandi.md", brainDir), { force: true });

console.log(`Indexed ${deduped.length} alerts from ${enabledSources.length} sources`);
console.log(`Channels: bandi=${byChannel.bandi.length}, normativa=${byChannel.normativa.length}`);
if (errors.length > 0) {
  console.log(`Sources with errors: ${errors.map((error) => error.sourceId).join(", ")}`);
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "user-agent": "ragosint/0.1 (+https://rssmonitorbandi.vercel.app)",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel ?? parsed?.feed;
  const items = asArray(channel?.item ?? channel?.entry);
  return items.map((item) => normalizeItem(item, source)).filter(Boolean);
}

function normalizeItem(item, source) {
  const title = cleanText(readValue(item.title));
  const summary = cleanText(readValue(item.description) || readValue(item.summary) || readValue(item["content:encoded"]));
  const url = normalizeUrl(readLink(item.link) || readValue(item.guid) || source.homepage, source.homepage);
  const publishedAt = normalizeDate(readValue(item.pubDate) || readValue(item.published) || readValue(item.updated));

  if (!title || !url) return null;

  const text = `${title} ${summary}`;
  const tags = inferTags(text, source.tags);
  const kind = inferKind(text, source);

  return {
    id: hash(`${source.id}:${url}:${title}`),
    title,
    summary: summary || "Nessuna descrizione disponibile dalla fonte.",
    url,
    channel: source.channel,
    sourceId: source.id,
    sourceName: source.name,
    publishedAt,
    tags,
    kind,
    score: score(text, tags, kind, source.channel),
  };
}

function snapshot(channel, channelAlerts) {
  return {
    generatedAt,
    channel,
    count: channelAlerts.length,
    alerts: channelAlerts,
    errors: errors.filter((error) => channel === "all" || error.channel === channel),
  };
}

function toChunk(alert) {
  return {
    id: `chunk-${alert.id}`,
    alertId: alert.id,
    title: alert.title,
    text: `${alert.title}\n\n${alert.summary}\n\nCanale: ${alert.channel}\nFonte: ${alert.sourceName}\nURL: ${alert.url}`,
    metadata: {
      channel: alert.channel,
      sourceId: alert.sourceId,
      sourceName: alert.sourceName,
      publishedAt: alert.publishedAt,
      tags: alert.tags,
      kind: alert.kind,
      score: alert.score,
    },
  };
}

function toIndexMarkdown(generatedAtValue, grouped) {
  return [
    "---",
    "type: osint-brain-index",
    "project: RAGOSINT",
    `generated: ${generatedAtValue}`,
    "---",
    "",
    "# RAGOSINT",
    "",
    "Knowledge base OSINT/RAG-ready per normativa italiana, bandi, gare d'appalto e PNRR.",
    "",
    `Snapshot generata: ${generatedAtValue}`,
    `Alert totali: ${grouped.all.length}`,
    `Canale bandi: ${grouped.bandi.length}`,
    `Canale normativa: ${grouped.normativa.length}`,
    "",
    "## Feed",
    "",
    "- Bandi: /feed/bandi.xml",
    "- Normativa: /feed/normativa.xml",
    "- Aggregato: /feed.xml",
    "",
    "## Note",
    "",
    "- [[RAGOSINT - Bandi]]",
    "- [[RAGOSINT - Normativa]]",
  ].join("\n");
}

function toMarkdown(channel, generatedAtValue, channelAlerts) {
  const body = channelAlerts.slice(0, 100).map((alert, index) => [
    `## ${index + 1}. ${alert.title}`,
    "",
    `- Canale: ${alert.channel}`,
    `- Fonte: ${alert.sourceName}`,
    `- Tipo: ${alert.kind}`,
    `- Score: ${alert.score}`,
    `- Pubblicato: ${alert.publishedAt}`,
    `- Tag: ${alert.tags.join(", ")}`,
    `- URL: ${alert.url}`,
    "",
    alert.summary,
    "",
  ].join("\n"));

  return [
    "---",
    "type: osint-monitor",
    "project: RAGOSINT",
    `channel: ${channel}`,
    `generated: ${generatedAtValue}`,
    "---",
    "",
    `# RAGOSINT - ${channel}`,
    "",
    `Snapshot generata: ${generatedAtValue}`,
    `Alert indicizzati: ${channelAlerts.length}`,
    "",
    ...body,
  ].join("\n");
}

function inferTags(text, sourceTags) {
  const normalized = normalizeText(text);
  const tags = new Set(sourceTags);
  const rules = {
    normativa: ["legge", "decreto", "delibera", "regolamento", "ordinanza", "provvedimento"],
    privacy: ["privacy", "gdpr", "protezione dei dati", "garante"],
    lavoro: ["lavoro", "contratto collettivo", "inps", "inail"],
    tributi: ["tribut", "agenzia delle entrate", "imposta", "fiscale"],
    pnrr: ["pnrr", "next generation eu", "missione", "m1c", "m2c", "m3c", "m4c", "m5c", "m6c"],
    digitale: ["digitale", "digitalizzazione", "cloud", "software", "piattaforma", "dati", "interoperabilita"],
    cyber: ["cyber", "sicurezza informatica", "security", "soc"],
    ai: ["intelligenza artificiale", "artificial intelligence", "machine learning"],
    gare: ["gara", "appalto", "affidamento", "procedura aperta"],
    scadenza: ["scadenza", "termine", "presentazione domande"],
    comuni: ["comune", "comuni", "enti locali", "provincia"],
    cultura: ["cultura", "patrimonio", "museo", "archivio", "biblioteca"],
  };

  Object.entries(rules).forEach(([tag, terms]) => {
    if (terms.some((term) => normalized.includes(normalizeText(term)))) tags.add(tag);
  });

  return Array.from(tags).slice(0, 10);
}

function inferKind(text, source) {
  const normalized = normalizeText(`${source.category} ${text}`);
  if (source.channel === "normativa") return "normativa";
  if (normalized.includes("aggiudicazione") || normalized.includes("esito")) return "esito";
  if (normalized.includes("gara") || normalized.includes("appalto") || normalized.includes("affidamento")) return "gara";
  if (normalized.includes("bando")) return "bando";
  if (normalized.includes("pnrr")) return "pnrr";
  if (normalized.includes("avviso")) return "avviso";
  return "news";
}

function score(text, tags, kind, channel) {
  const normalized = normalizeText(text);
  let value = 25;
  if (channel === "normativa") value += 15;
  if (tags.includes("normativa")) value += 10;
  if (tags.includes("pnrr")) value += 20;
  if (tags.includes("digitale") || tags.includes("cyber") || tags.includes("ai")) value += 18;
  if (tags.includes("gare") || kind === "gara" || kind === "bando") value += 12;
  if (tags.includes("scadenza")) value += 8;
  if (normalized.includes("comune") || normalized.includes("enti locali")) value += 6;
  if (normalized.includes("manifestazione di interesse")) value += 6;
  if (normalized.includes("decreto legge") || normalized.includes("decreto legislativo")) value += 8;
  if (kind === "esito") value -= 8;
  return Math.max(1, Math.min(100, value));
}

function dedupe(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = normalizeText(`${item.channel}:${item.url || item.title}`);
    const existing = map.get(key);
    if (!existing || item.score > existing.score) map.set(key, item);
  });
  return Array.from(map.values());
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function readValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return readValue(value.__cdata ?? value["#text"] ?? value["@href"]);
  return "";
}

function readLink(value) {
  if (Array.isArray(value)) {
    const alternate = value.find((entry) => entry?.["@rel"] === "alternate") ?? value[0];
    return readLink(alternate);
  }
  return readValue(value);
}

function normalizeUrl(value, base) {
  try {
    return new URL(value, base).href;
  } catch {
    return base;
  }
}

function normalizeDate(value) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

function cleanText(value) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
