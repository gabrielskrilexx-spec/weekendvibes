import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import AdminCircuitBreakerPanel from "./AdminCircuitBreakerPanel";

const refetch = vi.fn();
const reset = vi.fn();
const reactivate = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    circuitBreaker: {
      statuses: { useQuery: () => ({ data: [
        { sourceKey: "instagram:ativahouse", name: "Ativa House", kind: "instagram", circuitState: "open", circuitFailureCount: 3, circuitOpenedAt: new Date("2026-08-22T12:00:00Z"), circuitNextAttemptAt: new Date("2026-08-23T06:00:00Z"), circuitLastError: "HTTP 403: perfil pausado", lastHttpStatus: 403, lastFailureReason: "403 - Proibido", lastStatus: "failed", lastMessage: "HTTP 403" },
        { sourceKey: "public:ingresse", name: "Ingresse", kind: "public", circuitState: "half_open", circuitFailureCount: 3, circuitOpenedAt: new Date("2026-08-22T12:00:00Z"), circuitNextAttemptAt: new Date("2026-08-23T06:00:00Z"), circuitLastError: null, lastHttpStatus: 502, lastFailureReason: "502 - Erro do provedor", lastStatus: "failed", lastMessage: "HTTP 502" },
      ], isLoading: false, isError: false, isFetching: false, refetch }) },
      resetActive: { useMutation: () => ({ isPending: false, mutate: reset }) },
      reactivateAndTest: { useMutation: () => ({ isPending: false, mutate: reactivate }) },
    },
  },
}));

describe("AdminCircuitBreakerPanel", () => {
  it("confirma e dispara o reset das fontes ativas", async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal("window", { confirm: confirmSpy });
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminCircuitBreakerPanel />); });
    const button = tree!.root.findByProps({ children: "Resetar fontes ativas" });
    await act(async () => { button.props.onClick(); });
    expect(confirmSpy).toHaveBeenCalledWith("Resetar o Circuit Breaker de todas as fontes ativas? Isso remove o cooldown e preserva a freshness já registrada.");
    expect(reset).toHaveBeenCalledWith();
    vi.unstubAllGlobals();
  });

  it("confirma e dispara o teste controlado apenas para a fonte pausada", async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal("window", { confirm: confirmSpy });
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminCircuitBreakerPanel />); });
    const button = tree!.root.findByProps({ children: "Reativar e testar" });
    await act(async () => { button.props.onClick(); });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Testar e reativar Ativa House"));
    expect(reactivate).toHaveBeenCalledWith({ sourceKey: "instagram:ativahouse" });
    vi.unstubAllGlobals();
  });

  it("exibe o último HTTP e o motivo sanitizado no diagnóstico rápido", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminCircuitBreakerPanel />); });
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain("Diagnóstico rápido");
    expect(rendered).toContain("403 - Proibido");
    expect(rendered).toContain("502 - Erro do provedor");
  });

  it("expõe explicações acessíveis para Open e Half-Open", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminCircuitBreakerPanel />); });
    const badges = tree!.root.findAll(node => typeof node.props["aria-label"] === "string");
    expect(badges.map(node => node.props["aria-label"])).toEqual(expect.arrayContaining([
      expect.stringContaining("PAUSADO: CIRCUIT OPEN"),
      expect.stringContaining("HALF-OPEN · TESTE"),
    ]));
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain("A fonte atingiu três falhas críticas consecutivas");
    expect(rendered).toContain("O cooldown terminou");
  });
});
