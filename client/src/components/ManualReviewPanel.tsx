import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Copy, Edit3, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { trpc } from "@/lib/trpc";
import { friendlyAdminErrorMessage } from "@/lib/adminFeedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ManualReviewStatus = "pending" | "approved" | "rejected";
type ManualReviewCategory = "show" | "balada" | "evento_musical";

type ManualReviewEvent = {
  id: number;
  sourceUrl: string | null;
  sourceType: string | null;
  title: string;
  summary: string | null;
  eventDate: string | null;
  endDate: string | null;
  locationName: string | null;
  address: string | null;
  city: string | null;
  category: ManualReviewCategory | null;
  genre: string | null;
  priceCents: number | null;
  imageUrl: string | null;
  rawText: string | null;
  reason: string;
  status: ManualReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  publishedEventId: number | null;
  createdAt: string;
  updatedAt: string;
};

type ManualReviewDraft = {
  title: string;
  eventDate: string;
  endDate: string;
  locationName: string;
  address: string;
  city: "" | "Santos" | "Guarujá";
  category: "" | ManualReviewCategory;
  genre: string;
  summary: string;
  priceCents: string;
  sourceUrl: string;
  sourceType: string;
  imageUrl: string;
  rawText: string;
  reason: string;
};

const PAGE_SIZES = [10, 25, 50] as const;

function readUrlValue(key: string) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

function validStatus(value: string): value is ManualReviewStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

export function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function localDateTimeToIso(value: string) {
  if (!value) return null;
  const date = new Date(`${value}:00-03:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function formatDate(value: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date)
    : "Data inválida";
}

function sourceLabel(sourceType: string | null) {
  if (!sourceType) return "Origem não informada";
  return sourceType === "instagram" ? "Instagram" : sourceType === "public" ? "Agenda pública" : sourceType;
}

function statusLabel(status: ManualReviewStatus) {
  return status === "pending" ? "Aguardando revisão" : status === "approved" ? "Publicado" : "Rejeitado";
}

function statusClass(status: ManualReviewStatus) {
  return status === "pending" ? "bg-amber-300/15 text-amber-100" : status === "approved" ? "bg-emerald-300/15 text-emerald-100" : "bg-red-300/15 text-red-100";
}

const RAW_TEXT_HIGHLIGHT_PATTERN = /(^|[^A-Za-zÀ-ÿ0-9])((?:[01]?\d|2[0-3])(?:[:hH][0-5]\d|h)|(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?|(?:amanhã|amanha|hoje)|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)(?![A-Za-zÀ-ÿ0-9])/gi;

export type RawTextTokenKind = "time" | "date";
export type RawTextToken = { value: string; kind: RawTextTokenKind };
export type RawTextHighlightOptions = {
  onTokenClick?: (token: RawTextToken) => void;
  onApplyToken?: (token: RawTextToken) => void;
  copiedToken?: string | null;
  appliedToken?: string | null;
};

function tokenKind(value: string): RawTextTokenKind {
  return /^(?:[01]?\d|2[0-3])(?:[:hH][0-5]\d|h)$/i.test(value) ? "time" : "date";
}

export function highlightRawText(text: string, options: RawTextHighlightOptions = {}): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  RAW_TEXT_HIGHLIGHT_PATTERN.lastIndex = 0;
  while ((match = RAW_TEXT_HIGHLIGHT_PATTERN.exec(text)) !== null) {
    const prefixLength = match[0].length - match[2].length;
    const token: RawTextToken = { value: match[2], kind: tokenKind(match[2]) };
    nodes.push(<React.Fragment key={`text-${index}`}>{text.slice(cursor, match.index + prefixLength)}</React.Fragment>);
    if (!options.onTokenClick) {
      nodes.push(<mark key={`highlight-${index}`} className="rounded bg-amber-300/25 px-1 font-bold text-amber-100 ring-1 ring-inset ring-amber-200/20">{token.value}</mark>);
    } else {
      nodes.push(
        <span key={`interactive-highlight-${index}`} className="mx-0.5 inline-flex items-center align-baseline rounded bg-amber-300/25 font-bold text-amber-100 ring-1 ring-inset ring-amber-200/20">
          <button type="button" onClick={() => options.onTokenClick?.(token)} aria-label={`Copiar ${token.value}`} title="Copiar este valor" className="rounded-l px-1 font-bold underline decoration-dotted underline-offset-2 hover:bg-amber-200/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">{token.value}</button>
          {options.onApplyToken && <button type="button" onClick={() => options.onApplyToken?.(token)} aria-label={`Aplicar ${token.value} ao formulário`} title="Aplicar ao formulário" className="rounded-r border-l border-amber-200/20 px-1.5 text-xs font-black hover:bg-amber-200/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">+</button>}
          {options.copiedToken === token.value && <span role="status" className="sr-only">Copiado!</span>}
          {options.appliedToken === token.value && <span role="status" className="sr-only">Aplicado!</span>}
        </span>,
      );
    }
    cursor = match.index + match[0].length;
    index += 1;
  }
  nodes.push(<React.Fragment key={`text-${index}`}>{text.slice(cursor)}</React.Fragment>);
  return nodes;
}

export function applyRawTokenToDateTime(currentValue: string, token: RawTextToken, fallbackDate?: string): string | null {
  const datePart = currentValue.slice(0, 10) || fallbackDate || new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (token.kind === "time") {
    const timeMatch = token.value.match(/^(\d{1,2})(?::|h)(\d{2})?$/i);
    if (!timeMatch || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] ?? 0);
    if (!Number.isInteger(hours) || hours > 23 || minutes > 59) return null;
    return `${datePart}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const dateMatch = token.value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!dateMatch) return null;
  const currentYear = datePart.slice(0, 4);
  const year = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : currentYear;
  if (!/^\d{4}$/.test(year)) return null;
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[1]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}${currentValue.slice(10) || "T00:00"}`;
}

export function draftFromEvent(event: ManualReviewEvent): ManualReviewDraft {
  return {
    title: event.title,
    eventDate: toDateTimeLocal(event.eventDate),
    endDate: toDateTimeLocal(event.endDate),
    locationName: event.locationName ?? "",
    address: event.address ?? "",
    city: event.city === "Santos" || event.city === "Guarujá" ? event.city : "",
    category: event.category ?? "",
    genre: event.genre ?? "",
    summary: event.summary ?? "",
    priceCents: event.priceCents == null ? "" : String(event.priceCents),
    sourceUrl: event.sourceUrl ?? "",
    sourceType: event.sourceType ?? "",
    imageUrl: event.imageUrl ?? "",
    rawText: event.rawText ?? "",
    reason: event.reason,
  };
}

export default function ManualReviewPanel() {
  const [status, setStatus] = useState<"" | ManualReviewStatus>(() => { const value = readUrlValue("manual_review_status"); return validStatus(value) ? value : ""; });
  const [sourceType, setSourceType] = useState(() => readUrlValue("manual_review_source"));
  const [from, setFrom] = useState(() => readUrlValue("manual_review_from"));
  const [to, setTo] = useState(() => readUrlValue("manual_review_to"));
  const [pageSize, setPageSize] = useState(() => { const value = Number(readUrlValue("manual_review_page_size")); return PAGE_SIZES.includes(value as typeof PAGE_SIZES[number]) ? value : 25; });
  const [page, setPage] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<ManualReviewEvent | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [draft, setDraft] = useState<ManualReviewDraft | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [appliedToken, setAppliedToken] = useState<string | null>(null);

  const listInput = useMemo(() => ({ status: status || undefined, sourceType: sourceType.trim() || undefined, from: from || undefined, to: to || undefined, offset: page * pageSize, limit: pageSize }), [status, sourceType, from, to, page, pageSize]);
  const queueQuery = trpc.adminRoutine.manualReview.list.useQuery(listInput, { refetchInterval: 30_000 });
  const metricsQuery = trpc.adminRoutine.manualReview.metrics.useQuery(undefined, { refetchInterval: 30_000 });
  const updateMutation = trpc.adminRoutine.manualReview.update.useMutation({
    onSuccess: updated => {
      setSelectedEvent(updated);
      setDraft(draftFromEvent(updated));
      sonnerToast.success("Revisão salva", { description: "Os dados assistidos foram atualizados." });
      void queueQuery.refetch();
      void metricsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível salvar a revisão", { description: friendlyAdminErrorMessage(error, "Revise os campos e tente novamente.") }),
  });
  const approveMutation = trpc.adminRoutine.manualReview.approve.useMutation({
    onSuccess: approved => {
      setSelectedEvent(approved);
      setDraft(draftFromEvent(approved));
      sonnerToast.success("Evento publicado", { description: "O evento revisado já está disponível na agenda pública." });
      void queueQuery.refetch();
      void metricsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível publicar", { description: friendlyAdminErrorMessage(error, "Preencha data, local, cidade e categoria antes de aprovar.") }),
  });
  const approveManyMutation = trpc.adminRoutine.manualReview.approveMany.useMutation({
    onSuccess: result => {
      setSelectedIds(current => current.filter(id => !result.ids.includes(id)));
      sonnerToast.success("Eventos publicados", { description: `${result.count} evento(s) foram aprovados e publicados.` });
      void queueQuery.refetch();
      void metricsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível aprovar em massa", { description: friendlyAdminErrorMessage(error, "Complete os campos obrigatórios dos eventos selecionados.") }),
  });
  const rejectManyMutation = trpc.adminRoutine.manualReview.rejectMany.useMutation({
    onSuccess: result => {
      setSelectedIds(current => current.filter(id => !result.ids.includes(id)));
      sonnerToast.success("Eventos rejeitados", { description: `${result.count} evento(s) foram removidos da fila de revisão.` });
      void queueQuery.refetch();
      void metricsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível rejeitar em massa", { description: friendlyAdminErrorMessage(error, "Tente novamente em instantes.") }),
  });
  const rejectMutation = trpc.adminRoutine.manualReview.reject.useMutation({
    onSuccess: rejected => {
      setSelectedEvent(rejected);
      setDraft(draftFromEvent(rejected));
      sonnerToast.success("Evento rejeitado", { description: "A entrada foi retirada da fila de revisão." });
      void queueQuery.refetch();
      void metricsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível rejeitar", { description: friendlyAdminErrorMessage(error, "Tente novamente em instantes.") }),
  });

  useEffect(() => {
    setPage(0);
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (status) params.set("manual_review_status", status); else params.delete("manual_review_status");
    if (sourceType.trim()) params.set("manual_review_source", sourceType.trim()); else params.delete("manual_review_source");
    if (from) params.set("manual_review_from", from); else params.delete("manual_review_from");
    if (to) params.set("manual_review_to", to); else params.delete("manual_review_to");
    params.set("manual_review_page_size", String(pageSize));
    window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`);
  }, [status, sourceType, from, to, pageSize]);

  useEffect(() => { setPage(0); }, [status, sourceType, from, to, pageSize]);
  const pendingVisibleIds = useMemo(() => (queueQuery.data?.items ?? []).filter(event => event.status === "pending").map(event => event.id), [queueQuery.data?.items]);
  const pendingVisibleKey = pendingVisibleIds.join(",");
  useEffect(() => { setSelectedIds(current => current.filter(id => pendingVisibleIds.includes(id))); }, [pendingVisibleKey]);
  const allPendingSelected = pendingVisibleIds.length > 0 && pendingVisibleIds.every(id => selectedIds.includes(id));
  const bulkPending = approveManyMutation.isPending || rejectManyMutation.isPending;
  const toggleSelected = (id: number) => setSelectedIds(current => current.includes(id) ? current.filter(selectedId => selectedId !== id) : [...current, id]);
  const toggleAllPending = () => setSelectedIds(current => allPendingSelected ? current.filter(id => !pendingVisibleIds.includes(id)) : Array.from(new Set([...current, ...pendingVisibleIds])));
  const approveSelectedMany = () => { if (!bulkPending && selectedIds.length > 0) approveManyMutation.mutate({ ids: Array.from(new Set(selectedIds)) }); };
  const rejectSelectedMany = () => { if (!bulkPending && selectedIds.length > 0 && window.confirm(`Rejeitar ${selectedIds.length} evento(s) selecionado(s)? Eles sairão da fila de revisão.`)) rejectManyMutation.mutate({ ids: Array.from(new Set(selectedIds)) }); };

  const selectEvent = (event: ManualReviewEvent) => {
    setSelectedEvent(event);
    setDraft(draftFromEvent(event));
    setCopyState("idle");
    setCopiedToken(null);
    setAppliedToken(null);
  };
  const copyRawText = async () => {
    if (!draft?.rawText) return;
    try {
      await navigator.clipboard.writeText(draft.rawText);
      setCopyState("copied");
      sonnerToast.success("Texto copiado", { description: "O texto original foi copiado para a área de transferência." });
    } catch {
      setCopyState("error");
      sonnerToast.error("Não foi possível copiar", { description: "Selecione o texto manualmente e tente novamente." });
    }
  };
  const copyToken = async (token: RawTextToken) => {
    try {
      await navigator.clipboard.writeText(token.value);
      setCopiedToken(token.value);
      sonnerToast.success("Token copiado", { description: `“${token.value}” foi copiado.` });
    } catch {
      sonnerToast.error("Não foi possível copiar o token", { description: "Selecione o valor manualmente e tente novamente." });
    }
  };
  const setDraftField = <K extends keyof ManualReviewDraft>(key: K, value: ManualReviewDraft[K]) => setDraft(current => current ? { ...current, [key]: value } : current);
  const applyTokenToDraft = (token: RawTextToken) => {
    if (!draft) return;
    const nextEventDate = applyRawTokenToDateTime(draft.eventDate, token);
    if (!nextEventDate) {
      sonnerToast.info("Token não reconhecido para preenchimento", { description: "O valor foi mantido disponível para cópia manual; confirme a data ou horário no formulário." });
      return;
    }
    setDraft(current => current ? { ...current, eventDate: nextEventDate } : current);
    setAppliedToken(token.value);
    sonnerToast.success("Token aplicado", { description: `“${token.value}” foi aplicado à data e hora do evento.` });
  };
  const saveDraft = () => {
    if (!selectedEvent || !draft || updateMutation.isPending) return;
    updateMutation.mutate({
      id: selectedEvent.id,
      title: draft.title,
      eventDate: localDateTimeToIso(draft.eventDate),
      endDate: localDateTimeToIso(draft.endDate),
      locationName: draft.locationName || null,
      address: draft.address || null,
      city: draft.city || null,
      category: draft.category || null,
      genre: draft.genre || null,
      summary: draft.summary || null,
      priceCents: draft.priceCents ? Number(draft.priceCents) : null,
      sourceUrl: draft.sourceUrl || null,
      sourceType: draft.sourceType || null,
      imageUrl: draft.imageUrl || null,
      rawText: draft.rawText || null,
      reason: draft.reason,
    });
  };
  const approveSelected = () => {
    if (!selectedEvent || approveMutation.isPending) return;
    approveMutation.mutate({ id: selectedEvent.id });
  };
  const rejectSelected = () => {
    if (!selectedEvent || rejectMutation.isPending) return;
    rejectMutation.mutate({ id: selectedEvent.id });
  };
  const isSaving = updateMutation.isPending || approveMutation.isPending || rejectMutation.isPending || bulkPending;

  return (
    <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/[0.04] p-5 sm:p-7" data-testid="manual-review-panel" aria-labelledby="manual-review-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><Clock3 size={18} className="text-amber-200" /><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">Governança de eventos</p></div>
          <h2 id="manual-review-title" className="mt-2 text-2xl font-black text-zinc-100">Fila de Revisão Manual</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">Eventos parcialmente estruturados pela IA permanecem aqui para completar os dados com segurança antes da publicação.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => { void queueQuery.refetch(); void metricsQuery.refetch(); }} disabled={queueQuery.isFetching || metricsQuery.isFetching} aria-label="Atualizar fila de revisão manual"><RefreshCw size={14} className={queueQuery.isFetching ? "animate-spin" : ""} /> Atualizar</Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2" data-testid="manual-review-metrics">
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-200">Eventos publicados</p><p className="mt-2 text-3xl font-black text-emerald-50">{metricsQuery.data?.published ?? "—"}</p><p className="mt-1 text-xs text-zinc-500">Eventos ativos na agenda pública</p></div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-200">Aguardando revisão</p><p className="mt-2 text-3xl font-black text-amber-50">{metricsQuery.data?.awaitingReview ?? "—"}</p><p className="mt-1 text-xs text-zinc-500">Entradas incompletas preservadas pela IA</p></div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="manual-review-filters">
        <label className="grid gap-1 text-xs font-bold text-zinc-400">Status<select value={status} onChange={event => setStatus(event.target.value as "" | ManualReviewStatus)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" aria-label="Filtrar fila manual por status"><option value="">Todos</option><option value="pending">Aguardando revisão</option><option value="approved">Publicados</option><option value="rejected">Rejeitados</option></select></label>
        <label className="grid gap-1 text-xs font-bold text-zinc-400">Fonte/tipo<input value={sourceType} onChange={event => setSourceType(event.target.value)} placeholder="instagram ou public" className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100 placeholder:text-zinc-600" aria-label="Filtrar fila manual por fonte" /></label>
        <label className="grid gap-1 text-xs font-bold text-zinc-400">Data inicial<input type="date" value={from} onChange={event => setFrom(event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" aria-label="Filtrar fila manual a partir da data" /></label>
        <label className="grid gap-1 text-xs font-bold text-zinc-400">Data final<input type="date" value={to} onChange={event => setTo(event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" aria-label="Filtrar fila manual até a data" /></label>
        <label className="grid gap-1 text-xs font-bold text-zinc-400">Por página<select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" aria-label="Tamanho da página da fila manual">{PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-zinc-500"><span>{queueQuery.data?.total ?? 0} entrada(s) para os filtros atuais</span>{queueQuery.isFetching && <span role="status">Atualizando…</span>}</div>
      {pendingVisibleIds.length > 0 && <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/[0.05] p-3 sm:flex-row sm:items-center sm:justify-between" data-testid="manual-review-bulk-actions"><label className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-zinc-200"><input type="checkbox" checked={allPendingSelected} onChange={toggleAllPending} disabled={bulkPending} aria-label="Selecionar todos os eventos pendentes visíveis" className="h-5 w-5 accent-fuchsia-400" /> Selecionar pendentes visíveis <span className="text-zinc-500">({pendingVisibleIds.length})</span></label>{selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-fuchsia-100">{selectedIds.length} selecionado(s)</span><Button type="button" size="sm" data-testid="manual-review-approve-many" onClick={approveSelectedMany} disabled={bulkPending} aria-busy={approveManyMutation.isPending} className="bg-emerald-300 text-zinc-950 hover:bg-emerald-200">{approveManyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {approveManyMutation.isPending ? "Publicando…" : "Aprovar selecionados"}</Button><Button type="button" variant="outline" size="sm" data-testid="manual-review-reject-many" onClick={rejectSelectedMany} disabled={bulkPending} aria-busy={rejectManyMutation.isPending} className="text-red-100">{rejectManyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} {rejectManyMutation.isPending ? "Rejeitando…" : "Rejeitar selecionados"}</Button></div>}</div>}
      {queueQuery.isError ? <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">Não foi possível carregar a fila. <Button type="button" variant="outline" size="sm" className="ml-2" onClick={() => void queueQuery.refetch()}>Tentar novamente</Button></div> : queueQuery.data?.items.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2" data-testid="manual-review-list">{queueQuery.data.items.map(event => <article key={event.id} className="grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/40 p-3 sm:grid-cols-[96px_1fr]"><div>{event.imageUrl ? <img src={event.imageUrl} alt={`Imagem de ${event.title}`} loading="lazy" className="h-24 w-full rounded-xl border border-white/10 object-cover" /> : <div className="grid h-24 place-items-center rounded-xl border border-dashed border-white/10 text-center text-[11px] text-zinc-600">Sem imagem</div>}</div><div className="min-w-0"><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-start gap-2">{event.status === "pending" && <input type="checkbox" checked={selectedIds.includes(event.id)} onChange={() => toggleSelected(event.id)} disabled={bulkPending} aria-label={`Selecionar ${event.title}`} className="mt-1 h-5 w-5 shrink-0 accent-fuchsia-400" />}<div className="min-w-0"><h3 className="truncate font-black text-zinc-100">{event.title}</h3><p className="mt-1 text-xs text-zinc-500">{sourceLabel(event.sourceType)} · {formatDate(event.eventDate)}</p></div></div><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${statusClass(event.status)}`}>{statusLabel(event.status)}</span></div><p className="mt-2 text-xs text-amber-100">Motivo: {event.reason}</p><p className="mt-2 line-clamp-2 text-xs text-zinc-400">{event.summary || event.rawText || "Sem texto complementar registrado."}</p><Button type="button" variant="outline" size="sm" data-testid={`manual-review-edit-${event.id}`} className="mt-3" onClick={() => selectEvent(event)}><Edit3 size={13} /> {event.status === "pending" ? "Completar e revisar" : "Ver detalhes"}</Button></div></article>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">Nenhum evento encontrado para os filtros atuais.</div>}
      {(queueQuery.data?.hasNextPage || page > 0) && <div className="mt-5 flex items-center justify-between gap-3"><Button type="button" variant="outline" size="sm" onClick={() => setPage(current => Math.max(0, current - 1))} disabled={page === 0 || queueQuery.isFetching}>Anterior</Button><span className="text-xs text-zinc-500">Página {page + 1}</span><Button type="button" variant="outline" size="sm" onClick={() => setPage(current => current + 1)} disabled={!queueQuery.data?.hasNextPage || queueQuery.isFetching}>Próxima</Button></div>}

      <Dialog open={selectedEvent !== null} onOpenChange={open => { if (!open && !isSaving) { setSelectedEvent(null); setDraft(null); } }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto bg-zinc-950 text-zinc-100">
          <DialogHeader><DialogTitle>Revisão assistida do evento</DialogTitle><DialogDescription className="text-zinc-400">Complete os campos faltantes, salve a revisão e publique somente quando os dados essenciais estiverem conferidos.</DialogDescription></DialogHeader>
          {selectedEvent && draft && <div className="grid gap-4 py-3"><section data-testid="manual-review-source-preview" aria-labelledby="manual-review-source-title" className="grid gap-4 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/[0.05] p-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]"><div className="min-w-0">{draft.imageUrl ? <img src={draft.imageUrl} alt={`Imagem original de ${draft.title}`} className="h-48 w-full rounded-xl border border-white/10 object-cover" /> : <div className="grid h-48 place-items-center rounded-xl border border-dashed border-white/10 text-sm text-zinc-600">Sem imagem original</div>}</div><div className="min-w-0"><div className="flex items-center justify-between gap-3"><h3 id="manual-review-source-title" className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-100">Texto original da publicação</h3><span className="rounded-full bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-zinc-500">OCR / legenda</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-zinc-500">Horários, datas e dias reconhecidos ficam destacados.</span><Button type="button" variant="outline" size="sm" onClick={() => void copyRawText()} disabled={!draft.rawText} aria-label="Copiar texto original"><Copy size={14} /> {copyState === "copied" ? "Texto copiado" : "Copiar texto original"}</Button></div><pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-zinc-950/60 p-3 text-sm leading-6 text-zinc-200">{draft.rawText ? highlightRawText(draft.rawText, { onTokenClick: copyToken, onApplyToken: applyTokenToDraft, copiedToken, appliedToken }) : "Sem texto bruto registrado para esta entrada."}</pre><p role="status" aria-live="polite" className="mt-2 text-xs text-zinc-500">{copyState === "error" ? "A cópia automática falhou; selecione o texto manualmente." : "Use esta referência para completar horário, cidade, categoria e demais campos estruturados abaixo."}</p></div></section><div className="grid gap-4 lg:grid-cols-[180px_1fr]">{draft.imageUrl ? <img src={draft.imageUrl} alt={`Imagem original de ${draft.title}`} className="h-44 w-full rounded-2xl border border-white/10 object-cover" /> : <div className="grid h-44 place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-600">Sem imagem original</div>}<div className="grid gap-3"><label className="grid gap-1 text-xs font-bold text-zinc-400">Título<input value={draft.title} onChange={event => setDraftField("title", event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Motivo da revisão<input value={draft.reason} onChange={event => setDraftField("reason", event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label></div></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-zinc-400">Data e hora<input type="datetime-local" value={draft.eventDate} onChange={event => setDraftField("eventDate", event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Fim (opcional)<input type="datetime-local" value={draft.endDate} onChange={event => setDraftField("endDate", event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Local<input value={draft.locationName} onChange={event => setDraftField("locationName", event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Cidade<select value={draft.city} onChange={event => setDraftField("city", event.target.value as ManualReviewDraft["city"])} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100"><option value="">Selecionar cidade</option><option value="Santos">Santos</option><option value="Guarujá">Guarujá</option></select></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Categoria<select value={draft.category} onChange={event => setDraftField("category", event.target.value as ManualReviewDraft["category"])} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100"><option value="">Selecionar categoria</option><option value="show">Show</option><option value="balada">Balada</option><option value="evento_musical">Evento musical</option></select></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Gênero<input value={draft.genre} onChange={event => setDraftField("genre", event.target.value)} placeholder="funk, house/eletrônica..." className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label></div><label className="grid gap-1 text-xs font-bold text-zinc-400">Endereço<input value={draft.address} onChange={event => setDraftField("address", event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" /></label><label className="grid gap-1 text-xs font-bold text-zinc-400">Resumo<textarea value={draft.summary} onChange={event => setDraftField("summary", event.target.value)} className="min-h-24 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-zinc-100" /></label></div>}
          <DialogFooter className="gap-2 sm:justify-between"><div className="flex flex-wrap gap-2">{selectedEvent?.status === "pending" && <Button type="button" variant="outline" onClick={rejectSelected} disabled={isSaving} className="text-red-100"><XCircle size={14} /> Rejeitar</Button>}{selectedEvent?.status === "pending" && <Button type="button" onClick={approveSelected} disabled={isSaving} className="bg-emerald-300 text-zinc-950 hover:bg-emerald-200"><CheckCircle2 size={14} /> {approveMutation.isPending ? "Publicando…" : "Aprovar e publicar"}</Button>}</div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => { if (!isSaving) { setSelectedEvent(null); setDraft(null); } }} disabled={isSaving}>Fechar</Button>{selectedEvent?.status === "pending" && <Button type="button" onClick={saveDraft} disabled={isSaving || !draft?.title.trim()}>{updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Edit3 size={14} />} Salvar revisão</Button>}</div></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
