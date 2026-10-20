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
    expect(initial).toContain("Vallum Garden");
    expect(initial).toContain("Arena Club");
    expect(initial).toContain("Laroc Club Guarujá");
    expect(initial).toContain("Guarujá Golf Club");
    expect(initial).toContain("Goat Club");
    expect(initial).toContain("https://weekendvib-jscaalye.manus.space/manus-storage/laroc-guaruja_13c232b6.jpg");
    expect(initial).toContain("Guarujá");
    expect(initial).toContain("https://weekendvib-jscaalye.manus.space/manus-storage/santos-convention-center-fachada_67f02d28.jpg");
    expect(initial).not.toContain("SHOW-ROBERTO-CARLOS.png");
    const selected = renderToStaticMarkup(<VenueSpotlight selectedVenue="blue-med" onSelect={vi.fn()} events={[event]} />);
    expect(selected).toContain('role="dialog"');
    expect(selected).toContain("Pagodin com Belo");
    expect(selected).toContain('aria-label="Fechar detalhes do local"');
    const guaruja = renderToStaticMarkup(<VenueSpotlight selectedVenue="laroc-guaruja" onSelect={vi.fn()} events={[]} />);
    expect(guaruja).toContain("Sunset e beach club de música eletrônica à beira-mar.");
    expect(guaruja).toContain("Praia do Perequê");
  });
});
