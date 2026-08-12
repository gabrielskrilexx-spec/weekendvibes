import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import AdminRoutinePanel from "./AdminRoutinePanel";

let statusState: { data?: { nextExecutionAt: string; timezone: string; runMode: string; isRunning: boolean }; isLoading: boolean; isError: boolean } = { isLoading: true, isError: false };
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
