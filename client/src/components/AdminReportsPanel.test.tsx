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
  weeklyTrend: [],
  freshness: [],
  weeklySummary: { retries: 0, fallbackList: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, degradedRuns: 0, inconsistentRuns: 0 },
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
    expect(JSON.stringify(tree!.toJSON())).toContain("db6cf437");
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

  it("mantém o erro sanitizado e atualiza os relatórios", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    await act(async () => { mutationOptions.onError?.(new Error("falha controlada"), { sourceKey: "instagram" }); });
    expect(mocks.reportRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).toHaveBeenCalledWith("Não foi possível executar a ingestão", expect.objectContaining({ description: expect.stringContaining("falha controlada") }));
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
