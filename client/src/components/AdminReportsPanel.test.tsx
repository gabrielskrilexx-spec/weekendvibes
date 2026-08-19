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

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, warning: mocks.toastWarning, error: mocks.toastError } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    ingestionReports: {
      summary: { useQuery: () => ({ data: reportData, refetch: mocks.reportRefetch }) },
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
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    mocks.toastWarning.mockReset();
    mutationOptions = {};
    mutationState = { isPending: false };
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
    await act(async () => { mutationOptions.onSuccess?.({ ok: true, routine: "instagram-agenda", imported: 2, counts: { read: 4, filtered: 2, persisted: 2, duplicates: 0 }, degraded: false }, { sourceKey: "instagram" }); });
    expect(mocks.reportRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Ingestão concluída", expect.objectContaining({ description: expect.stringContaining("2 novos eventos cadastrados") }));

    await act(async () => { mutationOptions.onSuccess?.({ ok: true, routine: "instagram-agenda", imported: 0, counts: { read: 0, filtered: 0, persisted: 0, duplicates: 0 }, degraded: true }, { sourceKey: "instagram" }); });
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
