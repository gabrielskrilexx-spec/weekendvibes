import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({
  query: { data: [{ key: "1:2", similarity: 0.82, civilDate: "2026-09-05", venue: "Laroc Club Guarujá", recommendedKeepId: 1, left: { id: 1, title: "Laroc Guarujá apresenta Meduza", eventDate: new Date("2026-09-05T13:00:00-03:00"), locationName: "Laroc Club Guarujá", city: "Guarujá", priceCents: 12000, imageUrl: "image", latitude: "-23", longitude: "-46", sourceUrl: "source" }, right: { id: 2, title: "Laroc Guarujá apresenta: Meduza", eventDate: new Date("2026-09-05T16:00:00-03:00"), locationName: "Laroc Club Guarujá", city: "Guarujá", priceCents: 0, imageUrl: "image", latitude: null, longitude: null, sourceUrl: "other" } }], isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }, remove: { isPending: false, mutate: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({ trpc: { collisionReview: { list: { useQuery: () => state.query } }, events: { remove: { useMutation: () => state.remove }, list: { invalidate: vi.fn() } }, useUtils: () => ({ events: { list: { invalidate: vi.fn() } } }) } }));

import CollisionReviewPanel from "./CollisionReviewPanel";

describe("CollisionReviewPanel", () => {
  it("exibe a colisão, a similaridade e a recomendação sem apagar automaticamente", () => {
    const markup = renderToStaticMarkup(<CollisionReviewPanel />);
    expect(markup).toContain("Revisar possíveis colisões");
    expect(markup).toContain("Similaridade 82%");
    expect(markup).toContain("Sugerido");
    expect(markup).toContain("Excluir duplicata sugerida");
    expect(state.remove.mutate).not.toHaveBeenCalled();
  });
});
