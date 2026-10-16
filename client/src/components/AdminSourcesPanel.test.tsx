import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import AdminSourcesPanel from "./AdminSourcesPanel";

const { refetch, invalidate, mutate, reactivateMutate, createMutate, mockSettingsMutate, fetchMock, exportRefetch, reportQueryInputs, downloadAnchors, createObjectUrl } = vi.hoisted(() => ({ refetch: vi.fn(), invalidate: vi.fn(), mutate: vi.fn(), reactivateMutate: vi.fn(), createMutate: vi.fn(), mockSettingsMutate: vi.fn(), fetchMock: vi.fn(), exportRefetch: vi.fn().mockResolvedValue({ data: { items: [], total: 0 } }), reportQueryInputs: [] as unknown[], downloadAnchors: [] as Array<{ download?: string; click: () => void }>, createObjectUrl: vi.fn(() => "blob:test") }));
const source = { id: 1, sourceKey: "instagram:mobydicksantos", name: "Moby House", kind: "instagram", handle: "mobydicksantos", url: "https://www.instagram.com/mobydicksantos/", isEnabled: 1, priority: 10, frequencyMinutes: 10080, p95LatencyThresholdMs: 3000, lastAttemptAt: new Date("2026-08-15T13:00:00Z"), lastSuccessAt: new Date("2026-08-15T12:00:00Z"), lastStatus: "failed", lastMessage: "Meta Graph API HTTP 400: Invalid user id", lastFailureReason: "ID inválido", lastExecutionFeedback: null, lastHttpStatus: 400, circuitNextAttemptAt: new Date("2026-08-16T07:00:00Z"), circuitState: "open", circuitFailureCount: 3 };
const closedSource = { ...source, id: 2, sourceKey: "public:closed", name: "Fonte Saudável", kind: "public", handle: null, url: "https://example.com/agenda", lastStatus: "succeeded", lastMessage: "Sucesso: 10 eventos lidos, 2 persistidos.", lastExecutionFeedback: "Sucesso: 10 eventos lidos, 2 persistidos.", lastFailureReason: null, lastHttpStatus: 200, circuitNextAttemptAt: null, circuitState: "closed", circuitFailureCount: 0 };
vi.stubGlobal("fetch", fetchMock);
vi.stubGlobal("Blob", class TestBlob { constructor(public parts: unknown[], public options: unknown) {} });
vi.stubGlobal("URL", { createObjectURL: createObjectUrl, revokeObjectURL: vi.fn() });
vi.stubGlobal("document", { createElement: vi.fn(() => { const anchor = { download: "", href: "", click: vi.fn() }; downloadAnchors.push(anchor); return anchor; }) });

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ingestionReports: {
      mockSettings: { useQuery: () => ({ data: { allowSandboxMocks: true, environment: "preview" }, isLoading: false }) },
      setMockSettings: { useMutation: () => ({ isPending: false, mutate: mockSettingsMutate }) },
    },
    ingestionSources: {
      list: { useQuery: (input?: { openOnly?: boolean; failureCategory?: string }) => ({ data: [source, closedSource].filter(item => (!input?.openOnly || item.circuitState === "open") && (!input?.failureCategory || (input.failureCategory === "meta110" && item.lastHttpStatus === 400))), isLoading: false, isError: false, isFetching: false, refetch }) },
      summary: { useQuery: () => ({ data: { active: 2, open: 1, waf: 0, meta110: 1, network: 0 }, isLoading: false }) },
      consolidatedReport: { useQuery: () => ({ data: undefined, isFetching: false, refetch: () => Promise.resolve({ data: { generatedAt: "2026-10-16T12:00:00.000Z", totalSources: 2, activeSources: 1, pausedSources: 1, sources: [] } }) }) },
      executiveReport: { useQuery: (input: unknown) => { reportQueryInputs.push(input); return { data: { generatedAt: "2026-10-16T12:00:00.000Z", periodDays: 14, system_health_status: "degraded", sources: { active: 2, open: 1, waf: 0, meta110: 1, network: 0 }, series: [{ date: "2026-10-16", waf: 2, meta110: 1, network: 0, succeeded: 4, total: 5, successRate: 80 }], trends: { waf: { current: 2, previous: 3, delta: -1, percentage: -33.3, direction: "down" }, meta110: { current: 1, previous: 0, delta: 1, percentage: 100, direction: "up" }, network: { current: 0, previous: 0, delta: 0, percentage: 0, direction: "flat" }, succeeded: { current: 4, previous: 3, delta: 1, percentage: 33.3, direction: "up" }, successRate: { current: 80, previous: 60, delta: 20, percentage: 33.3, direction: "up" } } }, isLoading: false }; } },
      auditLog: { useQuery: () => ({ data: [{ id: 1, previousHandle: "moby-old", nextHandle: "moby-corrigido", changedAt: new Date("2026-08-16T12:00:00Z") }] }) },
      actionAudit: { useQuery: () => ({ data: [{ id: 1, action: "reactivated", operatorOpenId: "admin@example", details: "Reprocessamento imediato solicitado", actedAt: new Date("2026-08-17T12:00:00Z") }] }) },
      operationalTimeline: { useQuery: (input: { page: number }) => ({ data: { items: input.page === 1 ? [{ id: "handle-1", sourceKey: "instagram:mobydicksantos", action: "handle_changed", actorOpenId: "admin@example", details: "moby-old → moby-corrigido", occurredAt: new Date("2026-08-16T12:00:00Z").toISOString() }, { id: "action-1", sourceKey: "instagram:mobydicksantos", action: "reactivated", actorOpenId: "admin@example", details: "Reprocessamento imediato solicitado", occurredAt: new Date("2026-08-17T12:00:00Z").toISOString() }] : [{ id: "action-2", sourceKey: "instagram:mobydicksantos", action: "reprocessed", actorOpenId: "admin@example", details: "Sucesso: 10 eventos lidos, 2 persistidos.", occurredAt: new Date("2026-08-18T12:00:00Z").toISOString() }], page: input.page, pageSize: 5, total: 6, hasNextPage: input.page === 1, actionCounts: { all: 6, handle_changed: 2, reactivated: 1, reprocessed: 3 } } }) },
      operationalTimelineExport: { useQuery: (input: unknown) => ({ data: { items: [], total: 0 }, isFetching: false, refetch: () => { exportRefetch(input); return Promise.resolve({ data: { items: [], total: 0 } }); } }) },
      operationalTimelineJsonExport: { useQuery: (input: unknown) => ({ data: undefined, isFetching: false, refetch: () => { exportRefetch(input); return Promise.resolve({ data: { sourceKey: "instagram:mobydicksantos", exportedAt: "2026-10-16T12:00:00.000Z", total: 1, items: [] } }); } }) },
      create: { useMutation: (options?: { onSuccess?: () => void }) => ({ isPending: false, mutate: (input: unknown) => { createMutate(input); options?.onSuccess?.(); } }) },
      update: { useMutation: () => ({ isPending: false, mutate }) },
      reactivate: { useMutation: (options?: { onSuccess?: (result: { reprocess: "succeeded" | "failed" | "skipped" }) => void }) => ({ isPending: false, mutate: (input: unknown) => { reactivateMutate(input); options?.onSuccess?.({ reprocess: "succeeded" }); } }) },
    },
    adminRoutine: {
      status: { invalidate },
    },
    useUtils: () => ({ ingestionSources: { list: { invalidate }, operationalTimeline: { invalidate } }, ingestionReports: { mockSettings: { invalidate }, logs: { invalidate } }, adminRoutine: { status: { invalidate } } }),
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
    expect(rendered).toContain("Moby House");
    expect(rendered).toContain("Ativa");
    expect(rendered).toContain("Pausar Ingestão");
    expect(rendered).toContain("Meta Graph API HTTP 400: Invalid user id");
    expect(rendered).toContain("Fontes ativas");
    expect(rendered).toContain("Meta Code 110");
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
    expect(invalidate).toHaveBeenCalled();
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
    expect(rendered).toContain("Timeline operacional");
    expect(rendered).toContain("ID Meta alterado");
    expect(rendered).toContain("moby-old");
    expect(rendered).toContain("Fonte reativada");
    expect(rendered).toContain("admin@example");
  });

  it("pagina a timeline operacional sem poluir o modal", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const details = tree!.root.findByProps({ "aria-label": "Ver detalhes de Moby House" });
    await act(async () => { details.props.onClick(); });
    const next = tree!.root.findByProps({ children: "Próxima" });
    await act(async () => { next.props.onClick(); });
    expect(JSON.stringify(tree!.toJSON())).toContain('"Página ","2"');
    expect(JSON.stringify(tree!.toJSON())).toContain("Reprocessamento imediato");
  });

  it("exibe o feedback detalhado da última execução no cartão", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    expect(JSON.stringify(tree!.toJSON())).toContain("Sucesso: 10 eventos lidos, 2 persistidos.");
  });

  it("filtra por Meta Code 110 e exibe a próxima tentativa prevista", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const select = tree!.root.findByProps({ "aria-label": "Filtrar por motivo da falha" });
    await act(async () => { select.props.onChange({ target: { value: "meta110" } }); });
    expect(JSON.stringify(tree!.toJSON())).toContain("Moby House");
    expect(JSON.stringify(tree!.toJSON())).not.toContain("Fonte Saudável");
    const details = tree!.root.findByProps({ "aria-label": "Ver detalhes de Moby House" });
    await act(async () => { details.props.onClick(); });
    expect(JSON.stringify(tree!.toJSON())).toContain("Próxima tentativa automática prevista");
  });

  it("cruza status OPEN, categoria e período nos controles do painel", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const open = tree!.root.findAllByType("input").find(item => item.props.type === "checkbox" && item.props.checked === false);
    await act(async () => { open!.props.onChange({ target: { checked: true } }); });
    const failure = tree!.root.findByProps({ "aria-label": "Filtrar por motivo da falha" });
    await act(async () => { failure.props.onChange({ target: { value: "meta110" } }); });
    const period = tree!.root.findByProps({ "aria-label": "Filtrar por período" });
    await act(async () => { period.props.onChange({ target: { value: "7d" } }); });
    expect(JSON.stringify(tree!.toJSON())).toContain("Moby House");
    expect(JSON.stringify(tree!.toJSON())).not.toContain("Fonte Saudável");
  });

  it("oferece exportação do histórico em CSV UTF-8", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const details = tree!.root.findByProps({ "aria-label": "Ver detalhes de Moby House" });
    await act(async () => { details.props.onClick(); });
    expect(JSON.stringify(tree!.toJSON())).toContain("Exportar Histórico (CSV)");
    expect(JSON.stringify(tree!.toJSON())).toContain("Exportar JSON");
  });

  it("altera o período do gráfico e expõe exportação CSV e JSON da série", async () => {
    reportQueryInputs.length = 0;
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const period = tree!.root.findByProps({ "aria-label": "Período do gráfico de telemetria" });
    expect(period.props.value).toBe(14);
    await act(async () => { period.props.onChange({ target: { value: "30" } }); });
    expect(reportQueryInputs.at(-1)).toEqual({ days: 30 });
    expect(JSON.stringify(tree!.toJSON())).toContain("Últimos 30 dias");
    expect(tree!.root.findByProps({ "aria-label": "Exportar série de telemetria em CSV" })).toBeTruthy();
    expect(tree!.root.findByProps({ "aria-label": "Exportar série de telemetria em JSON" })).toBeTruthy();
  });

  it("simula o clique de download e entrega Blob com nome contextual", async () => {
    downloadAnchors.length = 0;
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const failure = tree!.root.findByProps({ "aria-label": "Filtrar por motivo da falha" });
    const period = tree!.root.findByProps({ "aria-label": "Período do gráfico de telemetria" });
    await act(async () => {
      failure.props.onChange({ target: { value: "meta110" } });
      period.props.onChange({ target: { value: "7" } });
    });
    const csv = tree!.root.findByProps({ "aria-label": "Exportar série de telemetria em CSV" });
    await act(async () => { csv.props.onClick(); });
    expect(createObjectUrl).toHaveBeenCalled();
    expect(downloadAnchors.at(-1)?.download).toMatch(/^auditoria_meta110_7dias_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(downloadAnchors.at(-1)?.click).toHaveBeenCalled();
  });

  it("oferece a exportação global do catálogo consolidado", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    expect(tree!.root.findByProps({ "aria-label": "Exportar Catálogo Consolidado" })).toBeTruthy();
  });

  it("exporta usando ação, datas e status ativos no modal", async () => {
    exportRefetch.mockClear();
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const details = tree!.root.findByProps({ "aria-label": "Ver detalhes de Moby House" });
    await act(async () => { details.props.onClick(); });
    const from = tree!.root.findByProps({ "aria-label": "Data inicial da timeline" });
    const to = tree!.root.findByProps({ "aria-label": "Data final da timeline" });
    await act(async () => {
      from.props.onChange({ target: { value: "2026-08-01" } });
      to.props.onChange({ target: { value: "2026-08-31" } });
    });
    const reprocessed = tree!.root.findByProps({ "aria-label": "Reprocessamentos (3)" });
    await act(async () => { reprocessed.props.onClick(); });
    const exportButton = tree!.root.findAllByType("button").find(item => String(item.props.children).includes("Exportar Histórico"));
    await act(async () => { await exportButton!.props.onClick(); });
    expect(exportRefetch).toHaveBeenCalledWith(expect.objectContaining({ action: "reprocessed", status: "open", from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T23:59:59.999Z" }));
  });

  it("limpa datas e ação e move o foco para o primeiro controle ao abrir", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const details = tree!.root.findByProps({ "aria-label": "Ver detalhes de Moby House" });
    await act(async () => { details.props.onClick(); });
    const from = tree!.root.findByProps({ "aria-label": "Data inicial da timeline" });
    const to = tree!.root.findByProps({ "aria-label": "Data final da timeline" });
    expect(from.props.autoFocus).toBe(true);
    await act(async () => {
      from.props.onChange({ target: { value: "2026-08-01" } });
      to.props.onChange({ target: { value: "2026-08-31" } });
    });
    const reprocessed = tree!.root.findByProps({ "aria-label": "Reprocessamentos (3)" });
    await act(async () => { reprocessed.props.onClick(); });
    const clear = tree!.root.findByProps({ "aria-label": "Limpar filtros da timeline" });
    await act(async () => { clear.props.onClick(); });
    expect(from.props.value).toBe("");
    expect(to.props.value).toBe("");
    expect(tree!.root.findByProps({ "aria-label": "Todas (6)" }).props["aria-pressed"]).toBe(true);
  });

  it("mantém modal, filtros e paginação acessíveis em viewport mobile", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const details = tree!.root.findByProps({ "aria-label": "Ver detalhes de Moby House" });
    await act(async () => { details.props.onClick(); });
    const modal = tree!.root.findByProps({ "data-testid": "source-details-dialog" });
    expect(modal.props.className).toContain("max-h-[90vh]");
    expect(modal.props.className).toContain("max-w-lg");
    const actionGroup = tree!.root.findByProps({ "aria-label": "Filtrar timeline por ação" });
    expect(actionGroup.props.className).toContain("flex-wrap");
    expect(tree!.root.findAllByType("button").some(item => String(item.props["aria-label"] ?? "").startsWith("Edição de ID Meta"))).toBe(true);
    expect(tree!.root.findByProps({ children: "Próxima" }).props.className).toContain("min-h-10");
    const reprocessFilter = tree!.root.findAllByType("button").find(item => String(item.props["aria-label"] ?? "").startsWith("Reprocessamentos"));
    await act(async () => { reprocessFilter!.props.onKeyDown({ key: " ", preventDefault: vi.fn() }); });
    expect(reprocessFilter!.props["aria-pressed"]).toBe(true);
  });

  it("exibe contadores agregados e aceita intervalo de datas na timeline", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const details = tree!.root.findByProps({ "aria-label": "Ver detalhes de Moby House" });
    await act(async () => { details.props.onClick(); });
    expect(JSON.stringify(tree!.toJSON())).toContain("Todas (6)");
    expect(JSON.stringify(tree!.toJSON())).toContain("Reativações (1)");
    const start = tree!.root.findByProps({ "aria-label": "Data inicial da timeline" });
    const end = tree!.root.findByProps({ "aria-label": "Data final da timeline" });
    await act(async () => {
      start.props.onChange({ target: { value: "2026-08-01" } });
      end.props.onChange({ target: { value: "2026-08-31" } });
    });
    expect(start.props.value).toBe("2026-08-01");
    expect(end.props.value).toBe("2026-08-31");
  });

  it("ativa filtro da timeline com Enter e Space e mantém foco visível", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminSourcesPanel />); });
    const details = tree!.root.findByProps({ "aria-label": "Ver detalhes de Moby House" });
    await act(async () => { details.props.onClick(); });
    const filter = tree!.root.findAllByType("button").find(item => String(item.props["aria-label"] ?? "").startsWith("Reativações"));
    const preventDefault = vi.fn();
    await act(async () => { filter!.props.onKeyDown({ key: "Enter", preventDefault }); });
    expect(filter!.props["aria-pressed"]).toBe(true);
    expect(filter!.props.className).toContain("focus-visible:ring-2");
    await act(async () => { filter!.props.onKeyDown({ key: " ", preventDefault }); });
    expect(preventDefault).toHaveBeenCalled();
  });
});
