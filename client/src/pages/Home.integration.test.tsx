import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  events: { data: [], isLoading: false, isError: false },
  agenda: { data: undefined as unknown, isLoading: true, isError: false },
  user: null as { role: string } | null,
}));

vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ operationalAlerts: { list: { invalidate: vi.fn() } }, events: { favoriteIds: { invalidate: vi.fn() }, reminders: { invalidate: vi.fn() } } }),
    auth: { me: { useQuery: () => ({ data: mocks.user }) } },
    operationalAlerts: {
      list: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
      resolve: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
    events: {
      list: { useQuery: () => mocks.events },
      recentInstagramAgenda: { useQuery: () => mocks.agenda },
      today: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
      favoriteIds: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
      reminders: { useQuery: () => ({ data: [], isLoading: false, isError: false }) },
      toggleFavorite: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      setReminder: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
  },
}));

vi.mock("@/components/Map", () => ({ MapView: () => <div data-testid="map-mock" />, WEEKENDVIBES_MAP_STYLE: [] }));
vi.mock("@/components/EventCard", () => ({ default: ({ event }: { event: { title: string } }) => <div>{event.title}</div> }));

import Home from "./Home";

const agendaEvent = {
  id: 9,
  slug: "agenda-moby",
  title: "Agenda Moby",
  city: "Santos",
  eventDate: "2026-08-14T22:00:00.000Z",
  locationName: "Moby House",
  imageUrl: null,
};

describe("Home / Agenda da Semana", () => {
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

  it("renderiza loading, empty e success a partir da query dedicada", () => {
    mocks.agenda = { data: undefined, isLoading: true, isError: false };
    expect(renderToStaticMarkup(<Home />)).toContain("Carregando Agenda da Semana");

    mocks.agenda = { data: [], isLoading: false, isError: false };
    expect(renderToStaticMarkup(<Home />)).toContain("Nenhum evento recente da Agenda da Semana");

    mocks.agenda = { data: [agendaEvent], isLoading: false, isError: false };
    mocks.user = null;
    expect(renderToStaticMarkup(<Home />)).toContain("Agenda Moby");
  });
});
