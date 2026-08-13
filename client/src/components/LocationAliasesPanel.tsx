import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type City = "Santos" | "Guarujá";
type AliasForm = { alias: string; canonicalName: string; city: City; isActive: boolean };
const emptyForm: AliasForm = { alias: "", canonicalName: "", city: "Santos", isActive: true };

export default function LocationAliasesPanel() {
  const utils = trpc.useUtils();
  const aliases = trpc.locationAliases.list.useQuery();
  const [form, setForm] = useState<AliasForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const create = trpc.locationAliases.create.useMutation({ onSuccess: () => { setForm(emptyForm); setNotice("Alias adicionado."); utils.locationAliases.list.invalidate(); }, onError: e => setNotice(e.message) });
  const update = trpc.locationAliases.update.useMutation({ onSuccess: () => { setForm(emptyForm); setEditingId(null); setNotice("Alias atualizado."); utils.locationAliases.list.invalidate(); }, onError: e => setNotice(e.message) });
  const remove = trpc.locationAliases.remove.useMutation({ onSuccess: () => { setNotice("Alias removido."); utils.locationAliases.list.invalidate(); }, onError: e => setNotice(e.message) });
  const pending = create.isPending || update.isPending || remove.isPending;
  const save = () => { if (!form.alias.trim() || !form.canonicalName.trim()) { setNotice("Informe o alias e o nome oficial do local."); return; } editingId ? update.mutate({ id: editingId, ...form }) : create.mutate(form); };
  return <section className="mt-6 rounded-3xl border border-orange-300/20 bg-orange-300/[0.04] p-5 sm:p-7" aria-labelledby="location-aliases-title">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Normalização da ingestão</p><h2 id="location-aliases-title" className="mt-1 text-xl font-black">Aliases de locais</h2><p className="mt-1 max-w-2xl text-sm text-zinc-400">Cadastre variações usadas em posts para associá-las ao nome oficial e manter o filtro regional consistente.</p></div>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"><X size={16} /> Cancelar</button>}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_140px_auto]"><input aria-label="Alias do local" value={form.alias} onChange={e => setForm({ ...form, alias: e.target.value })} placeholder="Ex.: Flamingo Music Bar" className="field" /><input aria-label="Nome oficial do local" value={form.canonicalName} onChange={e => setForm({ ...form, canonicalName: e.target.value })} placeholder="Nome oficial" className="field" /><select aria-label="Cidade do local" value={form.city} onChange={e => setForm({ ...form, city: e.target.value as City })} className="field"><option>Santos</option><option>Guarujá</option></select><button type="button" onClick={save} disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-300 px-4 py-3 text-sm font-black text-zinc-950 disabled:opacity-40">{pending ? <Loader2 size={16} className="animate-spin" /> : editingId ? <Pencil size={16} /> : <Plus size={16} />}{editingId ? "Salvar" : "Adicionar"}</button></div>
    {notice && <p role="status" className="mt-3 text-sm text-orange-100">{notice}</p>}
    <div className="mt-5 overflow-hidden rounded-2xl border border-white/10"><div className="grid grid-cols-[1fr_1fr_90px_120px] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-wide text-zinc-500"><span>Alias</span><span>Local oficial</span><span>Cidade</span><span>Ações</span></div>{aliases.isLoading ? <p className="p-4 text-sm text-zinc-400">Carregando aliases...</p> : aliases.data?.length ? aliases.data.map(item => <div key={item.id} className="grid grid-cols-[1fr_1fr_90px_120px] items-center gap-3 border-b border-white/10 px-4 py-3 text-sm last:border-0"><span className="truncate text-white">{item.alias}</span><span className="truncate text-zinc-300">{item.canonicalName}</span><span className="text-zinc-400">{item.city}</span><span className="flex gap-2"><button type="button" aria-label={`Editar ${item.alias}`} onClick={() => { setEditingId(item.id); setForm({ alias: item.alias, canonicalName: item.canonicalName, city: item.city as City, isActive: item.isActive === 1 }); }} className="rounded-lg border border-white/10 p-2 text-zinc-300 hover:text-white"><Pencil size={14} /></button><button type="button" aria-label={`Remover ${item.alias}`} onClick={() => remove.mutate({ id: item.id })} className="rounded-lg border border-red-400/20 p-2 text-red-200 hover:bg-red-400/10"><Trash2 size={14} /></button></span></div>) : <p className="p-4 text-sm text-zinc-400">Nenhum alias cadastrado.</p>}</div>
  </section>;
}
