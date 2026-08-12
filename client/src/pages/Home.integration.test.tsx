import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  events: { data: [], isLoading: false, isError: false },
  agenda: { data: undefined as unknown, isLoading: true, isError: false },
}));

vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    events: {
      list: { useQuery: () => mocks.events },
      recentInstagramAgenda: { useQuery: () => mocks.agenda },
    },
  },
}));

vi.mock("@/components/Map", () => ({ MapView: () => <div data-testid="map-mock" /> }));
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
  it("renderiza loading, empty e success a partir da query dedicada", () => {
    mocks.agenda = { data: undefined, isLoading: true, isError: false };
    expect(renderToStaticMarkup(<Home />)).toContain("Carregando Agenda da Semana");

    mocks.agenda = { data: [], isLoading: false, isError: false };
    expect(renderToStaticMarkup(<Home />)).toContain("Nenhum evento recente da Agenda da Semana");

    mocks.agenda = { data: [agendaEvent], isLoading: false, isError: false };
    expect(renderToStaticMarkup(<Home />)).toContain("Agenda Moby");
  });
});
