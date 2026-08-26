import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import AdminAlertsPanel from "./AdminAlertsPanel";

let reportState = { isLoading: false, isError: false, data: { alerts: [{ id: 1, integration: "meta", title: "Meta sem mídias", message: "HTTP 200 sem mídias", isResolved: 0, createdAt: new Date("2026-08-15T12:00:00Z") }], criticalAlerts: [{ id: 1 } as never] } };
const refetch = vi.fn();
const mutate = vi.fn();
const mutateAll = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ingestionReports: { summary: { useQuery: () => ({ ...reportState, refetch }) } },
    operationalAlerts: { resolve: { useMutation: () => ({ isPending: false, mutate }) }, resolveAll: { useMutation: () => ({ isPending: false, mutate: mutateAll }) } },
  },
}));

describe("AdminAlertsPanel", () => {
  it("exibe alertas em aberto e permite filtrar por integração", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminAlertsPanel />); });
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain("Alertas de integração");
    expect(rendered).toContain("Meta Graph API");
    expect(rendered).toContain("HTTP 200 sem mídias");
    expect(tree!.root.findAllByType("select")).toHaveLength(2);
  });

  it("arquiva todas as pendências após confirmação e preserva o histórico", async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal("window", { confirm: confirmSpy });
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminAlertsPanel />); });
    const archiveButton = tree!.root.findByProps({ children: "Arquivar pendências" });
    await act(async () => { archiveButton.props.onClick(); });
    expect(confirmSpy).toHaveBeenCalledWith("Arquivar 1 alerta(s) em aberto? O histórico será preservado.");
    expect(mutateAll).toHaveBeenCalledWith();
    vi.unstubAllGlobals();
  });

  it("resolve o alerta pelo id e atualiza os dados", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminAlertsPanel />); });
    const resolveButton = tree!.root.findByProps({ children: "Marcar como resolvido" });
    await act(async () => { resolveButton.props.onClick(); });
    expect(mutate).toHaveBeenCalledWith({ id: 1 });
    reportState = { isLoading: false, isError: false, data: { alerts: [], criticalAlerts: [] } };
  });
});
