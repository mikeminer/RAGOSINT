import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { XMLParser } from "fast-xml-parser";
import seedAlerts from "@/data/seed-alerts.json";
import sources from "@/data/sources.json";
import { extractFields, fieldsToTags } from "@/lib/extract";
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
  { tag: "data-breach", terms: ["data breach", "violazione dei dati", "incident notification", "notifica violazione"] },
  { tag: "lavoro", terms: ["lavoro", "contratto collettivo", "inps", "inail"] },
  { tag: "tributi", terms: ["tribut", "agenzia delle entrate", "imposta", "fiscale"] },
  { tag: "pnrr", terms: ["pnrr", "next generation eu", "missione", "m1c", "m2c", "m3c", "m4c", "m5c", "m6c"] },
  { tag: "digitale", terms: ["digitale", "digitalizzazione", "cloud", "software", "piattaforma", "dati", "interoperabilita"] },
  { tag: "pa-digitale", terms: ["pubblica amministrazione", "pa digitale", "piano triennale", "cad", "spid", "anpr", "app io", "pagoPA", "send"] },
  { tag: "accessibilita", terms: ["accessibilita", "accessibility", "european accessibility act", "servizi digitali accessibili"] },
  { tag: "documenti-digitali", terms: ["conservazione", "documento informatico", "gestione documentale", "protocollo informatico", "pec", "domicilio digitale", "eidas"] },
  { tag: "cyber", terms: ["cyber", "sicurezza informatica", "security", "csirt", "soc"] },
  { tag: "nis2", terms: ["nis2", "nis 2", "direttiva nis", "soggetti essenziali", "soggetti importanti", "incident response"] },
  { tag: "ai", terms: ["intelligenza artificiale", "artificial intelligence", "machine learning", "ai "] },
  { tag: "ai-act", terms: ["ai act", "regolamento ue 2024/1689", "regulation (eu) 2024/1689", "gpai", "general-purpose ai", "high-risk ai", "sistemi ad alto rischio"] },
  { tag: "dora", terms: ["dora", "digital operational resilience act", "resilienza operativa digitale", "ict risk", "ict third-party"] },
  { tag: "mica", terms: ["mica", "markets in crypto-assets", "crypto asset", "crypto-asset", "casp", "stablecoin", "asset-referenced token"] },
  { tag: "aml", terms: ["antiriciclaggio", "anti-money laundering", "aml", "travel rule", "uif", "oam"] },
  { tag: "gare", terms: ["gara", "appalto", "affidamento", "procedura aperta", "procedura negoziata"] },
  { tag: "scadenza", terms: ["scadenza", "termine", "entro il", "presentazione domande"] },
  { tag: "comuni", terms: ["comune", "comuni", "enti locali", "provincia", "citta metropolitana"] },
  { tag: "sanita", terms: ["sanita", "salute", "asl", "azienda sanitaria", "ospedale"] },
  { tag: "scuola", terms: ["scuola", "istruzione", "universita", "ricerca", "its"] },
  { tag: "cultura", terms: ["cultura", "patrimonio", "museo", "archivio", "biblioteca"] },
  { tag: "anac", terms: ["anac", "anticorruzione", "bdncp", "contratti pubblici"] },
  { tag: "mepa", terms: ["mepa", "consip", "acquistinrete", "acquisti in rete"] },
  { tag: "asl", terms: ["asl", "ausl", "azienda usl", "azienda sanitaria locale"] },
  { tag: "universita", terms: ["universita", "università", "ateneo", "unibo", "politecnico"] },
  { tag: "regioni", terms: ["regione", "regionale", "start toscana", "lombardia"] },
  { tag: "eurohpc", terms: ["eurohpc", "eurohpc ju", "supercomputing", "hpc", "supercomputer", "supercomputers"] },
  { tag: "ai-factories", terms: ["ai factories", "ai factory", "factory antennas", "industrial innovation"] },
  { tag: "it4lia", terms: ["it4lia", "italian ai factory", "cineca", "leonardo", "bologna tecnopolo"] },
  { tag: "eu-funding", terms: ["call for proposals", "access call", "funding", "grant", "grants", "horizon europe", "digital europe"] },
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
  "ai act",
  "regolamento ue 2024/1689",
  "general-purpose ai",
  "gpai",
  "high-risk ai",
  "sistemi ad alto rischio",
  "linee guida",
  "consultazione pubblica",
  "provvedimento",
  "sanzione",
  "garante",
  "gdpr",
  "privacy",
  "data breach",
  "biometria",
  "riconoscimento facciale",
  "videosorveglianza",
  "nis2",
  "nis 2",
  "cybersicurezza",
  "cybersecurity",
  "incident response",
  "piano triennale",
  "cad",
  "interoperabilita",
  "accessibilita",
  "accessibility",
  "european accessibility act",
  "conservazione",
  "documento informatico",
  "eidas",
  "spid",
  "anpr",
  "send",
  "dora",
  "resilienza operativa digitale",
  "ict risk",
  "incident reporting",
  "mica",
  "crypto-asset",
  "casp",
  "stablecoin",
  "antiriciclaggio",
  "aml",
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

const DEFAULT_FETCH_TIMEOUT_MS = 20_000;

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
  const alerts = filterExpiredBandi(dedupeAlerts(fetchedAlerts.length > 0 ? fetchedAlerts : fallbackAlerts))
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
    ].join("\n")),
  ];

  if (result.errors.length > 0) {
    lines.push("## Errori fonti", "");
    lines.push(...result.errors.map((error) => `- ${error.sourceId}: ${error.message}`));
  }

  return lines.join("\n");
}

async function fetchSource(source: Source): Promise<Alert[]> {
  if (source.type === "rss") {
    const xml = await fetchSourceText(source, "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8");
    return parseRss(xml, source);
  }

  if (source.type === "html") {
    return fetchHtmlSource(source);
  }

  return [];
}

async function fetchHtmlSource(source: Source): Promise<Alert[]> {
  const html = await fetchSourceText(source, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8");
  const links = extractRelevantLinks(html, source).slice(0, 28);

  if (links.length > 0) {
    return links.map((link) => normalizeHtmlSignal(link, source));
  }

  const title = cleanText(extractTitle(html) || source.name);
  const summary = cleanText(extractMetaDescription(html) || `Pagina istituzionale monitorata da RAGOSINT: ${source.name}.`);
  return [normalizeHtmlSignal({ title, url: source.url, summary }, source)];
}

async function fetchSourceText(source: Source, accept: string) {
  const headers = {
    accept,
    "user-agent": "ragosint/0.1 (+https://ragosint.vercel.app)",
  };

  if (source.allowInvalidCertificate) {
    return fetchTextWithNode(source.url, source, headers);
  }

  const response = await fetch(source.url, {
    headers: {
      accept,
      "user-agent": "ragosint/0.1 (+https://ragosint.vercel.app)",
    },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(fetchTimeoutMs(source)),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} da ${source.name}`);
  }

  return response.text();
}

function fetchTextWithNode(url: string, source: Source, headers: Record<string, string>, redirects = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = target.protocol === "http:" ? httpRequest : httpsRequest;
    const timeoutMs = fetchTimeoutMs(source);
    const requestOptions = {
      method: "GET",
      headers,
      timeout: timeoutMs,
      rejectUnauthorized: target.protocol === "https:" && source.allowInvalidCertificate ? false : undefined,
    };

    const req = request(target, requestOptions, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;

      if (status >= 300 && status < 400 && location) {
        response.resume();
        if (redirects >= 5) {
          reject(new Error(`Troppi redirect da ${source.name}`));
          return;
        }
        resolve(fetchTextWithNode(new URL(location, target).toString(), source, headers, redirects + 1));
        return;
      }

      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`HTTP ${status} da ${source.name}`));
        return;
      }

      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.on("end", () => resolve(body));
    });

    req.on("timeout", () => {
      req.destroy(new Error(`Timeout ${timeoutMs}ms da ${source.name}`));
    });
    req.on("error", reject);
    req.end();
  });
}

function parseRss(xml: string, source: Source): Alert[] {
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel ?? parsed?.feed;
  const rawItems = asArray(channel?.item ?? channel?.entry);

  return rawItems
    .map((item) => normalizeRssItem(item as Record<string, unknown>, source))
    .filter((alert): alert is Alert => Boolean(alert));
}

function fetchTimeoutMs(source: Source) {
  return source.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
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
  const fields = extractFields(title, summary);
  const tags = inferTags(fullText, [...source.tags, ...fieldsToTags(fields)]);
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
    fields,
  };
}

function normalizeHtmlSignal(
  signal: { title: string; url: string; summary?: string },
  source: Source,
): Alert {
  const title = cleanText(signal.title) || source.name;
  const url = normalizeUrl(signal.url, source.homepage);
  const summary =
    cleanText(signal.summary ?? "") ||
    `Segnale OSINT rilevato su ${source.name}. Verificare la pagina originale per documenti, allegati e scadenze.`;
  const fullText = `${title} ${summary} ${url}`;
  const fields = extractFields(title, summary);
  const tags = inferTags(fullText, [...source.tags, ...fieldsToTags(fields)]);
  const kind = inferKind(fullText, source);

  return {
    id: hashId(`${source.id}:${url}:${title}`),
    title,
    summary,
    url,
    channel: source.channel,
    sourceId: source.id,
    sourceName: source.name,
    publishedAt: new Date().toISOString(),
    tags,
    kind,
    score: scoreAlert(fullText, tags, kind, source.channel),
    fields,
  };
}

function extractRelevantLinks(html: string, source: Source) {
  const anchorRe = /<a\b[^>]*href=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi;
  const links: { title: string; url: string; summary?: string }[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(anchorRe)) {
    const href = decodeHtmlEntities(match[1] ?? "").trim();
    const title = cleanText(match[2] ?? "");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }

    const url = normalizeUrl(href, source.homepage);
    if (isNavigationNoise(title, url)) {
      continue;
    }

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

function isNavigationNoise(title: string, url: string) {
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) {
    return true;
  }
  if (/^\d+$/.test(normalizedTitle) || /^[a-z]{2}(?:\s|$)/.test(normalizedTitle)) {
    return true;
  }

  const boringTitles = [
    "accessibility statement",
    "cookie policy",
    "cookies",
    "legal notice",
    "next",
    "previous",
    "privacy policy",
    "privacy statement",
  ];

  if (boringTitles.some((item) => normalizedTitle.includes(item))) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "");
    if (parsed.searchParams.has("page") && /^\d+$/.test(normalizedTitle)) {
      return true;
    }
    if (/^\/[a-z]{2}\/funding$/i.test(path)) {
      return true;
    }
    if (/^\/[a-z]{2}$/i.test(path)) {
      return true;
    }
    if (/\/(?:legal-notice|privacy|accessibility)(?:\/|$|#)/i.test(parsed.href)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function extractTitle(html: string) {
  return readRegex(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
}

function extractMetaDescription(html: string) {
  return (
    readRegex(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
    readRegex(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)
  );
}

function readRegex(value: string, re: RegExp) {
  return value.match(re)?.[1] ?? "";
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

function scoreAlert(text: string, tags: string[], kind: AlertKind, channel: Channel) {
  const normalized = normalizeText(text);
  let score = 25;

  if (channel === "normativa") score += 15;
  if (tags.includes("normativa")) score += 10;
  if (tags.includes("pnrr")) score += 20;
  if (tags.includes("digitale") || tags.includes("cyber") || tags.includes("ai")) score += 18;
  if (tags.includes("ai-act") || tags.includes("nis2") || tags.includes("dora") || tags.includes("mica")) score += 22;
  if (tags.includes("pa-digitale") || tags.includes("accessibilita") || tags.includes("documenti-digitali")) score += 14;
  if (tags.includes("privacy") || tags.includes("data-breach") || tags.includes("aml")) score += 12;
  if (tags.includes("eurohpc") || tags.includes("ai-factories") || tags.includes("it4lia") || tags.includes("eu-funding")) {
    score += 24;
  }
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

function filterExpiredBandi(alerts: Alert[]) {
  const now = new Date();
  const today = startOfRomeDay(now);
  return alerts.filter((alert) => !isExpiredBando(alert, today, now));
}

function isExpiredBando(alert: Alert, today: Date, now: Date) {
  if (alert.channel !== "bandi") {
    return false;
  }

  const dates = extractDeadlineDates(alert);
  if (dates.length > 0) {
    return dates.every((date) => date.getTime() < today.getTime());
  }

  const publishedAt = Date.parse(alert.publishedAt);
  if (!Number.isFinite(publishedAt)) {
    return false;
  }

  const ageDays = (now.getTime() - publishedAt) / 86_400_000;
  return ageDays > 180;
}

function extractDeadlineDates(alert: Alert) {
  const fullContext = `${alert.title} ${alert.summary}`;
  const contextHasDeadline = hasDeadlineContext(fullContext);
  const values = alert.fields?.deadlines?.length ? alert.fields.deadlines : [fullContext];
  const dates = values.flatMap((value) => {
    if (!hasDeadlineContext(value) && !(isDateOnly(value) && contextHasDeadline)) {
      return [];
    }

    return extractDates(value);
  });

  const seen = new Set<string>();
  return dates.filter((date) => {
    const key = date.toISOString().slice(0, 10);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function extractDates(value: string) {
  const dates: Date[] = [];
  const numericRe = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g;
  const textualRe =
    /\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/gi;

  for (const match of value.matchAll(numericRe)) {
    const date = makeDate(Number(match[3]), Number(match[2]), Number(match[1]));
    if (date) {
      dates.push(date);
    }
  }

  for (const match of value.matchAll(textualRe)) {
    const date = makeDate(Number(match[3]), monthNumber(match[2]), Number(match[1]));
    if (date) {
      dates.push(date);
    }
  }

  return dates;
}

function makeDate(year: number, month: number, day: number) {
  const fullYear = year < 100 ? (year >= 70 ? 1900 + year : 2000 + year) : year;
  if (fullYear < 2000 || fullYear > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(fullYear, month - 1, day));
  if (date.getUTCFullYear() !== fullYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date;
}

function startOfRomeDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const record = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(record.year), Number(record.month) - 1, Number(record.day)));
}

function hasDeadlineContext(value: string) {
  const normalized = normalizeText(value);
  return [
    "scadenza",
    "scade",
    "termine",
    "termini",
    "entro",
    "proroga",
    "presentazione domande",
    "presentazione offerte",
    "presentazione candidature",
    "deadline",
    "closing date",
    "submission deadline",
    "apply by",
  ].some((term) => normalized.includes(term));
}

function isDateOnly(value: string) {
  return /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+\p{L}+\s+\d{4})$/iu.test(value.trim());
}

function monthNumber(value: string) {
  const months: Record<string, number> = {
    gennaio: 1,
    january: 1,
    febbraio: 2,
    february: 2,
    marzo: 3,
    march: 3,
    aprile: 4,
    april: 4,
    maggio: 5,
    may: 5,
    giugno: 6,
    june: 6,
    luglio: 7,
    july: 7,
    agosto: 8,
    august: 8,
    settembre: 9,
    september: 9,
    ottobre: 10,
    october: 10,
    novembre: 11,
    november: 11,
    dicembre: 12,
    december: 12,
  };
  return months[normalizeText(value)] ?? 0;
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

function formatList(values: string[] | undefined) {
  return values && values.length > 0 ? values.join("; ") : "n/d";
}

export { CHANNELS };
