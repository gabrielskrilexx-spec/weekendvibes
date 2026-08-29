import React from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminRoutinePanel, { buildOcrEditInput, filterAndPaginateFilteredStories, getApifyQuotaNotice, isChunkNetworkError, retryChunkNetwork } from "./AdminRoutinePanel";

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
      ocrAudit?: Array<{ mediaOrigin: "post" | "story" | "highlight"; imageUrl: string; sourceUrl: string; highlightTitle: string | null; ocrText: string; rawText: string }>;
      filteredStories?: Array<{ id: string; username: string; mediaOrigin: "story" | "highlight"; imageUrl: string; sourceUrl: string; postedAt: string | null; expiresAt: string | null; ocrText: string; rawText: string; reasons: string[]; status: "pending" | "approved" }>;
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
let statusQueryOptions: Record<string, unknown> | undefined;
let rolloverHourState = { data: { rolloverHour: 6 }, isLoading: false, isError: false, refetch: vi.fn() };

beforeEach(() => {
  mutate.mockClear();
  refetch.mockClear();
  statusQueryOptions = undefined;
  statusState = { isLoading: true, isError: false };
  mutationState = { isPending: false };
  rolloverHourState = { data: { rolloverHour: 6 }, isLoading: false, isError: false, refetch: vi.fn() };
});

vi.mock("@/lib/trpc", () => ({
  trpc: {
    adminRoutine: {
      status: {
        useQuery: (_input?: unknown, options?: Record<string, unknown>) => {
          statusQueryOptions = options;
          return { ...statusState, refetch };
        },
      },
      rolloverHour: {
        useQuery: () => rolloverHourState,
      },
      setRolloverHour: {
        useMutation: (options: { onSuccess?: (result: { success: true; rolloverHour: number }) => void; onError?: (error: Error) => void }) => ({
          isPending: mutationState.isPending,
          mutate: (input: { rolloverHour: number }) => {
            mutate(input);
            options.onSuccess?.({ success: true, rolloverHour: input.rolloverHour });
          },
        }),
      },
      updateOcrText: {
        useMutation: (options: { onSuccess?: (result: { success: true; runId: number; entryIndex: number; ocrText: string }) => void; onError?: (error: Error) => void }) => ({
          isPending: mutationState.isPending,
          mutate: (input: { runId: number; entryIndex: number; ocrText: string }) => {
            mutate(input);
            options.onSuccess?.({ success: true, runId: input.runId, entryIndex: input.entryIndex, ocrText: input.ocrText });
          },
        }),
      },
      approveFilteredStory: {
        useMutation: (options: { onSuccess?: (result: { success: true; runId: number; storyId: string; status: "approved" }) => void; onError?: (error: Error) => void }) => ({
          isPending: mutationState.isPending,
          mutate: (input: { runId: number; storyId: string }) => {
            mutate(input);
            options.onSuccess?.({ success: true, runId: input.runId, storyId: input.storyId, status: "approved" });
          },
        }),
      },
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

describe("filtered stories pagination", () => {
  const story = (id: string, reasons: string[]): Parameters<typeof filterAndPaginateFilteredStories>[0][number] => ({ id, username: "meulugar.bar", mediaOrigin: "story", imageUrl: "https://example.com/story.png", sourceUrl: "https://instagram.com/meulugar.bar", postedAt: null, expiresAt: null, ocrText: "", rawText: "", reasons, status: "pending" });

  it("filtra por motivo sem diferenciar maiúsculas e minúsculas", () => {
    const result = filterAndPaginateFilteredStories([story("1", ["Data expirada"]), story("2", ["Baixa confiança"])], "data EXPIRADA", 0, 12);
    expect(result.items.map(item => item.id)).toEqual(["1"]);
    expect(result.total).toBe(1);
    expect(result.hasNextPage).toBe(false);
  });

  it("retorna offsets e próxima página de forma determinística", () => {
    const result = filterAndPaginateFilteredStories(Array.from({ length: 25 }, (_, index) => story(String(index + 1), ["sem data"])), "", 12, 12);
    expect(result.items).toHaveLength(12);
    expect(result.items[0]?.id).toBe("13");
    expect(result.nextOffset).toBe(24);
    expect(result.hasNextPage).toBe(true);
  });
});

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
  it("identifica quota excedida como limitação do provedor", () => {
    expect(getApifyQuotaNotice({ quotaExceeded: true, providerIssue: { code: "APIFY_QUOTA_EXCEEDED", message: "Cota mensal do Apify excedida." } })).toBe("Cota mensal do Apify excedida.");
    expect(getApifyQuotaNotice({ quotaExceeded: false, providerIssue: { code: "HTTP_403" } })).toBeNull();
    expect(getApifyQuotaNotice(null)).toBeNull();
  });
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
    expect(tree!.root.findByProps({ "aria-label": "Executar ingestão manual agora" }).props.disabled).toBe(true);
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
    expect(tree!.root.findByProps({ "aria-label": "Executar ingestão manual agora" }).props.disabled).toBe(true);
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
            ocrAudit: [{ mediaOrigin: "story", imageUrl: "https://cdn.example.com/meu-lugar-story.jpg", sourceUrl: "https://www.instagram.com/meulugar.bar/", highlightTitle: null, ocrText: "Meu Lugar · Programação especial · 22h", rawText: "Meu Lugar · Programação especial · 22h" }],
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
    const detailButton = tree!.root.findByProps({ "aria-label": "Auditar OCR da execução 91" });
    await act(async () => { detailButton.props.onClick(); });
    const dialog = tree!.root.findByProps({ "data-testid": "ocr-audit-dialog" });
    expect(dialog.props["data-testid"]).toBe("ocr-audit-dialog");
    expect(dialog.props["data-ocr-entry-count"]).toBe(1);
  });

  it("lista Stories filtrados com motivo e aprovação manual", async () => {
    statusState = { isLoading: false, isError: false, data: { nextExecutionAt: "2026-08-28T10:00:00.000Z", timezone: "America/Sao_Paulo", runMode: "automatic", isRunning: false, recentRuns: [{ id: 77, routine: "Instagram Stories", trigger: "automatic", status: "partial", startedAt: "2026-08-28T09:00:00.000Z", finishedAt: "2026-08-28T09:01:00.000Z", httpStatus: 200, durationMs: 1000, expurgatedCount: 1, readCount: 2, processedCount: 1, persistedEventIds: [], dateFilterValidation: null, filteredStories: [{ id: "story-1", username: "meulugar.bar", mediaOrigin: "story", imageUrl: "https://example.com/story.jpg", sourceUrl: "https://instagram.com/meulugar.bar", postedAt: null, expiresAt: null, ocrText: "Sexta 22h", rawText: "Sexta 22h", reasons: ["Data não confirmada"], status: "pending" }] }] } };
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminRoutinePanel />); });
    await act(async () => { const tab = tree!.root.findAll(node => node.type === "button" && node.props.children?.toString().includes("Stories filtrados"))[0]; tab.props.onClick(); });
    expect(tree!.toJSON()).toBeTruthy();
    expect(tree!.root.findAll(node => node.props["data-testid"] === "filtered-stories-list").length).toBe(1);
    expect(tree!.root.findAll(node => node.props["aria-label"] === "Aprovar Story de meulugar.bar").length).toBeGreaterThan(0);
    expect(tree!.root.findAll(node => node.props["aria-label"] === "Filtrar Stories por fonte ou usuário").length).toBe(1);
    expect(tree!.root.findAll(node => node.props["aria-label"] === "Filtrar Stories por status").length).toBe(1);
    expect(tree!.root.findAll(node => node.props["aria-label"] === "Filtrar Stories a partir da data").length).toBe(1);
    expect(tree!.root.findAll(node => node.props["aria-label"] === "Filtrar Stories até a data").length).toBe(1);
    const detailButton = tree!.root.findByProps({ "aria-label": "Ver detalhes do Story story-1" });
    await act(async () => { detailButton.props.onClick(); });
    expect(tree!.root.findAll(node => node.props["data-testid"] === "filtered-story-detail-dialog").length).toBe(1);
  });

  it("exibe a data e o status da última sincronização automática bem-sucedida", async () => {
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
            id: 92,
            routine: "manual-agenda",
            trigger: "manual",
            status: "partial",
            startedAt: "2026-08-27T12:00:00.000Z",
            finishedAt: "2026-08-27T12:00:02.000Z",
            httpStatus: 200,
            durationMs: 2000,
            expurgatedCount: 0,
            readCount: 1,
            processedCount: 1,
            persistedEventIds: [1],
            dateFilterValidation: null,
          },
          {
            id: 91,
            routine: "instagram-agenda",
            trigger: "automatic",
            status: "succeeded",
            startedAt: "2026-08-26T12:00:00.000Z",
            finishedAt: "2026-08-26T12:00:03.000Z",
            httpStatus: 200,
            durationMs: 3000,
            expurgatedCount: 0,
            readCount: 3,
            processedCount: 2,
            persistedEventIds: [2],
            dateFilterValidation: null,
          },
        ],
      },
    };
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<AdminRoutinePanel />);
    });
    const rendered = JSON.stringify(tree!.toJSON());
    expect(rendered).toContain("Última sincronização bem-sucedida");
    expect(rendered).toContain("Sucesso");
    expect(rendered).toContain("26 de agosto de 2026");
  });

  it("atualiza o status do cron sem recarregar a página", async () => {
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
    refetch.mockResolvedValue({ error: null });
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<AdminRoutinePanel />);
    });
    const refreshButton = tree!.root.findByProps({ "aria-label": "Atualizar status do cron" });
    expect(refreshButton.props.disabled).not.toBe(true);
    await act(async () => {
      await refreshButton.props.onClick();
    });
    expect(refetch).toHaveBeenCalled();
    expect(refreshButton.props["aria-busy"]).not.toBe(true);
  });

  it("permite configurar presets e intervalo personalizado do polling", async () => {
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
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<AdminRoutinePanel />);
    });
    expect(statusQueryOptions?.refetchInterval).toBe(60_000);
    const intervalSelect = tree!.root.findByProps({ id: "cron-refresh-interval" });
    await act(async () => {
      intervalSelect.props.onChange({ currentTarget: { value: "300" } });
    });
    expect(statusQueryOptions?.refetchInterval).toBe(300_000);
    await act(async () => {
      tree!.root.findByProps({ id: "cron-refresh-interval" }).props.onChange({ currentTarget: { value: "-1" } });
    });
    const customInput = tree!.root.findByProps({ "aria-label": "Intervalo personalizado em segundos" });
    expect(customInput.props.value).toBe(60);
    await act(async () => {
      customInput.props.onChange({ currentTarget: { value: "45" } });
    });
    expect(statusQueryOptions?.refetchInterval).toBe(45_000);
  });

  it("edita e salva o horário de rollover do feed", async () => {
    statusState = { isLoading: false, isError: false, data: { nextExecutionAt: "2026-08-18T13:00:00.000Z", timezone: "America/Sao_Paulo", runMode: "full_auto", isRunning: false } };
    rolloverHourState = { data: { rolloverHour: 6 }, isLoading: false, isError: false, refetch: vi.fn() };
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<AdminRoutinePanel />);
    });
    const input = tree!.root.findByProps({ "aria-label": "Hora de virada do dia em America/Sao_Paulo" });
    expect(input.props.value).toBe("6");
    await act(async () => {
      input.props.onChange({ currentTarget: { value: "8" } });
    });
    expect(tree!.root.findByProps({ "aria-label": "Hora de virada do dia em America/Sao_Paulo" }).props.value).toBe("8");
    await act(async () => {
      tree!.root.findByProps({ "aria-label": "Salvar horário de virada do dia" }).props.onClick();
    });
    expect(mutate).toHaveBeenCalledWith({ rolloverHour: 8 });
  });

  it("monta o payload editável do OCR com trim e limite seguro", () => {
    const payload = buildOcrEditInput(93, 0, "  Texto revisado manualmente  ");
    expect(payload).toEqual({ runId: 93, entryIndex: 0, ocrText: "Texto revisado manualmente" });
    expect(buildOcrEditInput(93, 0, "x".repeat(6000)).ocrText).toHaveLength(5000);
  });

  it("mantém o contrato de edição OCR no histórico sem alterar o texto bruto", async () => {
    statusState = {
      isLoading: false,
      isError: false,
      data: {
        nextExecutionAt: "2026-08-18T13:00:00.000Z",
        timezone: "America/Sao_Paulo",
        runMode: "full_auto",
        isRunning: false,
        recentRuns: [{ id: 93, routine: "instagram-agenda", trigger: "automatic", status: "succeeded", startedAt: "2026-08-26T12:00:00.000Z", finishedAt: "2026-08-26T12:00:03.000Z", httpStatus: 200, durationMs: 3000, expurgatedCount: 0, readCount: 1, processedCount: 1, persistedEventIds: [3], dateFilterValidation: null, ocrAudit: [{ mediaOrigin: "story", imageUrl: "https://cdn.example.com/story.jpg", sourceUrl: "https://instagram.com/meulugar.bar", highlightTitle: null, ocrText: "Texto original", rawText: "Texto bruto original" }] }],
      },
    };
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminRoutinePanel />); });
    const detailButton = tree!.root.findByProps({ "aria-label": "Auditar OCR da execução 93" });
    await act(async () => { detailButton.props.onClick(); });
    const dialog = tree!.root.findByProps({ "data-testid": "ocr-audit-dialog" });
    expect(dialog.props["data-ocr-entry-count"]).toBe(1);
    expect(buildOcrEditInput(93, 0, "Texto revisado manualmente")).toEqual({ runId: 93, entryIndex: 0, ocrText: "Texto revisado manualmente" });
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
      tree!.root.findByProps({ "aria-label": "Executar ingestão manual agora" }).props.onClick();
    });
    expect(confirm).toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(tree!.toJSON())).toContain("Rotina concluída");
    expect(refetch).toHaveBeenCalled();
    globalThis.confirm = originalConfirm;
  });
});
