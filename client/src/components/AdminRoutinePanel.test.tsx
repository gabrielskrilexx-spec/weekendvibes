import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import AdminRoutinePanel from "./AdminRoutinePanel";

let statusState: { data?: { nextExecutionAt: string; timezone: string; runMode: string; isRunning: boolean; progress?: { isRunning: boolean; runId: number | null; phase: string; step: number; totalSteps: number; message: string; error: string | null; sources: Array<{ sourceKey: string; status: string; read: number; added: number; updated: number; ignored: number }> } }; isLoading: boolean; isError: boolean } = { isLoading: true, isError: false };
let mutationState = { isPending: false };
const mutate = vi.fn();
const refetch = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    adminRoutine: {
      status: { useQuery: () => ({ ...statusState, refetch }) },
      runNow: { useMutation: (options: { onSuccess?: (result: unknown) => void; onError?: (error: Error) => void }) => ({ ...mutationState, mutate: (input?: unknown) => { mutate(input); options.onSuccess?.({ publicSources: { imported: 2 } }); } }) },
    },
  },
}));

describe("AdminRoutinePanel", () => {
  it("exibe loading e erro da consulta do schedule", async () => {
    statusState = { isLoading: true, isError: false };
    let loadingTree: ReturnType<typeof create>;
    await act(async () => { loadingTree = create(<AdminRoutinePanel />); });
    expect(loadingTree!.toJSON()).toBeTruthy();
    statusState = { isLoading: false, isError: true };
    let errorTree: ReturnType<typeof create>;
    await act(async () => { errorTree = create(<AdminRoutinePanel />); });
    expect(JSON.stringify(errorTree!.toJSON())).toContain("Não foi possível consultar o schedule");
  });
  it("exibe a próxima execução e mantém o botão desabilitado enquanto executa", async () => {
    statusState = { isLoading: false, isError: false, data: { nextExecutionAt: "2026-08-18T13:00:00.000Z", timezone: "America/Sao_Paulo", runMode: "full_auto", isRunning: false } };
    mutationState = { isPending: true };
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminRoutinePanel />); });
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
            { sourceKey: "public", status: "running", read: 12, added: 1, updated: 2, ignored: 3 },
            { sourceKey: "instagram", status: "pending", read: 0, added: 0, updated: 0, ignored: 0 },
          ],
        },
      },
    };
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminRoutinePanel />); });
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

  it("confirma o disparo manual e exibe sucesso", async () => {
    statusState = { isLoading: false, isError: false, data: { nextExecutionAt: "2026-08-18T13:00:00.000Z", timezone: "America/Sao_Paulo", runMode: "full_auto", isRunning: false } };
    mutationState = { isPending: false };
    const confirm = vi.fn().mockReturnValue(true);
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = confirm;
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<AdminRoutinePanel />); });
    await act(async () => { tree!.root.findByType("button").props.onClick(); });
    expect(confirm).toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(tree!.toJSON())).toContain("Rotina concluída");
    expect(refetch).toHaveBeenCalled();
    globalThis.confirm = originalConfirm;
  });
});
