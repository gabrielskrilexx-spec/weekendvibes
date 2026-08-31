import { useEffect, useMemo, useState } from "react";
import { Download, HeartPulse, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
const formatDuration = (value: number | null) => value == null ? "—" : `${value} ms`;

export default function HeartbeatTimelinePanel() {
  const initialExecutionId = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("heartbeat_execution_id") ?? "";
  const [heartbeatExecutionId, setHeartbeatExecutionId] = useState(initialExecutionId);
  const [draftExecutionId, setDraftExecutionId] = useState(initialExecutionId);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("json");

  useEffect(() => {
    const url = new URL(window.location.href);
    if (heartbeatExecutionId) url.searchParams.set("heartbeat_execution_id", heartbeatExecutionId);
    else url.searchParams.delete("heartbeat_execution_id");
    window.history.replaceState({}, "", url);
  }, [heartbeatExecutionId]);

  const enabled = heartbeatExecutionId.trim().length > 0;
  const timeline = trpc.heartbeat.timeline.useQuery({ heartbeatExecutionId, offset, limit }, { enabled, refetchInterval: enabled ? 30_000 : false });
  const summary = trpc.heartbeat.summary.useQuery({ heartbeatExecutionId }, { enabled });
  const startExport = trpc.heartbeat.startTimelineExport.useMutation({ onSuccess: data => { setExportJobId(data.jobId); toast.success("Exportação iniciada", { description: "O relatório está sendo preparado em segundo plano." }); }, onError: error => toast.error("Não foi possível exportar", { description: error.message }) });
  const exportStatus = trpc.heartbeat.exportStatus.useQuery({ jobId: exportJobId ?? "" }, { enabled: Boolean(exportJobId), refetchInterval: query => query.state.data?.status === "completed" || query.state.data?.status === "failed" || query.state.data?.status === "cancelled" || query.state.data?.status === "expired" ? false : 1500 });
  const download = trpc.heartbeat.exportDownload.useQuery({ jobId: exportJobId ?? "" }, { enabled: false });

  const statusTone = useMemo(() => {
    const status = summary.data?.status;
    return status === "succeeded" ? "text-emerald-200" : status === "failed" || status === "timeout" ? "text-red-200" : "text-yellow-200";
  }, [summary.data?.status]);

  const selectExecution = () => {
    const next = draftExecutionId.trim();
    setOffset(0);
    setHeartbeatExecutionId(next);
  };

  const downloadReport = async () => {
    const result = await download.refetch();
    if (!result.data) return toast.error("O arquivo ainda não está disponível.");
    const anchor = document.createElement("a");
    anchor.href = result.data.downloadUrl;
    anchor.download = result.data.fileName;
    anchor.rel = "noopener";
    anchor.click();
  };

  return (
    <section className="mt-6 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5 text-zinc-100 sm:p-7" data-testid="heartbeat-timeline-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200"><HeartPulse size={15} /> Observabilidade M2M</p>
          <h2 className="mt-2 text-2xl font-black">Timeline do Heartbeat</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">Inspecione eventos, logs e durações de uma execução específica do agendador.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input aria-label="Heartbeat execution ID" value={draftExecutionId} onChange={event => setDraftExecutionId(event.target.value)} onKeyDown={event => { if (event.key === "Enter") selectExecution(); }} placeholder="heartbeatExecutionId" className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-cyan-200/60" />
          <button type="button" onClick={selectExecution} disabled={!draftExecutionId.trim()} className="min-h-11 rounded-xl bg-cyan-200 px-4 text-sm font-black text-zinc-950 disabled:opacity-40">Consultar</button>
        </div>
      </div>

      {!enabled ? <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">Informe um `heartbeatExecutionId` para carregar a timeline.</div> : <>
        {summary.data && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div><span className="text-xs text-zinc-500">Status</span><p className={`mt-1 font-black ${statusTone}`}>{summary.data.status}</p></div>
          <div><span className="text-xs text-zinc-500">Início</span><p className="mt-1 text-sm">{formatDate(summary.data.startedAt)}</p></div>
          <div><span className="text-xs text-zinc-500">Fim</span><p className="mt-1 text-sm">{formatDate(summary.data.finishedAt)}</p></div>
          <div><span className="text-xs text-zinc-500">Duração</span><p className="mt-1 text-sm">{formatDuration(summary.data.durationMs)}</p></div>
          <div><span className="text-xs text-zinc-500">Eventos / alertas</span><p className="mt-1 text-sm">{summary.data.eventCount} / {summary.data.alertCount}</p></div>
        </div>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><label htmlFor="heartbeat-page-size" className="text-xs text-zinc-400">Eventos por página</label><select id="heartbeat-page-size" value={limit} onChange={event => { setLimit(Number(event.target.value)); setOffset(0); }} className="min-h-9 rounded-lg border border-white/10 bg-black/20 px-2 text-xs"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select><button type="button" onClick={() => void timeline.refetch()} aria-label="Atualizar timeline do Heartbeat" className="rounded-lg border border-white/10 p-2 text-zinc-300"><RefreshCw size={14} /></button></div>
          <div className="flex items-center gap-2"><select aria-label="Formato da exportação do Heartbeat" value={exportFormat} onChange={event => setExportFormat(event.target.value as "csv" | "json")} className="min-h-9 rounded-lg border border-white/10 bg-black/20 px-2 text-xs"><option value="json">JSON</option><option value="csv">CSV</option></select><button type="button" onClick={() => startExport.mutate({ format: exportFormat, heartbeatExecutionId })} disabled={startExport.isPending} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-fuchsia-300 px-3 text-xs font-black text-zinc-950 disabled:opacity-40">{startExport.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Exportar timeline</button></div>
        </div>
        {exportStatus.data && <div className="mt-3 rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-2 text-xs text-fuchsia-100" role="status">Exportação: {exportStatus.data.status} ({exportStatus.data.progress}%). {exportStatus.data.status === "completed" && <button type="button" onClick={() => void downloadReport()} className="ml-2 font-black underline">Baixar arquivo</button>}</div>}
        {timeline.isLoading && <p className="py-8 text-sm text-zinc-500" role="status">Carregando eventos do Heartbeat…</p>}
        {timeline.isError && <p className="mt-4 rounded-xl border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm text-red-100" role="alert">Não foi possível consultar esta execução.</p>}
        {!timeline.isLoading && !timeline.isError && timeline.data?.items.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">Nenhum evento registrado para este identificador.</p>}
        {timeline.data && timeline.data.items.length > 0 && <div className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/15">{timeline.data.items.map(item => <article key={item.id} className="grid gap-2 px-4 py-4 sm:grid-cols-[80px_130px_1fr_auto] sm:items-center"><span className="text-xs font-black text-cyan-200">#{item.sequence}</span><span className="text-xs uppercase tracking-wide text-zinc-400">{item.eventType}</span><div><p className="text-sm text-zinc-200">{item.message ?? "Sem mensagem"}</p><p className="mt-1 text-xs text-zinc-500">{formatDate(item.timestamp)}{item.status ? ` · ${item.status}` : ""}</p></div><span className="text-xs text-zinc-400">{formatDuration(item.durationMs)}</span></article>)}</div>}
        {timeline.data && <div className="mt-4 flex items-center justify-between"><button type="button" onClick={() => setOffset(current => Math.max(0, current - limit))} disabled={offset === 0 || timeline.isFetching} className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-40">Anterior</button><span className="text-xs text-zinc-500">Offset {offset}</span><button type="button" onClick={() => setOffset(current => current + limit)} disabled={!timeline.data.hasNextPage || timeline.isFetching} className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-40">Próxima</button></div>}
      </>}
    </section>
  );
}
