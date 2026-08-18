import React, { useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, Play, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";

const formatExecution = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "Calculando…";

export default function AdminRoutinePanel() {
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const status = trpc.adminRoutine.status.useQuery(undefined, { refetchInterval: 30_000 });
  const runNow = trpc.adminRoutine.runNow.useMutation({
    onSuccess: result => {
      setFeedback({ type: "success", text: `Rotina concluída: ${result.publicSources && typeof result.publicSources === "object" && "imported" in result.publicSources ? String(result.publicSources.imported) : "0"} eventos públicos e atualização do Instagram processados.` });
      status.refetch();
    },
    onError: error => setFeedback({ type: "error", text: `A rotina falhou: ${error.message}` }),
  });
  const confirmRun = () => {
    if (runNow.isPending || status.data?.isRunning) return;
    if (globalThis.confirm("Executar agora a coleta pública e a ingestão do Instagram? O processo pode levar alguns minutos.")) {
      setFeedback(null);
      runNow.mutate();
    }
  };
  return <section className="mt-6 rounded-3xl border border-orange-300/20 bg-gradient-to-br from-orange-300/10 via-white/[0.04] to-fuchsia-400/10 p-5 sm:p-7" aria-labelledby="routine-title">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-orange-200"><CalendarClock size={18} /><p className="text-xs font-black uppercase tracking-[0.2em]">Automação da agenda</p></div>
        <h2 id="routine-title" className="mt-2 text-xl font-black">Rotina de quarta-feira</h2>
        {status.isLoading ? <p className="mt-2 text-sm text-zinc-400">Consultando a próxima execução…</p> : status.isError ? <p className="mt-2 text-sm text-red-200">Não foi possível consultar o schedule.</p> : <><p className="mt-2 text-sm text-zinc-300">Próxima execução: <strong className="text-white">{formatExecution(status.data?.nextExecutionAt)}</strong></p><p className="mt-1 text-xs text-zinc-500">Quartas-feiras às 10:00 · {status.data?.timezone} · modo {status.data?.runMode}</p></>}
      </div>
      <button type="button" onClick={confirmRun} disabled={runNow.isPending || status.data?.isRunning || status.isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-400 to-fuchsia-500 px-4 py-3 text-sm font-black text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Executar rotina de quarta-feira agora" title="Executar rotina de quarta-feira agora">
        {runNow.isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {runNow.isPending ? "Executando…" : "Executar agora"}
      </button>
    </div>
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400"><ShieldAlert size={16} className="mt-0.5 shrink-0 text-yellow-200" /><span>O disparo manual usa a mesma proteção administrativa, é idempotente e bloqueia uma segunda execução enquanto a primeira estiver em andamento.</span></div>
    {feedback && <div role="status" className={`mt-4 flex items-start gap-2 rounded-2xl border p-3 text-sm ${feedback.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{feedback.type === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <ShieldAlert size={16} className="mt-0.5 shrink-0" />}{feedback.text}</div>}
  </section>;
}
