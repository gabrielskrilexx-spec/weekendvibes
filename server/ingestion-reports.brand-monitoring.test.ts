import { describe, expect, it } from "vitest";
import { aggregateBrandMonitoringMetrics } from "./ingestion-reports";

describe("aggregateBrandMonitoringMetrics", () => {
  const brands = [
    { id: 2, name: "Plants Santos", slug: "plants-santos", platforms: ["Sympla", "Ingresse"], cities: ["Santos"], matchTerms: ["Plants Santos"], isActive: 1 },
    { id: 1, name: "Nosso After", slug: "nosso-after", platforms: ["Instagram", "Bilheterias itinerantes"], cities: ["Guarujá", "Santos"], matchTerms: ["nossoafterguaruja"], isActive: 1 },
  ];

  it("returns every active brand with configured fields and counts only matching platform/city events", () => {
    const rows = [
      { title: "Plants Santos — edição verão", sourceUrl: "https://sympla.com.br/plants-santos", city: "Santos", eventDate: new Date("2026-12-10T22:00:00-03:00"), sourceType: "sympla", createdAt: new Date("2026-11-01T00:00:00Z"), updatedAt: new Date("2026-11-02T00:00:00Z") },
      { title: "Plants Santos — outra cidade", sourceUrl: null, city: "Guarujá", eventDate: new Date("2026-12-11T22:00:00-03:00"), sourceType: "sympla", createdAt: new Date("2026-11-01T00:00:00Z"), updatedAt: new Date("2026-11-01T00:00:00Z") },
      { title: "Plants Santos — plataforma não configurada", sourceUrl: null, city: "Santos", eventDate: new Date("2026-12-12T22:00:00-03:00"), sourceType: "zig", createdAt: new Date("2026-11-01T00:00:00Z"), updatedAt: new Date("2026-11-01T00:00:00Z") },
      { title: "Nosso After — Guarujá", sourceUrl: "https://instagram.com/p/after", city: "Guarujá", eventDate: new Date("2026-12-13T22:00:00-03:00"), sourceType: "instagram_story", createdAt: new Date("2026-11-03T00:00:00Z"), updatedAt: new Date("2026-11-03T00:00:00Z") },
    ];

    expect(aggregateBrandMonitoringMetrics(brands, rows)).toEqual([
      expect.objectContaining({ id: 2, name: "Plants Santos", slug: "plants-santos", platforms: ["Sympla", "Ingresse"], cities: ["Santos"], matchTerms: ["Plants Santos"], isActive: true, editionsDetected: 1, rescrapes: 1, latestEditionDate: "2026-12-11T01:00:00.000Z", lastDetectedAt: "2026-11-02T00:00:00.000Z" }),
      expect.objectContaining({ id: 1, name: "Nosso After", slug: "nosso-after", isActive: true, editionsDetected: 1, rescrapes: 0, latestEditionDate: "2026-12-14T01:00:00.000Z", lastDetectedAt: "2026-11-03T00:00:00.000Z" }),
    ]);
  });

  it("returns zeroed metrics for newly monitored brands", () => {
    expect(aggregateBrandMonitoringMetrics([brands[0]], [])).toEqual([
      { id: 2, name: "Plants Santos", slug: "plants-santos", platforms: ["Sympla", "Ingresse"], cities: ["Santos"], matchTerms: ["Plants Santos"], isActive: true, editionsDetected: 0, rescrapes: 0, latestEditionDate: null, lastDetectedAt: null },
    ]);
  });
});
