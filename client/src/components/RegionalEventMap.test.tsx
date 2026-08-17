import { describe, expect, it } from "vitest";
import { directionsUrl, visibleEventIdsForBounds } from "./RegionalEventMap";

describe("directionsUrl", () => {
  it("gera uma rota de carro para o destino do evento", () => {
    const url = directionsUrl({ title: "Show", latitude: "-23.9601", longitude: "-46.3322" });
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=-23.9601%2C-46.3322&travelmode=driving");
  });

  it("usa o centro de Santos como destino aproximado quando faltam coordenadas", () => {
    expect(directionsUrl({ title: "Sem mapa", latitude: null, longitude: "-46.33", city: "Santos" })).toContain("destination=-23.9608%2C-46.3336");
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
