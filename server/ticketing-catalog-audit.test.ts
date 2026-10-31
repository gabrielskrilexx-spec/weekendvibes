import { describe, expect, it } from "vitest";
import {
  buildTicketingCatalogAudit,
  getTicketingPlatform,
  isExplicitTicketingEventUrl,
  safeTicketingUrl,
} from "./ticketing-catalog-audit";

describe("ticketing catalog audit", () => {
  it("classifica rotas variadas, slugs customizados e separa páginas de catálogo", () => {
    expect(getTicketingPlatform("https://zig.tickets/eventos/house-night")).toBe("zig");
    expect(isExplicitTicketingEventUrl("https://zig.tickets/evento/house-night")).toBe(true);
    expect(isExplicitTicketingEventUrl("https://blacktag.com.br/evento/house-night")).toBe(true);
    expect(isExplicitTicketingEventUrl("https://blacktag.com.br/eventos/house-night")).toBe(true);
    expect(isExplicitTicketingEventUrl("https://articket.com.br/e/7163/feijuca-no-arcos")).toBe(true);
    expect(isExplicitTicketingEventUrl("https://www.ingresse.com/laroc-guaruja-apresenta-dubdogz-nostalgia/")).toBe(true);
    expect(isExplicitTicketingEventUrl("https://www.sympla.com.br/eventos/santos-sp")).toBe(false);
    expect(safeTicketingUrl("https://zig.tickets/eventos/house-night?access_token=private#tickets")).toBe("https://zig.tickets/eventos/house-night");
  });

  it("audita aliases ativos sem afirmar que a falta de match prova ausência de bilheteria", () => {
    const report = buildTicketingCatalogAudit({
      venueAliases: [
        { alias: "curvao", canonicalName: "Curvão Surf House", city: "Guarujá", isActive: 1 },
        { alias: "curvão surf house", canonicalName: "Curvão Surf House", city: "Guarujá", isActive: 1 },
        { alias: "arena jequitimar", canonicalName: "Arena Jequitimar", city: "Guarujá", isActive: 1 },
      ],
      sources: [
        { sourceKey: "instagram:curvaosurfhouse", name: "Curvão Surf House", kind: "instagram", handle: "curvaosurfhouse", url: "https://www.instagram.com/curvaosurfhouse/", isEnabled: 1 },
        { sourceKey: "public:curvao-halloween", name: "Curvão — Halloween", kind: "public", url: "https://zig.tickets/evento/halloween-na-curvao?utm_source=agenda", isEnabled: 1, lastStatus: "never" },
        { sourceKey: "public:blacktag", name: "Blacktag", kind: "public", url: "https://blacktag.com.br/", isEnabled: 1 },
      ],
      events: [
        { locationName: "Curvão Surf House", city: "Guarujá", sourceUrl: "https://zig.tickets/evento/halloween-na-curvao" },
      ],
    });

    expect(report.summary).toMatchObject({
      venueCandidates: 2,
      venuesWithExplicitTicketingSourceCandidate: 1,
      venuesNeedingOfficialLinkValidation: 1,
      activeInstagramPartners: 1,
      activePublicSources: 2,
    });
    expect(report.venues.find(venue => venue.canonicalName === "Curvão Surf House")?.status).toBe("explicit_source_candidate");
    expect(report.venues.find(venue => venue.canonicalName === "Arena Jequitimar")?.status).toBe("needs_official_link_validation");
    expect(report.catalogBasis).toContain("não existe tabela venues");
  });
});
