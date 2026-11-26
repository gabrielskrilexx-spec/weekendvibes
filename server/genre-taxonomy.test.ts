import { describe, expect, it } from "vitest";
import { classifyCanonicalGenres, canonicalGenresToPersisted, inferPersistedGenre } from "./genre-taxonomy";

describe("taxonomia musical compartilhada", () => {
  it("não usa termos administrativos ou DJ/festa isolados como Eletrônica", () => {
    expect(classifyCanonicalGenres(["KINGDOM NOITE DA COMÉDIA", "ingresso eletrônico, DJ e festa"])).toEqual([]);
    expect(classifyCanonicalGenres(["Sunset", "música eletrônica com line-up de DJs"])).toEqual(["eletrônica"]);
  });

  it("preserva Funk quando também há Rap/Trap", () => {
    expect(classifyCanonicalGenres(["Baile Funk com rap e trap"])).toEqual(["trap", "rap", "funk"]);
    expect(inferPersistedGenre(["Baile Funk com rap e trap"])).toBe("funk");
    expect(canonicalGenresToPersisted(["trap", "rap"])).toBe("rap_trap");
  });
});
