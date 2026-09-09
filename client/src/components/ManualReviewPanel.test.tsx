import React from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  approveMany: vi.fn(),
  rejectMany: vi.fn(),
  queue: {
    data: {
      items: [
        { id: 7, sourceUrl: "https://instagram.com/meulugar.bar", sourceType: "instagram", title: "Sábado no Bar", summary: "Festa", eventDate: "2026-12-12T01:00:00.000Z", endDate: null, locationName: "Meu Lugar", address: null, city: "Santos", category: "balada", genre: null, priceCents: 0, imageUrl: null, rawText: "Festa", reason: "campos_parciais", status: "pending", reviewedBy: null, reviewedAt: null, publishedEventId: null, createdAt: "2026-09-09T10:00:00.000Z", updatedAt: "2026-09-09T10:00:00.000Z" },
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
}));

vi.mock("@/lib/trpc", () => ({
  trpc: { adminRoutine: { manualReview: {
    list: { useQuery: () => state.queue },
    metrics: { useQuery: () => state.metrics },
    update: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    approve: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    reject: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    approveMany: { useMutation: () => ({ isPending: false, mutate: state.approveMany }) },
    rejectMany: { useMutation: () => ({ isPending: false, mutate: state.rejectMany }) },
  } } },
}));
vi.mock("@/lib/adminFeedback", () => ({ friendlyAdminErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ManualReviewPanel, { draftFromEvent, localDateTimeToIso, toDateTimeLocal } from "./ManualReviewPanel";

describe("ManualReviewPanel helpers", () => {
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
});
