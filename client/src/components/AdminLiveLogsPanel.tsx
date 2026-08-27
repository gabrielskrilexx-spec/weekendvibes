import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  friendlyAdminErrorMessage,
  isAdminSessionError,
} from "@/lib/adminFeedback";
import AdminAuthRecoveryDialog from "@/components/AdminAuthRecoveryDialog";

const isSandboxLog = (entry: { message?: string | null; sandboxRestricted?: boolean }) => entry.sandboxRestricted === true || /sandbox_restricted|previewmock/i.test(entry.message ?? "");

const kindLabel: Record<string, string> = {
  ingestion: "Ingestão",
  retry: "Retry",
  alert: "Alerta",
  heartbeat: "Heartbeat",
};

const statusTone = (status: string) => {
  if (status === "succeeded") return "text-emerald-200";
  if (status === "partial" || status === "warning") return "text-yellow-200";
  if (status === "failed" || status === "error" || status === "critical")
    return "text-red-200";
  if (status === "retry") return "text-orange-200";
  return "text-zinc-300";
};

function LogsSkeleton() {
  return (
    <div
      data-testid="admin-live-logs-skeleton"
      aria-label="Carregando logs"
      className="space-y-2"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

export default function AdminLiveLogsPanel() {
  const [authRecoveryOpen, setAuthRecoveryOpen] = useState(false);
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("");
  const logs = trpc.ingestionReports.logs.useQuery(
    { limit: 80 },
    { refetchInterval: 3_000, staleTime: 1_500 }
  );

  useEffect(() => {
    if (!logs.isError) return;
    const message = friendlyAdminErrorMessage(
      logs.error,
      "Não foi possível carregar os logs agora."
    );
    if (isAdminSessionError(logs.error)) setAuthRecoveryOpen(true);
    sonnerToast.error("Falha na comunicação", { description: message });
  }, [logs.isError, logs.error]);

  const refresh = () => {
    void logs.refetch();
  };
  const liveLogEntries = Array.isArray(logs.data?.logs) ? logs.data.logs : [];
  const visibleLogs = liveLogEntries.filter(entry =>
    (kindFilter === "all" || entry.kind === kindFilter) &&
    (statusFilter === "all" || entry.status === statusFilter) &&
    (!sourceFilter.trim() || (entry.sourceKey ?? "").toLowerCase().includes(sourceFilter.trim().toLowerCase()))
  );
  const exportCsv = () => {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [["ID", "Run", "Tipo", "Status", "Fonte", "Data", "Mensagem"], ...visibleLogs.map(entry => [entry.id, entry.runId, entry.kind, entry.status, entry.sourceKey ?? "", entry.timestamp, entry.message ?? ""])];
    const csv = rows.map(row => row.map(value => escape(String(value))).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `weekendvibes-logs-${new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date())}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-labelledby="live-logs-heading"
      className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7"
    >
      <AdminAuthRecoveryDialog
        open={authRecoveryOpen}
        onOpenChange={setAuthRecoveryOpen}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-cyan-200">
            <Activity size={18} aria-hidden="true" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">
              Operação ao vivo
            </p>
          </div>
          <h2 id="live-logs-heading" className="mt-2 text-xl font-black">
            Logs em tempo real
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
            Acompanhe inícios, conclusões, retries e alertas das ingestões sem
            expor payloads ou credenciais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-bold ${logs.data?.isLive ? "text-emerald-200" : "text-yellow-200"}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${logs.data?.isLive ? "bg-emerald-300" : "bg-yellow-300"}`}
              aria-hidden="true"
            />
            {logs.data?.isLive ? "Atualização ativa" : "Aguardando conexão"}
          </span>
          <button
            type="button"
            onClick={exportCsv}
            disabled={visibleLogs.length === 0}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300/20 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-50"
            data-testid="export-live-logs-csv"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={logs.isFetching}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-200 disabled:cursor-wait disabled:opacity-50"
            aria-busy={logs.isFetching}
          >
            {logs.isFetching ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Atualizar
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        <select aria-label="Filtrar tipo de log" value={kindFilter} onChange={event => setKindFilter(event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-zinc-200"><option value="all">Todos os tipos</option>{Object.entries(kindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Filtrar status do log" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-zinc-200"><option value="all">Todos os status</option><option value="succeeded">Sucesso</option><option value="partial">Parcial</option><option value="failed">Falha</option><option value="retry">Retry</option></select>
        <input aria-label="Filtrar fonte do log" value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} placeholder="Fonte específica" className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-zinc-200 placeholder:text-zinc-600" />
        <p className="flex items-center text-xs text-zinc-500">{visibleLogs.length} evento(s) visível(is)</p>
      </div>

      {logs.isLoading && (
        <div className="mt-6">
          <LogsSkeleton />
        </div>
      )}
      {logs.isError && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100"
        >
          <XCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">Não foi possível carregar os logs.</p>
            <p className="mt-1 text-red-100/80">
              {friendlyAdminErrorMessage(
                logs.error,
                "Tente atualizar novamente em instantes."
              )}
            </p>
          </div>
        </div>
      )}
      {!logs.isLoading &&
        !logs.isError &&
        visibleLogs.length === 0 && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
            Ainda não há eventos operacionais recentes.
          </div>
        )}
      {visibleLogs.length > 0 && (
        <div className="mt-6 space-y-2" aria-live="polite">
          {visibleLogs.map(entry => (
            <article
              key={entry.id}
              className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
              <div className="flex items-center gap-2 text-zinc-400">
                {entry.kind === "alert" ? (
                  <AlertTriangle
                    size={16}
                    className="text-yellow-200"
                    aria-hidden="true"
                  />
                ) : entry.kind === "retry" ? (
                  <RotateCcw
                    size={16}
                    className="text-orange-200"
                    aria-hidden="true"
                  />
                ) : entry.status === "succeeded" ? (
                  <CheckCircle2
                    size={16}
                    className="text-emerald-200"
                    aria-hidden="true"
                  />
                ) : (
                  <Clock3 size={16} aria-hidden="true" />
                )}
                <span className="text-[11px] font-black uppercase tracking-[0.13em]">
                  {kindLabel[entry.kind] ?? entry.kind}
                </span>
              </div>
              <div className="min-w-0">
                <p
                  className={`break-words text-sm font-bold ${statusTone(entry.status)}`}
                >
                  {entry.label}
                </p>
                <p className="mt-1 break-words text-xs text-zinc-500">
                  {entry.sourceKey ?? "fonte não identificada"}
                  {isSandboxLog(entry) && <span className="ml-2 inline-flex rounded-full border border-yellow-300/30 bg-yellow-300/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-yellow-100" title="Esta entrada usa dados simulados porque a fonte externa está restrita no ambiente de preview.">Sandbox / Mocks</span>}
                  {entry.message ? ` · ${entry.message}` : ""}
                </p>
              </div>
              <div className="text-left text-xs text-zinc-500 sm:text-right">
                <p>
                  {new Date(entry.timestamp).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </p>
                <p className="mt-1 font-mono text-[10px]">run {entry.runId}</p>
              </div>
            </article>
          ))}
        </div>
      )}
      {logs.data?.updatedAt && (
        <p className="mt-4 text-[11px] text-zinc-500">
          Última atualização:{" "}
          {new Date(logs.data.updatedAt).toLocaleTimeString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}{" "}
          · São Paulo
        </p>
      )}
    </section>
  );
}
