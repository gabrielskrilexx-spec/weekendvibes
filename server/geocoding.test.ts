import { describe, expect, it } from "vitest";
import { geocodingAddressHash } from "./geocoding";

describe("geocoding helpers", () => {
  it("gera o mesmo hash para o mesmo endereço com diferenças de capitalização e espaços", () => {
    expect(geocodingAddressHash(" Rua A, 10 ", "Santos")).toBe(geocodingAddressHash("rua a, 10", "santos"));
  });

  it("diferencia cidades para evitar reutilizar coordenadas incorretas", () => {
    expect(geocodingAddressHash("Rua A, 10", "Santos")).not.toBe(geocodingAddressHash("Rua A, 10", "Guarujá"));
  });
});
