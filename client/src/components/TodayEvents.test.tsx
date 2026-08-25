import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({ query: { data: undefined as unknown, isLoading: true, isError: false } }));

vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/trpc", () => ({ trpc: { events: { today: { useQuery: () => state.query } } } }));
vi.mock("@/components/EventCard", () => ({ default: ({ event }: { event: { title: string } }) => <article>{event.title}</article> }));

import TodayEvents from "./TodayEvents";

describe("TodayEvents", () => {
  it("renderiza loading, vazio, erro e sucesso", () => {
    state.query = { data: undefined, isLoading: true, isError: false };
    expect(renderToStaticMarkup(<TodayEvents />)).toContain("Buscando os rolês de hoje");

    state.query = { data: [], isLoading: false, isError: false };
    const emptyMarkup = renderToStaticMarkup(<TodayEvents />);
    expect(emptyMarkup).toContain("Ainda não há eventos confirmados para hoje");
    expect(emptyMarkup).toContain("Ver os rolês do fim de semana");
    expect(emptyMarkup).toContain('href="/#filtros"');

    state.query = { data: undefined, isLoading: false, isError: true };
    expect(renderToStaticMarkup(<TodayEvents />)).toContain("Não foi possível carregar os eventos de hoje");

    state.query = { data: [{ id: 1, title: "Rolê de hoje" }], isLoading: false, isError: false };
    expect(renderToStaticMarkup(<TodayEvents />)).toContain("Rolê de hoje");
  });
});
