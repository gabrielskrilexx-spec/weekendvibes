import React from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2, Play, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

const sourceLabels: Record<string, string> = {
  instagram: "Instagram",
  "public:ingresse": "Ingresse",
  "public:blackpass": "Black Pass",
  "public:mringressos": "Mr Ingressos",
  "public:articket": "Articket",
  "public:blacktag": "Blacktag",
  "public:zig": "Zig Tickets",
  "public:unknown": "Fonte pública",
};

const labelForSource = (sourceKey: string) => sourceLabels[sourceKey] ?? sourceKey.replace(/^public:/, "");
const numberValue = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

export default function AdminDryRunPanel() {
  const dryRun = trpc.ingestionReports.dryRun.useMutation();
  const report = dryRun.data;
  const run = () => dryRun.mutate();

  return <section aria-labelledby="dry-run-heading" className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5 sm:p-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200"><FlaskConical size={14} /> Simulação segura</p>
        <h2 id="dry-run-heading" className="mt-1 text-xl font-black">Dry-run da ingestão</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Varre as fontes ativas e aplica os filtros atuais sem criar eventos, atualizar caches, registrar runs ou alterar o estado operacional.</p>
      </div>
      <button type="button" onClick={run} disabled={dryRun.isPending} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-xs font-black text-zinc-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-wait disabled:opacity-60" aria-busy={dryRun.isPending}>
        {dryRun.isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
        {dryRun.isPending ? "Simulando..." : "Simular ingestão (Dry-run)"}
      </button>
    </div>

    {dryRun.error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-100"><XCircle size={18} className="mt-0.5 shrink-0" /><div><p className="font-bold">Não foi possível concluir a simulação.</p><p className="mt-1 text-red-100/80">{dryRun.error.message || "O servidor retornou uma falha sem detalhes."}</p></div></div>}

    {report && <div aria-live="polite" className="mt-6 space-y-5">
      <div className="grid gap-3 sm:grid-cols-5">
        {[
          ["Lidos", numberValue(report.totals.read)],
          ["Filtrados", numberValue(report.totals.filtered)],
          ["Seriam persistidos", numberValue(report.totals.persistable)],
          ["Duplicidades", numberValue(report.totals.duplicates)],
          ["Erros", numberValue(report.totals.errors)],
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div>)}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400"><CheckCircle2 size={15} className="text-emerald-300" /> Simulação concluída sem persistência · {numberValue(report.durationMs)} ms · {new Date(report.finishedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
      {report.sources.length === 0 ? <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400">Nenhuma fonte ativa retornou candidatos nesta simulação.</div> : <div className="grid gap-3 lg:grid-cols-2">{report.sources.map(source => <article key={`${source.routine}:${source.sourceKey}`} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-white">{labelForSource(source.sourceKey)}</h3><p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-zinc-500">{source.routine} · {source.sourceKey}</p></div>{source.errors.length > 0 ? <AlertTriangle size={18} className="shrink-0 text-yellow-200" /> : <CheckCircle2 size={18} className="shrink-0 text-emerald-300" />}</div><div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div><p className="text-zinc-500">Lidos</p><p className="font-black text-white">{numberValue(source.read)}</p></div><div><p className="text-zinc-500">Filtrados</p><p className="font-black text-white">{numberValue(source.filtered)}</p></div><div><p className="text-zinc-500">Persistíveis</p><p className="font-black text-cyan-200">{numberValue(source.persistable)}</p></div><div><p className="text-zinc-500">Duplicados</p><p className="font-black text-white">{numberValue(source.duplicates)}</p></div></div>{source.errors.length > 0 && <div className="mt-4 space-y-2">{source.errors.map((error, index) => <p key={`${source.sourceKey}-error-${index}`} className="rounded-xl border border-yellow-300/15 bg-yellow-300/5 p-3 text-xs leading-5 text-yellow-100">{error.status ? `HTTP ${error.status}: ` : ""}{error.message}</p>)}</div>}</article>)}</div>}
    </div>}
  </section>;
}
