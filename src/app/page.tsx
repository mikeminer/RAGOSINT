import {
  Activity,
  ArrowUpRight,
  Bell,
  Briefcase,
  Database,
  Download,
  FileText,
  GitBranch,
  Github,
  Network,
  Radar,
  RefreshCw,
  Rss,
  Scale,
  Search,
  ShieldCheck,
} from "lucide-react";
import { channelLabel, collectAlerts } from "@/lib/osint";
import type { Alert, CollectResult } from "@/lib/types";

export const revalidate = 1800;

export default async function Home() {
  const [allResult, bandiResult, normativaResult] = await Promise.all([
    collectAlerts({ channel: "all", limit: 32 }),
    collectAlerts({ channel: "bandi", limit: 20 }),
    collectAlerts({ channel: "normativa", limit: 20 }),
  ]);
  const latest = allResult.alerts.slice(0, 10);

  return (
    <main className="teletext-main">
      <div className="teletext-shell">
        <section className="teletext-hero">
          <div className="teletext-header-line">
            <span>P100 RAGOSINT</span>
            <span>OSINT/RAG LIVE - RSS - OBSIDIAN - VERCEL</span>
            <span>EU/IT TECH RADAR</span>
          </div>
          <nav className="teletext-nav">
            <div className="teletext-brand">
              <div className="teletext-logo">
                <Radar size={22} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <div>
                <p className="teletext-eyebrow">OSINT / RAG / Obsidian</p>
                <h1 className="teletext-brand-title">RAGOSINT</h1>
              </div>
            </div>
            <div className="teletext-actions">
              <FeedButton href="/feed/normativa.xml" label="Normativa" />
              <FeedButton href="/feed/bandi.xml" label="Bandi" />
              <a
                className="teletext-button"
                href="https://github.com/mikeminer/RAGOSINT"
                target="_blank"
                rel="noreferrer"
              >
                <Github size={16} aria-hidden="true" />
                GitHub
              </a>
              <a
                className="teletext-button"
                href="/api/semantic?q=pnrr%20digitale&channel=all"
              >
                <Network size={16} aria-hidden="true" />
                Semantic
              </a>
              <a
                className="teletext-button"
                href="/api/brain.zip"
              >
                <Download size={16} aria-hidden="true" />
                Brain
              </a>
              <a
                className="teletext-button"
                href="/api/report"
              >
                <FileText size={16} aria-hidden="true" />
                Report
              </a>
              <a
                className="teletext-button teletext-button-primary"
                href="/api/refresh"
              >
                <RefreshCw size={16} aria-hidden="true" />
                Refresh
              </a>
            </div>
          </nav>

          <div className="teletext-hero-grid">
            <div>
              <p className="teletext-kicker">
                <ShieldCheck size={14} aria-hidden="true" />
                Fonti pubbliche, deduplica, scoring, due feed RSS
              </p>
              <h2 className="teletext-title">
                Intelligence operativa per normativa, bandi, gare d&apos;appalto e PNRR.
              </h2>
              <p className="teletext-subtitle">
                RAGOSINT e&apos; un radar OSINT/RAG per sviluppatori tech: monitora normative digitali,
                bandi, gare d&apos;appalto e PNRR, trasformando fonti pubbliche italiane ed europee in
                segnali operativi, requisiti tecnici e opportunita di progetto.
              </p>
            </div>
            <form action="/api/search" className="teletext-search">
              <label className="sr-only" htmlFor="q">
                Cerca nella knowledge base
              </label>
              <input
                id="q"
                name="q"
                placeholder="Cerca: cloud, privacy, comuni, PNRR..."
              />
              <label className="sr-only" htmlFor="channel">
                Canale
              </label>
              <select id="channel" name="channel">
                <option value="all">Tutto</option>
                <option value="normativa">Normativa</option>
                <option value="bandi">Bandi</option>
              </select>
              <button type="submit" aria-label="Cerca">
                <Search size={20} aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>

        <section className="teletext-metrics">
          <div className="grid md:grid-cols-4">
          <Metric label="Alert totali" value={allResult.stats.totalAlerts.toString()} icon={<Activity size={18} aria-hidden="true" />} />
          <Metric label="Fonti attive" value={allResult.stats.activeSources.toString()} icon={<Database size={18} aria-hidden="true" />} />
          <Metric label="Canale bandi" value={bandiResult.stats.totalAlerts.toString()} icon={<Briefcase size={18} aria-hidden="true" />} />
          <Metric label="Canale normativa" value={normativaResult.stats.totalAlerts.toString()} icon={<Scale size={18} aria-hidden="true" />} />
          </div>
        </section>

        <section className="teletext-content">
        <div className="space-y-6">
          <div className="teletext-channel-grid">
            <ChannelPanel
              result={normativaResult}
              href="/feed/normativa.xml"
              brainHref="/api/brain/normativa.zip"
              icon={<Scale size={18} aria-hidden="true" />}
            />
            <ChannelPanel
              result={bandiResult}
              href="/feed/bandi.xml"
              brainHref="/api/brain/bandi.zip"
              icon={<Briefcase size={18} aria-hidden="true" />}
            />
          </div>

          <div className="teletext-section-heading">
            <div>
              <p className="teletext-section-kicker">Alert prioritari</p>
              <h2 className="teletext-section-title">Segnali recenti</h2>
            </div>
            <a className="teletext-json-link inline-flex items-center gap-2" href="/api/alerts">
              JSON
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>

          <div className="grid gap-3">
            {latest.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>

        <aside className="teletext-side">
          <div className="teletext-panel">
            <h2 className="teletext-panel-title">Pipeline</h2>
            <div className="teletext-panel-inner space-y-3 text-sm">
              <PipelineItem icon={<Radar size={16} aria-hidden="true" />} title="Recupera" text="Legge RSS e fonti pubbliche ufficiali." />
              <PipelineItem icon={<GitBranch size={16} aria-hidden="true" />} title="Estrae" text="Rileva scadenze, importi, CIG, CUP, requisiti e beneficiari." />
              <PipelineItem icon={<Database size={16} aria-hidden="true" />} title="Indicizza" text="Genera knowledge JSON, embeddings e vector store." />
              <PipelineItem icon={<Network size={16} aria-hidden="true" />} title="Brain" text="Crea vault Obsidian con link semantici e grafo locale." />
              <PipelineItem icon={<Rss size={16} aria-hidden="true" />} title="Distribuisce" text="Pubblica alert, report, feed e Slack digest opzionale." />
            </div>
          </div>

          <div className="teletext-panel">
            <div className="teletext-panel-title">
              <Scale size={17} aria-hidden="true" />
              <h2>Feed normativa</h2>
            </div>
            <div className="teletext-panel-inner flex flex-wrap gap-2">
              {[
                "AI Act / GPAI",
                "NIS2 / ACN",
                "Privacy / GDPR",
                "PA digitale",
                "Accessibilita",
                "Documenti digitali",
                "DORA",
                "MiCA / AML",
              ].map((item) => (
                <span key={item} className="teletext-tag">
                  {item}
                </span>
              ))}
              <p className="mt-2 text-sm leading-6 text-[#d9e4ff]">
                Ogni alert prova a trasformare la novita in impatto: chi e&apos; colpito, cosa deve fare, entro quando, rischio e opportunita.
              </p>
            </div>
          </div>

          <div className="teletext-panel">
            <h2 className="teletext-panel-title">Obsidian brain</h2>
            <div className="teletext-panel-inner grid gap-2">
              <DownloadLink href="/api/brain.zip" label="Vault completa" />
              <DownloadLink href="/api/brain/normativa.zip" label="Solo normativa" />
              <DownloadLink href="/api/brain/bandi.zip" label="Solo bandi" />
              <DownloadLink href="/api/semantic?q=pnrr%20cloud&channel=bandi" label="Ricerca semantica" icon={<Network size={15} aria-hidden="true" />} />
              <DownloadLink href="/api/vector-store?channel=all" label="Vector store" icon={<Database size={15} aria-hidden="true" />} />
              <DownloadLink href="/api/notify/slack?channel=bandi" label="Slack digest" icon={<Bell size={15} aria-hidden="true" />} />
            </div>
          </div>

          <div className="teletext-panel">
            <h2 className="teletext-panel-title">Fonte GitHub</h2>
            <div className="teletext-panel-inner">
            <a
              className="teletext-list-link flex items-center justify-between gap-2 text-sm font-semibold"
              href="https://github.com/mikeminer/RAGOSINT"
              target="_blank"
              rel="noreferrer"
            >
              <span className="inline-flex items-center gap-2">
                <Github size={16} aria-hidden="true" />
                mikeminer/RAGOSINT
              </span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <p className="mt-3 text-sm leading-6 text-[#d9e4ff]">
              Repository pubblico del MVP: codice sorgente, README, pipeline OSINT/RAG, fonti e brain Obsidian.
            </p>
            </div>
          </div>

          <div className="teletext-panel">
            <h2 className="teletext-panel-title">Fonti attive</h2>
            <div className="teletext-panel-inner space-y-3">
              {allResult.sources.map((source) => (
                <a
                  key={source.id}
                  className="teletext-list-link"
                  href={source.homepage}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{source.name}</span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </div>
                  <p className="mt-1 text-xs text-[#9fb5ff]">
                    {source.channel} · {source.cadence}
                  </p>
                </a>
              ))}
            </div>
          </div>

          <div className="teletext-panel">
            <h2 className="teletext-panel-title">Tag dominanti</h2>
            <div className="teletext-panel-inner flex flex-wrap gap-2">
              {allResult.stats.topTags.map((item) => (
                <span key={item.tag} className="teletext-chip">
                  {item.tag} <span className="ml-1 text-[#fff200]">{item.count}</span>
                </span>
              ))}
            </div>
          </div>

          {allResult.errors.length > 0 ? (
            <div className="teletext-warning text-sm">
              <h2 className="font-semibold">Fonti con errore</h2>
              <ul className="mt-2 space-y-1">
                {allResult.errors.map((error) => (
                  <li key={error.sourceId}>
                    {error.sourceId}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
        </section>
      </div>
    </main>
  );
}

function FeedButton({ href, label }: { href: string; label: string }) {
  return (
    <a className="teletext-button" href={href}>
      <Rss size={16} aria-hidden="true" />
      {label}
    </a>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="teletext-metric">
      <div className="teletext-metric-icon">{icon}</div>
      <p className="teletext-metric-value">{value}</p>
      <p className="teletext-metric-label">{label}</p>
    </div>
  );
}

function ChannelPanel({
  result,
  href,
  brainHref,
  icon,
}: {
  result: CollectResult;
  href: string;
  brainHref: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="teletext-channel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#00d7ff]">{icon}</div>
          <h2 className="text-lg font-semibold">{channelLabel(result.channel)}</h2>
          <p className="teletext-muted mt-1">
            {result.stats.totalAlerts} alert da {result.stats.activeSources} fonti
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="teletext-link-button" href={href}>
            RSS
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <a className="teletext-button" href={brainHref}>
            ZIP
            <Download size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {result.stats.topTags.slice(0, 5).map((item) => (
          <span key={item.tag} className="teletext-chip">
            {item.tag}
          </span>
        ))}
      </div>
    </section>
  );
}

function DownloadLink({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <a className="teletext-list-link flex items-center justify-between gap-2 text-sm font-semibold" href={href}>
      <span>{label}</span>
      {icon ?? <Download size={15} aria-hidden="true" />}
    </a>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <article className="teletext-alert">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span className="teletext-tag">{alert.channel}</span>
          <span className="teletext-chip">{alert.kind}</span>
          <span className="teletext-tag teletext-score">score {alert.score}</span>
        </div>
        <time className="text-xs font-black text-[#00d7ff]" dateTime={alert.publishedAt}>
          {formatDate(alert.publishedAt)}
        </time>
      </div>
      <h3 className="text-lg font-semibold leading-snug">{alert.title}</h3>
      <p className="teletext-alert-summary line-clamp-2">{alert.summary}</p>
      <FieldSummary alert={alert} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {alert.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="teletext-chip">
              {tag}
            </span>
          ))}
        </div>
        <a
          className="teletext-link-button"
          href={alert.url}
          target="_blank"
          rel="noreferrer"
        >
          Apri fonte
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

function FieldSummary({ alert }: { alert: Alert }) {
  const fields = alert.fields ?? {
    deadlines: [],
    amounts: [],
    cig: [],
    cup: [],
    requirements: [],
    beneficiaries: [],
  };
  const chips = [
    fields.deadlines.length > 0 ? `scadenze ${fields.deadlines.length}` : null,
    fields.amounts.length > 0 ? `importi ${fields.amounts.length}` : null,
    fields.cig.length > 0 ? `CIG ${fields.cig.length}` : null,
    fields.cup.length > 0 ? `CUP ${fields.cup.length}` : null,
    fields.requirements.length > 0 ? `requisiti ${fields.requirements.length}` : null,
    fields.beneficiaries.length > 0 ? `beneficiari ${fields.beneficiaries.length}` : null,
  ].filter((chip): chip is string => Boolean(chip));

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span key={chip} className="teletext-chip">
          {chip}
        </span>
      ))}
    </div>
  );
}

function PipelineItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-[#00d7ff]">{icon}</div>
      <div>
        <p className="font-black uppercase text-[#fff200]">{title}</p>
        <p className="text-[#d9e4ff]">{text}</p>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}
