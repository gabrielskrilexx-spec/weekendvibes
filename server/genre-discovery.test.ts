import { describe, expect, it } from "vitest";
import { candidateUrl, classifyDiscoveryGenres, detectDiscoveryCity, isFutureDiscoveryDate, pageToDiscoveryCandidate } from "./genre-discovery";

describe("Radar de descoberta por estilo", () => {
  it("classifica todos os gêneros que aparecem no conjunto de textos", () => {
    expect(classifyDiscoveryGenres({ title: "Trap & Rap", description: "Baile Funk com DJ e house eletrônica" })).toEqual(["trap", "rap", "funk", "eletrônica"]);
  });

  it("aceita exclusivamente Santos e Guarujá", () => {
    expect(detectDiscoveryCity("Evento no Espaço X, Santos - SP")).toBe("Santos");
    expect(detectDiscoveryCity("Evento no Espaço X, Guarujá - SP")).toBe("Guarujá");
    expect(detectDiscoveryCity("Evento no Espaço X, Praia Grande - SP")).toBeUndefined();
    expect(detectDiscoveryCity("Rio de Janeiro")).toBeUndefined();
  });

  it("rejeita datas passadas e aceita datas futuras", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    expect(isFutureDiscoveryDate("2026-11-25T02:00:00-03:00", now)).toBe(true);
    expect(isFutureDiscoveryDate("2026-11-23T02:00:00-03:00", now)).toBe(false);
  });

  it("normaliza URL e registra os gêneros musicais reais no candidato", () => {
    const candidate = pageToDiscoveryCandidate({
      url: "https://www.sympla.com.br/evento/trap-rap-santos/123?utm_source=foo",
      text: "Trap Rap Santos; funk e house eletrônica, próximo sábado",
      imageUrl: "https://img.example/flyer.jpg",
      structured: { title: "Trap Rap Santos", startDate: "2026-12-05T23:00:00-03:00", city: "Santos", locationName: "Arena" },
    }, new Date("2026-11-24T12:00:00.000Z"));
    expect(candidate).toMatchObject({ canonicalUrl: "https://www.sympla.com.br/evento/trap-rap-santos/123", city: "Santos", flyerUrl: "https://img.example/flyer.jpg" });
    expect(candidate?.matchedGenres).toEqual(expect.arrayContaining(["trap", "rap", "funk", "eletrônica"]));
  });

  it("ignora Santos no rodapé quando o título identifica uma cidade externa", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    for (const title of ["Baile 80 em Curitiba", "Tasha & Tracie em Bauru"]) {
      expect(pageToDiscoveryCandidate({
        url: `https://articket.com.br/e/${title.replaceAll(" ", "-")}`,
        text: `${title} Ingressos e informações. Santos · Política de privacidade`,
        imageUrl: "",
        structured: { title, startDate: "2026-12-05T23:00:00-03:00", city: "Santos", locationName: "Casa de shows" },
      }, now)).toBeUndefined();
    }
  });

  it("não classifica comédia ou rock como eletrônica por causa de ingresso eletrônico", () => {
    expect(classifyDiscoveryGenres({ title: "KINGDOM NOITE DA COMÉDIA", description: "ingresso eletrônico, meia-entrada eletrônica" })).toEqual([]);
    expect(classifyDiscoveryGenres({ title: "ESPECIAL ACDC + Guns", description: "bilhete eletrônico e pagamento eletrônico" })).toEqual([]);
  });

  it("aprova candidatos reais de Santos e Guarujá nos estilos-alvo", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    expect(pageToDiscoveryCandidate({
      url: "https://www.sympla.com.br/evento/paredao-tbt-santos-sp/3626596",
      text: "Paredão TBT | Santos/SP",
      imageUrl: "",
      structured: { title: "Paredão TBT | Santos/SP", startDate: "2026-11-29T00:00:00-03:00", city: "Santos", locationName: "Bujas Garagem Bar", description: "Baile Funk" },
    }, now)?.city).toBe("Santos");
    expect(pageToDiscoveryCandidate({
      url: "https://mringressos.com.br/comprar/493/baile-do-invictus",
      text: "Baile do Invictus Guarujá",
      imageUrl: "",
      structured: { title: "Baile do Invictus", startDate: "2026-12-11T23:00:00-03:00", city: "Guarujá", locationName: "Casa Guarujá", description: "Baile Funk" },
    }, now)?.city).toBe("Guarujá");
  });

  it("mantém URLs rejeitadas estáveis para bloqueio idempotente", () => {
    expect(candidateUrl("https://articket.com.br/e/123/festa?fbclid=tracking")).toBe("https://articket.com.br/e/123/festa");
  });
});
