import { describe, expect, it } from "vitest";
import { getManualReviewAuditChangedFieldsForTest } from "./manual-review";

describe("manual review audit diff", () => {
  it("identifica apenas os campos estruturados que mudaram", () => {
    expect(getManualReviewAuditChangedFieldsForTest(
      { title: "Sábado", eventDate: "2026-12-12T21:00:00.000Z", city: "Santos", category: "balada" },
      { title: "Sábado", eventDate: "2026-12-12T22:00:00.000Z", city: "Guarujá", category: "balada" },
    )).toEqual(["eventDate", "city"]);
  });

  it("trata valores nulos e vazios como equivalentes para a trilha", () => {
    expect(getManualReviewAuditChangedFieldsForTest({ genre: null, summary: "" }, { genre: "", summary: null })).toEqual([]);
  });
});
