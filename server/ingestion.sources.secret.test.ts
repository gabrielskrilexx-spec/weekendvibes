import { describe, expect, it } from "vitest";

describe("INGESTION_SOURCE_URLS", () => {
  it("contains the configured public event sources", () => {
    const raw = process.env.INGESTION_SOURCE_URLS;
    expect(raw).toBeTruthy();

    const sources = JSON.parse(raw ?? "[]") as string[];
    expect(sources).toEqual(
      expect.arrayContaining([
        "https://articket.com.br/",
        "https://blacktag.com.br/",
        "https://zig.tickets/pt-BR",
        "https://www.ingresse.com/laroc-guaruja-apresenta-reveillon-2027-feat-mau-p/",
      ]),
    );
    expect(sources.every(source => source.startsWith("https://"))).toBe(true);
  });

  it("valida o foco temporário das ticketeiras secundárias", () => {
    const raw = process.env.INGESTION_FOCUS_URLS;
    if (!raw) return;
    const sources = raw.split(",").map(source => source.trim()).filter(Boolean);
    expect(sources).toEqual(expect.arrayContaining([
      "https://blacktag.com.br/",
      "https://zig.tickets/pt-BR",
      "https://articket.com.br/",
    ]));
  });
});
