import React, { memo } from "react";
import type { ManualReviewStatus } from "./manual-review-shared";

export const PAGE_SIZES = [10, 25, 50] as const;

type Props = {
  status: "" | ManualReviewStatus;
  sourceType: string;
  from: string;
  to: string;
  pageSize: number;
  onStatusChange: (value: "" | ManualReviewStatus) => void;
  onSourceChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
};

export const ManualReviewFilters = memo(function ManualReviewFilters({ status, sourceType, from, to, pageSize, onStatusChange, onSourceChange, onFromChange, onToChange, onPageSizeChange }: Props) {
  return <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="manual-review-filters">
    <label className="grid gap-1 text-xs font-bold text-zinc-400">Status<select value={status} onChange={event => onStatusChange(event.target.value as "" | ManualReviewStatus)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" aria-label="Filtrar fila manual por status"><option value="">Todos</option><option value="pending">Aguardando revisão</option><option value="approved">Publicados</option><option value="rejected">Rejeitados</option></select></label>
    <label className="grid gap-1 text-xs font-bold text-zinc-400">Fonte/tipo<input value={sourceType} onChange={event => onSourceChange(event.target.value)} placeholder="instagram ou public" className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100 placeholder:text-zinc-600" aria-label="Filtrar fila manual por fonte" /></label>
    <label className="grid gap-1 text-xs font-bold text-zinc-400">Data inicial<input type="date" value={from} onChange={event => onFromChange(event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" aria-label="Filtrar fila manual a partir da data" /></label>
    <label className="grid gap-1 text-xs font-bold text-zinc-400">Data final<input type="date" value={to} onChange={event => onToChange(event.target.value)} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" aria-label="Filtrar fila manual até a data" /></label>
    <label className="grid gap-1 text-xs font-bold text-zinc-400">Por página<select value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))} className="min-h-10 rounded-xl border border-white/10 bg-zinc-900 px-3 text-zinc-100" aria-label="Tamanho da página da fila manual">{PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</select></label>
  </div>;
});
