import React, { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { trpc } from "@/lib/trpc";
import { friendlyAdminErrorMessage } from "@/lib/adminFeedback";

type TimelineActionFilter = "all" | "handle_changed" | "reactivated" | "reprocessed";

function formatTimestamp(value: string | Date | null) {
  if (!value) return "Ainda não registrada";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function csvCell(value: string | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function SourceOperationalTimeline({ sourceKey, sourceStatus }: { sourceKey: string; sourceStatus: string }) {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<TimelineActionFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const from = fromDate ? new Date(`${fromDate}T00:00:00.000Z`).toISOString() : undefined;
  const to = toDate ? new Date(`${toDate}T23:59:59.999Z`).toISOString() : undefined;
  const status: "open" | "closed" = sourceStatus === "open" ? "open" : "closed";
  const firstControlRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstControlRef.current?.focus(); }, []);
  const timeline = trpc.ingestionSources.operationalTimeline.useQuery({ sourceKey, page, pageSize: 5, action: actionFilter === "all" ? undefined : actionFilter, from, to }, { staleTime: 30_000, refetchInterval: 30_000 });
  const exportInput = { sourceKey, action: actionFilter === "all" ? undefined : actionFilter, from, to, status };
  const exportTimeline = trpc.ingestionSources.operationalTimelineExport.useQuery(exportInput, { enabled: false });
  const exportJsonTimeline = trpc.ingestionSources.operationalTimelineJsonExport.useQuery(exportInput, { enabled: false });
  const label = (action: string) => action === "handle_changed" ? "ID Meta alterado" : action === "reactivated" ? "Fonte reativada" : "Reprocessamento imediato";
  const exportCsv = async () => {
    try {
      const result = await exportTimeline.refetch();
      const items = result.data?.items ?? [];
      const rows = [["operador", "ação", "data/hora", "motivo"], ...items.map(item => [item.actorOpenId ?? "", label(item.action), item.occurredAt, item.details ?? ""])];
      const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      const actionName = actionFilter === "all" ? "todas" : actionFilter;
      const dateName = fromDate || toDate ? `${fromDate || "inicio"}_${toDate || "fim"}` : "todas-datas";
      link.download = `auditoria_${actionName}_${dateName}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      sonnerToast.error("Não foi possível exportar o histórico", { description: friendlyAdminErrorMessage(error, "Tente novamente.") });
    }
  };
  const exportJson = async () => {
    try {
      const result = await exportJsonTimeline.refetch();
      const payload = JSON.stringify(result.data ?? { sourceKey, exportedAt: new Date().toISOString(), total: 0, items: [] }, null, 2);
      const url = URL.createObjectURL(new Blob([payload], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      const actionName = actionFilter === "all" ? "todas" : actionFilter;
      const dateName = fromDate || toDate ? `${fromDate || "inicio"}_${toDate || "fim"}` : "todas-datas";
      link.download = `auditoria_${actionName}_${dateName}_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      sonnerToast.error("Não foi possível exportar o JSON", { description: friendlyAdminErrorMessage(error, "Tente novamente.") });
    }
  };
  const counts = timeline.data?.actionCounts ?? { all: 0, handle_changed: 0, reactivated: 0, reprocessed: 0 };
  const clearFilters = () => { setFromDate(""); setToDate(""); setActionFilter("all"); setPage(1); };
  return <div className="mt-4" data-testid={`operational-timeline-${sourceKey}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Timeline operacional</p>{timeline.data && <span className="text-[10px] text-zinc-500">{timeline.data.total} evento(s)</span>}</div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void exportCsv()} disabled={exportTimeline.isFetching} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-bold text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-wait disabled:opacity-50" aria-busy={exportTimeline.isFetching}>{exportTimeline.isFetching ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} {exportTimeline.isFetching ? "Gerando CSV..." : "Exportar Histórico (CSV)"}</button><button type="button" onClick={() => void exportJson()} disabled={exportJsonTimeline.isFetching} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-bold text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-wait disabled:opacity-50" aria-busy={exportJsonTimeline.isFetching} aria-label="Exportar timeline em JSON">{exportJsonTimeline.isFetching ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} {exportJsonTimeline.isFetching ? "Gerando JSON..." : "Exportar JSON"}</button><button type="button" onClick={clearFilters} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-bold text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300" aria-label="Limpar filtros da timeline">Limpar filtros</button></div></div><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">Data inicial<input ref={firstControlRef} autoFocus aria-label="Data inicial da timeline" type="date" value={fromDate} onChange={event => { setFromDate(event.target.value); setPage(1); }} className="min-h-10 rounded-lg border border-white/10 bg-zinc-950 px-2 text-xs normal-case tracking-normal text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300" /></label><label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">Data final<input aria-label="Data final da timeline" type="date" value={toDate} onChange={event => { setToDate(event.target.value); setPage(1); }} className="min-h-10 rounded-lg border border-white/10 bg-zinc-950 px-2 text-xs normal-case tracking-normal text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300" /></label></div><div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar timeline por ação">{([ ["all", `Todas (${counts.all})`], ["handle_changed", `Edição de ID Meta (${counts.handle_changed})`], ["reactivated", `Reativações (${counts.reactivated})`], ["reprocessed", `Reprocessamentos (${counts.reprocessed})`] ] as const).map(([value, text]) => <button key={value} type="button" onClick={() => { setActionFilter(value); setPage(1); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActionFilter(value); setPage(1); } }} aria-label={text} aria-pressed={actionFilter === value} className={`min-h-10 rounded-lg border px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${actionFilter === value ? "border-orange-300/60 bg-orange-300/10 text-orange-100" : "border-white/10 text-zinc-400"}`}>{text}</button>)}</div>{timeline.data?.items?.length ? <><ol className="mt-2 space-y-2">{timeline.data.items.map(item => <li key={item.id} className="border-l border-emerald-300/40 pl-3 text-xs text-zinc-300"><strong>{label(item.action)}</strong><time className="ml-2 text-zinc-500" dateTime={item.occurredAt}>{formatTimestamp(item.occurredAt)}</time>{item.actorOpenId && <span className="mt-0.5 block text-[10px] text-zinc-500">Operador: {item.actorOpenId}</span>}{item.details && <span className="mt-0.5 block text-[10px] text-zinc-400">{item.details}</span>}</li>)}</ol><div className="mt-3 flex items-center justify-between gap-2"><button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1} aria-label="Página anterior da timeline" className="min-h-10 rounded-lg border border-white/10 px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40">Anterior</button><span className="text-[10px] text-zinc-500" aria-live="polite">Página {page}</span><button type="button" onClick={() => setPage(value => value + 1)} disabled={!timeline.data.hasNextPage} aria-label="Próxima página da timeline" className="min-h-10 rounded-lg border border-white/10 px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-40">Próxima</button></div></> : <p className="mt-2 text-xs text-zinc-500">Nenhum evento operacional registrado.</p>}</div>;
}

export default SourceOperationalTimeline;
