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
        (logs.data?.logs.length ?? 0) === 0 && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
            Ainda não há eventos operacionais recentes.
          </div>
        )}
      {(logs.data?.logs.length ?? 0) > 0 && (
        <div className="mt-6 space-y-2" aria-live="polite">
          {logs.data?.logs.map(entry => (
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
