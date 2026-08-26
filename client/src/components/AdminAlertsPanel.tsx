import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { trpc } from "@/lib/trpc";

const integrationLabels: Record<string, string> = {
  meta: "Meta Graph API",
  public: "Fontes públicas",
  ocr: "OCR",
  openai: "OpenAI",
  pipeline: "Pipeline",
};

export default function AdminAlertsPanel() {
  const [status, setStatus] = useState<"all" | "open" | "resolved">("open");
  const [integration, setIntegration] = useState("all");
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const report = trpc.ingestionReports.summary.useQuery(undefined, { refetchInterval: 30_000 });
  const resolveAll = trpc.operationalAlerts.resolveAll.useMutation({
    onSuccess: async result => {
      await report.refetch();
      sonnerToast.success("Pendências arquivadas", { description: `${result.resolvedCount} alerta(s) antigo(s) foram marcados como resolvidos.` });
    },
    onError: error => sonnerToast.error("Não foi possível limpar as pendências", { description: error.message || "Tente novamente." }),
  });
  const resolve = trpc.operationalAlerts.resolve.useMutation({
    onSuccess: async () => {
      await report.refetch();
      sonnerToast.success("Alerta resolvido", { description: "O alerta foi marcado como resolvido." });
    },
    onError: error => sonnerToast.error("Não foi possível resolver o alerta", { description: error.message || "Tente novamente." }),
    onSettled: () => setResolvingId(null),
  });
  const alerts = useMemo(() => (report.data?.alerts ?? []).filter(alert => {
    const statusMatches = status === "all" || (status === "open" ? alert.isResolved === 0 : alert.isResolved === 1);
    const integrationMatches = integration === "all" || alert.integration === integration;
    return statusMatches && integrationMatches;
  }), [report.data?.alerts, status, integration]);
  const openCount = (report.data?.alerts ?? []).filter(alert => alert.isResolved === 0).length;
  const resolvedCount = (report.data?.alerts ?? []).filter(alert => alert.isResolved === 1).length;
  const refresh = () => void report.refetch();

  return <section aria-labelledby="admin-alerts-heading" className="mt-6 rounded-3xl border border-red-300/20 bg-red-300/[0.04] p-5 sm:p-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-red-200">Segurança operacional</p>
        <h2 id="admin-alerts-heading" className="mt-1 text-xl font-black">Alertas de integração</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">Área exclusiva para administradores acompanharem falhas de Meta, OCR, OpenAI, fontes públicas e do pipeline.</p>
      </div>
      <div className="flex flex-wrap gap-2 self-start">
        <button type="button" onClick={refresh} disabled={report.isFetching || resolveAll.isPending} aria-label="Atualizar alertas de integração" aria-busy={report.isFetching} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-wait disabled:opacity-50"><RefreshCw size={15} className={report.isFetching ? "animate-spin" : ""} /> {report.isFetching ? "Atualizando..." : "Atualizar"}</button>
        <button type="button" onClick={() => { if (window.confirm(`Arquivar ${openCount} alerta(s) em aberto? O histórico será preservado.`)) resolveAll.mutate(); }} disabled={openCount === 0 || report.isFetching || resolveAll.isPending} aria-label="Arquivar todas as pendências abertas" aria-busy={resolveAll.isPending} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-3 py-2 text-xs font-black text-zinc-950 hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-50">{resolveAll.isPending ? <><Loader2 size={15} className="animate-spin" /> Arquivando...</> : "Arquivar pendências"}</button>
      </div>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-4"><XCircle size={17} className="text-red-200" /><p className="mt-3 text-2xl font-black">{openCount}</p><p className="text-xs text-zinc-400">Em aberto</p></div>
      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4"><CheckCircle2 size={17} className="text-emerald-200" /><p className="mt-3 text-2xl font-black">{resolvedCount}</p><p className="text-xs text-zinc-400">Resolvidos</p></div>
      <div className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4"><AlertTriangle size={17} className="text-yellow-200" /><p className="mt-3 text-2xl font-black">{report.data?.criticalAlerts.length ?? 0}</p><p className="text-xs text-zinc-400">Críticos identificados</p></div>
    </div>

    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
      <label className="flex-1 text-xs font-bold text-zinc-400">Status<select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"><option value="open">Em aberto</option><option value="resolved">Resolvidos</option><option value="all">Todos</option></select></label>
      <label className="flex-1 text-xs font-bold text-zinc-400">Integração<select value={integration} onChange={event => setIntegration(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"><option value="all">Todas</option>{Object.entries(integrationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>

    <div className="mt-5 space-y-3" aria-live="polite">
      {report.isLoading && <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-400">Carregando alertas...</p>}
      {report.isError && <p role="alert" className="rounded-2xl border border-red-300/30 bg-red-300/10 p-5 text-sm text-red-100">Não foi possível carregar os alertas de integração.</p>}
      {!report.isLoading && !report.isError && alerts.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-500">Nenhum alerta corresponde aos filtros selecionados.</p>}
      {alerts.map(alert => {
        const rowPending = resolve.isPending && resolvingId === alert.id;
        return <article key={alert.id} className={`rounded-2xl border p-4 ${alert.isResolved ? "border-emerald-300/20 bg-emerald-300/[0.06]" : "border-red-300/20 bg-red-300/[0.08]"}`} aria-busy={rowPending}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-white">{alert.title}</h3><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{integrationLabels[alert.integration] ?? alert.integration}</span>{alert.isResolved === 1 && <span className="rounded-full bg-emerald-300/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200">Resolvido</span>}</div><p className="mt-2 text-sm leading-relaxed text-zinc-300">{alert.message}</p><p className="mt-2 text-[11px] text-zinc-500">Registrado em {new Date(alert.createdAt).toLocaleString("pt-BR")}</p></div>
            {alert.isResolved === 0 && <button type="button" onClick={() => { setResolvingId(alert.id); resolve.mutate({ id: alert.id }); }} disabled={resolve.isPending} aria-busy={rowPending} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-3 py-2 text-xs font-black text-zinc-950 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">{rowPending ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : "Marcar como resolvido"}</button>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
