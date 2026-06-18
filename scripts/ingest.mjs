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

const CIG_RE = /\b(?:CIG[:\s-]*)?([A-Z0-9]{10})\b/g;
const CUP_RE = /\b(?:CUP[:\s-]*)?([A-Z][0-9A-Z]{14})\b/g;
const EURO_RE = /(?:€|EUR|euro)\s?[\d.]+(?:,\d{2})?|[\d.]+(?:,\d{2})?\s?(?:€|euro|EUR)/gi;
const DATE_RE = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})\b/gi;
const REQUIREMENT_TERMS = [
  "requisiti",
  "requisito",
  "abilitazione",
  "iscrizione",
  "soa",
  "fatturato",
  "certificazione",
  "esperienza",
  "operatori economici",
  "requirements",
  "eligibility",
  "eligible",
  "submission",
  "application",
  "applicants",
];
const BENEFICIARY_TERMS = [
  "beneficiari",
  "soggetti beneficiari",
  "destinatari",
  "soggetti ammessi",
  "microimprese",
  "pmi",
  "smes",
  "startups",
  "startup",
  "public administrations",
  "pa",
  "academia",
  "research organisations",
  "research organizations",
  "universities",
  "companies",
  "industry",
  "enti locali",
  "comuni",
  "aziende sanitarie",
  "universita",
];
const HTML_SIGNAL_TERMS = [
  "bando",
  "bandi",
  "gara",
  "gare",
  "appalto",
  "appalti",
  "avviso",
  "avvisi",
  "pnrr",
  "cig",
  "cup",
  "affidamento",
  "procedura",
  "manifestazione",
  "indagine",
  "contratti",
  "mepa",
  "anac",
  "opendata",
  "call",
  "calls",
  "proposal",
  "proposals",
  "access",
  "funding",
  "grant",
  "grants",
  "deadline",
  "eligible",
  "eurohpc",
  "supercomputer",
  "supercomputers",
  "ai factories",
  "ai factory",
  "it4lia",
  "opportunita",
  "opportunities",
  "services",
  "innovation",
  "horizon",
  "digital europe",
];
const VECTOR_SIZE = 256;
const STOPWORDS = new Set(["che", "con", "del", "della", "delle", "degli", "dei", "per", "nel", "nella", "sono", "alla", "alle", "gli", "una", "uno", "sul", "sulla", "the", "and", "for"]);

const enabledSources = sources.filter((source) => source.enabled);
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
await writeFile(new URL("vector-store.json", knowledgeDir), JSON.stringify(buildVectorStore(byChannel.all), null, 2));

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
  if (source.type === "html") {
    return fetchHtmlSource(source);
  }

  if (source.type !== "rss") {
    return [];
  }

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

async function fetchHtmlSource(source) {
  const response = await fetch(source.url, {
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "user-agent": "ragosint/0.1 (+https://rssmonitorbandi.vercel.app)",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const links = extractRelevantLinks(html, source).slice(0, 28);
  if (links.length > 0) {
    return links.map((link) => normalizeHtmlSignal(link, source));
  }

  return [
    normalizeHtmlSignal(
      {
        title: cleanText(extractTitle(html) || source.name),
        url: source.url,
        summary: cleanText(extractMetaDescription(html) || `Pagina istituzionale monitorata da RAGOSINT: ${source.name}.`),
      },
      source,
    ),
  ];
}

function normalizeItem(item, source) {
  const title = cleanText(readValue(item.title));
  const summary = cleanText(readValue(item.description) || readValue(item.summary) || readValue(item["content:encoded"]));
  const url = normalizeUrl(readLink(item.link) || readValue(item.guid) || source.homepage, source.homepage);
  const publishedAt = normalizeDate(readValue(item.pubDate) || readValue(item.published) || readValue(item.updated));

  if (!title || !url) return null;

  const text = `${title} ${summary}`;
  const fields = extractFields(title, summary);
  const tags = inferTags(text, [...source.tags, ...fieldsToTags(fields)]);
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
    fields,
  };
}

function normalizeHtmlSignal(signal, source) {
  const title = cleanText(signal.title) || source.name;
  const url = normalizeUrl(signal.url, source.homepage);
  const summary =
    cleanText(signal.summary ?? "") ||
    `Segnale OSINT rilevato su ${source.name}. Verificare la pagina originale per documenti, allegati e scadenze.`;
  const text = `${title} ${summary} ${url}`;
  const fields = extractFields(title, summary);
  const tags = inferTags(text, [...source.tags, ...fieldsToTags(fields)]);
  const kind = inferKind(text, source);

  return {
    id: hash(`${source.id}:${url}:${title}`),
    title,
    summary,
    url,
    channel: source.channel,
    sourceId: source.id,
    sourceName: source.name,
    publishedAt: new Date().toISOString(),
    tags,
    kind,
    score: score(text, tags, kind, source.channel),
    fields,
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
      fields: alert.fields,
    },
  };
}

function buildVectorStore(channelAlerts) {
  return {
    model: "ragosint-hash-embedding-v1",
    dimensions: VECTOR_SIZE,
    generatedAt,
    documents: channelAlerts.map((alert) => ({
      id: `vec-${alert.id}`,
      alertId: alert.id,
      channel: alert.channel,
      title: alert.title,
      url: alert.url,
      vector: embedText(`${alert.title}\n${alert.summary}\n${alert.tags.join(" ")}\n${JSON.stringify(alert.fields ?? emptyFields())}`),
      metadata: {
        score: alert.score,
        sourceName: alert.sourceName,
        tags: alert.tags,
      },
    })),
  };
}

function embedText(text) {
  const vector = new Array(VECTOR_SIZE).fill(0);
  tokenizeVector(text).forEach((token) => {
    const index = hash32(token) % VECTOR_SIZE;
    vector[index] += 1;
  });
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function tokenizeVector(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function hash32(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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
    "",
    "## Ricerca semantica",
    "",
    "- /api/semantic?q=pnrr&channel=bandi",
    "- /api/vector-store?channel=all",
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
    `- Scadenze: ${formatList(alert.fields?.deadlines)}`,
    `- Importi: ${formatList(alert.fields?.amounts)}`,
    `- CIG: ${formatList(alert.fields?.cig)}`,
    `- CUP: ${formatList(alert.fields?.cup)}`,
    `- Requisiti: ${formatList(alert.fields?.requirements)}`,
    `- Beneficiari: ${formatList(alert.fields?.beneficiaries)}`,
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

function extractRelevantLinks(html, source) {
  const anchorRe = /<a\b[^>]*href=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi;
  const links = [];
  const seen = new Set();

  for (const match of html.matchAll(anchorRe)) {
    const href = decodeHtml(match[1] ?? "").trim();
    const title = cleanText(match[2] ?? "");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }

    const url = normalizeUrl(href, source.homepage);
    const haystack = normalizeText(`${title} ${url}`);
    const relevant = HTML_SIGNAL_TERMS.some((term) => haystack.includes(normalizeText(term)));
    if (!title || !relevant || seen.has(url)) {
      continue;
    }

    seen.add(url);
    links.push({
      title,
      url,
      summary: `Link rilevato da ${source.name}: ${title}`,
    });
  }

  return links;
}

function extractTitle(html) {
  return readRegex(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
}

function extractMetaDescription(html) {
  return (
    readRegex(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
    readRegex(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)
  );
}

function extractFields(title, summary) {
  const text = `${title}. ${summary}`.replace(/\s+/g, " ").trim();
  return {
    deadlines: unique([
      ...extractMatches(text, DATE_RE),
      ...extractSentencesByTerms(text, [
        "scadenza",
        "termine",
        "entro",
        "presentazione",
        "ore",
        "deadline",
        "closing date",
        "opening date",
        "submission",
        "apply",
      ]),
    ]).slice(0, 8),
    amounts: unique(extractMatches(text, EURO_RE)),
    cig: unique(extractMatches(text, CIG_RE)).filter((value) => /[0-9]/.test(value)),
    cup: unique(extractMatches(text, CUP_RE)).filter((value) => value.length === 15),
    requirements: unique(extractSentencesByTerms(text, REQUIREMENT_TERMS)).slice(0, 5),
    beneficiaries: unique(extractSentencesByTerms(text, BENEFICIARY_TERMS)).slice(0, 5),
  };
}

function fieldsToTags(fields) {
  const tags = [];
  if (fields.deadlines.length > 0) tags.push("scadenza");
  if (fields.amounts.length > 0) tags.push("importo");
  if (fields.cig.length > 0) tags.push("cig");
  if (fields.cup.length > 0) tags.push("cup");
  if (fields.requirements.length > 0) tags.push("requisiti");
  if (fields.beneficiaries.length > 0) tags.push("beneficiari");
  return tags;
}

function extractMatches(text, re) {
  return Array.from(text.matchAll(re), (match) => cleanMatch(match[1] ?? match[0]));
}

function extractSentencesByTerms(text, terms) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      const normalized = asciiLower(sentence);
      return normalized && terms.some((term) => normalized.includes(asciiLower(term)));
    });
}

function cleanMatch(value) {
  return value.replace(/^[\s:,-]+|[\s:,-]+$/g, "").trim();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, 12);
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
    sanita: ["sanita", "salute", "asl", "azienda sanitaria", "ospedale"],
    scuola: ["scuola", "istruzione", "universita", "ricerca", "its"],
    cultura: ["cultura", "patrimonio", "museo", "archivio", "biblioteca"],
    anac: ["anac", "anticorruzione", "bdncp", "contratti pubblici"],
    mepa: ["mepa", "consip", "acquistinrete", "acquisti in rete"],
    asl: ["asl", "ausl", "azienda usl", "azienda sanitaria locale"],
    universita: ["universita", "università", "ateneo", "unibo", "politecnico"],
    regioni: ["regione", "regionale", "start toscana", "lombardia"],
    eurohpc: ["eurohpc", "eurohpc ju", "supercomputing", "hpc", "supercomputer", "supercomputers"],
    "ai-factories": ["ai factories", "ai factory", "factory antennas", "industrial innovation"],
    it4lia: ["it4lia", "italian ai factory", "cineca", "leonardo", "bologna tecnopolo"],
    "eu-funding": ["call for proposals", "access call", "funding", "grant", "grants", "horizon europe", "digital europe"],
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
  if (
    normalized.includes("call for proposals") ||
    normalized.includes("access call") ||
    normalized.includes("calls") ||
    normalized.includes("funding") ||
    normalized.includes("grant")
  ) {
    return "bando";
  }
  if (
    normalized.includes("regular access") ||
    normalized.includes("extreme scale access") ||
    normalized.includes("benchmark access") ||
    normalized.includes("development access") ||
    normalized.includes("large scale access") ||
    normalized.includes("fast lane access") ||
    normalized.includes("playground access")
  ) {
    return "bando";
  }
  if (normalized.includes("gara") || normalized.includes("appalto") || normalized.includes("affidamento")) return "gara";
  if (normalized.includes("bando")) return "bando";
  if (normalized.includes("pnrr")) return "pnrr";
  if (normalized.includes("avviso")) return "avviso";
  if (normalized.includes("opportunity") || normalized.includes("opportunities") || normalized.includes("opportunita")) {
    return "avviso";
  }
  return "news";
}

function score(text, tags, kind, channel) {
  const normalized = normalizeText(text);
  let value = 25;
  if (channel === "normativa") value += 15;
  if (tags.includes("normativa")) value += 10;
  if (tags.includes("pnrr")) value += 20;
  if (tags.includes("digitale") || tags.includes("cyber") || tags.includes("ai")) value += 18;
  if (tags.includes("eurohpc") || tags.includes("ai-factories") || tags.includes("it4lia") || tags.includes("eu-funding")) {
    value += 24;
  }
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

function readRegex(value, re) {
  return value.match(re)?.[1] ?? "";
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function asciiLower(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatList(values) {
  return values && values.length > 0 ? values.join("; ") : "n/d";
}

function emptyFields() {
  return {
    deadlines: [],
    amounts: [],
    cig: [],
    cup: [],
    requirements: [],
    beneficiaries: [],
  };
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
