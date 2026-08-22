import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import AdminCircuitBreakerPanel from "./AdminCircuitBreakerPanel";

const refetch = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    circuitBreaker: {
      statuses: { useQuery: () => ({ data: [
        { sourceKey: "instagram:ativahouse", name: "Ativa House", kind: "instagram", circuitState: "open", circuitFailureCount: 3, circuitOpenedAt: new Date("2026-08-22T12:00:00Z"), circuitNextAttemptAt: new Date("2026-08-23T06:00:00Z"), circuitLastError: "HTTP 403: perfil pausado", lastStatus: "failed", lastMessage: "HTTP 403" },
        { sourceKey: "public:ingresse", name: "Ingresse", kind: "public", circuitState: "half_open", circuitFailureCount: 3, circuitOpenedAt: new Date("2026-08-22T12:00:00Z"), circuitNextAttemptAt: new Date("2026-08-23T06:00:00Z"), circuitLastError: null, lastStatus: "failed", lastMessage: "HTTP 502" },
      ], isLoading: false, isError: false, isFetching: false, refetch }) },
    },
  },
}));

describe("AdminCircuitBreakerPanel", () => {
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
