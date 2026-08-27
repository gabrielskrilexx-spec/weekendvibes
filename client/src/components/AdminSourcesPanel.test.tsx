import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import AdminSourcesPanel from "./AdminSourcesPanel";

const { refetch, invalidate, mutate, mockSettingsMutate, fetchMock } = vi.hoisted(() => ({ refetch: vi.fn(), invalidate: vi.fn(), mutate: vi.fn(), mockSettingsMutate: vi.fn(), fetchMock: vi.fn() }));
const source = { id: 1, sourceKey: "instagram:mobydicksantos", name: "Moby House", kind: "instagram", handle: "mobydicksantos", url: "https://www.instagram.com/mobydicksantos/", isEnabled: 1, priority: 10, frequencyMinutes: 10080, p95LatencyThresholdMs: 3000, lastSuccessAt: new Date("2026-08-15T12:00:00Z"), lastStatus: "succeeded" };
vi.stubGlobal("fetch", fetchMock);

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ingestionReports: {
      mockSettings: { useQuery: () => ({ data: { allowSandboxMocks: true, environment: "preview" }, isLoading: false }) },
      setMockSettings: { useMutation: () => ({ isPending: false, mutate: mockSettingsMutate }) },
    },
    ingestionSources: {
      list: { useQuery: () => ({ data: [source], isLoading: false, isError: false, isFetching: false, refetch }) },
      update: { useMutation: () => ({ isPending: false, mutate }) },
    },
    adminRoutine: {
      status: { invalidate },
    },
    useUtils: () => ({ ingestionSources: { list: { invalidate } }, ingestionReports: { mockSettings: { invalidate }, logs: { invalidate } }, adminRoutine: { status: { invalidate } } }),
  },
}));

describe("AdminSourcesPanel", () => {
  it("exibe fonte, estado e último sucesso", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain("Fontes monitoradas");
    expect(rendered).toContain("Moby House");
    expect(rendered).toContain("Último sucesso");
    expect(rendered).toContain("Ativa");
  });

  it("exibe e alterna o toggle de mocks do sandbox", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const toggle = tree!.root.findByProps({ role: "switch" });
    expect(toggle.props["aria-checked"]).toBe(true);
    await act(async () => { toggle.props.onClick(); });
    expect(mockSettingsMutate).toHaveBeenCalledWith({ allowSandboxMocks: false });
  });

  it("persiste o limite P95 configurável", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const input = tree!.root.findByProps({ "aria-label": "Limite P95 de Moby House" });
    await act(async () => { input.props.onBlur({ currentTarget: { value: "4500" } }); });
    expect(mutate).toHaveBeenCalledWith({ id: 1, isEnabled: true, priority: 10, frequencyMinutes: 10080, p95LatencyThresholdMs: 4500 });
  });

  it("aciona a sincronização dedicada de Stories para perfis Instagram", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const button = tree!.root.findByProps({ "aria-label": "Sincronizar Stories de Moby House" });
    expect(button).toBeDefined();
    await act(async () => { await button?.props.onClick(); });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/sync-stories", expect.objectContaining({ method: "POST", credentials: "include", body: JSON.stringify({ sourceKey: "instagram:mobydicksantos" }) }));
  });

  it("permite pausar uma fonte", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const button = tree!.root.findAllByType("button").find(item => item.props["aria-pressed"] === true);
    await act(async () => { button?.props.onClick(); });
    expect(mutate).toHaveBeenCalledWith({ id: 1, isEnabled: false, priority: 10, frequencyMinutes: 10080, p95LatencyThresholdMs: 3000 });
  });
});
