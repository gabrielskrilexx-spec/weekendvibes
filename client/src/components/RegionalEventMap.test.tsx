import { describe, expect, it } from "vitest";
import { directionsUrl, locationControlLabel, MAP_LEGEND_ITEMS, markerTooltipContent, routeDetailsFromResult, routeOptionsFromResult, shouldShowTouchTooltip, visibleEventIdsForBounds } from "./RegionalEventMap";
import { ShortLivedCache } from "@/lib/shortLivedCache";

describe("map legend and touch interaction", () => {
  it("documenta cidades, agrupamentos e precisão aproximada", () => {
    expect(MAP_LEGEND_ITEMS.map(item => item.key)).toEqual(["santos", "guaruja", "cluster", "approximate"]);
    expect(MAP_LEGEND_ITEMS.map(item => item.label)).toEqual(["Santos", "Guarujá", "Número", "Aproximado"]);
  });

  it("mantém o resumo no primeiro toque e permite abrir detalhes no segundo", () => {
    expect(shouldShowTouchTooltip(null, "santos")).toBe(true);
    expect(shouldShowTouchTooltip("guaruja", "santos")).toBe(true);
    expect(shouldShowTouchTooltip("santos", "santos")).toBe(false);
  });
});

describe("markerTooltipContent", () => {
  it("exibe cidade, contagem, locais e sinalização de precisão aproximada", () => {
    const content = markerTooltipContent({ id: "santos", city: "Santos", latitude: -23.96, longitude: -46.33, approximate: true, events: [
      { id: 1, title: "Rolê <script>", slug: "role", locationName: "Moby House", city: "Santos", latitude: "-23.96", longitude: "-46.33" },
      { id: 2, title: "Outro", slug: "outro", locationName: "Meu Lugar", city: "Santos", latitude: "-23.96", longitude: "-46.33" },
    ] });
    expect(content).toContain("Santos");
    expect(content).toContain("2 rolês");
    expect(content).toContain("Moby House · Meu Lugar");
    expect(content).toContain("Endereço aproximado");
    expect(content).not.toContain("<script>");
  });

  it("limita a lista de locais e informa itens adicionais", () => {
    const content = markerTooltipContent({ id: "guaruja", city: "Guarujá", latitude: -23.99, longitude: -46.25, approximate: false, events: [
      { id: 1, title: "A", slug: "a", locationName: "A", city: "Guarujá", latitude: "-23.99", longitude: "-46.25" },
      { id: 2, title: "B", slug: "b", locationName: "B", city: "Guarujá", latitude: "-23.99", longitude: "-46.25" },
      { id: 3, title: "C", slug: "c", locationName: "C", city: "Guarujá", latitude: "-23.99", longitude: "-46.25" },
      { id: 4, title: "D", slug: "d", locationName: "D", city: "Guarujá", latitude: "-23.99", longitude: "-46.25" },
    ] });
    expect(content).toContain("4 rolês +1");
    expect(content).toContain("A · B · C");
    expect(content).not.toContain("A · B · C · D");
  });
});

describe("directionsUrl", () => {
  it("gera uma rota de carro para o destino do evento", () => {
    const url = directionsUrl({ title: "Show", latitude: "-23.9601", longitude: "-46.3322" });
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=-23.9601%2C-46.3322&travelmode=driving");
  });

  it("usa o centro de Santos como destino aproximado quando faltam coordenadas", () => {
    expect(directionsUrl({ title: "Sem mapa", latitude: null, longitude: "-46.33", city: "Santos" })).toContain("destination=-23.9608%2C-46.3336");
  });
});

describe("routeDetailsFromResult", () => {
  it("normaliza distância, duração e até cinco instruções da rota", () => {
    const details = routeDetailsFromResult({ routes: [{ legs: [{ distance: { text: "8,4 km" }, duration: { text: "24 min" }, steps: [{ instructions: "Siga <b>em frente</b>" }, { instructions: "Vire à direita" }, { instructions: "Continue" }, { instructions: "A" }, { instructions: "B" }, { instructions: "Ignorada" }] }] }] });
    expect(details).toEqual({ distanceText: "8,4 km", durationText: "24 min", steps: ["Siga em frente", "Vire à direita", "Continue", "A", "B"] });
  });

  it("retorna nulo quando a API não entrega uma perna válida", () => {
    expect(routeDetailsFromResult({ routes: [] })).toBeNull();
  });
});

describe("route cache", () => {
  it("retém uma consulta até o TTL e expira depois dele", () => {
    const cache = new ShortLivedCache<string>(60_000, 2);
    cache.set("route", "cached", 1_000);
    expect(cache.get("route", 60_999)).toBe("cached");
    expect(cache.get("route", 61_000)).toBeNull();
  });

  it("limita entradas removendo a mais antiga", () => {
    const cache = new ShortLivedCache<string>(60_000, 2);
    cache.set("a", "A", 1);
    cache.set("b", "B", 2);
    cache.set("c", "C", 3);
    expect(cache.get("a", 4)).toBeNull();
    expect(cache.get("b", 4)).toBe("B");
    expect(cache.size).toBe(2);
  });
});

describe("Routes API e localização", () => {
  it("normaliza distância, duração e instruções do formato nativo da Routes API", () => {
    const routes = routeOptionsFromResult({ routes: [{ distanceMeters: 8400, duration: "1440s", localizedValues: { distance: { text: "8,4 km" }, duration: { text: "24 min" } }, legs: [{ steps: [{ instructions: "Siga em frente" }] }] }] });
    expect(routes[0]).toEqual({ distanceText: "8,4 km", durationText: "24 min", steps: ["Siga em frente"] });
  });

  it("mantém rótulos claros nos estados do botão de localização", () => {
    expect(locationControlLabel("loading")).toBe("Localizando…");
    expect(locationControlLabel("ready")).toBe("Minha localização");
    expect(locationControlLabel("denied")).toBe("Usar minha localização");
  });
});

describe("routeOptionsFromResult", () => {
  it("normaliza e preserva rotas alternativas válidas", () => {
    const routes = routeOptionsFromResult({ routes: [
      { legs: [{ distance: { text: "8 km" }, duration: { text: "20 min" }, steps: [{ instructions: "Siga" }] }] },
      { legs: [{ distance: { text: "10 km" }, duration: { text: "18 min" }, steps: [{ instructions: "Vire" }] }] },
    ] });
    expect(routes).toHaveLength(2);
    expect(routes[1]).toEqual({ distanceText: "10 km", durationText: "18 min", steps: ["Vire"] });
  });
});

describe("visibleEventIdsForBounds", () => {
  it("retorna apenas os eventos dentro do viewport em ordem estável", () => {
    const events = [
      { id: 4, city: "Santos", latitude: "-23.96", longitude: "-46.33", title: "A", slug: "a", locationName: "Local A" },
      { id: 2, city: "Guarujá", latitude: "-23.99", longitude: "-46.25", title: "B", slug: "b", locationName: "Local B" },
      { id: 7, city: "Santos", latitude: "-23.90", longitude: "-46.30", title: "C", slug: "c", locationName: "Local C" },
    ];
    const ids = visibleEventIdsForBounds(events, { contains: point => point.lat < -23.94 });
    expect(ids).toEqual([2, 4]);
  });
});
