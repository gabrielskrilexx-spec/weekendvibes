import { useMemo, useState } from "react";
import { Download, ExternalLink, Loader2, Radar, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const genres = [
  { value: undefined, label: "Todos" },
  { value: "trap", label: "Trap" },
  { value: "rap", label: "Rap" },
  { value: "funk", label: "Funk" },
  { value: "eletrônica", label: "Eletrônica" },
] as const;
const statuses = [
  { value: "pending", label: "Pendentes" },
  { value: "approved", label: "Aprovados" },
  { value: "rejected", label: "Descartados" },
] as const;

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function GenreDiscoveryPanel() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [genre, setGenre] = useState<"trap" | "rap" | "funk" | "eletrônica" | undefined>();
  const [city, setCity] = useState<string | undefined>();
  const utils = trpc.useUtils();
  const list = trpc.discovery.list.useQuery({ status, genre, city: city as never, limit: 100, offset: 0 });
  const scan = trpc.discovery.scanNow.useMutation({
    onSuccess: result => { toast.success(`Varredura concluída: ${result.inserted} novo(s), ${result.duplicates} duplicado(s).`); void list.refetch(); },
    onError: error => toast.error(`Falha na varredura: ${error.message}`),
  });
  const approve = trpc.discovery.approve.useMutation({
    onSuccess: result => { toast.success(result.created ? "Candidato publicado na vitrine." : "Candidato processado."); void utils.discovery.list.invalidate(); },
    onError: error => toast.error(`Não foi possível aprovar: ${error.message}`),
  });
  const reject = trpc.discovery.reject.useMutation({
    onSuccess: () => { toast.success("Candidato descartado; a URL ficará bloqueada em novas varreduras."); void utils.discovery.list.invalidate(); },
    onError: error => toast.error(`Não foi possível descartar: ${error.message}`),
  });
  const items = list.data?.items ?? [];
  const exportItems = useMemo(() => items, [items]);
  const busy = scan.isPending || approve.isPending || reject.isPending;
  return <section data-testid="genre-discovery-panel" className="mt-6 overflow-hidden rounded-3xl border border-orange-300/20 bg-orange-300/[0.04]">
    <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-3"><Radar className="mt-1 text-orange-300" size={22} /><div><h2 className="font-black text-white">Radar de Descoberta por Estilo</h2><p className="mt-1 text-xs text-zinc-400">Candidatos públicos de Trap, Rap, Funk e Eletrônica para aprovação manual.</p></div></div>
      <button type="button" onClick={() => scan.mutate({})} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-300 px-4 py-2 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-50">{scan.isPending && <Loader2 size={16} className="animate-spin" />}{scan.isPending ? "Varredura em andamento..." : "Rodar varredura de descoberta"}</button>
    </div>
    {scan.data && <details className="border-b border-white/10 p-4" open>
      <summary className="cursor-pointer list-none text-sm font-black text-orange-200">Diagnóstico da última varredura · {scan.data.scannedPages} URL(s), {scan.data.eligible} elegível(is), {scan.data.errors} falha(s)</summary>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-zinc-500"><tr><th className="px-2 py-2">Plataforma</th><th className="px-2 py-2">URLs / eventos</th><th className="px-2 py-2">Cidade</th><th className="px-2 py-2">Gênero</th><th className="px-2 py-2">Duplicados</th><th className="px-2 py-2">Falhas / vazias</th></tr></thead><tbody>{scan.data.platformStats.map(stat => <tr key={stat.platform} className="border-t border-white/5"><td className="px-2 py-2 font-bold text-zinc-200">{stat.platform}</td><td className="px-2 py-2 text-zinc-300">{stat.totalUrls} / {stat.totalEvents}</td><td className="px-2 py-2 text-zinc-300">{stat.discardedByCity}</td><td className="px-2 py-2 text-zinc-300">{stat.discardedByGenre}</td><td className="px-2 py-2 text-zinc-300" title={stat.duplicateItems.map(item => `${item.title} · ${item.url}`).join("\n")}>{stat.duplicates}</td><td className="px-2 py-2 text-zinc-300">{stat.failures} / {stat.emptyPages}</td></tr>)}</tbody></table></div>
    </details>}
    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-4">
      {statuses.map(option => <button key={option.value} type="button" onClick={() => setStatus(option.value)} className={`rounded-full border px-3 py-2 text-xs font-black ${status === option.value ? "border-orange-300 bg-orange-300 text-zinc-950" : "border-white/10 text-zinc-300 hover:bg-white/10"}`}>{option.label}</button>)}
      <select aria-label="Filtrar gênero" value={genre ?? "all"} onChange={event => setGenre(event.target.value === "all" ? undefined : event.target.value as typeof genre)} className="field min-h-10 w-auto py-2 text-xs"><option value="all">Todos os gêneros</option>{genres.slice(1).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <select aria-label="Filtrar cidade" value={city ?? "all"} onChange={event => setCity(event.target.value === "all" ? undefined : event.target.value)} className="field min-h-10 w-auto py-2 text-xs"><option value="all">Santos e Guarujá</option><option>Santos</option><option>Guarujá</option></select>
      <div className="ml-auto flex gap-2"><button type="button" onClick={() => download(`radar-candidatos-${status}.json`, JSON.stringify(exportItems, null, 2), "application/json") } className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300"><Download size={14} /> JSON</button><button type="button" onClick={() => download(`radar-candidatos-${status}.csv`, ["title,eventDate,city,venue,platform,genres,canonicalUrl", ...exportItems.map(item => [item.title, item.eventDate, item.city, item.venueNameRaw ?? "", item.platform, item.matchedGenres.join("|"), item.canonicalUrl].map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n"), "text/csv;charset=utf-8") } className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300"><Download size={14} /> CSV</button></div>
    </div>
    {list.isLoading ? <div className="p-6 text-sm text-zinc-400">Carregando candidatos…</div> : list.isError ? <div className="p-6 text-sm text-red-200">Não foi possível carregar o Radar: {list.error.message}</div> : items.length === 0 ? <div className="p-6 text-sm text-zinc-400">Nenhum candidato nesta combinação de filtros.</div> : <div className="divide-y divide-white/10">{items.map(item => <article key={item.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 gap-3">{item.flyerUrl ? <img src={item.flyerUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-dashed border-white/10 text-[10px] uppercase text-zinc-600">Sem flyer</div>}<div className="min-w-0"><h3 className="break-words font-bold text-white">{item.title}</h3><p className="mt-1 text-xs text-zinc-400">{new Date(item.eventDate).toLocaleString("pt-BR")} · {item.venueNameRaw || "Local não informado"} · {item.city}</p><div className="mt-2 flex flex-wrap gap-1.5">{item.matchedGenres.map(matched => <span key={matched} className="rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 px-2 py-1 text-[10px] font-black uppercase text-fuchsia-100">{matched}</span>)}<span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-zinc-400">{item.platform}</span></div></div></div><div className="flex flex-wrap gap-2"><a href={item.canonicalUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-200"><ExternalLink size={14} /> Abrir URL</a>{status === "pending" && <><button type="button" onClick={() => approve.mutate({ id: item.id, addAsSource: false })} disabled={busy} className="inline-flex min-h-10 items-center rounded-xl bg-emerald-300 px-3 py-2 text-xs font-black text-zinc-950 disabled:opacity-50">Aprovar na vitrine</button><button type="button" onClick={() => reject.mutate({ id: item.id })} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-300/30 px-3 py-2 text-xs font-black text-red-100 disabled:opacity-50"><X size={14} /> Descartar</button></>}</div></article>)}</div>}
  </section>;
}
