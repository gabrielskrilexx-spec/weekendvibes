import { describe, expect, it } from "vitest";
import { buildSocialShareUrls, resolveEventDetailImage } from "./EventDetail";

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

  it("uses the persisted cover first and the official venue logo as fallback", () => {
    expect(resolveEventDetailImage({ imageUrl: "https://cdn.example/flyer.jpg", locationName: "Curvão Surf House" })).toBe("https://cdn.example/flyer.jpg");
    expect(resolveEventDetailImage({ imageUrl: null, locationName: "Curvão Surf House" })).toBe("/images/venues/curvao.jpg");
  });
});
