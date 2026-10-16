import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import VenueSpotlight from "./VenueSpotlight";

const event = { id: 1, title: "Pagodin com Belo", eventDate: "2030-11-23T20:00:00-03:00", locationName: "Santos Convention Center" } as never;

describe("VenueSpotlight", () => {
  it("exibe os dois venues e o modal do local selecionado", () => {
    const initial = renderToStaticMarkup(<VenueSpotlight selectedVenue="" onSelect={vi.fn()} events={[]} />);
    expect(initial).toContain("Blue Med Convention Center");
    expect(initial).toContain("Parque Valongo");
    const selected = renderToStaticMarkup(<VenueSpotlight selectedVenue="blue-med" onSelect={vi.fn()} events={[event]} />);
    expect(selected).toContain('role="dialog"');
    expect(selected).toContain("Pagodin com Belo");
    expect(selected).toContain('aria-label="Fechar detalhes do local"');
  });
});
