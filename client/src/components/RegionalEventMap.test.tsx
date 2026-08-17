import { describe, expect, it } from "vitest";
import { directionsUrl } from "./RegionalEventMap";

describe("directionsUrl", () => {
  it("gera uma rota de carro para o destino do evento", () => {
    const url = directionsUrl({ title: "Show", latitude: "-23.9601", longitude: "-46.3322" });
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=-23.9601%2C-46.3322&travelmode=driving");
  });

  it("usa o centro de Santos como destino aproximado quando faltam coordenadas", () => {
    expect(directionsUrl({ title: "Sem mapa", latitude: null, longitude: "-46.33", city: "Santos" })).toContain("destination=-23.9608%2C-46.3336");
  });
});
