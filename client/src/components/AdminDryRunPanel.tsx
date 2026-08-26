import React, { useEffect } from "react";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  friendlyAdminErrorMessage,
  isAdminSessionError,
} from "@/lib/adminFeedback";
import AdminAuthRecoveryDialog from "@/components/AdminAuthRecoveryDialog";

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

const labelForSource = (sourceKey: string) =>
  sourceLabels[sourceKey] ?? sourceKey.replace(/^public:/, "");
function isChunkNetworkError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error ?? "").toLowerCase();
  return /failed to fetch|network|fetch|timeout|timed out|gateway|502|503|504|econn|socket|transport/.test(message);
}

async function retryChunkNetwork<T>(work: () => Promise<T>, maxRetries = 2) {
  let attempt = 0;
  while (true) {
    try {
      return await work();
    } catch (error) {
      if (!isChunkNetworkError(error) || attempt >= maxRetries) throw error;
      attempt += 1;
      await new Promise(resolve => setTimeout(resolve, 150 * attempt));
    }
  }
}

const formatMetric = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
type DryRunReport = { dryRun: true; startedAt: string; finishedAt: string; durationMs: number; totals: { read: number; filtered: number; persistable: number; duplicates: number; errors: number }; sources: Array<{ routine: "public-agenda" | "instagram-agenda"; sourceKey: string; durationMs: number; medianDurationMs: number; p95DurationMs: number; read: number; filtered: number; persistable: number; duplicates: number; errors: Array<{ sourceUrl?: string; status: number | null; message: string }>; rejectionReasons: Record<string, number> }> };

function DryRunLoadingSkeleton() {
  return (
    <div
      className="mt-6 space-y-5"
      aria-live="polite"
      aria-busy="true"
      data-testid="dry-run-loading-skeleton"
    >
      <div className="flex items-center gap-3 text-sm font-bold text-cyan-100">
        <Loader2 size={17} className="animate-spin" /> Processando fontes e
        validando candidatos…
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={`dry-run-skeleton-metric-${index}`}
            className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.06]"
          />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={`dry-run-skeleton-source-${index}`}
            className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.06]"
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminDryRunPanel() {
  const [authRecoveryOpen, setAuthRecoveryOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [localReport, setLocalReport] = useState<DryRunReport | undefined>();
  const [localFailure, setLocalFailure] = useState<{ message: string } | undefined>();
  const legacyDryRun = trpc.ingestionReports.dryRun.useMutation();
  const report = localReport ?? (legacyDryRun.data?.dryRun ? legacyDryRun.data as DryRunReport : undefined);
  const failure = localFailure ?? (legacyDryRun.data?.dryRun === false ? legacyDryRun.data : undefined) ?? (legacyDryRun.isError ? { message: friendlyAdminErrorMessage(legacyDryRun.error, "Não foi possível comunicar com o servidor") } : undefined);
  const adminRoutine = (trpc as unknown as { adminRoutine?: { sources?: { useQuery: () => unknown }; runSource?: { useMutation: () => { mutateAsync: (input: { sourceKey: string; dryRun: boolean }) => Promise<any> } } } }).adminRoutine;
  const chunkSourcesProcedure = adminRoutine?.sources;
  const chunkSources = chunkSourcesProcedure ? chunkSourcesProcedure.useQuery() as { data?: { sources?: string[] } } : undefined;
  const runSourceProcedure = adminRoutine?.runSource;
  const runSource = runSourceProcedure ? runSourceProcedure.useMutation() : undefined;
  const run = () => {
    if (running) return;
    const sources = chunkSources?.data?.sources ?? [];
        if (!runSourceProcedure) { legacyDryRun.mutate(); return; }
    if (!sources.length) {
      setLocalFailure({ message: "Nenhuma fonte ativa está configurada para a simulação." });
      return;
    }
    setRunning(true); setLocalReport(undefined); setLocalFailure(undefined);
    void (async () => {
      const startedAt = new Date().toISOString();
      const sourceReports: DryRunReport["sources"] = [];
      try {
        for (let index = 0; index < sources.length; index += 1) {
          const sourceKey = sources[index];
          try {
            const result = await retryChunkNetwork(() => runSource!.mutateAsync({ sourceKey, dryRun: true }));
            const errors = result.ok ? result.errors.map((message: string) => ({ status: null, message })) : [{ status: null, message: result.message ?? "Falha sanitizada na fonte." }];
            sourceReports.push({ routine: sourceKey === "instagram" ? "instagram-agenda" : "public-agenda", sourceKey, durationMs: result.durationMs, medianDurationMs: result.durationMs, p95DurationMs: result.durationMs, read: result.ok ? result.read : 0, filtered: result.ok ? result.ignored : 0, persistable: 0, duplicates: 0, errors, rejectionReasons: result.ok && result.ignored > 0 ? { filtered: result.ignored } : {} });
          } catch (error) {
            sourceReports.push({ routine: sourceKey === "instagram" ? "instagram-agenda" : "public-agenda", sourceKey, durationMs: 0, medianDurationMs: 0, p95DurationMs: 0, read: 0, filtered: 0, persistable: 0, duplicates: 0, errors: [{ status: null, message: isChunkNetworkError(error) ? "Falha de Conexão após 2 tentativas." : friendlyAdminErrorMessage(error, "Falha sanitizada na fonte.") }], rejectionReasons: { fetchFailed: 1 } });
          }
        }
        const totals = sourceReports.reduce((acc, source) => ({ read: acc.read + source.read, filtered: acc.filtered + source.filtered, persistable: 0, duplicates: acc.duplicates + source.duplicates, errors: acc.errors + source.errors.length }), { read: 0, filtered: 0, persistable: 0, duplicates: 0, errors: 0 });
        setLocalReport({ dryRun: true, startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - Date.parse(startedAt), totals, sources: sourceReports });
        sonnerToast.success("Dry-run concluído", { description: `${sourceReports.length} fonte(s) processada(s), sem persistência.` });
      } catch (error) {
        const message = friendlyAdminErrorMessage(error, "A simulação não pôde ser concluída.");
        setLocalFailure({ message });
        if (isAdminSessionError(error)) setAuthRecoveryOpen(true);
        sonnerToast.error("Falha na comunicação", { description: message });
      } finally { setRunning(false); }
    })();
  };

  return (
    <>
      <AdminAuthRecoveryDialog
        open={authRecoveryOpen}
        onOpenChange={setAuthRecoveryOpen}
      />
      <section
        aria-labelledby="dry-run-heading"
        className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5 sm:p-7"
      >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
            <FlaskConical size={14} /> Simulação segura
          </p>
          <h2 id="dry-run-heading" className="mt-1 text-xl font-black">
            Dry-run da ingestão
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
            Varre as fontes ativas e aplica os filtros atuais sem criar eventos,
            atualizar caches, registrar runs ou alterar o estado operacional.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running || legacyDryRun.isPending}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-xs font-black text-zinc-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-wait disabled:opacity-60"
          aria-busy={running || legacyDryRun.isPending}
        >
          {running || legacyDryRun.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Play size={16} />
          )}
          {running || legacyDryRun.isPending ? "Simulando..." : "Simular ingestão (Dry-run)"}
        </button>
      </div>

      {failure && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-2xl border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-100"
        >
          <XCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Não foi possível concluir a simulação.</p>
            <p className="mt-1 text-red-100/80">
              {failure?.message ??
                friendlyAdminErrorMessage(
                  failure.message,
                  "O servidor retornou uma falha sem detalhes."
                )}
            </p>
          </div>
        </div>
      )}

      {(running || legacyDryRun.isPending) && <DryRunLoadingSkeleton />}

      {report && (
        <div aria-live="polite" className="mt-6 space-y-5">
          <div className="grid gap-3 sm:grid-cols-5">
            {[
              ["Lidos", formatMetric(report.totals.read)],
              ["Filtrados", formatMetric(report.totals.filtered)],
              ["Seriam persistidos", formatMetric(report.totals.persistable)],
              ["Duplicidades", formatMetric(report.totals.duplicates)],
              ["Erros", formatMetric(report.totals.errors)],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <CheckCircle2 size={15} className="text-emerald-300" /> Simulação
            concluída sem persistência · {formatMetric(report.durationMs)} ms ·{" "}
            {new Date(report.finishedAt).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
          </div>
          {report.sources.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
              Nenhuma fonte ativa retornou candidatos nesta simulação.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {report.sources.map(source => (
                <article
                  key={`${source.routine}:${source.sourceKey}`}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-white">
                        {labelForSource(source.sourceKey)}
                      </h3>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                        {source.routine} · {source.sourceKey}
                      </p>
                    </div>
                    {source.errors.length > 0 ? (
                      <AlertTriangle
                        size={18}
                        className="shrink-0 text-yellow-200"
                      />
                    ) : (
                      <CheckCircle2
                        size={18}
                        className="shrink-0 text-emerald-300"
                      />
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-7">
                    <div>
                      <p className="text-zinc-500">Lidos</p>
                      <p className="font-black text-white">
                        {formatMetric(source.read)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Filtrados</p>
                      <p className="font-black text-white">
                        {formatMetric(source.filtered)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Persistíveis</p>
                      <p className="font-black text-cyan-200">
                        {formatMetric(source.persistable)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Duplicados</p>
                      <p className="font-black text-white">
                        {formatMetric(source.duplicates)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Duração</p>
                      <p className="font-black text-cyan-200">
                        {formatMetric(source.durationMs)} ms
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Mediana</p>
                      <p className="font-black text-white">
                        {formatMetric(source.medianDurationMs)} ms
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">P95</p>
                      <p className="font-black text-white">
                        {formatMetric(source.p95DurationMs)} ms
                      </p>
                    </div>
                  </div>
                  {source.errors.length > 0 && (
                    <details className="mt-4 overflow-hidden rounded-xl border border-yellow-300/15 bg-yellow-300/5">
                      <summary className="cursor-pointer px-3 py-3 text-xs font-bold text-yellow-100 outline-none focus-visible:ring-2 focus-visible:ring-yellow-200">
                        Ver detalhes dos erros ({source.errors.length})
                      </summary>
                      <div className="space-y-2 border-t border-yellow-300/10 p-3">
                        {source.errors.map((error, index) => (
                          <p
                            key={`${source.sourceKey}-error-${index}`}
                            className={`rounded-xl border p-3 text-xs leading-5 ${source.sourceKey === "public:ingresse" && error.status === 403 ? "border-red-300/30 bg-red-400/10 text-red-100" : "border-yellow-300/15 bg-yellow-300/5 text-yellow-100"}`}
                          >
                            {source.sourceKey === "public:ingresse" &&
                            error.status === 403
                              ? "Acesso temporariamente bloqueado (HTTP 403): "
                              : error.status
                                ? `HTTP ${error.status}: `
                                : ""}
                            {error.message}
                          </p>
                        ))}
                      </div>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
      </section>
    </>
  );
}
