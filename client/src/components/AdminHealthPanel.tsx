import { AlertTriangle, CheckCircle2, Clock3, Timer, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

const state = {
  active: { label: "Operacional", tone: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100", Icon: CheckCircle2 },
  degraded: { label: "Degradação controlada", tone: "border-yellow-300/30 bg-yellow-300/10 text-yellow-100", Icon: AlertTriangle },
  failed: { label: "Falha crítica", tone: "border-red-300/30 bg-red-300/10 text-red-100", Icon: XCircle },
  never: { label: "Sem execução", tone: "border-white/10 bg-white/[0.03] text-zinc-300", Icon: Clock3 },
} as const;

export default function AdminHealthPanel() {
  const report = trpc.ingestionReports.summary.useQuery(undefined, { refetchInterval: 30_000 });
  const latest = report.data?.runs?.[0];
  const status = report.data?.metaStatus?.status ?? "never";
  const copy = state[status];
  const Icon = copy.Icon;
  const counts = latest?.counts ? (() => { try { return JSON.parse(latest.counts) as Record<string, number>; } catch { return {}; } })() : {};
  return <section aria-labelledby="health-heading" className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7" data-testid="admin-health-panel">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Status page interna</p><h2 id="health-heading" className="mt-1 text-xl font-black">Saúde da ingestão</h2><p className="mt-1 text-sm text-zinc-400">Última execução oficial persistida, atualizada automaticamente.</p></div><div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black ${copy.tone}`} aria-live="polite"><Icon size={15} />{copy.label}</div></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><Timer size={16} className="text-cyan-200" /><p className="mt-2 text-xs text-zinc-500">Duração</p><p className="text-xl font-black">{latest?.durationMs ?? 0} ms</p></div><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs text-zinc-500">HTTP</p><p className="mt-2 text-xl font-black">{latest?.httpStatus ?? "—"}</p></div><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs text-zinc-500">Mídias lidas</p><p className="mt-2 text-xl font-black">{counts.read ?? 0}</p></div><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs text-zinc-500">Persistidos</p><p className="mt-2 text-xl font-black text-emerald-200">{counts.persisted ?? latest?.importedCount ?? 0}</p></div></div>
    <p className="mt-4 text-xs text-zinc-500">Última tentativa: {latest?.startedAt ? new Date(latest.startedAt).toLocaleString("pt-BR") : "nenhuma registrada"} · Último sucesso: {report.data?.metaStatus?.lastSuccessfulSync ? new Date(report.data.metaStatus.lastSuccessfulSync).toLocaleString("pt-BR") : "nenhum"}</p>
  </section>;
}
