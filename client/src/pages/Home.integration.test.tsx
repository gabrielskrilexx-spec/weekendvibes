import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  events: { data: [] as Array<{ id: number; title: string }>, isLoading: false, isError: false },
  user: null as { role: string } | null,
}));

vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: { me: { useQuery: () => ({ data: mocks.user }) } },
    events: {
      list: { useQuery: () => mocks.events },
      today: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
      favoriteIds: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
      reminders: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
      toggleFavorite: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      setReminder: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
  },
}));

vi.mock("@/components/EventCard", () => ({ default: ({ event }: { event: { title: string } }) => <div>{event.title}</div> }));

import Home from "./Home";

describe("Home pública simplificada", () => {
  it("oculta o link administrativo para usuários não administradores", () => {
    mocks.user = null;
    expect(renderToStaticMarkup(<Home />)).not.toContain("Painel Administrativo");
    mocks.user = { role: "user" };
    expect(renderToStaticMarkup(<Home />)).not.toContain("Painel Administrativo");
  });

  it("exibe o link administrativo somente para administradores", () => {
    mocks.user = { role: "admin" };
    const markup = renderToStaticMarkup(<Home />);
    expect(markup).toContain('href="/admin/health"');
    expect(markup).toContain("Painel Administrativo");
  });

  it("renderiza estados e cards do catálogo principal sem a seção de diagnóstico", () => {
    mocks.user = null;
    mocks.events = { data: [], isLoading: true, isError: false };
    expect(renderToStaticMarkup(<Home />)).toContain("Agenda em destaque");

    mocks.events = { data: [], isLoading: false, isError: false };
    const emptyMarkup = renderToStaticMarkup(<Home />);
    expect(emptyMarkup).toContain("Nenhum evento encontrado com esses filtros");
    expect(emptyMarkup).not.toContain("Capturado Recentemente");
    expect(emptyMarkup).not.toContain("Capturado hoje");

    mocks.events = { data: [{ id: 9, title: "Agenda Moby" }], isLoading: false, isError: false };
    expect(renderToStaticMarkup(<Home />)).toContain("Agenda Moby");
  });
});
