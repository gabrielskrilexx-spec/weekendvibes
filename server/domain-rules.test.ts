import { describe, expect, it } from "vitest";
import { isAllowedCity, isAllowedPersistedGenre, PERSISTED_GENRES, TARGET_CITIES } from "../shared/domain";

describe("regras compartilhadas de escopo", () => {
  it("aceita apenas as cidades exatas, sem prefixos ou vizinhas", () => {
    expect(TARGET_CITIES).toEqual(["Santos", "Guarujá"]);
    expect(isAllowedCity("Santos")).toBe(true);
    expect(isAllowedCity("Guarujá")).toBe(true);
    expect(isAllowedCity("Santos Dumont")).toBe(false);
    expect(isAllowedCity("São Vicente")).toBe(false);
    expect(isAllowedCity("Praia Grande")).toBe(false);
    expect(isAllowedCity("Cubatão")).toBe(false);
  });
  it("aceita somente gêneros persistidos sem samba/pagode ou fallback genérico", () => {
    expect(PERSISTED_GENRES).toEqual(["funk", "house_eletronica", "rap_trap"]);
    for (const genre of PERSISTED_GENRES) expect(isAllowedPersistedGenre(genre)).toBe(true);
    expect(isAllowedPersistedGenre("samba_pagode")).toBe(false);
    expect(isAllowedPersistedGenre("outros")).toBe(false);
    expect(isAllowedPersistedGenre("")).toBe(false);
    expect(isAllowedPersistedGenre(null)).toBe(false);
  });
});
