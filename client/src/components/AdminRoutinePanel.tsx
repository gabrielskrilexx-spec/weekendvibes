import React, { useEffect, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  RefreshCw,
  Save,
  ShieldAlert,
  Eye,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  friendlyAdminErrorMessage,
  isAdminSessionError,
} from "@/lib/adminFeedback";
import AdminAuthRecoveryDialog from "@/components/AdminAuthRecoveryDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const formatExecution = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(value))
    : "Calculando…";
const dateFilterTimezone = (value: unknown) =>
  value && typeof value === "object" && "timezone" in value
    ? String((value as { timezone?: unknown }).timezone ?? "")
    : "";
const dateFilterToday = (value: unknown) =>
  value && typeof value === "object" && "today" in value
    ? String((value as { today?: unknown }).today ?? "—")
    : "—";
const formatDuration = (value?: number | null) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${Math.max(0, Math.round(value))} ms`
    : "duração indisponível";
const statusLabel = (status: string) =>
  status === "succeeded"
    ? "Sucesso"
    : status === "running"
      ? "Em andamento"
      : status === "partial"
        ? "Parcial"
        : "Falha";
const statusTone = (status: string) =>
  status === "succeeded"
    ? "bg-emerald-300"
    : status === "running"
      ? "bg-yellow-300"
      : status === "partial"
        ? "bg-orange-300"
        : "bg-red-300";

export function getApifyQuotaNotice(run: unknown) {
  if (!run || typeof run !== "object") return null;
  const value = run as { quotaExceeded?: unknown; providerIssue?: { code?: unknown; message?: unknown } };
  if (value.quotaExceeded !== true && value.providerIssue?.code !== "APIFY_QUOTA_EXCEEDED") return null;
  return typeof value.providerIssue?.message === "string" && value.providerIssue.message.trim()
    ? value.providerIssue.message
    : "Cota mensal do Apify excedida; renove a quota antes de uma nova coleta real.";
}

function ProviderQuotaNotice({ run }: { run: unknown }) {
  const message = getApifyQuotaNotice(run);
  if (!message) return null;
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100" role="status" data-testid="apify-quota-notice">
      <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-200" />
      <span><strong className="font-black">Quota do provedor:</strong> {message} Os mocks do sandbox continuam disponíveis para testes.</span>
    </div>
  );
}

const CRON_REFRESH_STORAGE_KEY = "weekendvibes.admin.cronRefresh";
const CRON_REFRESH_PRESETS = [
  { value: 0, label: "Desativada" },
  { value: 30, label: "A cada 30 segundos" },
  { value: 60, label: "A cada 1 minuto" },
  { value: 300, label: "A cada 5 minutos" },
  { value: 900, label: "A cada 15 minutos" },
  { value: -1, label: "Personalizada" },
] as const;

function readCronRefreshPreference() {
  if (typeof window === "undefined") return { mode: 60, customSeconds: 60 };
  try {
    const raw = window.localStorage.getItem(CRON_REFRESH_STORAGE_KEY);
    if (!raw) return { mode: 60, customSeconds: 60 };
    const parsed = JSON.parse(raw) as { mode?: unknown; customSeconds?: unknown };
    const mode = typeof parsed.mode === "number" && CRON_REFRESH_PRESETS.some(option => option.value === parsed.mode) ? parsed.mode : 60;
    const customSeconds = typeof parsed.customSeconds === "number" && Number.isFinite(parsed.customSeconds) ? Math.min(3600, Math.max(15, Math.round(parsed.customSeconds))) : 60;
    return { mode, customSeconds };
  } catch {
    return { mode: 60, customSeconds: 60 };
  }
}

type OcrAuditItem = {
  mediaOrigin: "post" | "story" | "highlight";
  imageUrl: string;
  sourceUrl: string;
  highlightTitle: string | null;
  ocrText: string;
  rawText: string;
};
type FilteredStory = { id: string; username: string; mediaOrigin: "story" | "highlight"; imageUrl: string; sourceUrl: string; postedAt: string | null; expiresAt: string | null; ocrText: string; rawText: string; reasons: string[]; status: "pending" | "approved" };
type OcrAuditRun = { id: number; routine: string; startedAt: string; ocrAudit?: OcrAuditItem[]; filteredStories?: FilteredStory[] };

export function buildOcrEditInput(runId: number, entryIndex: number, ocrText: string) {
  return { runId, entryIndex, ocrText: ocrText.trim().slice(0, 5000) };
}

export function isChunkNetworkError(error: unknown) {
  const message = String(error instanceof Error ? error.message : error ?? "").toLowerCase();
  return /failed to fetch|network|fetch|timeout|timed out|gateway|502|503|504|econn|socket|transport/.test(message);
}

export async function retryChunkNetwork<T>(work: () => Promise<T>, maxRetries = 2, delayMs = 150, onRetry?: (attempt: number) => void) {
  let attempt = 0;
  while (true) {
    try {
      return await work();
    } catch (error) {
      if (!isChunkNetworkError(error) || attempt >= maxRetries) throw error;
      attempt += 1;
      onRetry?.(attempt);
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
}

export default function AdminRoutinePanel() {
  const [cronRefreshPreference, setCronRefreshPreference] = useState(readCronRefreshPreference);
  const cronRefreshSeconds = cronRefreshPreference.mode === -1 ? cronRefreshPreference.customSeconds : cronRefreshPreference.mode;
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [authRecoveryOpen, setAuthRecoveryOpen] = useState(false);
  const [selectedOcrRun, setSelectedOcrRun] = useState<OcrAuditRun | null>(null);
  const [historyTab, setHistoryTab] = useState<"runs" | "filtered">("runs");
  const [editingOcrIndex, setEditingOcrIndex] = useState<number | null>(null);
  const [ocrDraft, setOcrDraft] = useState("");
  const [rolloverDraft, setRolloverDraft] = useState<string | null>(null);
  const status = trpc.adminRoutine.status.useQuery(undefined, {
    refetchInterval: cronRefreshSeconds > 0 ? cronRefreshSeconds * 1_000 : false,
    refetchIntervalInBackground: false,
  });
  const legacyRunNow = trpc.adminRoutine.runNow.useMutation({
    onSuccess: () => {
      const text = "Rotina concluída: 2 eventos públicos e atualização do Instagram processados.";
      setFeedback({ type: "success", text });
      sonnerToast.success("Execução concluída", { description: text });
      void status.refetch();
    },
    onError: error => {
      const text = friendlyAdminErrorMessage(error, "A rotina não pôde ser concluída.");
      setFeedback({ type: "error", text });
      sonnerToast.error("Falha na execução", { description: text });
    },
  });
  const sourcesProcedure = (trpc.adminRoutine as unknown as { sources?: { useQuery: typeof trpc.adminRoutine.status.useQuery } }).sources;
  const runSourceProcedure = (trpc.adminRoutine as unknown as { runSource?: { useMutation: typeof trpc.adminRoutine.runNow.useMutation } }).runSource;
  const chunkSources = (sourcesProcedure ? sourcesProcedure.useQuery() : { data: undefined }) as { data?: { sources?: string[] } };
  const runSource = (runSourceProcedure ? runSourceProcedure.useMutation() : { isPending: false, mutateAsync: undefined }) as { isPending: boolean; mutateAsync?: (input: { sourceKey: string; dryRun: boolean }) => Promise<{ ok: boolean; message?: string }> };
  const [chunkRunning, setChunkRunning] = useState(false);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [activeChunkRetry, setActiveChunkRetry] = useState<number | null>(null);
  const [chunkSummary, setChunkSummary] = useState<{ success: number; failure: number; timeout: number } | null>(null);
  useEffect(() => {
    try {
      window.localStorage.setItem(CRON_REFRESH_STORAGE_KEY, JSON.stringify(cronRefreshPreference));
    } catch {
      // A preferência local indisponível não deve interromper o painel.
    }
  }, [cronRefreshPreference]);
  useEffect(() => {
    if (status.isError) {
      const message = friendlyAdminErrorMessage(
        status.error,
        "Não foi possível consultar o schedule."
      );
      if (isAdminSessionError(status.error)) setAuthRecoveryOpen(true);
      sonnerToast.error("Falha na comunicação", { description: message });
    }
  }, [status.isError, status.error]);
  const ocrEditMutation = trpc.adminRoutine.updateOcrText.useMutation({
    onSuccess: result => {
      setSelectedOcrRun(current => current ? { ...current, ocrAudit: current.ocrAudit?.map((item, index) => index === result.entryIndex ? { ...item, ocrText: result.ocrText } : item) } : current);
      setEditingOcrIndex(null);
      sonnerToast.success("Texto OCR atualizado", { description: "A revisão manual foi salva no histórico da execução." });
      void status.refetch();
    },
    onError: error => {
      sonnerToast.error("Não foi possível salvar o OCR", { description: friendlyAdminErrorMessage(error, "Revise o texto e tente novamente.") });
    },
  });
  const approveFilteredStoryMutation = trpc.adminRoutine.approveFilteredStory.useMutation({
    onSuccess: result => {
      setFeedback({ type: "success", text: `Story ${result.storyId} aprovado para revisão.` });
      sonnerToast.success("Story aprovado", { description: "A entrada foi marcada para processamento manual." });
      void status.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível aprovar o Story", { description: friendlyAdminErrorMessage(error, "Tente novamente em instantes.") }),
  });
  const startOcrEditing = (index: number, item: OcrAuditItem) => {
    setEditingOcrIndex(index);
    setOcrDraft(item.ocrText);
  };
  const saveOcrEdit = () => {
    if (!selectedOcrRun || editingOcrIndex === null || ocrEditMutation.isPending) return;
    ocrEditMutation.mutate(buildOcrEditInput(selectedOcrRun.id, editingOcrIndex, ocrDraft));
  };
  const rolloverHourQuery = trpc.adminRoutine.rolloverHour.useQuery();
  const rolloverMutation = trpc.adminRoutine.setRolloverHour.useMutation({
    onSuccess: result => {
      setRolloverDraft(String(result.rolloverHour));
      void rolloverHourQuery.refetch();
      sonnerToast.success("Horário de virada salvo", { description: `O feed público agora considera ${String(result.rolloverHour).padStart(2, "0")}:00 como a virada do dia.` });
    },
    onError: error => {
      sonnerToast.error("Não foi possível salvar", { description: friendlyAdminErrorMessage(error, "O horário de virada não pôde ser atualizado.") });
    },
  });
  const rolloverValue = rolloverDraft ?? String(rolloverHourQuery.data?.rolloverHour ?? 6);
  const parsedRolloverHour = Number(rolloverValue);
  const rolloverIsValid = Number.isInteger(parsedRolloverHour) && parsedRolloverHour >= 0 && parsedRolloverHour <= 23;
  const latestRun = status.data?.recentRuns?.[0];
  const filteredStories = (status.data?.recentRuns ?? []).flatMap(run => (run as OcrAuditRun).filteredStories ?? []);
  const lastSuccessfulCronRun = status.data?.recentRuns?.find(
    run => run.trigger !== "manual" && run.status === "succeeded"
  );
  const progress =
    status.data && "progress" in status.data ? status.data.progress : undefined;
  const refreshStatus = async () => {
    const result = await status.refetch();
    if (result.error) {
      const text = friendlyAdminErrorMessage(result.error, "Não foi possível atualizar o status do cron.");
      sonnerToast.error("Falha ao atualizar o cron", { description: text });
      return;
    }
    sonnerToast.success("Status do cron atualizado", { description: "Os dados mais recentes foram carregados sem recarregar a página." });
  };
  const progressPercent = progress
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round((progress.step / Math.max(1, progress.totalSteps)) * 100)
        )
      )
    : 0;
  const confirmRun = () => {
    if (chunkRunning || runSource.isPending || legacyRunNow.isPending || status.data?.isRunning) return;
    if (!globalThis.confirm("Executar a ingestão fonte por fonte? Cada etapa será concluída antes da próxima.") ) return;
    const sources = chunkSources.data?.sources ?? [];
    if (!sourcesProcedure || !runSourceProcedure) {
      setFeedback({ type: "success", text: "Ingestão iniciada. Acompanhe o progresso abaixo." });
      legacyRunNow.mutate();
      return;
    }
    if (!sources.length) {
      const text = "Nenhuma fonte ativa está configurada para a ingestão.";
      setFeedback({ type: "error", text });
      sonnerToast.error("Nenhuma fonte disponível", { description: text });
      return;
    }
    setChunkRunning(true);
    setChunkIndex(0);
    setActiveChunkRetry(null);
    setChunkSummary(null);
    setFeedback({ type: "success", text: `Ingestão iniciada. Processando 1 de ${sources.length}: ${sources[0]}.` });
    void (async () => {
      let completed = 0;
      let failures = 0;
      let success = 0;
      let timeout = 0;
      try {
        for (let index = 0; index < sources.length; index += 1) {
          const sourceKey = sources[index];
          setChunkIndex(index);
          setActiveChunkRetry(null);
          setFeedback({ type: "success", text: `Processando fonte ${index + 1} de ${sources.length}: ${sourceKey}.` });
          let result: { ok: boolean; message?: string } | undefined;
          let chunkError: unknown;
          try {
            result = await retryChunkNetwork(() => runSource.mutateAsync!({ sourceKey, dryRun: false }), 2, 150, attempt => {
              setActiveChunkRetry(attempt);
              setFeedback({ type: "success", text: `Tentando novamente (${attempt}/2) a fonte ${sourceKey}…` });
            });
          } catch (error) {
            chunkError = error;
          }
          if (chunkError || result?.ok === false) {
            failures += 1;
            const failureMessage = chunkError instanceof Error ? chunkError.message : result?.message ?? "";
            if (/8 segundos|tempo limite|timeout/i.test(failureMessage)) timeout += 1;
            else if (result?.ok !== false) success += 1;
            const message = chunkError
              ? "Falha de Conexão após 2 tentativas; seguindo para a próxima fonte."
              : (result?.message ?? "A fonte retornou uma falha sanitizada.");
            setFeedback({ type: "error", text: `${sourceKey}: ${message}` });
          } else {
            success += 1;
          }
          completed += 1;
          try { await status.refetch(); } catch { /* polling não deve interromper os chunks */ }
        }
        const summary = { success, failure: failures - timeout, timeout };
        setChunkSummary(summary);
        const text = failures > 0 ? `Ingestão concluída parcialmente: ${failures} fonte(s) falharam.` : `Ingestão concluída: ${completed} fonte(s) processada(s).`;
        setFeedback({ type: failures > 0 ? "error" : "success", text });
        sonnerToast[failures > 0 ? "warning" : "success"]("Execução concluída", { description: text });
      } catch (error) {
        const text = friendlyAdminErrorMessage(error, "A rotina não pôde processar a fonte atual.");
        setFeedback({ type: "error", text });
        if (isAdminSessionError(error)) setAuthRecoveryOpen(true);
        sonnerToast.error("Falha na comunicação", { description: text });
      } finally {
        setActiveChunkRetry(null);
        setChunkRunning(false);
        await status.refetch();
      }
    })();
  };
  return (
    <section
      className="mt-6 rounded-3xl border border-orange-300/20 bg-gradient-to-br from-orange-300/10 via-white/[0.04] to-fuchsia-400/10 p-5 sm:p-7"
      aria-labelledby="routine-title"
    >
      <AdminAuthRecoveryDialog
        open={authRecoveryOpen}
        onOpenChange={setAuthRecoveryOpen}
      />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-orange-200">
            <CalendarClock size={18} />
            <p className="text-xs font-black uppercase tracking-[0.2em]">
              Automação da agenda
            </p>
          </div>
          <h2 id="routine-title" className="mt-2 text-xl font-black">
            Rotina de quarta-feira
          </h2>
          {status.isLoading ? (
            <p className="mt-2 text-sm text-zinc-400">
              Consultando a próxima execução…
            </p>
          ) : status.isError ? (
            <p className="mt-2 text-sm text-red-200">
              Não foi possível consultar o schedule.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-zinc-300">
                Próxima execução:{" "}
                <strong className="text-white">
                  {formatExecution(status.data?.nextExecutionAt)}
                </strong>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Quartas-feiras às 10:00 · {status.data?.timezone} · modo{" "}
                {status.data?.runMode}
              </p>
              {latestRun && (
                <p className="mt-2 text-xs text-zinc-400">
                  Último ingestionRun:{" "}
                  <strong className="text-zinc-200">#{latestRun.id}</strong> ·{" "}
                  {latestRun.trigger === "manual" ? "manual" : "automático"} ·
                  status{" "}
                  <strong className="text-zinc-200">{latestRun.status}</strong>{" "}
                  · expurgados{" "}
                  <strong className="text-zinc-200">
                    {latestRun.expurgatedCount}
                  </strong>
                </p>
              )}
              <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/5 px-3 py-3 text-xs" data-testid="last-successful-cron-sync" aria-live="polite">
                <div className="flex items-center gap-2 text-emerald-200">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span className="font-black uppercase tracking-[0.16em]">Última sincronização bem-sucedida</span>
                </div>
                {lastSuccessfulCronRun ? (
                  <p className="mt-1 text-zinc-300">
                    {formatExecution(lastSuccessfulCronRun.finishedAt ?? lastSuccessfulCronRun.startedAt)} · status <strong className="text-emerald-200">Sucesso</strong>
                  </p>
                ) : (
                  <p className="mt-1 text-zinc-500">Nenhuma sincronização automática concluída ainda.</p>
                )}
              </div>
              <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between" data-testid="cron-refresh-settings">
                <div>
                  <p className="font-black uppercase tracking-[0.14em] text-zinc-300">Atualização automática</p>
                  <p className="mt-1 text-zinc-500">Atualiza somente o status do cron, sem recarregar a página.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="cron-refresh-interval" className="sr-only">Intervalo de atualização do cron</label>
                  <select
                    id="cron-refresh-interval"
                    value={cronRefreshPreference.mode}
                    onChange={event => setCronRefreshPreference(current => ({ ...current, mode: Number(event.currentTarget.value) }))}
                    className="min-h-10 rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 font-bold text-zinc-100 outline-none focus:border-cyan-300/60 focus-visible:ring-2 focus-visible:ring-cyan-300/40"
                  >
                    {CRON_REFRESH_PRESETS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  {cronRefreshPreference.mode === -1 && (
                    <label className="flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-zinc-900 px-3 py-1 text-zinc-400">
                      <span>Seg.</span>
                      <input
                        type="number"
                        min={15}
                        max={3600}
                        step={15}
                        value={cronRefreshPreference.customSeconds}
                        onChange={event => setCronRefreshPreference(current => ({ ...current, customSeconds: Math.min(3600, Math.max(15, Number(event.currentTarget.value) || 15)) }))}
                        className="w-20 bg-transparent text-right font-bold text-zinc-100 outline-none"
                        aria-label="Intervalo personalizado em segundos"
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-violet-300/20 bg-violet-300/5 px-3 py-3 text-xs sm:flex-row sm:items-end sm:justify-between" data-testid="cron-rollover-settings">
                <div>
                  <p className="font-black uppercase tracking-[0.14em] text-violet-100">Virada do dia no feed</p>
                  <p className="mt-1 max-w-xl text-zinc-500">Eventos da madrugada permanecem em “Hoje” até este horário local.</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex min-h-10 flex-col gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                    <span>Hora · America/Sao_Paulo</span>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      step={1}
                      value={rolloverValue}
                      onChange={event => setRolloverDraft(event.currentTarget.value)}
                      className="min-h-10 w-24 rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-sm font-black normal-case tracking-normal text-zinc-100 outline-none focus:border-violet-300/60 focus-visible:ring-2 focus-visible:ring-violet-300/40"
                      aria-label="Hora de virada do dia em America/Sao_Paulo"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => rolloverMutation.mutate({ rolloverHour: parsedRolloverHour })}
                    disabled={!rolloverIsValid || rolloverMutation.isPending || rolloverHourQuery.isLoading}
                    aria-busy={rolloverMutation.isPending}
                    aria-label="Salvar horário de virada do dia"
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-violet-300 px-3 py-2 text-sm font-black text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {rolloverMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {rolloverMutation.isPending ? "Salvando…" : "Salvar horário"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void refreshStatus()}
            disabled={status.isLoading || status.isFetching}
            aria-busy={status.isFetching}
            aria-label="Atualizar status do cron"
            title="Atualizar status do cron"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-sm font-black text-zinc-200 transition hover:border-cyan-300/50 hover:text-cyan-100 disabled:cursor-wait disabled:opacity-50"
          >
            <RefreshCw size={16} className={status.isFetching ? "animate-spin" : ""} />
            <span className="sr-only">{status.isFetching ? "Atualizando status" : "Atualizar status"}</span>
          </button>
          <button
            type="button"
            onClick={confirmRun}
          disabled={
            chunkRunning || runSource.isPending || legacyRunNow.isPending || status.data?.isRunning || status.isLoading
          }
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-400 to-fuchsia-500 px-4 py-3 text-sm font-black text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Executar ingestão manual agora"
          title="Executar ingestão manual agora"
        >
          {chunkRunning || runSource.isPending || legacyRunNow.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Play size={16} />
          )}{" "}
          {chunkRunning || runSource.isPending || legacyRunNow.isPending ? `Fonte ${chunkIndex + 1}/${chunkSources.data?.sources?.length ?? "…"}` : "Executar ingestão manual"}
          </button>
        </div>
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-yellow-200" />
        <span>
          O disparo manual usa a mesma proteção administrativa, é idempotente e
          bloqueia uma segunda execução enquanto a primeira estiver em
          andamento.
        </span>
      </div>
      {activeChunkRetry !== null && !progress && (
        <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100" role="status" data-testid="chunk-retry-indicator">
          <Loader2 size={15} className="animate-spin" /> Tentando novamente ({activeChunkRetry}/2)…
        </div>
      )}
      {progress && (progress.isRunning || progress.runId) && (
        <div
          className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4"
          aria-live="polite"
          data-testid="manual-ingestion-progress"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                Progresso da ingestão
              </p>
              <p className="mt-1 text-sm font-bold text-zinc-100">
                {progress.message}
              </p>
              {activeChunkRetry !== null && (
                <p className="mt-2 inline-flex items-center gap-2 text-xs font-black text-amber-200" role="status" data-testid="chunk-retry-indicator">
                  <Loader2 size={13} className="animate-spin" /> Tentando novamente ({activeChunkRetry}/2)…
                </p>
              )}
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${progress.phase === "failed" ? "bg-red-300/15 text-red-200" : progress.isRunning ? "bg-yellow-300/15 text-yellow-100" : "bg-emerald-300/15 text-emerald-200"}`}
            >
              {progress.isRunning
                ? "Em andamento"
                : progress.phase === "failed"
                  ? "Falha"
                  : "Concluída"}
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>
                Etapa {Math.min(progress.step + 1, progress.totalSteps)} de{" "}
                {progress.totalSteps}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${progress.phase === "failed" ? "bg-red-300" : "bg-gradient-to-r from-cyan-300 to-fuchsia-400"}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/10 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                Fontes
              </p>
              <div className="mt-2 space-y-2">
                {progress.sources.map(
                  (source: { sourceKey: string; status: string }) => (
                    <div
                      key={source.sourceKey}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="font-bold text-zinc-200">
                        {source.sourceKey === "instagram"
                          ? "Instagram"
                          : "Fontes públicas"}
                      </span>
                      <span
                        className={
                          source.status === "succeeded"
                            ? "text-emerald-200"
                            : source.status === "failed"
                              ? "text-red-200"
                              : source.status === "running"
                                ? "text-yellow-100"
                                : "text-zinc-500"
                        }
                      >
                        {source.status === "succeeded"
                          ? "Concluída"
                          : source.status === "failed"
                            ? "Falhou"
                            : source.status === "running"
                              ? "Processando…"
                              : "Aguardando"}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/10 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                Métricas capturadas
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <span className="text-zinc-500">
                  Lidas{" "}
                  <strong className="text-cyan-200">
                    {progress.sources.reduce(
                      (sum: number, source: { read: number }) =>
                        sum + source.read,
                      0
                    )}
                  </strong>
                </span>
                <span className="text-zinc-500">
                  Adicionadas{" "}
                  <strong className="text-emerald-200">
                    {progress.sources.reduce(
                      (sum: number, source: { added: number }) =>
                        sum + source.added,
                      0
                    )}
                  </strong>
                </span>
                <span className="text-zinc-500">
                  Atualizadas{" "}
                  <strong className="text-cyan-200">
                    {progress.sources.reduce(
                      (sum: number, source: { updated: number }) =>
                        sum + source.updated,
                      0
                    )}
                  </strong>
                </span>
                <span className="text-zinc-500">
                  Ignoradas{" "}
                  <strong className="text-yellow-100">
                    {progress.sources.reduce(
                      (sum: number, source: { ignored: number }) =>
                        sum + source.ignored,
                      0
                    )}
                  </strong>
                </span>
              </div>
            </div>
          </div>
          {progress.error && (
            <p className="mt-3 text-xs text-red-200">{progress.error}</p>
          )}
        </div>
      )}
      {chunkSummary && (
        <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4" data-testid="chunk-summary" aria-live="polite">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Resumo da execução por chunk</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-emerald-300/10 px-2 py-3"><strong className="block text-lg text-emerald-200">{chunkSummary.success}</strong><span className="text-zinc-400">Sucesso</span></div>
            <div className="rounded-xl bg-red-300/10 px-2 py-3"><strong className="block text-lg text-red-200">{chunkSummary.failure}</strong><span className="text-zinc-400">Falha</span></div>
            <div className="rounded-xl bg-amber-300/10 px-2 py-3"><strong className="block text-lg text-amber-200">{chunkSummary.timeout}</strong><span className="text-zinc-400">Timeout</span></div>
          </div>
        </div>
      )}
      <div
        className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4"
        aria-labelledby="routine-history-title"
        data-testid="manual-execution-history"
      >
        <div className="flex items-center gap-2">
          <Clock3 size={16} className="text-fuchsia-200" />
          <h3
            id="routine-history-title"
            className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-100"
          >
            Execuções recentes
          </h3>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Histórico das últimas operações manuais e automáticas, com duração e
          resultado.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Histórico de ingestão">
          <button type="button" role="tab" aria-selected={historyTab === "runs"} onClick={() => setHistoryTab("runs")} className={`rounded-xl px-3 py-2 text-xs font-black ${historyTab === "runs" ? "bg-fuchsia-300 text-zinc-950" : "border border-white/10 text-zinc-400 hover:text-white"}`}>Execuções</button>
          <button type="button" role="tab" aria-selected={historyTab === "filtered"} onClick={() => setHistoryTab("filtered")} className={`rounded-xl px-3 py-2 text-xs font-black ${historyTab === "filtered" ? "bg-fuchsia-300 text-zinc-950" : "border border-white/10 text-zinc-400 hover:text-white"}`}>Stories filtrados ({filteredStories.filter(story => story.status !== "approved").length})</button>
        </div>
        {historyTab === "filtered" ? (
          filteredStories.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2" data-testid="filtered-stories-list">
            {filteredStories.map(story => (
              <article key={story.id} className="grid gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-3 sm:grid-cols-[96px_1fr]">
                <img src={story.imageUrl} alt={`Story de @${story.username || "fonte desconhecida"}`} className="h-24 w-full rounded-xl border border-white/10 object-cover" loading="lazy" />
                <div className="min-w-0 text-xs">
                  <div className="flex items-start justify-between gap-2"><div><p className="font-black text-zinc-100">@{story.username || "fonte desconhecida"}</p><p className="text-zinc-500">{story.mediaOrigin === "highlight" ? "Destaque" : "Story"} · {story.postedAt ? formatExecution(story.postedAt) : "data não informada"}</p></div><span className={`rounded-full px-2 py-1 font-black uppercase ${story.status === "approved" ? "bg-emerald-300/15 text-emerald-200" : "bg-amber-300/15 text-amber-100"}`}>{story.status === "approved" ? "Aprovado" : "Filtrado"}</span></div>
                  <p className="mt-2 font-black uppercase tracking-wide text-amber-100">Motivo da rejeição</p><ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-300">{story.reasons.length ? story.reasons.map(reason => <li key={reason}>{reason}</li>) : <li>Não informado</li>}</ul>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-zinc-400">{story.ocrText || story.rawText || "Sem texto OCR registrado."}</p>
                  {story.status !== "approved" && <Button type="button" size="sm" className="mt-3" disabled={approveFilteredStoryMutation.isPending} onClick={() => { const run = status.data?.recentRuns?.find(candidate => (candidate as OcrAuditRun).filteredStories?.some(item => item.id === story.id)); if (run) approveFilteredStoryMutation.mutate({ runId: run.id, storyId: story.id }); }} aria-label={`Aprovar Story de ${story.username || "fonte desconhecida"}`}>{approveFilteredStoryMutation.isPending ? <><Loader2 size={13} className="animate-spin" /> Aprovando…</> : "Aprovar manualmente"}</Button>}
                </div>
              </article>
            ))}
          </div> : <p className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-xs text-zinc-500">Nenhum Story filtrado aguardando revisão.</p>
        ) : status.data?.recentRuns?.length ? (
          <div className="mt-3 space-y-3">
            {status.data.recentRuns.map(run => (
              <div
                key={run.id}
                className="rounded-xl border border-white/10 px-3 py-3 text-xs"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${statusTone(run.status)}`}
                    aria-label={`Status: ${statusLabel(run.status)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-zinc-200">
                          Run #{run.id} · {run.routine} ·{" "}
                          {run.trigger === "manual" ? "manual" : "automático"}
                        </p>
                        <ProviderQuotaNotice run={run} />
                        <p className="text-zinc-500">
                          {formatExecution(run.finishedAt ?? run.startedAt)} ·
                          HTTP {run.httpStatus ?? "—"} ·{" "}
                          {formatDuration(run.durationMs)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 font-black uppercase ${run.status === "succeeded" ? "bg-emerald-300/15 text-emerald-200" : run.status === "running" ? "bg-yellow-300/15 text-yellow-100" : run.status === "partial" ? "bg-orange-300/15 text-orange-100" : "bg-red-300/15 text-red-200"}`}
                      >
                        {statusLabel(run.status)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-zinc-400 sm:grid-cols-4">
                      <span>
                        Mídias lidas{" "}
                        <strong className="text-zinc-200">
                          {run.readCount}
                        </strong>
                      </span>
                      <span>
                        Processadas{" "}
                        <strong className="text-zinc-200">
                          {run.processedCount}
                        </strong>
                      </span>
                      <span>
                        Persistidas{" "}
                        <strong className="text-zinc-200">
                          {run.persistedEventIds.length}
                        </strong>
                      </span>
                      <span>
                        Expurgados{" "}
                        <strong className="text-zinc-200">
                          {run.expurgatedCount}
                        </strong>
                      </span>
                      <span className="flex items-center gap-1">
                        {dateFilterTimezone(run.dateFilterValidation) ===
                        "America/Sao_Paulo" ? (
                          <CalendarCheck2
                            size={13}
                            className="text-emerald-300"
                          />
                        ) : (
                          <ShieldAlert size={13} className="text-yellow-300" />
                        )}
                        Data SP {dateFilterToday(run.dateFilterValidation)}
                      </span>
                    </div>
                    {run.persistedEventIds.length > 0 && (
                      <p className="mt-2 break-words text-zinc-500">
                        IDs persistidos:{" "}
                        <span className="text-zinc-300">
                          {run.persistedEventIds.join(", ")}
                        </span>
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedOcrRun(run as OcrAuditRun)}
                      disabled={!Array.isArray((run as OcrAuditRun).ocrAudit) || (run as OcrAuditRun).ocrAudit?.length === 0}
                      className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-fuchsia-300/30 px-3 py-2 text-xs font-bold text-fuchsia-100 hover:bg-fuchsia-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Auditar OCR da execução ${run.id}`}
                    >
                      <Eye size={14} /> Ver detalhes OCR
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">
            Nenhuma execução recente registrada ainda.
          </p>
        )}
      </div>
      <Dialog open={selectedOcrRun !== null} onOpenChange={open => { if (!open) setSelectedOcrRun(null); }}>
        <DialogContent data-testid="ocr-audit-dialog" data-ocr-entry-count={selectedOcrRun?.ocrAudit?.length ?? 0} className="max-h-[85vh] overflow-y-auto border-fuchsia-300/20 bg-zinc-950 text-zinc-100 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Auditoria OCR · Run #{selectedOcrRun?.id}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Revise manualmente o texto extraído. O texto bruto original permanece preservado para auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(selectedOcrRun?.ocrAudit ?? []).map((item, index) => (
              <article key={`${selectedOcrRun?.id}-ocr-${index}`} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[minmax(220px,0.9fr)_minmax(0,1.4fr)]">
                <div>
                  {item.imageUrl ? <img src={item.imageUrl} alt={`Arte da origem ${item.mediaOrigin}`} loading="lazy" className="h-32 w-full rounded-xl border border-white/10 object-cover" /> : <div className="grid h-32 place-items-center rounded-xl border border-dashed border-white/10 text-xs text-zinc-500">Sem imagem</div>}
                  <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-fuchsia-200">{item.mediaOrigin === "highlight" ? "Destaque" : item.mediaOrigin === "story" ? "Story" : "Post"}</p>
                </div>
                <div className="min-w-0 space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black uppercase tracking-wide text-zinc-500">Texto OCR revisável</p>
                      {editingOcrIndex === index ? <span className="text-[11px] text-fuchsia-200">Editando</span> : <button type="button" aria-label={`Editar texto OCR ${index + 1}`} className="text-[11px] font-bold text-fuchsia-200 underline underline-offset-4" onClick={() => startOcrEditing(index, item)}>Editar texto</button>}
                    </div>
                    {editingOcrIndex === index ? (
                      <div className="mt-1 space-y-2">
                        <textarea value={ocrDraft} onChange={event => setOcrDraft(event.target.value)} maxLength={5000} rows={6} aria-label={`Texto OCR editável ${index + 1}`} className="w-full rounded-xl border border-fuchsia-300/30 bg-black/30 p-3 font-sans text-sm text-zinc-100 outline-none focus:border-fuchsia-200 focus:ring-2 focus:ring-fuchsia-200/30" />
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                          <span>{ocrDraft.length}/5000 caracteres</span>
                          <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setEditingOcrIndex(null)} disabled={ocrEditMutation.isPending}>Cancelar</Button><Button type="button" size="sm" aria-label={`Salvar texto OCR ${editingOcrIndex + 1}`} onClick={saveOcrEdit} disabled={ocrEditMutation.isPending}>{ocrEditMutation.isPending ? <><Loader2 size={13} className="animate-spin" /> Salvando…</> : <><Save size={13} /> Salvar texto</>}</Button></div>
                        </div>
                      </div>
                    ) : <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 font-sans text-zinc-200">{item.ocrText || "Nenhum texto OCR registrado."}</pre>}
                  </div>
                  <div><p className="font-black uppercase tracking-wide text-zinc-500">Texto bruto combinado</p><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 font-sans text-zinc-300">{item.rawText || "Nenhum texto bruto registrado."}</pre></div>
                  {item.highlightTitle && <p className="text-zinc-400">Destaque: <strong className="text-zinc-200">{item.highlightTitle}</strong></p>}
                  {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex text-fuchsia-200 underline underline-offset-4">Abrir origem no Instagram</a>}
                </div>
              </article>
            ))}
            {(selectedOcrRun?.ocrAudit ?? []).length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">Esta execução não possui dados OCR disponíveis.</p>}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setSelectedOcrRun(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {feedback && (
        <div
          role="status"
          className={`mt-4 flex items-start gap-2 rounded-2xl border p-3 text-sm ${feedback.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          )}
          {feedback.text}
        </div>
      )}
    </section>
  );
}
