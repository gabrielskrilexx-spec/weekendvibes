import React, { useState } from "react";
import { CheckCircle2, GitCompareArrows, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const formatDate = (value: Date | string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const formatPrice = (value: number) => value > 0 ? `R$ ${(value / 100).toFixed(2).replace(".", ",")}` : "Sem preço";

type CollisionRow = { left: { id: number }; right: { id: number } };
export function removeCollisionByDeletedId<T extends CollisionRow>(rows: T[], deletedId: string | number) {
  const id = Number(deletedId);
  return Number.isSafeInteger(id) ? rows.filter(row => row.left.id !== id && row.right.id !== id) : rows;
}

export function getDeleteCollisionErrorMessage(error: unknown) {
  const raw = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  if (/unable to transform|transform response|serializ/i.test(raw)) return "O servidor atualizou o evento, mas não conseguiu serializar a confirmação. Atualize a lista e tente novamente se a colisão continuar visível.";
  if (/foreign|constraint|referenc|depend/i.test(raw)) return "O evento possui dependências que não puderam ser removidas com segurança. Nenhum registro foi excluído.";
  if (/unauthorized|forbidden|permission/i.test(raw)) return "Sua sessão não tem permissão administrativa para excluir este registro.";
  if (/unavailable|timeout|network|fetch/i.test(raw)) return "O serviço está temporariamente indisponível. Verifique a conexão e tente novamente.";
  return raw && raw.length <= 220 ? raw : "Não foi possível excluir a duplicata. Tente novamente.";
}

export default function CollisionReviewPanel() {
  const collisions = trpc.collisionReview.list.useQuery({ limit: 100 });
  const utils = trpc.useUtils();
  const [pending, setPending] = useState<{ id: number; title: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [selectedCollisionKeys, setSelectedCollisionKeys] = useState<string[]>([]);
  const collisionRows = collisions.data ?? [];
  const selectedDuplicateIds = collisionRows.filter(collision => selectedCollisionKeys.includes(collision.key)).map(collision => collision.recommendedKeepId === collision.left.id ? collision.right.id : collision.left.id);
  const allCollisionsSelected = collisionRows.length > 0 && collisionRows.every(collision => selectedCollisionKeys.includes(collision.key));
  const toggleCollisionSelection = (key: string) => setSelectedCollisionKeys(current => current.includes(key) ? current.filter(selectedKey => selectedKey !== key) : [...current, key]);
  const toggleAllCollisions = () => setSelectedCollisionKeys(allCollisionsSelected ? [] : collisionRows.map(collision => collision.key));
  const remove = trpc.events.remove.useMutation({
    onSuccess: result => {
      setPending(null);
      if (result.success) {
        const deletedId = String(result.deletedId);
        const deletedIdNumber = Number(deletedId);
        utils.collisionReview.list.setData({ limit: 100 }, current => current ? removeCollisionByDeletedId(current, deletedIdNumber) : current);
        setSelectedCollisionKeys(current => current.filter(key => {
          const collision = collisionRows.find(row => row.key === key);
          return !collision || (collision.left.id !== deletedIdNumber && collision.right.id !== deletedIdNumber);
        }));
        setNotice(`Registro ${deletedId} removido. Revise as colisões restantes.`);
      } else {
        setNotice("O registro já não estava disponível.");
      }
      void collisions.refetch();
      void utils.events.list.invalidate();
    },
    onError: error => { setPending(null); setNotice(`Não foi possível remover: ${getDeleteCollisionErrorMessage(error)}`); },
  });
  const resolveMany = trpc.collisionReview.resolveMany.useMutation({
    onSuccess: result => { setSelectedCollisionKeys([]); setNotice(`${result.count} duplicata(s) resolvida(s) com sucesso.`); void collisions.refetch(); void utils.events.list.invalidate(); },
    onError: error => setNotice(`Não foi possível resolver as colisões: ${getDeleteCollisionErrorMessage(error)}`),
  });
  const isBulkPending = resolveMany.isPending || remove.isPending;
  const resolveSelected = (action: "aprovar" | "excluir") => { if (selectedDuplicateIds.length === 0) return; const message = action === "aprovar" ? `Aprovar ${selectedCollisionKeys.length} colisão(ões) e remover apenas as duplicatas sugeridas?` : `Excluir ${selectedDuplicateIds.length} duplicata(s) selecionada(s)?`; if (window.confirm(message)) resolveMany.mutate({ ids: selectedDuplicateIds }); };

  return <section className="mt-8 rounded-3xl border border-orange-300/20 bg-orange-300/[0.04] p-4 sm:p-7" aria-labelledby="collision-review-title">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex items-center gap-2 text-orange-200"><GitCompareArrows size={18} /><p className="text-xs font-black uppercase tracking-[0.18em]">Qualidade de dados</p></div><h2 id="collision-review-title" className="mt-2 text-xl font-black text-white">Revisar possíveis colisões</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">Compare eventos do mesmo dia civil e local antes de excluir qualquer registro. O sistema sugere o registro mais completo, mas a decisão continua manual.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void collisions.refetch()} disabled={collisions.isFetching || isBulkPending} aria-busy={collisions.isFetching} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-black text-zinc-200 transition hover:border-orange-300/40 hover:bg-orange-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 disabled:cursor-wait disabled:opacity-50"><RefreshCw size={14} className={collisions.isFetching ? "animate-spin" : ""} /> {collisions.isFetching ? "Atualizando..." : "Atualizar"}</button>{selectedCollisionKeys.length > 0 && <><button type="button" onClick={() => resolveSelected("aprovar")} disabled={resolveMany.isPending} aria-busy={resolveMany.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-2 text-xs font-black text-zinc-950 disabled:cursor-wait disabled:opacity-50">{resolveMany.isPending && <Loader2 size={14} className="animate-spin" />} {resolveMany.isPending ? "Processando..." : "Aprovar selecionadas"}</button><button type="button" onClick={() => resolveSelected("excluir")} disabled={resolveMany.isPending} aria-busy={resolveMany.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300/30 px-4 py-2 text-xs font-black text-red-100 disabled:cursor-wait disabled:opacity-50">{resolveMany.isPending ? "Excluindo..." : "Excluir duplicatas selecionadas"}</button></>}</div>
    </div>
    {notice && <p role="status" aria-live="polite" className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}
    {collisions.isLoading && <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-400" role="status">Analisando eventos publicados…</div>}
    {collisions.isError && <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 p-5 text-sm text-red-100" role="alert">Não foi possível carregar as colisões. Tente atualizar novamente.</div>}
    {!collisions.isLoading && !collisions.isError && collisionRows.length === 0 && <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-5 text-sm text-emerald-100">Nenhuma colisão potencial encontrada.</div>}
    {collisionRows.length > 0 && <><div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"><label className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-zinc-300"><input type="checkbox" checked={allCollisionsSelected} onChange={toggleAllCollisions} disabled={isBulkPending} aria-label="Selecionar todas as colisões" className="h-5 w-5 accent-orange-400" /> <span>Selecionar todas</span></label><span className="text-xs text-zinc-500">{selectedCollisionKeys.length} selecionada(s) · aprovar remove a duplicata sugerida</span></div><div className="mt-4 space-y-4">{collisionRows.map(collision => { const duplicateId = collision.recommendedKeepId === collision.left.id ? collision.right.id : collision.left.id; return <article key={collision.key} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3 text-xs font-bold text-zinc-400"><label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" checked={selectedCollisionKeys.includes(collision.key)} onChange={() => toggleCollisionSelection(collision.key)} disabled={isBulkPending} aria-label={`Selecionar colisão ${collision.venue}`} className="h-5 w-5 accent-orange-400" /><span>{collision.civilDate} · {collision.venue} · {collision.left.city}</span></label><span className="rounded-full border border-yellow-300/20 bg-yellow-300/10 px-2.5 py-1 text-yellow-100">Similaridade {Math.round(collision.similarity * 100)}%</span></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{[collision.left, collision.right].map(event => <div key={event.id} className={`rounded-xl border p-4 ${event.id === collision.recommendedKeepId ? "border-emerald-300/30 bg-emerald-300/[0.06]" : "border-white/10 bg-white/[0.03]"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">ID {event.id}</p><h3 className="mt-1 break-words font-black text-white">{event.title}</h3></div>{event.id === collision.recommendedKeepId && <span className="shrink-0 rounded-full border border-emerald-300/25 px-2 py-1 text-[10px] font-black uppercase text-emerald-100">Sugerido</span>}</div><p className="mt-3 text-xs text-zinc-400">{formatDate(event.eventDate)} · {event.locationName}</p><p className="mt-1 text-xs text-zinc-400">{formatPrice(event.priceCents)} · {event.imageUrl ? "Com imagem" : "Sem imagem"} · {event.latitude && event.longitude ? "Com coordenadas" : "Sem coordenadas"}</p></div>)}</div><div className="mt-4 flex flex-col items-stretch justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center"><p className="text-xs text-zinc-500">A ação remove somente o registro não recomendado após confirmação.</p><button type="button" onClick={() => setPending({ id: duplicateId, title: `ID ${duplicateId} em ${collision.venue}` })} disabled={remove.isPending || resolveMany.isPending} aria-busy={remove.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300/20 bg-red-300/10 px-4 text-xs font-black text-red-100 transition hover:border-red-200/50 hover:bg-red-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:opacity-50"><Trash2 size={14} /> {remove.isPending ? "Removendo…" : "Excluir duplicata sugerida"}</button></div></article>; })}</div></>}
    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open && !remove.isPending) setPending(null); }}><AlertDialogContent className="border-white/10 bg-zinc-900 text-zinc-100"><AlertDialogHeader><AlertDialogTitle>Excluir colisão?</AlertDialogTitle><AlertDialogDescription className="text-zinc-400">Confirme a remoção de <strong className="text-zinc-100">{pending?.title}</strong>. O registro sugerido como mais completo será preservado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={remove.isPending} onClick={event => { event.preventDefault(); if (pending) remove.mutate({ id: pending.id }); }}>{remove.isPending ? <><Loader2 size={14} className="mr-2 animate-spin" /> Removendo...</> : "Confirmar exclusão"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
