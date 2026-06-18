export type SourceType = "rss" | "html" | "api";
export type Channel = "bandi" | "normativa";
export type ChannelFilter = Channel | "all";

export type Source = {
  id: string;
  name: string;
  type: SourceType;
  channel: Channel;
  category: string;
  homepage: string;
  url: string;
  cadence: string;
  trust: "official" | "institutional" | "community";
  enabled: boolean;
  tags: string[];
  timeoutMs?: number;
};

export type AlertKind = "bando" | "gara" | "pnrr" | "avviso" | "esito" | "news" | "normativa";

export type Alert = {
  id: string;
  title: string;
  summary: string;
  url: string;
  channel: Channel;
  sourceId: string;
  sourceName: string;
  publishedAt: string;
  tags: string[];
  kind: AlertKind;
  score: number;
  fields: ExtractedFields;
};

export type ExtractedFields = {
  deadlines: string[];
  amounts: string[];
  cig: string[];
  cup: string[];
  requirements: string[];
  beneficiaries: string[];
};

export type CollectOptions = {
  limit?: number;
  channel?: ChannelFilter;
};

export type CollectResult = {
  generatedAt: string;
  channel: ChannelFilter;
  alerts: Alert[];
  sources: Source[];
  errors: { sourceId: string; message: string }[];
  stats: {
    totalAlerts: number;
    activeSources: number;
    topTags: { tag: string; count: number }[];
    averageScore: number;
  };
};
