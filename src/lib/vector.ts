import type { Alert, ChannelFilter } from "@/lib/types";

export type VectorDocument = {
  id: string;
  alertId: string;
  channel: Alert["channel"];
  title: string;
  url: string;
  vector: number[];
  metadata: {
    score: number;
    sourceName: string;
    tags: string[];
  };
};

const VECTOR_SIZE = 256;
const STOPWORDS = new Set([
  "che",
  "con",
  "del",
  "della",
  "delle",
  "degli",
  "dei",
  "per",
  "nel",
  "nella",
  "sono",
  "alla",
  "alle",
  "gli",
  "una",
  "uno",
  "sul",
  "sulla",
  "the",
  "and",
  "for",
]);

export function buildVectorStore(alerts: Alert[]) {
  return {
    model: "ragosint-hash-embedding-v1",
    dimensions: VECTOR_SIZE,
    generatedAt: new Date().toISOString(),
    documents: alerts.map((alert) => toVectorDocument(alert)),
  };
}

export function semanticSearch(alerts: Alert[], query: string, channel: ChannelFilter = "all", limit = 10) {
  const queryVector = embedText(query);
  return alerts
    .filter((alert) => channel === "all" || alert.channel === channel)
    .map((alert) => {
      const document = toVectorDocument(alert);
      return {
        similarity: cosine(queryVector, document.vector),
        alert,
      };
    })
    .filter((item) => item.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity || b.alert.score - a.alert.score)
    .slice(0, limit);
}

export function toVectorDocument(alert: Alert): VectorDocument {
  const fields = alert.fields ?? {
    deadlines: [],
    amounts: [],
    cig: [],
    cup: [],
    requirements: [],
    beneficiaries: [],
  };

  return {
    id: `vec-${alert.id}`,
    alertId: alert.id,
    channel: alert.channel,
    title: alert.title,
    url: alert.url,
    vector: embedText(`${alert.title}\n${alert.summary}\n${alert.tags.join(" ")}\n${JSON.stringify(fields)}`),
    metadata: {
      score: alert.score,
      sourceName: alert.sourceName,
      tags: alert.tags,
    },
  };
}

export function embedText(text: string) {
  const vector = new Array<number>(VECTOR_SIZE).fill(0);
  tokenize(text).forEach((token) => {
    const index = hash(token) % VECTOR_SIZE;
    vector[index] += 1;
  });
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function cosine(a: number[], b: number[]) {
  let dot = 0;
  for (let i = 0; i < VECTOR_SIZE; i += 1) {
    dot += a[i] * b[i];
  }
  return Number(dot.toFixed(6));
}

function tokenize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
