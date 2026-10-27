import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import VenueSpotlight from "./VenueSpotlight";

const event = { id: 1, title: "Pagodin com Belo", eventDate: "2030-11-23T20:00:00-03:00", locationName: "Santos Convention Center" } as never;

describe("VenueSpotlight", () => {
  it("exibe os venues, endereços corrigidos e controles acessíveis do carrossel", () => {
    const initial = renderToStaticMarkup(<VenueSpotlight selectedVenue="" onSelect={vi.fn()} events={[]} />);
    expect(initial).toContain("Blue Med Convention Center");
    expect(initial).toContain("Parque Valongo");
    expect(initial).toContain("Vallum Garden");
    expect(initial).toContain("Arena Club");
    expect(initial).toContain("Laroc Club Guarujá");
    expect(initial).toContain("Guarujá Golf Club");
    expect(initial).toContain("Curvão Surf House");
    expect(initial).toContain("Goat Club");
    expect(initial).toContain("https://weekendvib-jscaalye.manus.space/manus-storage/laroc-guaruja_13c232b6.jpg");
    expect(initial).toContain("R. Tuyuti, 86");
    expect(initial).toContain("Rua do Comércio, 63");
    expect(initial).toContain("/venues/vallum-garden.webp");
    expect(initial).toContain("/venues/curvao-surf-house.jpg");
    expect(initial).toContain("goat-comercio_72feaa77.jpg");
    expect(initial).toContain('aria-label="Carrossel de espaços da Baixada"');
    expect(initial).toContain('aria-label="Mostrar espaços anteriores"');
    expect(initial).toContain('aria-label="Mostrar próximos espaços"');
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
    const vallum = renderToStaticMarkup(<VenueSpotlight selectedVenue="vallum-garden" onSelect={vi.fn()} events={[]} />);
    expect(vallum).toContain("R. Tuyuti, 86");
    expect(vallum).toContain("/venues/vallum-garden.webp");
    const goat = renderToStaticMarkup(<VenueSpotlight selectedVenue="goat-club" onSelect={vi.fn()} events={[]} />);
    expect(goat).toContain("Rua do Comércio, 63");
    expect(goat).toContain("goat-comercio_72feaa77.jpg");
    const curvao = renderToStaticMarkup(<VenueSpotlight selectedVenue="curvao-surf-house" onSelect={vi.fn()} events={[]} />);
    expect(curvao).toContain("Av. Miguel Estefno, 2435");
    expect(curvao).toContain("Guarujá");
  });
});
