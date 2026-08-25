import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

let mapMounts = 0;
let boundaryAttempts = 0;
let lastMapProps: { latitude?: number; longitude?: number; address?: string | null; eventDate?: string | number | Date | null; googleMapsUrl?: string; appleMapsUrl?: string } = {};

vi.mock("@/components/ErrorBoundary", () => ({
  default: ({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) => {
    if (boundaryAttempts === 0) {
      boundaryAttempts += 1;
      return <>{fallback}</>;
    }
    return <>{children}</>;
  },
}));

vi.mock("@/components/OpenStreetMapView", () => ({
  default: (props: { latitude?: number; longitude?: number }) => {
    mapMounts += 1;
    lastMapProps = props;
    return <div data-testid="map-loaded">Mapa carregado</div>;
  },
}));

import EventDetailMap, { buildAppleMapsRouteUrl, buildGoogleMapsRouteUrl, hasValidCoordinates } from "./EventDetailMap";

describe("EventDetailMap", () => {
  const event = { title: "Festa", locationName: "Ativa House", address: "Rua Exemplo, 10", city: "Santos" };

  it("não renderiza o provedor quando as coordenadas são nulas", () => {
    const markup = renderToStaticMarkup(<EventDetailMap event={event} />);
    expect(hasValidCoordinates(null, null)).toBe(false);
    expect(markup).toContain("Mapa temporariamente indisponível");
    expect(markup).toContain("Ver rota no Google Maps");
    expect(markup).toContain("Mapa indisponível");
    expect(markup).toContain('type="button"');
    expect(markup).not.toContain("Carregando mapa");
  });

  it("gera rota por coordenadas válidas e expõe pontos próximos", () => {
    const withCoordinates = { ...event, latitude: "-23.961", longitude: "-46.332" };
    expect(hasValidCoordinates(withCoordinates.latitude, withCoordinates.longitude)).toBe(true);
    expect(buildGoogleMapsRouteUrl(withCoordinates)).toContain(encodeURIComponent("-23.961,-46.332"));
    expect(buildAppleMapsRouteUrl(withCoordinates)).toContain(encodeURIComponent("-23.961,-46.332"));
    const markup = renderToStaticMarkup(<EventDetailMap event={withCoordinates} />);
    expect(markup).toContain("Traçar rota");
    expect(markup).toContain("Pontos próximos");
    expect(markup).toContain("Como chegar no Google Maps");
    expect(markup).toContain("Abrir no Apple Maps");
  });

  it("remonta o mapa após uma falha de rede ao clicar em Tentar novamente", async () => {
    mapMounts = 0;
    boundaryAttempts = 0;
    lastMapProps = {};
    const withCoordinates = { ...event, address: "Rua Exemplo, 10", eventDate: "2026-09-12T22:00:00.000Z", latitude: "-23.961", longitude: "-46.332" };
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(<EventDetailMap event={withCoordinates} />, { unstable_isConcurrent: false } as never);
      await Promise.resolve();
    });

    const retryButton = renderer!.root.findAll(node => node.type === "button")[0];
    const retryText = Array.isArray(retryButton.props.children) ? retryButton.props.children.filter((child: unknown): child is string => typeof child === "string").join(" ") : String(retryButton.props.children);
    expect(retryText).toContain("Tentar novamente");
    expect(mapMounts).toBe(0);

    await act(async () => {
      retryButton.props.onClick();
      await Promise.resolve();
    });

    expect(mapMounts).toBe(1);
    expect(lastMapProps).toMatchObject({ latitude: -23.961, longitude: -46.332, address: "Rua Exemplo, 10", eventDate: "2026-09-12T22:00:00.000Z" });
    expect(lastMapProps.googleMapsUrl).toContain(encodeURIComponent("-23.961,-46.332"));
    expect(lastMapProps.appleMapsUrl).toContain(encodeURIComponent("-23.961,-46.332"));
    expect(renderer!.root.findByProps({ "data-testid": "map-loaded" }).props.children).toBe("Mapa carregado");
    renderer!.unmount();
  });
});
