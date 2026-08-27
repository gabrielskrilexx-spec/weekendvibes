import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({
  query: { data: [{ key: "1:2", similarity: 0.82, civilDate: "2026-09-05", venue: "Laroc Club Guarujá", recommendedKeepId: 1, left: { id: 1, title: "Laroc Guarujá apresenta Meduza", eventDate: new Date("2026-09-05T13:00:00-03:00"), locationName: "Laroc Club Guarujá", city: "Guarujá", priceCents: 12000, imageUrl: "image", latitude: "-23", longitude: "-46", sourceUrl: "source" }, right: { id: 2, title: "Laroc Guarujá apresenta: Meduza", eventDate: new Date("2026-09-05T16:00:00-03:00"), locationName: "Laroc Club Guarujá", city: "Guarujá", priceCents: 0, imageUrl: "image", latitude: null, longitude: null, sourceUrl: "other" } }], isLoading: false, isError: false, isFetching: false, refetch: vi.fn() },
  remove: { isPending: false, mutate: vi.fn() },
  resolveMany: { isPending: false, mutate: vi.fn() },
}));
vi.mock("@/lib/trpc", () => ({ trpc: { collisionReview: { list: { useQuery: () => state.query }, resolveMany: { useMutation: () => state.resolveMany } }, events: { remove: { useMutation: () => state.remove }, list: { invalidate: vi.fn() } }, useUtils: () => ({ events: { list: { invalidate: vi.fn() } } }) } }));

import CollisionReviewPanel, { getDeleteCollisionErrorMessage, removeCollisionByDeletedId } from "./CollisionReviewPanel";

describe("CollisionReviewPanel", () => {
  it("mapeia falhas tRPC para mensagens descritivas e sanitizadas", () => {
    expect(getDeleteCollisionErrorMessage({ message: "Unable to transform response from server" })).toContain("serializar");
    expect(getDeleteCollisionErrorMessage({ message: "Foreign key constraint failed" })).toContain("dependências");
    expect(getDeleteCollisionErrorMessage({ message: "Database unavailable" })).toContain("indisponível");
  });

  it("remove imediatamente do cache a colisão correspondente ao deletedId", () => {
    const rows = [{ left: { id: 10 }, right: { id: 20 } }, { left: { id: 30 }, right: { id: 40 } }];
    expect(removeCollisionByDeletedId(rows, "20")).toEqual([{ left: { id: 30 }, right: { id: 40 } }]);
    expect(removeCollisionByDeletedId(rows, "999")).toEqual(rows);
  });

  it("exibe a colisão, a similaridade, a recomendação e a seleção em massa sem apagar automaticamente", () => {
    const markup = renderToStaticMarkup(<CollisionReviewPanel />);
    expect(markup).toContain("Revisar possíveis colisões");
    expect(markup).toContain("Similaridade 82%");
    expect(markup).toContain("Sugerido");
    expect(markup).toContain("Excluir duplicata sugerida");
    expect(markup).toContain("Selecionar todas as colisões");
    expect(markup).not.toContain("Aprovar selecionadas");
    expect(state.remove.mutate).not.toHaveBeenCalled();
  });
});
