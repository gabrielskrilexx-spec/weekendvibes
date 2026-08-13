import React from "react";
import { vi } from "vitest";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AgendaWeekHighlight from "./AgendaWeekHighlight";

vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));

const event = { id: 1, slug: "sexta-no-moby", title: "Sexta no Moby", city: "Santos", eventDate: "2026-08-14T22:00:00.000Z", locationName: "Moby House", imageUrl: null };

describe("AgendaWeekHighlight", () => {
  it("renderiza loading, empty e success", () => {
    expect(renderToStaticMarkup(<AgendaWeekHighlight state="loading" events={[]} />)).toContain("Carregando Agenda da Semana");
    expect(renderToStaticMarkup(<AgendaWeekHighlight state="empty" events={[]} />)).toContain("Nenhum evento recente da Agenda da Semana");
    expect(renderToStaticMarkup(<AgendaWeekHighlight state="ready" events={[event]} />)).toContain("Sexta no Moby");
  });

  it("destaca o evento substituído com a tag Atualizado", () => {
    const updatedEvent = { ...event, id: 2, slug: "nosso-after-14-08", title: "Nosso After" };
    const updatedMarkup = renderToStaticMarkup(<AgendaWeekHighlight state="ready" events={[updatedEvent]} />);
    const regularMarkup = renderToStaticMarkup(<AgendaWeekHighlight state="ready" events={[event]} />);
    expect(updatedMarkup).toContain("Atualizado");
    expect(updatedMarkup).toContain("aria-label=\"Evento atualizado\"");
    expect(regularMarkup).not.toContain("Atualizado");
  });
});
