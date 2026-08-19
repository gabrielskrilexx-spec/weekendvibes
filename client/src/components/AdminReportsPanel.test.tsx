import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminReportsPanel from "./AdminReportsPanel";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  reportRefetch: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
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

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
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

  it("atualiza relatórios e notifica sucesso ou erro", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminReportsPanel />); });
    await act(async () => { tree!.root.findByProps({ "data-testid": "force-instagram-ingestion" }).props.onClick(); });
    await act(async () => { mutationOptions.onSuccess?.({ ok: true }, { sourceKey: "instagram" }); });
    expect(mocks.reportRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Ingestão iniciada", expect.objectContaining({ description: expect.stringContaining("Instagram") }));

    await act(async () => { mutationOptions.onError?.(new Error("falha controlada"), { sourceKey: "instagram" }); });
    expect(mocks.reportRefetch).toHaveBeenCalledTimes(2);
    expect(mocks.toastError).toHaveBeenCalledWith("Não foi possível executar a ingestão", expect.objectContaining({ description: expect.stringContaining("falha controlada") }));
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
