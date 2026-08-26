import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import AdminRoutinePanel, { isChunkNetworkError, retryChunkNetwork } from "./AdminRoutinePanel";

let statusState: {
  data?: {
    nextExecutionAt: string;
    timezone: string;
    runMode: string;
    isRunning: boolean;
    recentRuns?: Array<{
      id: number;
      routine: string;
      trigger: string;
      status: string;
      startedAt: string;
      finishedAt: string | null;
      httpStatus: number | null;
      durationMs: number | null;
      expurgatedCount: number;
      readCount: number;
      processedCount: number;
      persistedEventIds: number[];
      dateFilterValidation: unknown;
    }>;
    progress?: {
      isRunning: boolean;
      runId: number | null;
      phase: string;
      step: number;
      totalSteps: number;
      message: string;
      error: string | null;
      sources: Array<{
        sourceKey: string;
        status: string;
        read: number;
        added: number;
        updated: number;
        ignored: number;
      }>;
    };
  };
  isLoading: boolean;
  isError: boolean;
  error?: Error;
} = { isLoading: true, isError: false };
let mutationState = { isPending: false };
const mutate = vi.fn();
const refetch = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    adminRoutine: {
      status: { useQuery: () => ({ ...statusState, refetch }) },
      runNow: {
        useMutation: (options: {
          onSuccess?: (result: unknown) => void;
          onError?: (error: Error) => void;
        }) => ({
          ...mutationState,
          mutate: (input?: unknown) => {
            mutate(input);
            options.onSuccess?.({ publicSources: { imported: 2 } });
          },
        }),
      },
    },
  },
}));

describe("chunk network resilience", () => {
  it("classifica falhas de transporte sem tratar erros de domínio como rede", () => {
    expect(isChunkNetworkError(new Error("Failed to fetch"))).toBe(true);
    expect(isChunkNetworkError(new Error("Fonte inválida"))).toBe(false);
  });

  it("repete até duas vezes e retorna o sucesso do chunk", async () => {
    let attempts = 0;
    const result = await retryChunkNetwork(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("gateway timeout");
      return "ok";
    }, 2, 0);
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("encerra após duas novas tentativas quando a rede continua indisponível", async () => {
    let attempts = 0;
    await expect(retryChunkNetwork(async () => {
      attempts += 1;
      throw new Error("Failed to fetch");
    }, 2, 0)).rejects.toThrow("Failed to fetch");
    expect(attempts).toBe(3);
  });
});

describe("AdminRoutinePanel", () => {
  it("exibe loading e erro da consulta do schedule", async () => {
    statusState = { isLoading: true, isError: false };
    let loadingTree: ReturnType<typeof create>;
    await act(async () => {
      loadingTree = create(<AdminRoutinePanel />);
    });
    expect(loadingTree!.toJSON()).toBeTruthy();
    statusState = { isLoading: false, isError: true };
    let errorTree: ReturnType<typeof create>;
    await act(async () => {
      errorTree = create(<AdminRoutinePanel />);
    });
    expect(JSON.stringify(errorTree!.toJSON())).toContain(
      "Não foi possível consultar o schedule"
    );
  });
  it("exibe a próxima execução e mantém o botão desabilitado enquanto executa", async () => {
    statusState = {
      isLoading: false,
      isError: false,
      data: {
        nextExecutionAt: "2026-08-18T13:00:00.000Z",
        timezone: "America/Sao_Paulo",
        runMode: "full_auto",
        isRunning: false,
      },
    };
    mutationState = { isPending: true };
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<AdminRoutinePanel />);
    });
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain("Próxima execução");
    expect(rendered).toContain("18 de agosto de 2026");
    expect(rendered).toContain("America/Sao_Paulo");
    expect(rendered).toContain("full_auto");
    expect(tree!.root.findByType("button").props.disabled).toBe(true);
    mutationState = { isPending: false };
  });
  it("exibe o progresso por fonte e bloqueia o botão durante a execução", async () => {
    statusState = {
      isLoading: false,
      isError: false,
      data: {
        nextExecutionAt: "2026-08-18T13:00:00.000Z",
        timezone: "America/Sao_Paulo",
        runMode: "full_auto",
        isRunning: true,
        progress: {
          isRunning: true,
          runId: 9001,
          phase: "collecting",
          step: 2,
          totalSteps: 4,
          message: "Coletando fontes públicas e Instagram.",
          error: null,
          sources: [
            {
              sourceKey: "public",
              status: "running",
              read: 12,
              added: 1,
              updated: 2,
              ignored: 3,
            },
            {
              sourceKey: "instagram",
              status: "pending",
              read: 0,
              added: 0,
              updated: 0,
              ignored: 0,
            },
          ],
        },
      },
    };
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<AdminRoutinePanel />);
    });
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain("Progresso da ingestão");
    expect(rendered).toContain("Coletando fontes públicas e Instagram");
    expect(rendered).toContain("Fontes públicas");
    expect(rendered).toContain("Processando");
    expect(rendered).toContain("Etapa");
    expect(rendered).toContain('"3"');
    expect(rendered).toContain('"4"');
    expect(tree!.root.findByType("button").props.disabled).toBe(true);
  });

  it("exibe o histórico visual com status, trigger e duração", async () => {
    statusState = {
      isLoading: false,
      isError: false,
      data: {
        nextExecutionAt: "2026-08-18T13:00:00.000Z",
        timezone: "America/Sao_Paulo",
        runMode: "full_auto",
        isRunning: false,
        recentRuns: [
          {
            id: 91,
            routine: "manual-agenda",
            trigger: "manual",
            status: "partial",
            startedAt: "2026-08-26T12:00:00.000Z",
            finishedAt: "2026-08-26T12:00:02.345Z",
            httpStatus: 200,
            durationMs: 2345,
            expurgatedCount: 1,
            readCount: 12,
            processedCount: 8,
            persistedEventIds: [701, 702],
            dateFilterValidation: {
              timezone: "America/Sao_Paulo",
              today: "2026-08-26",
            },
          },
        ],
      },
    };
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<AdminRoutinePanel />);
    });
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain("Execuções recentes");
    expect(rendered).toContain("Run #");
    expect(rendered).toContain('"91"');
    expect(rendered).toContain("manual-agenda");
    expect(rendered).toContain("Parcial");
    expect(rendered).toContain("2345 ms");
    expect(rendered).toContain("IDs persistidos");
  });

  it("confirma o disparo manual e exibe sucesso", async () => {
    statusState = {
      isLoading: false,
      isError: false,
      data: {
        nextExecutionAt: "2026-08-18T13:00:00.000Z",
        timezone: "America/Sao_Paulo",
        runMode: "full_auto",
        isRunning: false,
      },
    };
    mutationState = { isPending: false };
    const confirm = vi.fn().mockReturnValue(true);
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = confirm;
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<AdminRoutinePanel />);
    });
    await act(async () => {
      tree!.root.findByType("button").props.onClick();
    });
    expect(confirm).toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(tree!.toJSON())).toContain("Rotina concluída");
    expect(refetch).toHaveBeenCalled();
    globalThis.confirm = originalConfirm;
  });
});
