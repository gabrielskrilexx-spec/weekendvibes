import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const startLogin = vi.hoisted(() => vi.fn());
vi.mock("@/const", () => ({ startLogin }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ events: { favoriteIds: { invalidate: vi.fn() }, reminders: { invalidate: vi.fn() } } }),
    events: {
      favoriteIds: { useQuery: () => ({ data: [], isLoading: false }) },
      reminders: { useQuery: () => ({ data: [], isLoading: false }) },
      toggleFavorite: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      setReminder: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
  },
}));

import FavoriteReminderControls from "./FavoriteReminderControls";

describe("FavoriteReminderControls", () => {
  it("orienta visitantes a entrar para salvar preferências", () => {
    const html = renderToStaticMarkup(<FavoriteReminderControls eventId={42} />);
    expect(html).toContain("Favoritar");
    expect(html).toContain("Entrar para salvar");
    expect(html).not.toContain("Lembrar-me");
  });
});
