import { describe, expect, it } from "vitest";
import { buildSocialShareUrls } from "./EventDetail";

describe("event social sharing", () => {
  it("builds an encoded WhatsApp share URL with the event text and destination", () => {
    const urls = buildSocialShareUrls("https://weekendvib-jscaalye.manus.space/eventos/pagode", "Pagode no Meu Lugar");
    expect(urls.whatsapp).toContain("https://wa.me/?text=");
    expect(urls.whatsapp).toContain(encodeURIComponent("Pagode no Meu Lugar https://weekendvib-jscaalye.manus.space/eventos/pagode"));
  });

  it("builds a Facebook sharer URL with the event URL", () => {
    const urls = buildSocialShareUrls("https://weekendvib-jscaalye.manus.space/eventos/pagode", "Pagode");
    expect(urls.facebook).toBe("https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fweekendvib-jscaalye.manus.space%2Feventos%2Fpagode");
  });
});
