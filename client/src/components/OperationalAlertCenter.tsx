import React from "react";
import { trpc } from "@/lib/trpc";

export function resolveOperationalAlertFromUi(args: { id: number; isAdmin: boolean; mutate: (input: { id: number }) => void; dismissLocally: (id: number) => void }) {
  if (args.isAdmin) {
    args.mutate({ id: args.id });
    return;
  }
  args.dismissLocally(args.id);
}

/**
 * O centro visual de alertas foi removido da interface conforme decisão de produto.
 * A consulta e o contrato de resolução permanecem montados para preservar a
 * observabilidade administrativa e a compatibilidade com integrações existentes.
 */
export default function OperationalAlertCenter() {
  trpc.operationalAlerts.list.useQuery({ size: 8 }, { refetchInterval: 30_000, refetchIntervalInBackground: true });
  const utils = trpc.useUtils();
  trpc.operationalAlerts.resolve.useMutation({
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

  return null;
}
