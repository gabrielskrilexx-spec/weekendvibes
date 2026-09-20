import React from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  approveMany: vi.fn(),
  rejectMany: vi.fn(),
  approveOptions: null as any,
  toastSuccess: vi.fn(),
  queue: {
    data: {
      items: [
        { id: 7, sourceUrl: "https://instagram.com/meulugar.bar", sourceType: "instagram", title: "Sábado no Bar", summary: "Festa", eventDate: "2026-12-12T01:00:00.000Z", endDate: null, locationName: "Meu Lugar", address: null, city: "Santos", category: "balada", genre: null, priceCents: 0, imageUrl: null, rawText: "Festa sábado 12/10 às 22h", reason: "campos_parciais", status: "pending", reviewedBy: null, reviewedAt: null, publishedEventId: null, createdAt: "2026-09-09T10:00:00.000Z", updatedAt: "2026-09-09T10:00:00.000Z" },
        { id: 8, sourceUrl: "https://instagram.com/meulugar.bar", sourceType: "instagram", title: "Domingo no Bar", summary: "Festa", eventDate: "2026-12-13T01:00:00.000Z", endDate: null, locationName: "Meu Lugar", address: null, city: "Santos", category: "show", genre: null, priceCents: 0, imageUrl: null, rawText: "Festa", reason: "sem gênero", status: "pending", reviewedBy: null, reviewedAt: null, publishedEventId: null, createdAt: "2026-09-09T10:00:00.000Z", updatedAt: "2026-09-09T10:00:00.000Z" },
      ],
      total: 2,
      offset: 0,
      limit: 25,
      nextOffset: null,
      hasNextPage: false,
    },
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  },
  metrics: { data: { published: 3, awaitingReview: 2, rejected: 0, total: 2 }, isFetching: false, refetch: vi.fn() },
  auditHistory: { data: [] as Array<{ id: number; action: "edited" | "approved" | "rejected" | "undone"; changedByOpenId: string; createdAt: string; changes: Array<{ field: string; before: string | null; after: string | null }> }>, isFetching: false, isError: false },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: { adminRoutine: { manualReview: {
    list: { useQuery: () => state.queue },
    metrics: { useQuery: () => state.metrics },
    auditHistory: { useQuery: () => state.auditHistory },
    update: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    approve: { useMutation: (options: any) => { state.approveOptions = options; return { isPending: false, mutate: vi.fn() }; } },
    reject: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    undo: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    undoMany: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    approveMany: { useMutation: () => ({ isPending: false, mutate: state.approveMany }) },
    rejectMany: { useMutation: () => ({ isPending: false, mutate: state.rejectMany }) },
  } } },
}));
vi.mock("@/lib/adminFeedback", () => ({ friendlyAdminErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => state.toastSuccess(...args), error: vi.fn() } }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={className}>{children}</p>,
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

import ManualReviewPanel, { applyRawTokenToDateTime, draftFromEvent, highlightRawText, localDateTimeToIso, toDateTimeLocal } from "./ManualReviewPanel";

describe("ManualReviewPanel helpers", () => {
  it("destaca horários, datas, dias da semana e termos relativos", () => {
    const nodes = highlightRawText("Sábado 12/10 às 22h; amanhã às 23:00.");
    const highlighted = nodes.filter(node => React.isValidElement<{ children?: React.ReactNode }>(node) && node.type === "mark").map(node => String((node as React.ReactElement<{ children?: React.ReactNode }>).props.children));
    expect(highlighted).toEqual(["Sábado", "12/10", "22h", "amanhã", "23:00"]);
  });

  it("aplica tokens de horário e data ao campo datetime-local", () => {
    expect(applyRawTokenToDateTime("", { value: "22h", kind: "time" }, "2026-12-12")).toBe("2026-12-12T22:00");
    expect(applyRawTokenToDateTime("2026-12-12T18:00", { value: "12/10", kind: "date" })).toBe("2026-10-12T18:00");
    expect(applyRawTokenToDateTime("2026-12-12T18:00", { value: "sábado", kind: "date" })).toBeNull();
  });

  it("converte datas UTC para o campo local de São Paulo", () => {
    expect(toDateTimeLocal("2026-12-12T01:00:00.000Z")).toBe("2026-12-11T22:00");
    expect(toDateTimeLocal(null)).toBe("");
  });

  it("converte o horário local da revisão para ISO UTC", () => {
    expect(localDateTimeToIso("2026-12-11T22:00")).toBe("2026-12-12T01:00:00.000Z");
    expect(localDateTimeToIso("")).toBeNull();
  });

  it("preenche o rascunho com os campos incompletos preservados", () => {
    const draft = draftFromEvent({ id: 7, sourceUrl: "https://instagram.com/meulugar.bar", sourceType: "instagram", title: "Sábado no Bar", summary: null, eventDate: null, endDate: null, locationName: "Meu Lugar", address: null, city: null, category: null, genre: null, priceCents: null, imageUrl: "https://example.com/flyer.png", rawText: "Sábado no Bar", reason: "revisao_manual_campos_parciais", status: "pending", reviewedBy: null, reviewedAt: null, publishedEventId: null, createdAt: "2026-09-09T10:00:00.000Z", updatedAt: "2026-09-09T10:00:00.000Z" });
    expect(draft).toMatchObject({ title: "Sábado no Bar", locationName: "Meu Lugar", imageUrl: "https://example.com/flyer.png", reason: "revisao_manual_campos_parciais" });
    expect(draft.city).toBe("");
    expect(draft.category).toBe("");
  });
});

describe("ManualReviewPanel bulk selection", () => {
  beforeEach(() => {
    state.approveMany.mockClear();
    state.rejectMany.mockClear();
    state.toastSuccess.mockClear();
  });

  it("copia o texto original e exibe o estado de sucesso", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    let renderer!: ReturnType<typeof create>;
    await act(async () => { renderer = create(<ManualReviewPanel />); });
    const editButton = renderer.root.findByProps({ "data-testid": "manual-review-edit-7" });
    await act(async () => { editButton.props.onClick(); });
    const copyButton = renderer.root.findByProps({ "aria-label": "Copiar texto original" });
    await act(async () => { await copyButton.props.onClick(); });
    expect(writeText).toHaveBeenCalledWith("Festa sábado 12/10 às 22h");
    expect(JSON.stringify(renderer.toJSON())).toContain("Texto copiado");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });

  it("copia somente o token clicado e aplica o horário ao formulário", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    let renderer!: ReturnType<typeof create>;
    await act(async () => { renderer = create(<ManualReviewPanel />); });
    const editButton = renderer.root.findByProps({ "data-testid": "manual-review-edit-7" });
    await act(async () => { editButton.props.onClick(); });
    const tokenCopyButton = renderer.root.findByProps({ "aria-label": "Copiar 22h" });
    await act(async () => { await tokenCopyButton.props.onClick(); });
    expect(writeText).toHaveBeenCalledWith("22h");
    const applyButton = renderer.root.findByProps({ "aria-label": "Aplicar 22h ao formulário" });
    await act(async () => { applyButton.props.onClick(); });
    const dateTimeInput = renderer.root.findAll(node => node.props.type === "datetime-local")[0];
    expect(dateTimeInput.props.value).toMatch(/T22:00$/);
    expect(JSON.stringify(renderer.toJSON())).toContain("Aplicado!");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });

  it("exibe o texto bruto na prévia da edição assistida", () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<ManualReviewPanel />); });
    const editButton = renderer.root.findByProps({ "data-testid": "manual-review-edit-7" });
    expect(editButton).toBeTruthy();
    act(() => { editButton.props.onClick(); });
    const preview = renderer.root.findByProps({ "data-testid": "manual-review-source-preview" });
    expect(preview).toBeTruthy();
    expect(JSON.stringify(renderer.toJSON())).toContain("Festa");
    expect(renderer.root.findByProps({ children: "Texto original da publicação" })).toBeTruthy();
    expect(JSON.stringify(renderer.toJSON())).toContain("Nenhuma edição manual registrada.");
  });

  it("exibe alterações manuais com valores anterior e posterior", () => {
    state.auditHistory.data = [{ id: 31, action: "edited", changedByOpenId: "admin-1", createdAt: "2026-09-19T12:00:00.000Z", changes: [{ field: "eventDate", before: "2026-09-19T21:00:00.000Z", after: "2026-09-20T22:00:00.000Z" }] }];
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<ManualReviewPanel />); });
    act(() => { renderer.root.findByProps({ "data-testid": "manual-review-edit-7" }).props.onClick(); });
    const rendered = JSON.stringify(renderer.toJSON());
    expect(rendered).toContain("Edição manual");
    expect(rendered).toContain("Data e hora");
    expect(rendered).toContain("admin-1");
    state.auditHistory.data = [];
    renderer.unmount();
  });

  it("seleciona todos os pendentes visíveis e envia IDs deduplicados para aprovação", () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<ManualReviewPanel />); });
    const selectAll = renderer.root.findByProps({ "aria-label": "Selecionar todos os eventos pendentes visíveis" });
    act(() => { selectAll.props.onChange({ target: { checked: true } }); });
    const approveButton = renderer.root.findByProps({ "data-testid": "manual-review-approve-many" });
    act(() => { approveButton.props.onClick(); });
    expect(state.approveMany).toHaveBeenCalledWith({ ids: [7, 8] });
  });

  it("oferece Desfazer no toast após aprovação individual", () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<ManualReviewPanel />); });
    act(() => { state.approveOptions.onSuccess({ ...state.queue.data.items[0], status: "approved" }); });
    const toastOptions = state.toastSuccess.mock.calls.at(-1)?.[1] as { action?: { label: string } };
    expect(toastOptions.action?.label).toBe("Desfazer");
    renderer.unmount();
  });
});
