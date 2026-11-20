import { BellRing, CheckCircle2, Loader2, Send, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function AdminPushPanel() {
  const utils = trpc.useUtils();
  const diagnostics = trpc.push.diagnostics.useQuery(undefined, { refetchInterval: 30_000 });
  const sendTest = trpc.push.sendTest.useMutation({
    onSuccess: result => { setMessage(`Teste concluído: ${result.sent} enviada(s), ${result.failed} falha(s), ${result.expired} expirada(s).`); void utils.push.diagnostics.invalidate(); },
    onError: error => setMessage(error.message),
  });
  const [message, setMessage] = useState("");
  const data = diagnostics.data;
  return <section className="mt-6 rounded-3xl border border-orange-300/20 bg-orange-300/[.05] p-5 sm:p-6" aria-labelledby="push-admin-title" data-testid="admin-push-panel">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><span className="rounded-xl bg-orange-300/15 p-2 text-orange-200"><BellRing size={19} /></span><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-200">Entrega operacional</p><h2 id="push-admin-title" className="mt-1 text-xl font-black">Notificações Web Push</h2><p className="mt-1 text-sm text-zinc-400">Inscrições, configuração VAPID e última tentativa de entrega.</p></div></div><button type="button" onClick={() => sendTest.mutate()} disabled={sendTest.isPending || !data?.vapidConfigured || data.activeDevices === 0} aria-busy={sendTest.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-300 px-4 py-2 text-xs font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45"><Send size={15} />{sendTest.isPending ? "Enviando…" : "Enviar notificação de teste"}</button></div>
    {diagnostics.isLoading ? <p className="mt-4 text-sm text-zinc-400" role="status">Carregando diagnóstico…</p> : diagnostics.isError ? <p className="mt-4 rounded-xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100" role="alert">Não foi possível carregar o diagnóstico de push.</p> : <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs text-zinc-500">Chaves VAPID</p><p className="mt-2 flex items-center gap-2 font-black">{data?.vapidConfigured ? <CheckCircle2 size={16} className="text-emerald-300" /> : <TriangleAlert size={16} className="text-amber-300" />}{data?.vapidConfigured ? "Configuradas" : "Ausentes"}</p></div><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs text-zinc-500">Dispositivos ativos</p><p className="mt-2 text-2xl font-black">{data?.activeDevices ?? 0}</p></div><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs text-zinc-500">Último disparo</p><p className="mt-2 text-sm font-bold">{data?.lastDispatch ? `${new Date(data.lastDispatch.createdAt).toLocaleString("pt-BR")} · ${data.lastDispatch.sent} enviada(s)` : "Nenhum disparo registrado"}</p></div></div>}
    {message && <p className="mt-4 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-zinc-200" role="status" aria-live="polite">{message}</p>}
  </section>;
}
