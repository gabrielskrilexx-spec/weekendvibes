import React, { useMemo, useState } from "react";
import { AlertTriangle, Bell, Check, ChevronDown, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

const integrationLabels: Record<string, string> = {
  meta: "Meta Graph API",
  public: "Coleta pública",
  ocr: "OCR",
  openai: "OpenAI",
  pipeline: "Pipeline",
};

export function resolveOperationalAlertFromUi(args: { id: number; isAdmin: boolean; mutate: (input: { id: number }) => void; dismissLocally: (id: number) => void }) {
  if (args.isAdmin) {
    args.mutate({ id: args.id });
    return;
  }
  args.dismissLocally(args.id);
}

export default function OperationalAlertCenter() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const alertsQuery = trpc.operationalAlerts.list.useQuery({ size: 8 }, { refetchInterval: 30_000, refetchIntervalInBackground: true });
  const authQuery = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const resolveMutation = trpc.operationalAlerts.resolve.useMutation({
    onMutate: async ({ id }) => {
      await utils.operationalAlerts.list.cancel({ size: 8 });
      const previous = utils.operationalAlerts.list.getData({ size: 8 });
      utils.operationalAlerts.list.setData({ size: 8 }, current => current?.filter(alert => alert.id !== id) ?? []);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) utils.operationalAlerts.list.setData({ size: 8 }, context.previous);
    },
    onSettled: () => utils.operationalAlerts.list.invalidate({ size: 8 }),
  });
  const visibleAlerts = useMemo(() => (alertsQuery.data ?? []).filter(alert => !dismissed.includes(alert.id)), [alertsQuery.data, dismissed]);
  const isAdmin = authQuery.data?.role === "admin";

  if (alertsQuery.isLoading) return <div className="fixed right-4 top-20 z-40 rounded-full border border-white/10 bg-zinc-950/90 px-4 py-2 text-xs font-bold text-zinc-400 shadow-xl" role="status">Verificando integrações...</div>;
  if (alertsQuery.isError) return <div className="fixed right-4 top-20 z-40 rounded-full border border-orange-300/30 bg-orange-300/10 px-4 py-2 text-xs font-bold text-orange-100 shadow-xl" role="status">Não foi possível verificar as integrações.</div>;
  if (visibleAlerts.length === 0) return null;

  const dismissAlert = (id: number) => resolveOperationalAlertFromUi({
    id,
    isAdmin,
    mutate: input => resolveMutation.mutate(input),
    dismissLocally: alertId => setDismissed(current => [...current, alertId]),
  });

  return (
    <div className="fixed right-4 top-20 z-40 w-[min(22rem,calc(100vw-2rem))]" aria-live="assertive">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls="operational-alert-list"
        title={isAdmin ? "Alertas administrativos: marque como lido para resolver" : "Alertas operacionais"}
        className="ml-auto flex items-center gap-2 rounded-full border border-orange-300/40 bg-orange-300 px-4 py-2 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-xl shadow-orange-950/30 transition hover:bg-yellow-200 active:scale-[.98]"
      >
        <span className="relative"><Bell size={15} />{visibleAlerts.length > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-600 px-1 text-[10px] text-white">{visibleAlerts.length}</span>}</span>
        Alertas de integração
        <ChevronDown size={15} className={open ? "rotate-180 transition" : "transition"} />
      </button>

      {open && (
        <div id="operational-alert-list" className="mt-2 overflow-hidden rounded-2xl border border-orange-300/30 bg-zinc-950/95 p-3 shadow-2xl shadow-fuchsia-950/40 backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-200">Atenção operacional</p>
            <span className="text-[11px] text-zinc-500">Atualiza automaticamente</span>
          </div>
          <div className="space-y-2">
            {visibleAlerts.map(alert => (
              <article key={alert.id} className="rounded-xl border border-orange-300/20 bg-orange-300/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0 text-orange-300" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white">{alert.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-orange-50/80">{alert.message}</p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Integração: {integrationLabels[alert.integration] ?? alert.integration}</p>
                  </div>
                  <button type="button" onClick={() => dismissAlert(alert.id)} disabled={resolveMutation.isPending} aria-label={`${isAdmin ? "Marcar como lido" : "Dispensar"}: ${alert.title}`} className="rounded-md p-1 text-zinc-500 transition hover:bg-white/10 hover:text-white disabled:opacity-50">
                    <X size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-[11px] text-zinc-500"><Check size={14} className="text-yellow-200" /> {isAdmin ? "Marque como lido para resolver este alerta." : "O alerta permanece registrado para investigação."}</div>
        </div>
      )}
    </div>
  );
}
