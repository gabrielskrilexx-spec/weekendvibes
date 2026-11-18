import { describe, expect, it } from "vitest";
import { resolveEventActionCta } from "./event-action";

const base = { sourceType: "public:source", sourceUrl: null } as const;

describe("resolveEventActionCta", () => {
  it("classifica bilheteria externa como Garantir ingresso", () => {
    expect(resolveEventActionCta({ ...base, ticketUrl: "https://blackpass.com.br/eventos/festa" })).toEqual({
      kind: "ticket",
      url: "https://blackpass.com.br/eventos/festa",
      label: "Garantir ingresso",
    });
  });

  it("classifica destino do Instagram como Ver no Instagram", () => {
    expect(resolveEventActionCta({ ...base, sourceType: "instagram_feed", sourceUrl: "https://www.instagram.com/p/ABC123/" })).toEqual({
      kind: "instagram",
      url: "https://www.instagram.com/p/ABC123/",
      label: "Ver no Instagram",
    });
  });

  it("oculta ação quando não há URL válida", () => {
    expect(resolveEventActionCta({ ...base, ticketUrl: "not-a-url", sourceUrl: "mailto:evento@example.com" })).toEqual({
      kind: "none",
      url: null,
      label: null,
    });
  });

  it("prefere bilheteria externa mesmo quando o fallback do Instagram também existe", () => {
    expect(resolveEventActionCta({ ticketUrl: "https://www.instagram.com/p/ABC123/", sourceUrl: "https://sympla.com.br/evento/festa", sourceType: "instagram_feed" })).toMatchObject({
      kind: "ticket",
      url: "https://sympla.com.br/evento/festa",
      label: "Garantir ingresso",
    });
  });
});
