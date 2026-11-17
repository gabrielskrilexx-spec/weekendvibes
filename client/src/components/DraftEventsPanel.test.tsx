import React from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  publish: vi.fn(),
  remove: vi.fn(),
  query: {
    data: {
      items: [{ id: 101, title: "Festa pendente", eventDate: "2030-08-24T01:00:00.000Z", locationName: "Arena Club", address: "Av. Senador Pinheiro Machado, 33", city: "Santos", category: "balada", genre: "funk", sourceUrl: "https://www.instagram.com/p/festa/", sourceType: "instagram_story", imageUrl: null, createdAt: "2030-08-20T10:00:00.000Z", updatedAt: "2030-08-20T10:00:00.000Z" }],
      total: 1,
      limit: 50,
    },
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  },
  publishOptions: null as any,
  removeOptions: null as any,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    events: {
      drafts: { useQuery: () => state.query },
      publishMany: { useMutation: (options: any) => { state.publishOptions = options; return { isPending: false, mutate: state.publish }; } },
      removeMany: { useMutation: (options: any) => { state.removeOptions = options; return { isPending: false, mutate: state.remove }; } },
    },
  },
}));
vi.mock("@/lib/adminFeedback", () => ({ friendlyAdminErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import DraftEventsPanel from "./DraftEventsPanel";

describe("DraftEventsPanel", () => {
  beforeEach(() => {
    state.publish.mockClear();
    state.remove.mockClear();
    state.query.refetch.mockClear();
    state.publishOptions = null;
    state.removeOptions = null;
  });

  it("exibe rascunhos Instagram e permite selecionar todos para publicação", () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<DraftEventsPanel />); });
    expect(JSON.stringify(renderer.toJSON())).toContain("Festa pendente");
    expect(JSON.stringify(renderer.toJSON())).toContain("Rascunho");
    const selectAll = renderer.root.findByProps({ "aria-label": "Selecionar todos os rascunhos visíveis" });
    act(() => { selectAll.props.onChange({ target: { checked: true } }); });
    const publishButton = renderer.root.findByProps({ "data-testid": "draft-events-publish-many" });
    act(() => { publishButton.props.onClick(); });
    expect(state.publish).toHaveBeenCalledWith({ ids: [101] });
  });

  it("usa confirmação antes de excluir um rascunho individual", () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("window", { confirm });
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<DraftEventsPanel />); });
    const removeButton = renderer.root.findByProps({ "aria-label": "Excluir rascunho Festa pendente" });
    act(() => { removeButton.props.onClick(); });
    expect(confirm).toHaveBeenCalledWith("Excluir 1 rascunho(s)? Esta ação não pode ser desfeita.");
    expect(state.remove).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
