import React from "react";
import { CheckCircle2, Clock3, Power, RefreshCw, Save, SlidersHorizontal } from "lucide-react";
import { trpc } from "@/lib/trpc";

const frequencyOptions = [
  { value: 1440, label: "Diária" },
  { value: 10080, label: "Semanal" },
  { value: 20160, label: "A cada 14 dias" },
];

function formatLastSuccess(value: string | Date | null) {
  if (!value) return "Ainda não executada";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminSourcesPanel() {
  const sources = trpc.ingestionSources.list.useQuery(undefined, { refetchInterval: 30_000 });
  const utils = trpc.useUtils();
  const update = trpc.ingestionSources.update.useMutation({ onSuccess: () => utils.ingestionSources.list.invalidate() });

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7" aria-labelledby="sources-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-orange-200"><SlidersHorizontal size={18} /><p className="text-xs font-black uppercase tracking-[0.2em]">Governança da ingestão</p></div>
          <h2 id="sources-heading" className="mt-2 text-xl font-black">Fontes monitoradas</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">Ative ou pause perfis, ajuste a prioridade e defina a cadência desejada. A rotina existente continua sendo a responsável pelo disparo, evitando schedules duplicados.</p>
        </div>
        <button type="button" onClick={() => sources.refetch()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-300 hover:border-orange-300/50 hover:text-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300" aria-label="Atualizar fontes"><RefreshCw size={14} className={sources.isFetching ? "animate-spin" : ""} /> Atualizar</button>
      </div>
      {sources.isLoading && <p className="mt-5 rounded-2xl border border-white/10 p-5 text-sm text-zinc-400">Carregando fontes...</p>}
      {sources.isError && <p role="alert" className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-5 text-sm text-rose-100">Não foi possível carregar as fontes. Tente atualizar novamente.</p>}
      <div className="mt-5 space-y-3">
        {sources.data?.map(source => (
          <article key={source.id} className="rounded-2xl border border-white/10 bg-zinc-950/35 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-white">{source.name}</h3><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">{source.kind === "instagram" ? "Instagram" : "Fonte pública"}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${source.isEnabled ? "bg-emerald-400/15 text-emerald-200" : "bg-zinc-700/50 text-zinc-400"}`}>{source.isEnabled ? "Ativa" : "Pausada"}</span></div>
                <p className="mt-1 truncate text-xs text-zinc-500">{source.handle ? `@${source.handle}` : source.url}</p>
                <p className="mt-2 flex items-center gap-2 text-xs text-zinc-400"><Clock3 size={13} className="text-orange-300" /> Último sucesso: {formatLastSuccess(source.lastSuccessAt)} <span aria-hidden="true">·</span> <span className={source.lastStatus === "failed" ? "text-rose-200" : "text-zinc-400"}>{source.lastStatus}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Prioridade<input aria-label={`Prioridade de ${source.name}`} type="number" min={1} max={1000} defaultValue={source.priority} onBlur={event => update.mutate({ id: source.id, isEnabled: source.isEnabled === 1, priority: Number(event.currentTarget.value), frequencyMinutes: source.frequencyMinutes })} className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm font-bold text-white outline-none focus:border-orange-300/60" /></label>
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Frequência<select aria-label={`Frequência de ${source.name}`} defaultValue={source.frequencyMinutes} onChange={event => update.mutate({ id: source.id, isEnabled: source.isEnabled === 1, priority: source.priority, frequencyMinutes: Number(event.currentTarget.value) })} className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm font-bold text-white outline-none focus:border-orange-300/60">{frequencyOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <button type="button" onClick={() => update.mutate({ id: source.id, isEnabled: source.isEnabled !== 1, priority: source.priority, frequencyMinutes: source.frequencyMinutes })} disabled={update.isPending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-black text-zinc-200 hover:border-orange-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-50" aria-pressed={source.isEnabled === 1}><Power size={14} /> {source.isEnabled ? "Pausar" : "Ativar"}</button>
              </div>
            </div>
            {update.isPending && <p className="mt-3 flex items-center gap-2 text-xs text-orange-200"><Save size={13} /> Salvando configuração...</p>}
            {source.lastStatus === "succeeded" && <p className="mt-3 flex items-center gap-2 text-xs text-emerald-200"><CheckCircle2 size={13} /> A fonte respondeu com sucesso na última execução.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

export { frequencyOptions };

