import { describe, expect, it } from "vitest";
import { parseMapsRelayJavascript, parseMetaBusinessDiscovery, parseMetaGraphError, parseRoutesApiResponse } from "./external";

describe("contratos de integrações externas", () => {
  it("aceita Business Discovery com mídia opcional", () => {
    const result = parseMetaBusinessDiscovery({ business_discovery: { media: { data: [{ id: "m1", caption: "Agenda", timestamp: null, permalink: "https://instagram.com/p/1", media_url: "https://cdn/image.jpg", media_type: "IMAGE" }] } } });
    expect(result.business_discovery.media.data[0]?.id).toBe("m1");
  });

  it("rejeita resposta Meta sem identificador de mídia", () => {
    expect(() => parseMetaBusinessDiscovery({ business_discovery: { media: { data: [{ caption: "sem id" }] } } })).toThrow();
  });

  it("aceita e rejeita erros Graph com contrato explícito", () => {
    expect(parseMetaGraphError({ error: { message: "Invalid OAuth access token", code: 190 } }).error.code).toBe(190);
    expect(() => parseMetaGraphError({ error: { code: 190 } })).toThrow();
  });

  it("valida Routes API e impede ausência de routes", () => {
    expect(parseRoutesApiResponse({ routes: [{ distanceMeters: 1200, duration: "600s" }] }).routes).toHaveLength(1);
    expect(() => parseRoutesApiResponse({ route: [] })).toThrow();
  });

  it("valida que o relay devolva JavaScript Maps não vazio", () => {
    expect(parseMapsRelayJavascript("/* google maps bootstrap */ google.maps = {};" )).toContain("google");
    expect(() => parseMapsRelayJavascript("" )).toThrow();
    expect(() => parseMapsRelayJavascript("plain response" )).toThrow();
  });
});
