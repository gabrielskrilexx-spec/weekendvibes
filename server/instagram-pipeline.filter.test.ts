import { describe, expect, it } from "vitest";
import { hasApprovedAgendaText } from "./instagram-pipeline";

describe("Instagram agenda filtering", () => {
  it("keeps the global hashtag requirement for other profiles", () => {
    expect(hasApprovedAgendaText("Agenda da semana com programação", "outroperfil")).toBe(false);
    expect(hasApprovedAgendaText("Agenda da semana #Sexta-Feira", "outroperfil")).toBe(true);
  });

  it("accepts Agenda da semana for Ativa House without weakening other profiles", () => {
    expect(hasApprovedAgendaText("Agenda da semana com programação", "@ativahouse")).toBe(true);
    expect(hasApprovedAgendaText("Agenda da semana com programação", "ativahouse")).toBe(true);
    expect(hasApprovedAgendaText("Programação da semana", "ativahouse")).toBe(false);
  });
});
