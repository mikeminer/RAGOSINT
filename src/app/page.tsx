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
    <main className="min-h-screen bg-[#f7f7f4] text-[#161616]">
      <section className="border-b border-black/10 bg-[#101312] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
          <nav className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-[#36d399] text-[#101312]">
                <Radar size={22} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#b8f6d5]">OSINT / RAG / Obsidian</p>
                <h1 className="text-xl font-semibold">RAGOSINT</h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <FeedButton href="/feed/normativa.xml" label="Normativa" />
              <FeedButton href="/feed/bandi.xml" label="Bandi" />
              <a
                className="inline-flex h-10 items-center gap-2 rounded-md border border-white/20 px-3 text-sm font-medium hover:bg-white/10"
                href="https://github.com/mikeminer/RAGOSINT"
                target="_blank"
                rel="noreferrer"
              >
                <Github size={16} aria-hidden="true" />
                GitHub
              </a>
              <a
                className="inline-flex h-10 items-center gap-2 rounded-md border border-white/20 px-3 text-sm font-medium hover:bg-white/10"
                href="/api/semantic?q=pnrr%20digitale&channel=all"
              >
                <Network size={16} aria-hidden="true" />
                Semantic
              </a>
              <a
                className="inline-flex h-10 items-center gap-2 rounded-md border border-white/20 px-3 text-sm font-medium hover:bg-white/10"
                href="/api/brain.zip"
              >
                <Download size={16} aria-hidden="true" />
                Brain
              </a>
              <a
                className="inline-flex h-10 items-center gap-2 rounded-md border border-white/20 px-3 text-sm font-medium hover:bg-white/10"
                href="/api/report"
              >
                <FileText size={16} aria-hidden="true" />
                Report
              </a>
              <a
                className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-semibold text-[#101312] hover:bg-[#dff7ff]"
                href="/api/refresh"
              >
                <RefreshCw size={16} aria-hidden="true" />
                Refresh
              </a>
            </div>
          </nav>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1 font-mono text-xs text-[#dff7ff]">
                <ShieldCheck size={14} aria-hidden="true" />
                Fonti pubbliche, deduplica, scoring, due feed RSS
              </p>
              <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">
                Intelligence operativa per normativa, bandi, gare d&apos;appalto e PNRR.
              </h2>
            </div>
            <form action="/api/search" className="flex min-h-14 overflow-hidden rounded-md border border-white/20 bg-white">
              <label className="sr-only" htmlFor="q">
                Cerca nella knowledge base
              </label>
              <input
                id="q"
                name="q"
                className="min-w-0 flex-1 px-4 text-sm text-[#161616] outline-none"
                placeholder="Cerca: cloud, privacy, comuni, PNRR..."
              />
              <label className="sr-only" htmlFor="channel">
                Canale
              </label>
              <select id="channel" name="channel" className="border-l border-black/10 px-3 text-sm text-[#161616] outline-none">
                <option value="all">Tutto</option>
                <option value="normativa">Normativa</option>
                <option value="bandi">Bandi</option>
              </select>
              <button className="grid w-14 place-items-center bg-[#36d399] text-[#101312]" type="submit" aria-label="Cerca">
                <Search size={20} aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="border-b border-black/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-0 px-5 sm:px-8 md:grid-cols-4 lg:px-10">
          <Metric label="Alert totali" value={allResult.stats.totalAlerts.toString()} icon={<Activity size={18} aria-hidden="true" />} />
          <Metric label="Fonti attive" value={allResult.stats.activeSources.toString()} icon={<Database size={18} aria-hidden="true" />} />
          <Metric label="Canale bandi" value={bandiResult.stats.totalAlerts.toString()} icon={<Briefcase size={18} aria-hidden="true" />} />
          <Metric label="Canale normativa" value={normativaResult.stats.totalAlerts.toString()} icon={<Scale size={18} aria-hidden="true" />} />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_360px] lg:px-10">
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
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

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#0b7a53]">Alert prioritari</p>
              <h2 className="text-2xl font-semibold">Segnali recenti</h2>
            </div>
            <a className="inline-flex items-center gap-2 text-sm font-semibold text-[#075e54] hover:underline" href="/api/alerts">
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

        <aside className="space-y-4">
          <div className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Pipeline</h2>
            <div className="mt-4 space-y-3 text-sm text-black/65">
              <PipelineItem icon={<Radar size={16} aria-hidden="true" />} title="Recupera" text="Legge RSS e fonti pubbliche ufficiali." />
              <PipelineItem icon={<GitBranch size={16} aria-hidden="true" />} title="Estrae" text="Rileva scadenze, importi, CIG, CUP, requisiti e beneficiari." />
              <PipelineItem icon={<Database size={16} aria-hidden="true" />} title="Indicizza" text="Genera knowledge JSON, embeddings e vector store." />
              <PipelineItem icon={<Network size={16} aria-hidden="true" />} title="Brain" text="Crea vault Obsidian con link semantici e grafo locale." />
              <PipelineItem icon={<Rss size={16} aria-hidden="true" />} title="Distribuisce" text="Pubblica alert, report, feed e Slack digest opzionale." />
            </div>
          </div>

          <div className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#075e54]">
              <Scale size={17} aria-hidden="true" />
              <h2 className="text-base font-semibold text-black">Feed normativa</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
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
                <span key={item} className="rounded-md border border-black/10 bg-[#f7f7f4] px-2 py-1 text-xs font-medium text-black/70">
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-black/60">
              Ogni alert prova a trasformare la novita in impatto: chi e&apos; colpito, cosa deve fare, entro quando, rischio e opportunita.
            </p>
          </div>

          <div className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Obsidian brain</h2>
            <div className="mt-4 grid gap-2">
              <DownloadLink href="/api/brain.zip" label="Vault completa" />
              <DownloadLink href="/api/brain/normativa.zip" label="Solo normativa" />
              <DownloadLink href="/api/brain/bandi.zip" label="Solo bandi" />
              <DownloadLink href="/api/semantic?q=pnrr%20cloud&channel=bandi" label="Ricerca semantica" icon={<Network size={15} aria-hidden="true" />} />
              <DownloadLink href="/api/vector-store?channel=all" label="Vector store" icon={<Database size={15} aria-hidden="true" />} />
              <DownloadLink href="/api/notify/slack?channel=bandi" label="Slack digest" icon={<Bell size={15} aria-hidden="true" />} />
            </div>
          </div>

          <div className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Fonte GitHub</h2>
            <a
              className="mt-4 flex items-center justify-between rounded-md border border-black/10 p-3 text-sm font-semibold hover:border-[#36d399]"
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
            <p className="mt-3 text-sm leading-6 text-black/60">
              Repository pubblico del MVP: codice sorgente, README, pipeline OSINT/RAG, fonti e brain Obsidian.
            </p>
          </div>

          <div className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Fonti attive</h2>
            <div className="mt-4 space-y-3">
              {allResult.sources.map((source) => (
                <a
                  key={source.id}
                  className="block rounded-md border border-black/10 p-3 hover:border-[#36d399]"
                  href={source.homepage}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{source.name}</span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </div>
                  <p className="mt-1 font-mono text-xs text-black/50">
                    {source.channel} · {source.cadence}
                  </p>
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-black/10 bg-[#fffaf0] p-4 shadow-sm">
            <h2 className="text-base font-semibold">Tag dominanti</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {allResult.stats.topTags.map((item) => (
                <span key={item.tag} className="rounded-md bg-white px-2 py-1 text-sm text-black/70">
                  {item.tag} <span className="font-mono text-black/45">{item.count}</span>
                </span>
              ))}
            </div>
          </div>

          {allResult.errors.length > 0 ? (
            <div className="rounded-md border border-[#c2410c]/25 bg-[#fff7ed] p-4 text-sm text-[#7c2d12]">
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
    </main>
  );
}

function FeedButton({ href, label }: { href: string; label: string }) {
  return (
    <a className="inline-flex h-10 items-center gap-2 rounded-md border border-white/20 px-3 text-sm font-medium hover:bg-white/10" href={href}>
      <Rss size={16} aria-hidden="true" />
      {label}
    </a>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="border-black/10 py-5 md:border-r md:px-5 first:md:pl-0 last:md:border-r-0">
      <div className="mb-2 flex items-center gap-2 text-[#075e54]">{icon}</div>
      <p className="text-3xl font-semibold leading-none">{value}</p>
      <p className="mt-2 text-sm text-black/55">{label}</p>
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
    <section className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#075e54]">{icon}</div>
          <h2 className="text-lg font-semibold">{channelLabel(result.channel)}</h2>
          <p className="mt-1 text-sm text-black/55">
            {result.stats.totalAlerts} alert da {result.stats.activeSources} fonti
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="inline-flex items-center gap-2 rounded-md bg-[#101312] px-3 py-2 text-sm font-semibold text-white hover:bg-[#25312d]" href={href}>
            RSS
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <a className="inline-flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-[#101312] hover:bg-[#f2f2ed]" href={brainHref}>
            ZIP
            <Download size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {result.stats.topTags.slice(0, 5).map((item) => (
          <span key={item.tag} className="rounded-md border border-black/10 px-2 py-1 text-xs text-black/60">
            {item.tag}
          </span>
        ))}
      </div>
    </section>
  );
}

function DownloadLink({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <a className="inline-flex items-center justify-between rounded-md border border-black/10 px-3 py-2 text-sm font-semibold hover:border-[#36d399]" href={href}>
      <span>{label}</span>
      {icon ?? <Download size={15} aria-hidden="true" />}
    </a>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <article className="rounded-md border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-[#e6f7ef] px-2 py-1 font-mono text-xs text-[#075e54]">{alert.channel}</span>
          <span className="rounded-md bg-[#edf3ff] px-2 py-1 font-mono text-xs text-[#164e8f]">{alert.kind}</span>
          <span className="rounded-md bg-[#fff1c7] px-2 py-1 font-mono text-xs text-[#7a5600]">score {alert.score}</span>
        </div>
        <time className="font-mono text-xs text-black/50" dateTime={alert.publishedAt}>
          {formatDate(alert.publishedAt)}
        </time>
      </div>
      <h3 className="text-lg font-semibold leading-snug">{alert.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-black/65">{alert.summary}</p>
      <FieldSummary alert={alert} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {alert.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="rounded-md border border-black/10 px-2 py-1 text-xs text-black/60">
              {tag}
            </span>
          ))}
        </div>
        <a
          className="inline-flex items-center gap-2 rounded-md bg-[#101312] px-3 py-2 text-sm font-semibold text-white hover:bg-[#25312d]"
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
        <span key={chip} className="rounded-md bg-[#f2f2ed] px-2 py-1 font-mono text-xs text-black/55">
          {chip}
        </span>
      ))}
    </div>
  );
}

function PipelineItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-[#075e54]">{icon}</div>
      <div>
        <p className="font-semibold text-black">{title}</p>
        <p>{text}</p>
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
