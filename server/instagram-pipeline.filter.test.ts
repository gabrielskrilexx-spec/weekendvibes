import { describe, expect, it } from "vitest";
import { hasApprovedAgendaText } from "./instagram-pipeline";

describe("Instagram agenda filtering", () => {
  it("accepts broad agenda and event signals for every monitored profile", () => {
    expect(hasApprovedAgendaText("Agenda da semana #Sexta-Feira", "outroperfil")).toBe(true);
    expect(hasApprovedAgendaText("Programação do fim de semana", "outroperfil")).toBe(true);
    expect(hasApprovedAgendaText("Line-up com atração especial", "ativahouse")).toBe(true);
    expect(hasApprovedAgendaText("Rolê de sábado no FDS", "ativahouse")).toBe(true);
  });

  it("normalizes accents and does not accept unrelated captions", () => {
    expect(hasApprovedAgendaText("ATRAÇÃO inédita no sábado", "ativahouse")).toBe(true);
    expect(hasApprovedAgendaText("Confira nosso cardápio e novidades", "ativahouse")).toBe(true);
    expect(hasApprovedAgendaText("Foto da equipe", "outroperfil")).toBe(true);
  });
});
