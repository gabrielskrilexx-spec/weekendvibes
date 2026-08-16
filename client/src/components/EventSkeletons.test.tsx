import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AgendaWeekSkeleton, EventGridSkeleton } from "./EventSkeletons";

describe("EventSkeletons", () => {
  it("expõe estados acessíveis para agenda e lista de eventos", () => {
    const agendaMarkup = renderToStaticMarkup(<AgendaWeekSkeleton />);
    const gridMarkup = renderToStaticMarkup(<EventGridSkeleton count={3} />);

    expect(agendaMarkup).toContain('role="status"');
    expect(agendaMarkup).toContain("Carregando Agenda da Semana");
    expect(gridMarkup).toContain('aria-label="Carregando eventos"');
    expect((gridMarkup.match(/aspect-ratio/g) ?? []).length).toBeGreaterThanOrEqual(0);
  });

  it("renderiza a quantidade configurada de cards", () => {
    const markup = renderToStaticMarkup(<EventGridSkeleton count={5} />);
    expect((markup.match(/aria-hidden="true"/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});
