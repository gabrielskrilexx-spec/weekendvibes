import { describe, expect, it } from "vitest";
import { parseMapsRelayJavascript, parseRoutesApiResponse } from "./mapContracts";

describe("contratos client-side de mapas", () => {
  it("aceita Routes API com rota e métricas opcionais", () => {
    expect(parseRoutesApiResponse({ routes: [{ distanceMeters: 1500, duration: "720s" }] }).routes[0]?.distanceMeters).toBe(1500);
  });

  it("rejeita Routes API sem lista de rotas", () => {
    expect(() => parseRoutesApiResponse({ routes: null })).toThrow();
  });

  it("aceita JavaScript válido do relay e rejeita corpo inesperado", () => {
    expect(parseMapsRelayJavascript("google.maps = {};" )).toContain("google");
    expect(() => parseMapsRelayJavascript("" )).toThrow();
    expect(() => parseMapsRelayJavascript("html sem maps" )).toThrow();
  });
});
