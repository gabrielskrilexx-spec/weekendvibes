import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EventDetailMap, { buildGoogleMapsRouteUrl, hasValidCoordinates } from "./EventDetailMap";

describe("EventDetailMap", () => {
  const event = { title: "Festa", locationName: "Ativa House", address: "Rua Exemplo, 10", city: "Santos" };

  it("não renderiza o provedor quando as coordenadas são nulas", () => {
    const markup = renderToStaticMarkup(<EventDetailMap event={event} />);
    expect(hasValidCoordinates(null, null)).toBe(false);
    expect(markup).toContain("Mapa temporariamente indisponível");
    expect(markup).toContain("Ver rota no Google Maps");
    expect(markup).toContain("Tentar novamente");
    expect(markup).toContain('type="button"');
    expect(markup).not.toContain("Carregando mapa");
  });

  it("gera rota por coordenadas válidas e expõe pontos próximos", () => {
    const withCoordinates = { ...event, latitude: "-23.961", longitude: "-46.332" };
    expect(hasValidCoordinates(withCoordinates.latitude, withCoordinates.longitude)).toBe(true);
    expect(buildGoogleMapsRouteUrl(withCoordinates)).toContain(encodeURIComponent("-23.961,-46.332"));
    const markup = renderToStaticMarkup(<EventDetailMap event={withCoordinates} />);
    expect(markup).toContain("Traçar rota");
    expect(markup).toContain("Pontos próximos");
  });
});
