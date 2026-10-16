import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Download, Loader2, Power, RefreshCw, Save, SlidersHorizontal } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { trpc } from "@/lib/trpc";
import { postAdminJson } from "@/lib/admin-rest";
import { friendlyAdminErrorMessage } from "@/lib/adminFeedback";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const frequencyOptions = [
  { value: 1440, label: "Diária" },
  { value: 10080, label: "Semanal" },
  { value: 20160, label: "A cada 14 dias" },
];

function formatLastSuccess(value: string | Date | null) {
  if (!value) return "Ainda não executada";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatTimestamp(value: string | Date | null) {
  if (!value) return "Ainda não registrada";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

type FailureFilter = "all" | "waf" | "meta110" | "network";
type TimelineActionFilter = "all" | "handle_changed" | "reactivated" | "reprocessed";

function classifyFailure(source: { lastMessage?: string | null; lastFailureReason?: string | null; lastHttpStatus?: number | null }) {
  const text = `${source.lastMessage ?? ""} ${source.lastFailureReason ?? ""}`.toLowerCase();
  if (source.lastHttpStatus === 403 || /waf|cloudflare|akamai|bloqueado/.test(text)) return "waf" as const;
  if (/code 110|invalid user id|id inválido|desconectado da meta/.test(text)) return "meta110" as const;
  if (/timeout|timed out|network|rede|econn|socket|fetch failed/.test(text) || source.lastHttpStatus === 408 || source.lastHttpStatus === 504) return "network" as const;
  return "all" as const;
}

function nextAttemptFor(source: { circuitState: string; circuitNextAttemptAt?: string | Date | null; lastAttemptAt?: string | Date | null; frequencyMinutes: number }) {
  if (source.circuitState !== "open" && source.circuitState !== "half_open") return null;
  if (source.circuitNextAttemptAt) return new Date(source.circuitNextAttemptAt);
  if (source.lastAttemptAt) return new Date(new Date(source.lastAttemptAt).getTime() + source.frequencyMinutes * 60_000);
  return null;
}

function csvCell(value: string | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function trendLabel(trend: { percentage: number; direction: "up" | "down" | "flat" } | undefined) {
  if (!trend) return "Comparativo indisponível";
  const arrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
  return `${arrow} ${Math.abs(trend.percentage)}% vs período anterior`;
}

function trendClass(trend: { direction: "up" | "down" | "flat" } | undefined, inverse = false) {
  if (!trend || trend.direction === "flat") return "text-zinc-400";
  const positive = inverse ? trend.direction === "down" : trend.direction === "up";
  return positive ? "text-emerald-200" : "text-rose-200";
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

export default function AdminSourcesPanel() {
  const [openOnly, setOpenOnly] = useState(false);
  const [failureFilter, setFailureFilter] = useState<FailureFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "7d" | "30d">("all");
  const [graphPeriod, setGraphPeriod] = useState<7 | 14 | 30>(14);
  const filterSince = periodFilter === "all" ? undefined : new Date(Date.now() - (periodFilter === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString();
  const sources = trpc.ingestionSources.list.useQuery({ openOnly: openOnly || undefined, failureCategory: failureFilter === "all" ? undefined : failureFilter, since: filterSince }, { refetchInterval: 30_000 });
  const sourceSummary = trpc.ingestionSources.summary.useQuery(undefined, { refetchInterval: 30_000 });
  const consolidatedReport = trpc.ingestionSources.consolidatedReport.useQuery(undefined, { enabled: false });
  const executiveReport = trpc.ingestionSources.executiveReport.useQuery({ days: graphPeriod }, { refetchInterval: 60_000 });
  const mockSettings = trpc.ingestionReports.mockSettings.useQuery(undefined, { refetchInterval: 30_000 });
  const utils = trpc.useUtils();
  const [pendingSourceId, setPendingSourceId] = useState<number | null>(null);
  const [pendingReactivationKey, setPendingReactivationKey] = useState<string | null>(null);
  const [pendingStorySourceId, setPendingStorySourceId] = useState<number | null>(null);
  const [reactivationTarget, setReactivationTarget] = useState<{ sourceKey: string; name: string } | null>(null);
  const [reprocessNow, setReprocessNow] = useState(true);
  const [isSyncingStories, setIsSyncingStories] = useState(false);
  const [newSourceOpen, setNewSourceOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceKind, setNewSourceKind] = useState<"instagram" | "public">("instagram");
  const [newSourceHandle, setNewSourceHandle] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [detailsSource, setDetailsSource] = useState<NonNullable<typeof sources.data>[number] | null>(null);
  const createSource = trpc.ingestionSources.create.useMutation({
    onSuccess: async () => {
      await utils.ingestionSources.list.invalidate();
      setNewSourceOpen(false);
      setNewSourceName("");
      setNewSourceKind("instagram");
      setNewSourceHandle("");
      setNewSourceUrl("");
      sonnerToast.success("Fonte cadastrada", { description: "A nova fonte foi adicionada à lista de monitoramento." });
    },
    onError: error => sonnerToast.error("Não foi possível cadastrar a fonte", { description: friendlyAdminErrorMessage(error, "Verifique os dados e tente novamente.") }),
  });
  const update = trpc.ingestionSources.update.useMutation({
    onSuccess: async () => {
      await utils.ingestionSources.list.invalidate();
      sonnerToast.success("Fonte atualizada", { description: "A configuração foi salva e será usada na próxima execução." });
    },
    onError: error => sonnerToast.error("Não foi possível salvar a fonte", { description: friendlyAdminErrorMessage(error, "Tente novamente.") }),
    onSettled: () => setPendingSourceId(null),
  });
  const reactivate = trpc.ingestionSources.reactivate.useMutation({
    onSuccess: async result => {
      await Promise.all([utils.ingestionSources.list.invalidate(), utils.ingestionSources.operationalTimeline.invalidate()]);
      sonnerToast.success(result.reprocess === "succeeded" ? "Fonte reativada e reprocessada" : "Fonte reativada", { description: result.reprocess === "failed" ? "A fonte foi reativada, mas o reprocessamento imediato falhou." : result.reprocess === "succeeded" ? "A execução focada terminou com sucesso." : "O bloqueio automático foi limpo; a fonte voltará ao próximo ciclo." });
    },
    onError: error => sonnerToast.error("Não foi possível reativar a fonte", { description: friendlyAdminErrorMessage(error, "Tente novamente.") }),
    onSettled: () => setPendingReactivationKey(null),
  });
  const mockSettingsUpdate = trpc.ingestionReports.setMockSettings.useMutation({
    onSuccess: async result => {
      await utils.ingestionReports.mockSettings.invalidate();
      sonnerToast.success(result.allowSandboxMocks ? "Mocks de sandbox ativados" : "Mocks de sandbox desativados", { description: result.allowSandboxMocks ? "Falhas externas no preview poderão usar eventos de teste marcados." : "O preview tentará acessar as fontes reais e não usará fallback simulado." });
    },
    onError: error => sonnerToast.error("Não foi possível atualizar os mocks", { description: friendlyAdminErrorMessage(error, "Tente novamente.") }),
  });
  const syncStories = async (sourceId: number, sourceKey: string) => {
    if (isSyncingStories) return;
    setPendingStorySourceId(sourceId);
    setIsSyncingStories(true);
    try {
      await postAdminJson("/api/v2/admin/sync-stories", { sourceKey });
      await Promise.all([utils.adminRoutine.status.invalidate(), utils.ingestionReports.logs.invalidate()]);
      sonnerToast.success("Stories sincronizados", { description: "A sincronização foi concluída e o processamento de Vision/OCR foi registrado.", icon: <CheckCircle2 size={16} aria-hidden="true" />, duration: 5000 });
    } catch (error) {
      sonnerToast.error("Não foi possível sincronizar Stories", { description: friendlyAdminErrorMessage(error, "Tente novamente.") });
    } finally {
      setPendingStorySourceId(null);
      setIsSyncingStories(false);
    }
  };
  const saveSource = (sourceId: number, input: { isEnabled: boolean; priority: number; frequencyMinutes: number; p95LatencyThresholdMs: number; handle?: string | null }) => {
    if (update.isPending) return;
    setPendingSourceId(sourceId);
    update.mutate({ id: sourceId, ...input });
  };
  const reactivateSource = (sourceKey: string) => {
    if (reactivate.isPending) return;
    const source = sources.data?.find(item => item.sourceKey === sourceKey);
    setReactivationTarget({ sourceKey, name: source?.name ?? sourceKey });
    setReprocessNow(true);
  };
  const confirmReactivation = () => {
    if (!reactivationTarget || reactivate.isPending) return;
    setPendingReactivationKey(reactivationTarget.sourceKey);
    reactivate.mutate({ sourceKey: reactivationTarget.sourceKey, reprocessNow });
    setReactivationTarget(null);
  };
  const downloadTelemetrySeries = (format: "csv" | "json") => {
    const series = executiveReport.data?.series ?? [];
    const category = failureFilter === "all" ? "geral" : failureFilter;
    const today = new Date().toISOString().slice(0, 10);
    const filename = `auditoria_${category}_${graphPeriod}dias_${today}.${format}`;
    const content = format === "json"
      ? JSON.stringify({ periodDays: graphPeriod, series }, null, 2)
      : `\uFEFFdate,waf,meta110,network,succeeded,total,successRate\n${series.map(point => [point.date, point.waf, point.meta110, point.network, point.succeeded, point.total, point.successRate].join(",")).join("\n")}`;
    const blob = new Blob([content], { type: format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  const downloadConsolidatedCatalog = async () => {
    try {
      const result = await consolidatedReport.refetch();
      const payload = JSON.stringify(result.data ?? { generatedAt: new Date().toISOString(), totalSources: 0, activeSources: 0, pausedSources: 0, sources: [] }, null, 2);
      const url = URL.createObjectURL(new Blob([payload], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `catalogo_consolidado_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      sonnerToast.error("Não foi possível exportar o catálogo consolidado", { description: friendlyAdminErrorMessage(error, "Tente novamente.") });
    }
  };
  const submitNewSource = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createSource.isPending) return;
    const name = newSourceName.trim();
    const handle = newSourceHandle.trim().replace(/^@+/, "");
    const url = newSourceUrl.trim();
    if (name.length < 2 || (!handle && !url)) {
      sonnerToast.error("Revise os dados da fonte", { description: "Informe o nome e um handle ou URL válida." });
      return;
    }
    createSource.mutate({ name, kind: newSourceKind, handle: handle || undefined, url: url || undefined });
  };

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7" aria-labelledby="sources-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-orange-200"><SlidersHorizontal size={18} /><p className="text-xs font-black uppercase tracking-[0.2em]">Governança da ingestão</p></div>
          <h2 id="sources-heading" className="mt-2 text-xl font-black">Fontes monitoradas</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">Ative ou pause perfis, ajuste a prioridade e defina a cadência desejada. A rotina existente continua sendo a responsável pelo disparo, evitando schedules duplicados.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void downloadConsolidatedCatalog()} disabled={consolidatedReport.isFetching} aria-busy={consolidatedReport.isFetching} aria-label="Exportar Catálogo Consolidado" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-orange-300/30 bg-orange-300/10 px-3 text-xs font-black text-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-50"><Download size={14} aria-hidden="true" /> {consolidatedReport.isFetching ? "Gerando catálogo..." : "Exportar Catálogo Consolidado"}</button>
          <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-300"><input type="checkbox" checked={openOnly} onChange={event => setOpenOnly(event.target.checked)} className="size-4 accent-rose-300" /> Apenas OPEN</label>
          <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-300">Falha<select aria-label="Filtrar por motivo da falha" value={failureFilter} onChange={event => setFailureFilter(event.target.value as FailureFilter)} className="min-h-9 rounded-lg border border-white/10 bg-zinc-900 px-2 text-xs text-white"><option value="all">Todas</option><option value="waf">WAF / Cloudflare</option><option value="meta110">Meta API (Code 110)</option><option value="network">Timeout / Rede</option></select></label>
          <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-300">Período<select aria-label="Filtrar por período" value={periodFilter} onChange={event => setPeriodFilter(event.target.value as typeof periodFilter)} className="min-h-9 rounded-lg border border-white/10 bg-zinc-900 px-2 text-xs text-white"><option value="all">Todos</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option></select></label>
          <button type="button" onClick={() => void sources.refetch()} disabled={sources.isFetching} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-300 hover:border-orange-300/50 hover:text-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-wait disabled:opacity-50" aria-label="Atualizar fontes" aria-busy={sources.isFetching}><RefreshCw size={14} className={sources.isFetching ? "animate-spin" : ""} /> {sources.isFetching ? "Atualizando..." : "Atualizar"}</button>
          <button type="button" onClick={() => setNewSourceOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-300 px-3 py-2 text-xs font-black text-zinc-950 hover:bg-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">Nova Fonte</button>
        </div>
      </div>
      {newSourceOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="new-source-title">
        <form onSubmit={submitNewSource} className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><h3 id="new-source-title" className="text-lg font-black text-white">Nova Fonte</h3><p className="mt-1 text-sm text-zinc-400">Cadastre um local para monitoramento automático.</p></div><button type="button" onClick={() => setNewSourceOpen(false)} className="rounded-lg px-2 py-1 text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300" aria-label="Fechar cadastro de fonte">×</button></div>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-zinc-400">Nome do local<input value={newSourceName} onChange={event => setNewSourceName(event.target.value)} autoFocus required minLength={2} maxLength={180} placeholder="Ex.: Bar da Praia" className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-orange-300/60" /></label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-zinc-400">Plataforma/Tipo<select value={newSourceKind} onChange={event => setNewSourceKind(event.target.value as "instagram" | "public")} className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-orange-300/60"><option value="instagram">Instagram</option><option value="public">Fonte pública</option></select></label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-zinc-400">Handle<input value={newSourceHandle} onChange={event => setNewSourceHandle(event.target.value)} maxLength={180} placeholder="@nomedobar (opcional se usar URL)" className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-orange-300/60" /></label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-zinc-400">URL<input value={newSourceUrl} onChange={event => setNewSourceUrl(event.target.value)} type="url" placeholder="https://... (opcional se usar handle)" className="min-h-11 rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-orange-300/60" /></label>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setNewSourceOpen(false)} disabled={createSource.isPending} className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-black text-zinc-300 hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:opacity-50">Cancelar</button><button type="submit" disabled={createSource.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-300 px-4 text-xs font-black text-zinc-950 hover:bg-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-wait disabled:opacity-50">{createSource.isPending && <Loader2 size={14} className="animate-spin" />} {createSource.isPending ? "Salvando..." : "Salvar fonte"}</button></div>
        </form>
      </div>}
      {reactivationTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="reactivation-title"><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-5 text-white shadow-2xl sm:p-6"><h3 id="reactivation-title" className="text-lg font-black">Reativar fonte?</h3><p className="mt-2 text-sm text-zinc-300">Tem certeza que deseja reativar <strong>{reactivationTarget.name}</strong>? O Circuit Breaker será resetado.</p><label className="mt-5 flex items-start gap-3 rounded-xl border border-white/10 p-3 text-sm text-zinc-200"><input type="checkbox" checked={reprocessNow} onChange={event => setReprocessNow(event.target.checked)} className="mt-1 size-4 accent-orange-300" /> <span><strong>Reprocessar agora</strong><span className="mt-1 block text-xs text-zinc-400">Executa uma rodada focada imediatamente, sem aguardar o próximo cron.</span></span></label><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setReactivationTarget(null)} disabled={reactivate.isPending} className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-black text-zinc-300 disabled:opacity-50">Cancelar</button><button type="button" onClick={confirmReactivation} disabled={reactivate.isPending} className="min-h-11 rounded-xl bg-orange-300 px-4 text-xs font-black text-zinc-950 disabled:opacity-50">{reactivate.isPending ? "Reativando..." : "Confirmar reativação"}</button></div></div></div>}
      {sources.isLoading && <p className="mt-5 rounded-2xl border border-white/10 p-5 text-sm text-zinc-400">Carregando fontes...</p>}
      {sources.isError && <p role="alert" className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-5 text-sm text-rose-100">Não foi possível carregar as fontes. Tente atualizar novamente.</p>}
      <div className="mt-5 rounded-2xl border border-violet-300/20 bg-violet-300/5 p-4" data-testid="sandbox-mock-settings"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-violet-100">Permitir Mocks no Sandbox</p><p className="mt-1 text-xs leading-relaxed text-zinc-400">Quando ativo, falhas de rede no preview podem usar eventos simulados marcados. Em produção, esta opção permanece sempre desativada.</p></div><button type="button" role="switch" aria-checked={mockSettings.data?.allowSandboxMocks === true} aria-busy={mockSettingsUpdate.isPending} disabled={mockSettings.isLoading || mockSettingsUpdate.isPending || mockSettings.data?.environment === "production"} onClick={() => mockSettingsUpdate.mutate({ allowSandboxMocks: !(mockSettings.data?.allowSandboxMocks === true) })} className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:cursor-wait disabled:opacity-50 ${mockSettings.data?.allowSandboxMocks ? "border-violet-200/50 bg-violet-300 text-zinc-950" : "border-white/10 text-zinc-300"}`}>{mockSettingsUpdate.isPending ? <><Loader2 size={14} className="mr-2 animate-spin" /> Salvando...</> : mockSettings.data?.allowSandboxMocks ? "Ativado" : "Desativado"}</button></div></div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Indicadores de governança" data-testid="ingestion-source-kpis">
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-200">Fontes ativas</p><p className="mt-2 text-2xl font-black text-white">{sourceSummary.data?.active ?? "—"}</p><p className="mt-1 text-[10px] text-zinc-400">Estado atual</p></div>
        <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-rose-200">OPEN / pausadas</p><p className="mt-2 text-2xl font-black text-white">{sourceSummary.data?.open ?? "—"}</p><p className="mt-1 text-[10px] text-zinc-400">Circuit breaker</p></div>
        <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-sky-200">Bloqueios WAF</p><p className="mt-2 text-2xl font-black text-white">{executiveReport.data?.trends.waf.current ?? sourceSummary.data?.waf ?? "—"}</p><p className={`mt-1 text-[10px] font-bold ${trendClass(executiveReport.data?.trends.waf, true)}`}>{trendLabel(executiveReport.data?.trends.waf)}</p></div>
        <div className="rounded-2xl border border-violet-300/20 bg-violet-400/10 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-violet-200">Meta Code 110</p><p className="mt-2 text-2xl font-black text-white">{executiveReport.data?.trends.meta110.current ?? sourceSummary.data?.meta110 ?? "—"}</p><p className={`mt-1 text-[10px] font-bold ${trendClass(executiveReport.data?.trends.meta110, true)}`}>{trendLabel(executiveReport.data?.trends.meta110)}</p></div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Rede / timeout</p><p className="mt-2 text-2xl font-black text-white">{executiveReport.data?.trends.network.current ?? sourceSummary.data?.network ?? "—"}</p><p className={`mt-1 text-[10px] font-bold ${trendClass(executiveReport.data?.trends.network, true)}`}>{trendLabel(executiveReport.data?.trends.network)}</p></div>
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4" data-testid="telemetry-history-chart" aria-label="Histórico de telemetria">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-white">Histórico de telemetria</p><p className="text-xs text-zinc-500">Últimos {graphPeriod} dias: falhas por categoria e taxa de sucesso.</p></div><div className="flex flex-wrap items-center gap-2"><label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Período<select aria-label="Período do gráfico de telemetria" value={graphPeriod} onChange={event => setGraphPeriod(Number(event.target.value) as 7 | 14 | 30)} className="ml-2 min-h-9 rounded-lg border border-white/10 bg-zinc-900 px-2 text-xs normal-case tracking-normal text-white"><option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option></select></label><button type="button" onClick={() => downloadTelemetrySeries("csv")} aria-label="Exportar série de telemetria em CSV" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 px-2 text-xs font-bold text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><Download size={13} aria-hidden="true" /> CSV</button><button type="button" onClick={() => downloadTelemetrySeries("json")} aria-label="Exportar série de telemetria em JSON" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 px-2 text-xs font-bold text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><Download size={13} aria-hidden="true" /> JSON</button></div><p className={`text-xs font-bold ${trendClass(executiveReport.data?.trends.successRate)}`}>Sucesso {executiveReport.data?.trends.successRate.current ?? "—"}% {trendLabel(executiveReport.data?.trends.successRate)}</p></div>
        <div className="mt-3 h-64 w-full" role="img" aria-label="Gráfico de linhas de WAF, Meta Code 110, rede e sucesso">{typeof ResizeObserver === "undefined" ? <p className="flex h-full items-center justify-center text-xs text-zinc-500">Gráfico disponível no navegador.</p> : <ResponsiveContainer width="100%" height="100%"><LineChart data={executiveReport.data?.series ?? []} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" /><XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 10 }} tickFormatter={value => String(value).slice(5)} /><YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} /><Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} /><Line type="monotone" dataKey="waf" name="WAF" stroke="#38bdf8" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="meta110" name="Meta 110" stroke="#c084fc" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="network" name="Rede/Timeout" stroke="#fbbf24" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="successRate" name="Sucesso %" stroke="#34d399" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>}</div>
      </div>
      <div className="mt-5 space-y-3">
        {sources.data?.map(source => {
          const rowPending = update.isPending && pendingSourceId === source.id;
          return <article key={source.id} className="rounded-2xl border border-white/10 bg-zinc-950/35 p-4" aria-busy={rowPending}>
            {source.circuitState === "open" && <div className="mb-4 flex flex-col gap-2 rounded-xl border border-rose-300/30 bg-rose-400/10 p-3 text-rose-100 sm:flex-row sm:items-center sm:justify-between" role="alert" data-testid={`circuit-open-${source.id}`}><div className="flex items-start gap-2"><AlertTriangle size={17} className="mt-0.5 shrink-0 text-rose-300" aria-hidden="true" /><div><p className="text-xs font-black uppercase tracking-wider">Circuit Breaker OPEN — ingestão pausada</p><p className="mt-1 text-xs text-rose-100/80">{source.circuitFailureCount} falha(s) consecutiva(s). A fonte está protegida até a reativação manual ou a próxima janela permitida.</p></div></div><span className="w-fit rounded-full bg-rose-300/20 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-rose-200">Pausada preventivamente</span></div>}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-white">{source.name}</h3><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">{source.kind === "instagram" ? "Instagram" : "Fonte pública"}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${source.isEnabled ? "bg-emerald-400/15 text-emerald-200" : "bg-zinc-700/50 text-zinc-400"}`}>{source.isEnabled ? "Ativa" : "Pausada"}</span></div>
                {source.kind === "instagram" ? <><label className="mt-1 block text-[10px] font-black uppercase tracking-wider text-zinc-500">Username/ID Meta<input aria-label={`Username/ID Meta de ${source.name}`} defaultValue={source.handle ?? ""} disabled={update.isPending} onBlur={event => saveSource(source.id, { isEnabled: source.isEnabled === 1, priority: source.priority, frequencyMinutes: source.frequencyMinutes, p95LatencyThresholdMs: source.p95LatencyThresholdMs ?? 3000, handle: event.currentTarget.value })} className="mt-1 min-h-9 w-full max-w-xs rounded-lg border border-white/10 bg-zinc-900 px-2 text-xs font-bold normal-case tracking-normal text-white outline-none focus:border-orange-300/60 disabled:opacity-50" /></label></> : <p className="mt-1 truncate text-xs text-zinc-500">{source.url}</p>}
                <div className="mt-2 grid gap-1 text-xs text-zinc-400 sm:grid-cols-2 sm:gap-x-4"><p className="flex items-center gap-2"><Clock3 size={13} className="text-orange-300" /> Última tentativa: {formatTimestamp(source.lastAttemptAt)}</p><p className="flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-300" /> Último sucesso: {formatLastSuccess(source.lastSuccessAt)}</p></div><p className="mt-1 text-xs"><span className={source.lastStatus === "failed" ? "text-rose-200" : "text-zinc-400"}>Estado da última execução: {source.lastStatus}</span></p>{source.lastStatus === "failed" && (source.lastMessage || source.lastFailureReason) && <p className="mt-2 rounded-lg border border-rose-300/20 bg-rose-400/10 p-2 text-xs text-rose-100" data-testid={`failure-reason-${source.id}`}><strong>Motivo da última falha:</strong> {source.lastMessage || source.lastFailureReason}</p>}{source.lastExecutionFeedback && <p className="mt-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-2 text-xs text-emerald-100" data-testid={`execution-feedback-${source.id}`}><strong>Última execução focada:</strong> {source.lastExecutionFeedback}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:min-w-[620px]">
                <button type="button" onClick={() => setDetailsSource(source)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-3 text-xs font-black text-zinc-200 hover:border-orange-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300" aria-label={`Ver detalhes de ${source.name}`}>Detalhes</button>
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Prioridade<input aria-label={`Prioridade de ${source.name}`} type="number" min={1} max={1000} defaultValue={source.priority} disabled={update.isPending} onBlur={event => saveSource(source.id, { isEnabled: source.isEnabled === 1, priority: Number(event.currentTarget.value), frequencyMinutes: source.frequencyMinutes, p95LatencyThresholdMs: source.p95LatencyThresholdMs ?? 3000 })} className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm font-bold text-white outline-none focus:border-orange-300/60 disabled:cursor-wait disabled:opacity-50" /></label>
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500">P95 máximo (ms)<input aria-label={`Limite P95 de ${source.name}`} type="number" min={500} max={60000} step={100} defaultValue={source.p95LatencyThresholdMs ?? 3000} disabled={update.isPending} onBlur={event => saveSource(source.id, { isEnabled: source.isEnabled === 1, priority: source.priority, frequencyMinutes: source.frequencyMinutes, p95LatencyThresholdMs: Number(event.currentTarget.value) || 3000 })} className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm font-bold text-white outline-none focus:border-orange-300/60 disabled:cursor-wait disabled:opacity-50" /></label><label className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Frequência<select aria-label={`Frequência de ${source.name}`} defaultValue={source.frequencyMinutes} disabled={update.isPending} onChange={event => saveSource(source.id, { isEnabled: source.isEnabled === 1, priority: source.priority, frequencyMinutes: Number(event.currentTarget.value), p95LatencyThresholdMs: source.p95LatencyThresholdMs ?? 3000 })} className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm font-bold text-white outline-none focus:border-orange-300/60 disabled:cursor-wait disabled:opacity-50">{frequencyOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <button type="button" onClick={() => saveSource(source.id, { isEnabled: source.isEnabled !== 1, priority: source.priority, frequencyMinutes: source.frequencyMinutes, p95LatencyThresholdMs: source.p95LatencyThresholdMs ?? 3000 })} disabled={update.isPending || isSyncingStories} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-black text-zinc-200 hover:border-orange-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-wait disabled:opacity-50" aria-pressed={source.isEnabled === 1} aria-busy={rowPending}><Power size={14} /> {rowPending ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : source.isEnabled ? "Pausar Ingestão" : "Retomar Ingestão"}</button>{source.circuitState === "open" && <button type="button" onClick={() => reactivateSource(source.sourceKey)} disabled={reactivate.isPending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-300/30 px-3 text-xs font-black text-amber-100 hover:border-amber-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-wait disabled:opacity-50" aria-label={`Reativar Fonte ${source.name}`}>{pendingReactivationKey === source.sourceKey ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {pendingReactivationKey === source.sourceKey ? "Reativando..." : "Reativar Fonte"}</button>}{source.kind === "instagram" && <button type="button" onClick={() => { if (isSyncingStories) return; void syncStories(source.id, source.sourceKey); }} disabled={isSyncingStories || !source.isEnabled} aria-busy={isSyncingStories && pendingStorySourceId === source.id} aria-label={`Sincronizar Stories de ${source.name}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-fuchsia-300/25 px-3 text-xs font-black text-fuchsia-100 hover:border-fuchsia-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 disabled:cursor-wait disabled:opacity-50">{isSyncingStories && pendingStorySourceId === source.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}{isSyncingStories && pendingStorySourceId === source.id ? "Sincronizando..." : "Sincronizar Stories"}</button>}
              </div>
            </div>
            {rowPending && <p className="mt-3 flex items-center gap-2 text-xs text-orange-200" role="status"><Save size={13} /> Salvando configuração...</p>}
            {source.lastStatus === "succeeded" && !rowPending && <p className="mt-3 flex items-center gap-2 text-xs text-emerald-200"><CheckCircle2 size={13} /> A fonte respondeu com sucesso na última execução.</p>}
          </article>;
        })}
      </div>
      {detailsSource && <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="source-details-title"><div data-testid="source-details-dialog" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-5 text-white shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h3 id="source-details-title" className="text-lg font-black">Detalhes da fonte</h3><p className="mt-1 text-sm text-zinc-400">{detailsSource.name}</p></div><button type="button" onClick={() => setDetailsSource(null)} aria-label="Fechar detalhes da fonte" className="rounded-lg px-2 py-1 text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">×</button></div><div className="mt-5 rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100"><strong>Última falha:</strong> {detailsSource.lastMessage || detailsSource.lastFailureReason || "Nenhuma falha registrada."}</div>{nextAttemptFor(detailsSource) && <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100"><strong>Próxima tentativa automática prevista:</strong> {formatTimestamp(nextAttemptFor(detailsSource))}<span className="mt-1 block text-xs text-amber-100/70">Calculada pelo cooldown do Circuit Breaker; se não houver backoff persistido, usa a cadência configurada de {detailsSource.frequencyMinutes} minutos.</span></p>}<SourceOperationalTimeline sourceKey={detailsSource.sourceKey} sourceStatus={detailsSource.circuitState} /></div></div>}
    </section>
  );
}

export { frequencyOptions };
