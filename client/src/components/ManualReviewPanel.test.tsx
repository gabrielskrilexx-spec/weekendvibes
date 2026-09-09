import { describe, expect, it } from "vitest";
import { draftFromEvent, localDateTimeToIso, toDateTimeLocal } from "./ManualReviewPanel";

describe("ManualReviewPanel helpers", () => {
  it("converte datas UTC para o campo local de São Paulo", () => {
    expect(toDateTimeLocal("2026-12-12T01:00:00.000Z")).toBe("2026-12-11T22:00");
    expect(toDateTimeLocal(null)).toBe("");
  });

  it("converte o horário local da revisão para ISO UTC", () => {
    expect(localDateTimeToIso("2026-12-11T22:00")).toBe("2026-12-12T01:00:00.000Z");
    expect(localDateTimeToIso("")).toBeNull();
  });

  it("preenche o rascunho com os campos incompletos preservados", () => {
    const draft = draftFromEvent({
      id: 7,
      sourceUrl: "https://instagram.com/meulugar.bar",
      sourceType: "instagram",
      title: "Sábado no Bar",
      summary: null,
      eventDate: null,
      endDate: null,
      locationName: "Meu Lugar",
      address: null,
      city: null,
      category: null,
      genre: null,
      priceCents: null,
      imageUrl: "https://example.com/flyer.png",
      rawText: "Sábado no Bar",
      reason: "revisao_manual_campos_parciais",
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      publishedEventId: null,
      createdAt: "2026-09-09T10:00:00.000Z",
      updatedAt: "2026-09-09T10:00:00.000Z",
    });
    expect(draft).toMatchObject({ title: "Sábado no Bar", locationName: "Meu Lugar", imageUrl: "https://example.com/flyer.png", reason: "revisao_manual_campos_parciais" });
    expect(draft.city).toBe("");
    expect(draft.category).toBe("");
  });
});
