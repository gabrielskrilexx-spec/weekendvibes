import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import AdminSourcesPanel from "./AdminSourcesPanel";

const { refetch, invalidate, mutate, reactivateMutate, createMutate, mockSettingsMutate, fetchMock } = vi.hoisted(() => ({ refetch: vi.fn(), invalidate: vi.fn(), mutate: vi.fn(), reactivateMutate: vi.fn(), createMutate: vi.fn(), mockSettingsMutate: vi.fn(), fetchMock: vi.fn() }));
const source = { id: 1, sourceKey: "instagram:mobydicksantos", name: "Moby House", kind: "instagram", handle: "mobydicksantos", url: "https://www.instagram.com/mobydicksantos/", isEnabled: 1, priority: 10, frequencyMinutes: 10080, p95LatencyThresholdMs: 3000, lastAttemptAt: new Date("2026-08-15T13:00:00Z"), lastSuccessAt: new Date("2026-08-15T12:00:00Z"), lastStatus: "failed", lastMessage: "Meta Graph API HTTP 400: Invalid user id", lastFailureReason: "ID inválido", circuitState: "open", circuitFailureCount: 3 };
const closedSource = { ...source, id: 2, sourceKey: "public:closed", name: "Fonte Saudável", kind: "public", handle: null, url: "https://example.com/agenda", lastStatus: "succeeded", lastMessage: null, lastFailureReason: null, circuitState: "closed", circuitFailureCount: 0 };
vi.stubGlobal("fetch", fetchMock);

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ingestionReports: {
      mockSettings: { useQuery: () => ({ data: { allowSandboxMocks: true, environment: "preview" }, isLoading: false }) },
      setMockSettings: { useMutation: () => ({ isPending: false, mutate: mockSettingsMutate }) },
    },
    ingestionSources: {
      list: { useQuery: () => ({ data: [source, closedSource], isLoading: false, isError: false, isFetching: false, refetch }) },
      auditLog: { useQuery: () => ({ data: [{ id: 1, previousHandle: "moby-old", nextHandle: "moby-corrigido", changedAt: new Date("2026-08-16T12:00:00Z") }] }) },
      actionAudit: { useQuery: () => ({ data: [{ id: 1, action: "reactivated", operatorOpenId: "admin@example", details: "Reprocessamento imediato solicitado", actedAt: new Date("2026-08-17T12:00:00Z") }] }) },
      create: { useMutation: (options?: { onSuccess?: () => void }) => ({ isPending: false, mutate: (input: unknown) => { createMutate(input); options?.onSuccess?.(); } }) },
      update: { useMutation: () => ({ isPending: false, mutate }) },
      reactivate: { useMutation: () => ({ isPending: false, mutate: reactivateMutate }) },
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
    expect(rendered).toContain("Última tentativa");
    expect(rendered).toContain("15/08/2026");
    expect(rendered).toContain("Circuit Breaker OPEN");
    expect(rendered).toContain("Histórico de alterações do ID Meta");
    expect(rendered).toContain("moby-old");
    expect(rendered).toContain("Ativa");
    expect(rendered).toContain("Pausar Ingestão");
    expect(rendered).toContain("Meta Graph API HTTP 400: Invalid user id");
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
    expect(fetchMock).toHaveBeenCalledWith("/api/v2/admin/sync-stories", expect.objectContaining({ method: "POST", credentials: "include", body: JSON.stringify({ sourceKey: "instagram:mobydicksantos" }) }));
  });

  it("cadastra uma nova fonte pelo formulário", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const addButton = tree!.root.findByProps({ children: "Nova Fonte" });
    await act(async () => { addButton.props.onClick(); });
    const nameInput = tree!.root.findByProps({ placeholder: "Ex.: Bar da Praia" });
    const handleInput = tree!.root.findByProps({ placeholder: "@nomedobar (opcional se usar URL)" });
    await act(async () => {
      nameInput.props.onChange({ target: { value: "Bar Novo" } });
      handleInput.props.onChange({ target: { value: "@bar_novo" } });
    });
    const form = tree!.root.findByType("form");
    await act(async () => { form.props.onSubmit({ preventDefault: vi.fn() }); });
    expect(createMutate).toHaveBeenCalledWith({ name: "Bar Novo", kind: "instagram", handle: "bar_novo", url: undefined });
  });

  it("permite pausar uma fonte", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const button = tree!.root.findAllByType("button").find(item => item.props["aria-pressed"] === true);
    await act(async () => { button?.props.onClick(); });
    expect(mutate).toHaveBeenCalledWith({ id: 1, isEnabled: false, priority: 10, frequencyMinutes: 10080, p95LatencyThresholdMs: 3000 });
  });

  it("permite corrigir o username/ID Meta", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const input = tree!.root.findByProps({ "aria-label": "Username/ID Meta de Moby House" });
    await act(async () => { input.props.onBlur({ currentTarget: { value: "@moby-corrigido" } }); });
    expect(mutate).toHaveBeenCalledWith({ id: 1, isEnabled: true, priority: 10, frequencyMinutes: 10080, p95LatencyThresholdMs: 3000, handle: "@moby-corrigido" });
  });

  it("oferece reativação quando o circuito está aberto", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const button = tree!.root.findByProps({ "aria-label": "Reativar Fonte Moby House" });
    await act(async () => { button.props.onClick(); });
    expect(reactivateMutate).not.toHaveBeenCalled();
    const confirm = tree!.root.findByProps({ children: "Confirmar reativação" });
    await act(async () => { confirm.props.onClick({ preventDefault: vi.fn() }); });
    expect(reactivateMutate).toHaveBeenCalledWith({ sourceKey: "instagram:mobydicksantos", reprocessNow: true });
    expect(JSON.stringify(tree!.toJSON())).toContain("moby-corrigido");
  });

  it("filtra a listagem para mostrar somente fontes OPEN", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const checkbox = tree!.root.findAllByType("input").find(item => item.props.type === "checkbox" && item.props.checked === false);
    expect(checkbox).toBeDefined();
    await act(async () => { checkbox!.props.onChange({ target: { checked: true } }); });
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain("Moby House");
    expect(rendered).not.toContain("Fonte Saudável");
  });

  it("exibe a auditoria de reativação no modal de detalhes", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const details = tree!.root.findByProps({ "aria-label": "Ver detalhes de Moby House" });
    await act(async () => { details.props.onClick(); });
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain("Histórico de intervenções");
    expect(rendered).toContain("Fonte reativada");
    expect(rendered).toContain("admin@example");
  });
});
