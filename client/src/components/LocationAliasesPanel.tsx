import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { trpc } from "@/lib/trpc";
import { postAdminJson } from "@/lib/admin-rest";
import { friendlyAdminErrorMessage } from "@/lib/adminFeedback";

type City = "Santos" | "Guarujá";
type AliasForm = { alias: string; canonicalName: string; city: City; isActive: boolean };
const emptyForm: AliasForm = { alias: "", canonicalName: "", city: "Santos", isActive: true };

export default function LocationAliasesPanel() {
  const utils = trpc.useUtils();
  const aliases = trpc.locationAliases.list.useQuery();
  const [form, setForm] = useState<AliasForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const create = trpc.locationAliases.create.useMutation({ onSuccess: async () => { setForm(emptyForm); setNotice("Alias adicionado."); sonnerToast.success("Alias adicionado", { description: "A normalização foi salva." }); await utils.locationAliases.list.invalidate(); }, onError: e => { setNotice(e.message); sonnerToast.error("Não foi possível adicionar o alias", { description: e.message }); } });
  const update = trpc.locationAliases.update.useMutation({ onSuccess: async () => { setForm(emptyForm); setEditingId(null); setNotice("Alias atualizado."); sonnerToast.success("Alias atualizado", { description: "A normalização foi salva." }); await utils.locationAliases.list.invalidate(); }, onError: e => { setNotice(e.message); sonnerToast.error("Não foi possível atualizar o alias", { description: e.message }); } });
  const removeAlias = async (id: number) => {
    if (isRemoving) return;
    setRemovingId(id);
    setIsRemoving(true);
    try {
      await postAdminJson("/api/v2/admin/remove-alias", { id });
      setNotice("Alias removido.");
      sonnerToast.success("Alias removido", { description: "A lista foi atualizada." });
      await utils.locationAliases.list.invalidate();
    } catch (error) {
      const message = friendlyAdminErrorMessage(error, "Tente novamente.");
      setNotice(message);
      sonnerToast.error("Não foi possível remover o alias", { description: message });
    } finally {
      setRemovingId(null);
      setIsRemoving(false);
    }
  };
  const pending = create.isPending || update.isPending || isRemoving;
  const save = () => { if (!form.alias.trim() || !form.canonicalName.trim()) { setNotice("Informe o alias e o nome oficial do local."); return; } editingId ? update.mutate({ id: editingId, ...form }) : create.mutate(form); };
  return <section className="mt-6 rounded-3xl border border-orange-300/20 bg-orange-300/[0.04] p-5 sm:p-7" aria-labelledby="location-aliases-title">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Normalização da ingestão</p><h2 id="location-aliases-title" className="mt-1 text-xl font-black">Aliases de locais</h2><p className="mt-1 max-w-2xl text-sm text-zinc-400">Cadastre variações usadas em posts para associá-las ao nome oficial e manter o filtro regional consistente.</p></div>{editingId && <button type="button" disabled={pending} onClick={() => { setEditingId(null); setForm(emptyForm); }} className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white disabled:opacity-50"><X size={16} /> Cancelar</button>}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_140px_auto]"><input aria-label="Alias do local" value={form.alias} disabled={pending} onChange={e => setForm({ ...form, alias: e.target.value })} placeholder="Ex.: Flamingo Music Bar" className="field disabled:opacity-50" /><input aria-label="Nome oficial do local" value={form.canonicalName} disabled={pending} onChange={e => setForm({ ...form, canonicalName: e.target.value })} placeholder="Nome oficial" className="field disabled:opacity-50" /><select aria-label="Cidade do local" value={form.city} disabled={pending} onChange={e => setForm({ ...form, city: e.target.value as City })} className="field disabled:opacity-50"><option>Santos</option><option>Guarujá</option></select><button type="button" onClick={save} disabled={pending} aria-busy={create.isPending || update.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-300 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-wait disabled:opacity-40">{pending ? <Loader2 size={16} className="animate-spin" /> : editingId ? <Pencil size={16} /> : <Plus size={16} />}{create.isPending || update.isPending ? "Salvando..." : editingId ? "Salvar" : "Adicionar"}</button></div>
    {notice && <p role="status" aria-live="polite" className="mt-3 text-sm text-orange-100">{notice}</p>}
    <div className="mt-5 overflow-hidden rounded-2xl border border-white/10"><div className="hidden grid-cols-[1fr_1fr_90px_120px] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-wide text-zinc-500 sm:grid"><span>Alias</span><span>Local oficial</span><span>Cidade</span><span>Ações</span></div>{aliases.isLoading ? <p className="p-4 text-sm text-zinc-400">Carregando aliases...</p> : aliases.data?.length ? aliases.data.map(item => { const rowPending = isRemoving && removingId === item.id; return <div key={item.id} className="grid grid-cols-1 items-start gap-3 border-b border-white/10 px-4 py-4 text-sm last:border-0 sm:grid-cols-[1fr_1fr_90px_120px] sm:items-center sm:py-3"><div className="min-w-0"><span className="block text-[10px] font-black uppercase tracking-wide text-zinc-500 sm:hidden">Alias</span><span className="break-words text-white">{item.alias}</span></div><div className="min-w-0"><span className="block text-[10px] font-black uppercase tracking-wide text-zinc-500 sm:hidden">Local oficial</span><span className="break-words text-zinc-300">{item.canonicalName}</span></div><div><span className="block text-[10px] font-black uppercase tracking-wide text-zinc-500 sm:hidden">Cidade</span><span className="text-zinc-400">{item.city}</span></div><span className="flex gap-2"><button type="button" disabled={pending} aria-label={`Editar ${item.alias}`} onClick={() => { setEditingId(item.id); setForm({ alias: item.alias, canonicalName: item.canonicalName, city: item.city as City, isActive: item.isActive === 1 }); }} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/10 p-2 text-zinc-300 hover:text-white disabled:opacity-50"><Pencil size={14} /></button><button type="button" aria-label={`Remover ${item.alias}`} disabled={pending} aria-busy={rowPending} onClick={() => { if (globalThis.confirm(`Remover o alias ${item.alias}?`)) { void removeAlias(item.id); } }} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-red-400/20 px-3 py-2 text-red-200 hover:bg-red-400/10 disabled:cursor-wait disabled:opacity-50">{rowPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}{rowPending && "Removendo..."}</button></span></div>; }) : <p className="p-4 text-sm text-zinc-400">Nenhum alias cadastrado.</p>}</div>
  </section>;
}
