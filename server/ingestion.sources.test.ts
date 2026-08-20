import { describe, expect, it, vi } from "vitest";
import { getConfiguredSourceUrls } from "./ingestion";

describe("ingestion source configuration", () => {
  it("reads the configured public source URLs", () => {
    vi.stubEnv("INGESTION_SOURCE_URLS", "https://articket.com.br/,https://blacktag.com.br/");
    expect(getConfiguredSourceUrls()).toEqual(expect.arrayContaining([
      "https://articket.com.br/",
      "https://blacktag.com.br/",
      "https://www.ingresse.com/reveillon-guaruja-2027/",
      "https://www.ingresse.com/laroc-guaruja-apresenta-meduza/",
    ]));
    vi.unstubAllEnvs();
  });
});


describe("JSON public source configuration", () => {
  it("does not leak brackets or quotes into configured URLs", () => {
    vi.stubEnv("INGESTION_SOURCE_URLS", JSON.stringify(["https://example.com/a", "https://example.com/b"]));
    const urls = getConfiguredSourceUrls();
    expect(urls).toContain("https://example.com/a");
    expect(urls).toContain("https://example.com/b");
    expect(urls.every(url => !/[\\[\\]\\\"']/.test(url))).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("public event discovery", () => {
  it("extracts Articket and Blacktag event links from source HTML", async () => {
    const { extractPublicEventLinks, containsTargetVenue } = await import("./ingestion");
    const html = '<a href="/e/123/show-verilonguinho">Show</a><a href="/eventos/456/moby-house">Moby</a><a href="https://example.com/outro">Outro</a>';
    expect(extractPublicEventLinks(html, "https://articket.com.br/")).toEqual(["https://articket.com.br/e/123/show-verilonguinho"]);
    expect(containsTargetVenue("Moby Dick, Santos - SP")).toBe(true);
    expect(containsTargetVenue("Laroc Club Guarujá")).toBe(true);
    expect(containsTargetVenue("Guarujá Golf Club")).toBe(true);
    expect(containsTargetVenue("Arena desconhecida, Santos - SP")).toBe(false);
    expect(containsTargetVenue("Flamingo Music Bar, Santos - SP", ["flamingo music bar"])).toBe(true);
    expect(containsTargetVenue("Arena desconhecida, Santos - SP", ["Outro local"])).toBe(false);
  });
});
