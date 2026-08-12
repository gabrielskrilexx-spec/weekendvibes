import { describe, expect, it } from "vitest";
import { hasApprovedAgendaText, INSTAGRAM_TARGETS, isWithinInstagramLookback } from "./instagram-pipeline";

describe("Instagram weekend pipeline", () => {
  it("requires the exact agenda phrase and one allowed hashtag", () => {
    expect(hasApprovedAgendaText("Agenda da semana\n#Sexta-Feira")).toBe(true);
    expect(hasApprovedAgendaText("Agenda semanal\n#Sexta-Feira")).toBe(false);
    expect(hasApprovedAgendaText("Agenda da semana\n#sexta-feira")).toBe(false);
    expect(hasApprovedAgendaText("Agenda da semana\n#Domingo")).toBe(false);
  });

  it("accepts only posts from the last five days", () => {
    const now = new Date("2026-08-12T12:00:00.000Z");
    expect(isWithinInstagramLookback({ timestamp: "2026-08-10T12:00:00.000Z" }, now)).toBe(true);
    expect(isWithinInstagramLookback({ timestamp: "2026-08-06T11:59:59.000Z" }, now)).toBe(false);
    expect(isWithinInstagramLookback({ timestamp: "2026-08-13T00:00:00.000Z" }, now)).toBe(false);
  });

  it("keeps the five verified regional accounts as direct Apify sources", () => {
    expect(INSTAGRAM_TARGETS.map(target => target.username)).toEqual([
      "mobydicksantos", "projac.bar", "meulugar.bar", "nossoafterguaruja", "curvaosurfhouse",
    ]);
    expect(INSTAGRAM_TARGETS.every(target => target.directUrl.startsWith("https://www.instagram.com/"))).toBe(true);
  });
});
