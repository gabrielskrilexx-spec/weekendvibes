import { describe, expect, it } from "vitest";
import { extractNeighborhood, getRegionalFallback, isWithinRegionalBounds, normalizeLocationText } from "./location";

describe("location helpers", () => {
  it("remove ruídos de legenda e preserva a consulta de endereço", () => {
    expect(normalizeLocationText("📍 Rua Tolentino Filgueiras, 42 #Santos\nIngressos no link da bio")).toBe("Rua Tolentino Filgueiras, 42");
  });

  it("extrai bairros conhecidos por cidade", () => {
    expect(extractNeighborhood("Av. Ana Costa, Gonzaga, Santos", "", "Santos")).toBe("Gonzaga");
    expect(extractNeighborhood("Enseada - Guarujá", "", "Guarujá")).toBe("Enseada");
  });

  it("mantém fallbacks dentro da região da Baixada Santista", () => {
    const fallback = getRegionalFallback(42, "Santos", "Gonzaga", "");
    expect(isWithinRegionalBounds(Number(fallback.latitude), Number(fallback.longitude))).toBe(true);
    expect(fallback.neighborhood).toBe("Gonzaga");
  });
});
