import { describe, expect, it } from "vitest";
import { classifyCanonicalGenres, canonicalGenresToPersisted, inferPersistedGenre } from "./genre-taxonomy";

describe("taxonomia musical compartilhada", () => {
  it("não usa termos administrativos ou sinais genéricos como Eletrônica", () => {
    expect(classifyCanonicalGenres(["KINGDOM NOITE DA COMÉDIA", "ingresso eletrônico, DJ e festa"])).toEqual([]);
    for (const text of ["Sunset no Beach Club", "Noite Especial no bar", "Open Bar na balada", "Festa de aniversário no beach club", "Festival de música ao vivo"]) {
      expect(inferPersistedGenre(text)).toBe("");
    }
    expect(classifyCanonicalGenres(["Sunset", "música eletrônica com line-up de DJs"])).toEqual(["eletrônica"]);
  });

  it("reconhece subgêneros explícitos de Trap, Rap e Funk", () => {
    expect(classifyCanonicalGenres("Trap nacional com boom bap e baile funk mandelão")).toEqual(["trap", "rap", "funk"]);
    expect(inferPersistedGenre("Mega Funk no Santos Convention Center")).toBe("funk");
    expect(inferPersistedGenre("Boom bap e drill ao vivo em Santos")).toBe("rap_trap");
  });

  it("reconhece variações eletrônicas somente com evidência musical", () => {
    for (const text of ["Afro house e deep house", "Melodic techno com psytrance", "DJ set de música eletrônica", "Lineup: DJs, techno e EDM"]) {
      expect(inferPersistedGenre(text)).toBe("house_eletronica");
    }
  });

  it("preserva Funk quando também há Rap/Trap", () => {
    expect(classifyCanonicalGenres(["Baile Funk com rap e trap"])).toEqual(["trap", "rap", "funk"]);
    expect(inferPersistedGenre(["Baile Funk com rap e trap"])).toBe("funk");
    expect(canonicalGenresToPersisted(["trap", "rap"])).toBe("rap_trap");
  });

  it("mantém gêneros fora do escopo sem classificação elegível", () => {
    for (const text of ["Samba e pagode no Guarujá", "Sertanejo universitário em Santos", "Rock clássico e MPB"]) {
      expect(inferPersistedGenre(text)).toBe("");
      expect(classifyCanonicalGenres(text)).toEqual([]);
    }
  });
});
