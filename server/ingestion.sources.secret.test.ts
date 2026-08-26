import { afterEach, describe, expect, it, vi } from "vitest";

describe("INGESTION_SOURCE_URLS", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("contains the configured public event sources", () => {
    const sources = [
      "https://articket.com.br/",
      "https://blacktag.com.br/",
      "https://zig.tickets/pt-BR",
      "https://www.ingresse.com/laroc-guaruja-apresenta-reveillon-2027-feat-mau-p/",
    ];
    vi.stubEnv("INGESTION_SOURCE_URLS", JSON.stringify(sources));
    const raw = process.env.INGESTION_SOURCE_URLS;
    expect(raw).toBeTruthy();

    const configured = JSON.parse(raw ?? "[]") as string[];
    expect(configured).toEqual(
      expect.arrayContaining([
        "https://articket.com.br/",
        "https://blacktag.com.br/",
        "https://zig.tickets/pt-BR",
        "https://www.ingresse.com/laroc-guaruja-apresenta-reveillon-2027-feat-mau-p/",
      ]),
    );
    expect(configured.every(source => source.startsWith("https://"))).toBe(true);
  });

  it("trata DISABLED como ausência de foco temporário no parser", async () => {
    vi.stubEnv("INGESTION_SOURCE_URLS", JSON.stringify(["https://articket.com.br/", "https://blacktag.com.br/", "https://zig.tickets/pt-BR", "https://www.ingresse.com/laroc-guaruja-apresenta-reveillon-2027-feat-mau-p/"]));
    vi.stubEnv("INGESTION_FOCUS_URLS", "DISABLED");
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
