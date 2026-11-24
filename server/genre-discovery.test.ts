import { describe, expect, it } from "vitest";
import { candidateUrl, classifyDiscoveryGenres, detectDiscoveryCity, isFutureDiscoveryDate, pageToDiscoveryCandidate } from "./genre-discovery";

describe("Radar de descoberta por estilo", () => {
  it("classifica todos os gêneros que aparecem no conjunto de textos", () => {
    expect(classifyDiscoveryGenres({ title: "Trap & Rap", description: "Baile Funk com DJ e house eletrônica" })).toEqual(["trap", "rap", "funk", "eletrônica"]);
  });

  it("aceita apenas as cinco cidades da Baixada configuradas para o Radar", () => {
    expect(detectDiscoveryCity("Evento no Espaço X, Praia Grande - SP")).toBe("Praia Grande");
    expect(detectDiscoveryCity("Rio de Janeiro")).toBeUndefined();
  });

  it("rejeita datas passadas e aceita datas futuras", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    expect(isFutureDiscoveryDate("2026-11-25T02:00:00-03:00", now)).toBe(true);
    expect(isFutureDiscoveryDate("2026-11-23T02:00:00-03:00", now)).toBe(false);
  });

  it("normaliza URL e registra todos os gêneros no candidato", () => {
    const candidate = pageToDiscoveryCandidate({
      url: "https://www.sympla.com.br/evento/trap-rap-santos/123?utm_source=foo",
      text: "Trap Rap Santos; funk e DJ, próximo sábado",
      imageUrl: "https://img.example/flyer.jpg",
      structured: { title: "Trap Rap Santos", startDate: "2026-12-05T23:00:00-03:00", city: "Santos", locationName: "Arena" },
    }, new Date("2026-11-24T12:00:00.000Z"));
    expect(candidate).toMatchObject({ canonicalUrl: "https://www.sympla.com.br/evento/trap-rap-santos/123", city: "Santos", flyerUrl: "https://img.example/flyer.jpg" });
    expect(candidate?.matchedGenres).toEqual(expect.arrayContaining(["trap", "rap", "funk", "eletrônica"]));
  });

  it("mantém URLs rejeitadas estáveis para bloqueio idempotente", () => {
    expect(candidateUrl("https://articket.com.br/e/123/festa?fbclid=tracking")).toBe("https://articket.com.br/e/123/festa");
  });
});
