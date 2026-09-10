import React from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const copy = {
  closed: { label: "OPERACIONAL", tone: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100", Icon: CheckCircle2, help: "A fonte está operacional e pode receber novas tentativas." },
  half_open: { label: "HALF-OPEN · TESTE", tone: "border-yellow-300/25 bg-yellow-300/10 text-yellow-100", Icon: Clock3, help: "O cooldown terminou. Uma tentativa isolada está sendo permitida para confirmar a recuperação da fonte." },
  open: { label: "PAUSADO: CIRCUIT OPEN", tone: "border-red-300/30 bg-red-300/10 text-red-100", Icon: ShieldAlert, help: "A fonte atingiu três falhas críticas consecutivas e está pausada até o fim do cooldown. Nenhuma nova requisição será enviada nesse período." },
} as const;

export default function AdminCircuitBreakerPanel() {
  const statuses = trpc.circuitBreaker.statuses.useQuery(undefined, { refetchInterval: 30_000 });
  const resetActive = trpc.circuitBreaker.resetActive.useMutation({
    onSuccess: async result => {
      await statuses.refetch();
      sonnerToast.success("Circuit Breaker resetado", { description: `${result.resetCount} fonte(s) ativa(s) voltaram ao estado operacional. A freshness existente foi preservada.` });
    },
    onError: error => sonnerToast.error("Não foi possível resetar as fontes", { description: error.message || "Tente novamente." }),
  });
  return <section aria-labelledby="circuit-breaker-title" className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-cyan-200"><ShieldAlert size={18} /><p className="text-xs font-black uppercase tracking-[0.18em]">Proteção de fontes</p></div><h2 id="circuit-breaker-title" className="mt-2 text-xl font-black text-white">Circuit Breaker</h2><p className="mt-1 text-sm leading-relaxed text-zinc-400">Após três falhas críticas consecutivas, a fonte é pausada por 18 horas para evitar novas tentativas durante a instabilidade.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void statuses.refetch()} disabled={statuses.isFetching || resetActive.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-xs font-black text-zinc-200 transition hover:border-cyan-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:opacity-50"><RefreshCw size={14} className={statuses.isFetching ? "animate-spin" : ""} /> Atualizar</button><button type="button" onClick={() => { if (resetActive.isPending) return; if (window.confirm("Resetar o Circuit Breaker de todas as fontes ativas? Isso remove o cooldown e preserva a freshness já registrada.")) resetActive.mutate(); }} disabled={statuses.isFetching || resetActive.isPending} aria-busy={resetActive.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-yellow-300/30 px-4 text-xs font-black text-yellow-100 transition hover:bg-yellow-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 disabled:opacity-50">{resetActive.isPending ? <><Loader2 size={14} className="animate-spin" /> Resetando...</> : "Resetar fontes ativas"}</button></div></div>
    {statuses.isLoading && <p role="status" className="mt-5 text-sm text-zinc-400">Consultando estado das fontes…</p>}
    {statuses.isError && <p role="alert" className="mt-5 rounded-xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">Não foi possível consultar os disjuntores.</p>}
    {!!statuses.data?.length && <div className="mt-5 grid gap-3 md:grid-cols-2">{statuses.data.map(status => { const visual = copy[status.circuitState]; const Icon = visual.Icon; const nextAttempt = status.circuitNextAttemptAt ? new Date(status.circuitNextAttemptAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null; return <article key={status.sourceKey} className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-white">{status.name}</p><p className="mt-1 text-[11px] text-zinc-500">{status.sourceKey}</p></div><Tooltip><TooltipTrigger asChild><span tabIndex={0} aria-label={`${visual.label}: ${visual.help}`} className={`inline-flex cursor-help items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-200 ${visual.tone}`}><Icon size={12} aria-hidden="true" /> {visual.label}</span></TooltipTrigger><TooltipContent side="top" sideOffset={8} className="max-w-xs leading-relaxed">{visual.help}</TooltipContent></Tooltip></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400"><span>Falhas: <strong className="text-zinc-200">{status.circuitFailureCount}</strong></span>{nextAttempt && <span>Próxima tentativa: <strong className="text-yellow-100">{nextAttempt}</strong></span>}</div>{status.circuitLastError && <p className="mt-3 flex gap-2 text-xs leading-relaxed text-zinc-500"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-orange-300" /> {status.circuitLastError}</p>}</article>; })}</div>}
  </section>;
}
