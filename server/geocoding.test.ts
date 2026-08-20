import { describe, expect, it } from "vitest";
import { geocodingAddressHash } from "./geocoding";
import { buildRegionalGeocodingQuery } from "./location";

describe("geocoding helpers", () => {
  it("gera o mesmo hash para o mesmo endereço com diferenças de capitalização e espaços", () => {
    expect(geocodingAddressHash(" Rua A, 10 ", "Santos")).toBe(geocodingAddressHash("rua a, 10", "santos"));
  });

  it("diferencia cidades para evitar reutilizar coordenadas incorretas", () => {
    expect(geocodingAddressHash("Rua A, 10", "Santos")).not.toBe(geocodingAddressHash("Rua A, 10", "Guarujá"));
  });

  it("normaliza a grafia conhecida de Ativa House no contexto regional", () => {
    const query = buildRegionalGeocodingQuery("Rua Almeida de Morais, 41", "Ativa House", "Santos");
    expect(query).toContain("Almeida de Moraes");
    expect(query).toContain("Ativa House");
    expect(query).toContain("Santos");
  });
});
