import { describe, expect, it } from "vitest";
import { directionsUrl } from "./RegionalEventMap";

describe("directionsUrl", () => {
  it("gera uma rota de carro para o destino do evento", () => {
    const url = directionsUrl({ title: "Show", latitude: "-23.9601", longitude: "-46.3322" });
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=-23.9601%2C-46.3322&travelmode=driving");
  });

  it("retorna null quando o evento não tem coordenadas", () => {
    expect(directionsUrl({ title: "Sem mapa", latitude: null, longitude: "-46.33" })).toBeNull();
  });
});
