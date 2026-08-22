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

  it("trata DISABLED como ausência de foco temporário no parser", async () => {
    expect((process.env.INGESTION_FOCUS_URLS ?? "").trim().toUpperCase()).toBe("DISABLED");
    const { getConfiguredSourceUrls } = await import("./ingestion");
    const sources = getConfiguredSourceUrls();
    expect(sources).toEqual(expect.arrayContaining([
      "https://articket.com.br/",
      "https://blacktag.com.br/",
      "https://zig.tickets/pt-BR",
    ]));
    expect(sources.some(source => source.includes("ingresse.com"))).toBe(true);
    expect(sources).not.toContain("DISABLED");
  });
});
