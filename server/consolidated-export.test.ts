import { describe, expect, it } from "vitest";
import { consolidatedCatalogFilename, consolidatedCatalogToCsv } from "./consolidated-export";

describe("consolidated catalog CSV", () => {
  it("emite BOM UTF-8, cabeçalho, CRLF e escapa caracteres especiais", () => {
    const csv = consolidatedCatalogToCsv({ generatedAt: "2026-10-17T12:00:00.000Z", totalSources: 1, activeSources: 1, pausedSources: 0, sources: [{ sourceKey: "public:agenda", name: "Agenda \"Litoral\"", kind: "public", handle: null, url: "https://example.test/?q=a,b", isEnabled: true, lastStatus: "succeeded", lastAttemptAt: null, lastSuccessAt: "2026-10-17T12:00:00.000Z", lastFailureReason: "=HYPERLINK(\"x\")", lastHttpStatus: 200, circuitState: "closed", circuitFailureCount: 0, circuitNextAttemptAt: null, consecutive403Count: 0 }] });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\"sourceKey\",\"nome\",\"tipo\"");
    expect(csv).toContain("\"Agenda \"\"Litoral\"\"\"");
    expect(csv).toContain("\"https://example.test/?q=a,b\"");
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("gera nome de arquivo determinístico por data e formato", () => {
    expect(consolidatedCatalogFilename(new Date("2026-10-17T12:00:00.000Z"), "csv")).toBe("catalogo_consolidado_2026-10-17.csv");
  });
});
