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
        "https://zig.tickets/eventos/festa-do-branco-22-08",
        "https://www.ingresse.com/nosso-after-mc-luuky/",
      ]),
    );
    expect(sources.every(source => source.startsWith("https://"))).toBe(true);
  });
});
