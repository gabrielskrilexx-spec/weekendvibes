import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminReportsPanel from "./AdminReportsPanel";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  reportRefetch: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
}));


let mutationOptions: {
  onSuccess?: (result: unknown, variables: { sourceKey: string }) => void;
  onError?: (error: Error, variables: { sourceKey: string }) => void;
} = {};
let mutationState = { isPending: false };

let latestReportData: typeof reportData;
const reportData = {
  totals: { succeeded: 1, failed: 0, partial: 0, imported: 2 },
  metaStatus: { status: "active", lastSuccessfulSync: "2026-08-19T13:00:00.000Z" },
  filterEvaluatedAt: "2026-08-21T03:00:01.000Z",
  weeklyTrend: [],
  freshness: [],
  weeklySummary: { retries: 0, fallbackList: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, degradedRuns: 0, inconsistentRuns: 0, rejectedEvents: 3, rejectedPastEvents: 2, rejectedOtherReasons: 1 },
  reconciliationBySource: [],
  sourceMetrics: [],
  timeline: [],
  runs: [],
  criticalAlerts: [],
  alerts: [],
};
latestReportData = reportData;

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, warning: mocks.toastWarning, error: mocks.toastError } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    ingestionReports: {
      summary: { useQuery: () => ({ data: latestReportData, refetch: mocks.reportRefetch }) },
      geocoding: { useQuery: () => ({ data: { pending: 0, processing: 0, succeeded: 0, failed: 0 }, refetch: vi.fn() }) },
      geocodeNow: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      reprocess: { useMutation: (options: typeof mutationOptions) => { mutationOptions = options; return { ...mutationState, mutate: mocks.mutate }; } },
    },
  },
}));

describe("AdminReportsPanel — ingestão manual Instagram", () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    mocks.reportRefetch.mockReset();
    latestReportData = reportData;
    mocks.reportRefetch.mockImplementation(() => Promise.resolve({ data: latestReportData }));
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    mocks.toastWarning.mockReset();
    mutationOptions = {};
    mutationState = { isPending: false };
  });

  it("exibe uma tag de versão para auditoria do bundle", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    const versionTag = tree!.root.findByProps({ "data-testid": "admin-build-version" });
    expect(String(versionTag.props.children)).toContain("Versão do painel:");
    expect(JSON.stringify(tree!.toJSON())).toContain("4a464f29");
  });

  it("exibe o horário da última avaliação do filtro em São Paulo", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    const evaluatedAt = tree!.root.findByProps({ "data-testid": "filter-evaluated-at" });
    expect(JSON.stringify(tree!.toJSON())).toContain("21/08/2026");
    expect(JSON.stringify(tree!.toJSON())).toContain("00:00");
  });

  it("destaca rejeições por data passada separadas das demais", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    const rejectionCard = tree!.root.findByProps({ "data-testid": "past-event-rejections" });
    expect(rejectionCard.findAllByType("p").some(node => node.children.includes("2"))).toBe(true);
    expect(JSON.stringify(tree!.toJSON())).toContain("Outras rejeições");
  });

  it("exibe alerta quando um ciclo supera 50% de rejeições por data passada", async () => {
    latestReportData = { ...reportData, runs: [{ id: 77, sourceKey: "instagram", routine: "instagram-agenda", status: "succeeded", importedCount: 1, counts: JSON.stringify({ read: 10, persisted: 1, rejectedPastEvents: 6 }) }] } as typeof reportData;
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    const alert = tree!.root.findByProps({ "data-testid": "past-event-quality-alert" });
    const alertText = alert.findAllByType("p").map(node => node.children.join(" ")).join(" ").replace(/\s+/g, " ");
    expect(alertText).toContain("ultrapassou 50 %");
    expect(alertText).toContain("#77 (60%)");
  });

  it("renderiza a série semanal de lidas, persistidos e rejeitados", async () => {
    latestReportData = { ...reportData, weeklyTrend: [{ date: "2026-08-21", label: "21/08", runs: 1, receivedPosts: 10, persisted: 3, rejectedPastEvents: 6, approvedPosts: 4, structuredEvents: 3, imported: 3, zeroMediaRuns: 0 }] } as typeof reportData;
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    expect(tree!.root.findByProps({ "aria-label": "Gráfico semanal de ingestão" })).toBeDefined();
    expect(JSON.stringify(tree!.toJSON())).toContain("Mídias lidas:");
    expect(JSON.stringify(tree!.toJSON())).toContain("Rejeitados por data passada:");
  });

  it("exibe a ação de limpeza de cache do painel", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    const button = tree!.root.findByProps({ "data-testid": "clear-client-cache" });
    expect(button.props["aria-label"]).toBe("Limpar cache do painel");
    expect(JSON.stringify(tree!.toJSON())).toContain("Limpar Cache");
  });

  it("dispara a mutation protegida com a fonte Instagram", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    await act(async () => { tree!.root.findByProps({ "data-testid": "force-instagram-ingestion" }).props.onClick(); });
    expect(mocks.mutate).toHaveBeenCalledWith({ sourceKey: "instagram" });
    expect(mocks.reportRefetch).not.toHaveBeenCalled();
  });

  it("desabilita o botão e mostra estado busy durante a execução", async () => {
    mutationState = { isPending: true };
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    const button = tree!.root.findByProps({ "data-testid": "force-instagram-ingestion" });
    expect(button.props.disabled).toBe(true);
    expect(button.props["aria-busy"]).toBe(true);
    expect(JSON.stringify(tree!.toJSON())).toContain("Forçar Ingestão (Instagram)");
  });

  it("diferencia sucesso com novos eventos de execução sem novos eventos", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    await act(async () => { tree!.root.findByProps({ "data-testid": "force-instagram-ingestion" }).props.onClick(); });
    latestReportData = { ...reportData, runs: [{ sourceKey: "instagram", routine: "instagram-agenda", status: "succeeded", importedCount: 2, details: { counts: { persisted: 2 } } }] } as typeof reportData;
    await act(async () => { await mutationOptions.onSuccess?.(true, { sourceKey: "instagram" }); });
    expect(mocks.reportRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Ingestão concluída", expect.objectContaining({ description: expect.stringContaining("2 novos eventos cadastrados") }));

    latestReportData = { ...reportData, runs: [{ sourceKey: "instagram", routine: "instagram-agenda", status: "partial", importedCount: 0, details: { counts: { persisted: 0 }, degraded: true } }] } as typeof reportData;
    await act(async () => { await mutationOptions.onSuccess?.(true, { sourceKey: "instagram" }); });
    expect(mocks.reportRefetch).toHaveBeenCalledTimes(2);
    expect(mocks.toastWarning).toHaveBeenCalledWith("Ingestão sem novos eventos", expect.objectContaining({ description: expect.stringContaining("modo degradado da Meta") }));
  });

  it("informa quando a ingestão Instagram foi aceita em segundo plano", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    await act(async () => { await mutationOptions.onSuccess?.({ accepted: true }, { sourceKey: "instagram" }); });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Ingestão iniciada", expect.objectContaining({ description: expect.stringContaining("iniciada em segundo plano") }));
    expect(mocks.reportRefetch).toHaveBeenCalledTimes(1);
  });

  it("mantém o erro sanitizado e atualiza os relatórios", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    await act(async () => { mutationOptions.onError?.(new Error("falha controlada"), { sourceKey: "instagram" }); });
    expect(mocks.reportRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).toHaveBeenCalledWith("Não foi possível executar a ingestão", expect.objectContaining({ description: expect.stringContaining("falha controlada") }));
  });

  it("diferencia sessão administrativa ausente de falha de transporte", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    const error = Object.assign(new Error("FORBIDDEN"), { data: { code: "UNAUTHORIZED" } });
    await act(async () => { mutationOptions.onError?.(error, { sourceKey: "instagram" }); });
    expect(mocks.toastError).toHaveBeenCalledWith("Sessão administrativa necessária", expect.objectContaining({ description: expect.stringContaining("sessão administrativa expirou") }));
  });

  it("notifica explicitamente quando o transporte falha sem confirmar um novo run", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    await act(async () => { mutationOptions.onError?.(new Error("Unable to transform response from server"), { sourceKey: "instagram" }); });
    expect(mocks.toastError).toHaveBeenCalledWith("Não foi possível executar a ingestão", expect.objectContaining({ description: expect.stringContaining("nenhum resultado novo foi confirmado") }));
    expect(mocks.toastError).not.toHaveBeenCalledWith("Relatório atualizado", expect.anything());
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
