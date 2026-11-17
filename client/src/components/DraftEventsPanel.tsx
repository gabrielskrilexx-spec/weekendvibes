import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { trpc } from "@/lib/trpc";
import { friendlyAdminErrorMessage } from "@/lib/adminFeedback";
import { Button } from "@/components/ui/button";

type DraftSourceType = "all" | "instagram";

function sourceLabel(sourceType: string | null) {
  if (sourceType?.toLowerCase().startsWith("instagram")) return "Instagram";
  return sourceType || "Outra fonte";
}

function formatDraftDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function DraftEventsPanel() {
  const [sourceType, setSourceType] = useState<DraftSourceType>("instagram");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const listInput = useMemo(() => ({ sourceType, limit: 50 }), [sourceType]);
  const draftsQuery = trpc.events.drafts.useQuery(listInput, { refetchInterval: 30_000 });
  const publishMutation = trpc.events.publishMany.useMutation({
    onSuccess: result => {
      setSelectedIds(current => current.filter(id => !result.ids.includes(String(id))));
      sonnerToast.success("Rascunhos publicados", { description: `${result.count} evento(s) agora estão disponíveis na agenda pública.` });
      void draftsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível publicar", { description: friendlyAdminErrorMessage(error, "Tente novamente em instantes.") }),
  });
  const removeMutation = trpc.events.removeMany.useMutation({
    onSuccess: result => {
      setSelectedIds(current => current.filter(id => !result.ids.includes(String(id))));
      sonnerToast.success("Rascunhos removidos", { description: `${result.count} evento(s) foram excluídos.` });
      void draftsQuery.refetch();
    },
    onError: error => sonnerToast.error("Não foi possível remover", { description: friendlyAdminErrorMessage(error, "Tente novamente em instantes.") }),
  });

  const drafts = draftsQuery.data?.items ?? [];
  const busy = publishMutation.isPending || removeMutation.isPending;
  const visibleIds = drafts.map(event => event.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds(current => current.filter(id => visibleIds.includes(id)));
  }, [visibleIds.join(",")]);

  const toggleAll = () => setSelectedIds(allSelected ? [] : visibleIds);
  const toggleOne = (id: number) => setSelectedIds(current => current.includes(id) ? current.filter(selectedId => selectedId !== id) : [...current, id]);
  const publishIds = (ids: number[]) => {
    if (!busy && ids.length > 0) publishMutation.mutate({ ids: Array.from(new Set(ids)) });
  };
  const removeIds = (ids: number[]) => {
    if (!busy && ids.length > 0 && window.confirm(`Excluir ${ids.length} rascunho(s)? Esta ação não pode ser desfeita.`)) {
      removeMutation.mutate({ ids: Array.from(new Set(ids)) });
    }
  };

  return (
    <section className="mt-8 rounded-3xl border border-orange-300/20 bg-orange-300/[0.04] p-5 sm:p-7" data-testid="draft-events-panel" aria-labelledby="draft-events-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-200">Moderação rápida</p>
          <h2 id="draft-events-title" className="mt-2 text-2xl font-black text-zinc-100">Rascunhos pendentes</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">Eventos preservados pela ingestão, mas ainda fora da vitrine pública até uma revisão administrativa.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void draftsQuery.refetch()} disabled={draftsQuery.isFetching || busy} aria-label="Atualizar rascunhos pendentes">
          <RefreshCw size={14} className={draftsQuery.isFetching ? "animate-spin" : ""} /> Atualizar
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/15 p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-300">
          <span className="text-xs font-bold text-zinc-500">Origem</span>
          <select value={sourceType} onChange={event => setSourceType(event.target.value as DraftSourceType)} disabled={busy} className="min-h-11 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100">
            <option value="instagram">Instagram</option>
            <option value="all">Todas as fontes</option>
          </select>
        </label>
        <div className="text-xs text-zinc-500" role="status" aria-live="polite">
          {draftsQuery.isFetching ? "Atualizando…" : `${draftsQuery.data?.total ?? 0} rascunho(s) encontrado(s)`}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/[0.05] p-3 sm:flex-row sm:items-center sm:justify-between" data-testid="draft-events-bulk-actions">
          <span className="text-sm font-black text-fuchsia-100">{selectedIds.length} selecionado(s)</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" data-testid="draft-events-publish-many" onClick={() => publishIds(selectedIds)} disabled={busy} aria-busy={publishMutation.isPending}>
              {publishMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {publishMutation.isPending ? "Publicando…" : "Publicar selecionados"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => removeIds(selectedIds)} disabled={busy} aria-busy={removeMutation.isPending} className="text-red-100">
              {removeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} {removeMutation.isPending ? "Removendo…" : "Excluir selecionados"}
            </Button>
          </div>
        </div>
      )}

      {draftsQuery.isError ? (
        <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100" role="alert">Não foi possível carregar os rascunhos. <Button type="button" variant="outline" size="sm" className="ml-2" onClick={() => void draftsQuery.refetch()}>Tentar novamente</Button></div>
      ) : drafts.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">Nenhum rascunho pendente para este filtro.</div>
      ) : (
        <div className="mt-4 space-y-3" data-testid="draft-events-list">
          <label className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-zinc-300">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={busy} aria-label="Selecionar todos os rascunhos visíveis" className="h-5 w-5 accent-orange-400" /> Selecionar todos os rascunhos visíveis
          </label>
          {drafts.map(event => (
            <article key={event.id} className="grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/40 p-3 sm:grid-cols-[64px_1fr_auto] sm:items-center">
              {event.imageUrl ? <img src={event.imageUrl} alt={`Imagem de ${event.title}`} loading="lazy" className="h-16 w-16 rounded-xl border border-white/10 object-cover" /> : <div aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-white/10 text-center text-[10px] font-black uppercase text-zinc-600">Sem arte</div>}
              <div className="min-w-0">
                <div className="flex flex-wrap items-start gap-2">
                  <input type="checkbox" checked={selectedIds.includes(event.id)} onChange={() => toggleOne(event.id)} disabled={busy} aria-label={`Selecionar rascunho ${event.title}`} className="mt-1 h-5 w-5 shrink-0 accent-orange-400" />
                  <div className="min-w-0"><h3 className="break-words font-black text-zinc-100">{event.title}</h3><p className="mt-1 text-xs text-zinc-400">{event.city} · {event.locationName} · {formatDraftDate(event.eventDate)}</p><p className="mt-1 text-xs text-orange-200">Rascunho · {sourceLabel(event.sourceType)}</p></div>
                </div>
                {event.address && <p className="mt-2 text-xs text-zinc-500">{event.address}</p>}
                {event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block max-w-full truncate text-xs text-cyan-200 underline">Abrir origem</a>}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button type="button" size="sm" onClick={() => publishIds([event.id])} disabled={busy} aria-label={`Publicar rascunho ${event.title}`}><CheckCircle2 size={14} /> Publicar</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => removeIds([event.id])} disabled={busy} aria-label={`Excluir rascunho ${event.title}`} className="text-red-100"><Trash2 size={14} /> Excluir</Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
