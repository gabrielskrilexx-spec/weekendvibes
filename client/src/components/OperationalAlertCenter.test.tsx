import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import OperationalAlertCenter, { resolveOperationalAlertFromUi } from "./OperationalAlertCenter";

const mocks = {
  data: [{ id: 7, integration: "meta", title: "Falha na API oficial do Instagram", message: "Meta Graph API retornou HTTP 503", createdAt: new Date("2026-08-12T12:00:00.000Z") }],
};

const resolve = vi.fn();
const invalidate = vi.fn();
const cancel = vi.fn().mockResolvedValue(undefined);
const getData = vi.fn().mockReturnValue(mocks.data);
const setData = vi.fn();
let mutationOptions: { onMutate?: (input: { id: number }) => Promise<{ previous: unknown }>; onError?: (error: Error, input: { id: number }, context?: { previous?: unknown }) => void; onSettled?: () => void } | undefined;

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ operationalAlerts: { list: { invalidate, cancel, getData, setData } } }),
    auth: { me: { useQuery: () => ({ data: { role: "admin" } }) } },
    operationalAlerts: {
      list: { useQuery: () => ({ ...mocks, isLoading: false, isError: false }) },
      resolve: { useMutation: (options: typeof mutationOptions) => { mutationOptions = options; return { isPending: false, mutate: (input: { id: number }) => { resolve(input); options?.onSettled?.(); } }; } },
    },
  },
}));

describe("OperationalAlertCenter", () => {
  it("não renderiza a aba visual de alertas de integração", () => {
    const markup = renderToStaticMarkup(<OperationalAlertCenter />);
    expect(markup).not.toContain("Alertas de integração");
    expect(markup).toBe("");
  });

  it("executa resolução otimista, rollback e invalidação para administradores", async () => {
    const markup = renderToStaticMarkup(<OperationalAlertCenter />);
    expect(markup).toBe("");
    expect(typeof resolve).toBe("function");
    expect(mutationOptions?.onMutate).toBeTypeOf("function");
    expect(mutationOptions?.onError).toBeTypeOf("function");
    expect(mutationOptions?.onSettled).toBeTypeOf("function");

    const context = await mutationOptions?.onMutate?.({ id: 7 });
    expect(cancel).toHaveBeenCalledWith({ size: 8 });
    expect(setData).toHaveBeenCalledTimes(1);
    mutationOptions?.onError?.(new Error("falha"), { id: 7 }, context);
    expect(setData).toHaveBeenCalledTimes(2);
    mutationOptions?.onSettled?.();
    expect(invalidate).toHaveBeenCalledWith({ size: 8 });
  });

  it("não expõe botões após a remoção da aba visual", async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => { tree = create(<OperationalAlertCenter />); });
    expect(tree!.root.findAllByType("button")).toHaveLength(0);
    tree!.unmount();
  });

  it("não renderiza superfície visual quando não há alertas ativos", () => {
    mocks.data = [];
    expect(renderToStaticMarkup(<OperationalAlertCenter />)).toBe("");
    mocks.data = [{ id: 7, integration: "meta", title: "Falha na API oficial do Instagram", message: "Meta Graph API retornou HTTP 503", createdAt: new Date("2026-08-12T12:00:00.000Z") }];
  });
});
