import { describe, expect, it, vi } from "vitest";
import { getConfiguredSourceUrls } from "./ingestion";

describe("ingestion source configuration", () => {
  it("reads the configured public source URLs", () => {
    vi.stubEnv("INGESTION_SOURCE_URLS", "https://articket.com.br/,https://blacktag.com.br/");
    expect(getConfiguredSourceUrls()).toEqual([
      "https://articket.com.br/",
      "https://blacktag.com.br/",
    ]);
    vi.unstubAllEnvs();
  });
});


describe("public event discovery", () => {
  it("extracts Articket and Blacktag event links from source HTML", async () => {
    const { extractPublicEventLinks, containsTargetVenue } = await import("./ingestion");
    const html = '<a href="/e/123/show-verilonguinho">Show</a><a href="/eventos/456/moby-house">Moby</a><a href="https://example.com/outro">Outro</a>';
    expect(extractPublicEventLinks(html, "https://articket.com.br/")).toEqual(["https://articket.com.br/e/123/show-verilonguinho"]);
    expect(containsTargetVenue("Moby Dick, Santos - SP")).toBe(true);
    expect(containsTargetVenue("Arena desconhecida, Santos - SP")).toBe(false);
  });
});
