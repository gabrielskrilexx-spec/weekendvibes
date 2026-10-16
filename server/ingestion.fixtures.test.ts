import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractPublicEventLinks,
  fetchIngresseEventApi,
  buildPublicEventIdentity,
  parseArticketEventMetadata,
  parseBlackPassCatalogEvent,
  parseBlueMedAgendaEvents,
  parseEventosLitoralOrganizerMetadata,
  parseMrIngressosEventMetadata,
  parseParqueValongoEventMetadata,
  parseSymplaEventMetadata,
  parseWeTicketEventMetadata,
  parseZigEventMetadata,
  getTrackedPublicBrand,
} from "./ingestion";

const fixture = (name: string) => readFileSync(resolve(process.cwd(), "tests/fixtures", name), "utf8");

describe("fixtures dos conectores públicos", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normaliza Sympla a partir do __NEXT_DATA__", () => {
    expect(parseSymplaEventMetadata(fixture("sympla-santos.html"), "https://www.sympla.com.br/evento/festa-house/123")).toMatchObject({ title: "Festa House no GOAT CLUB", city: "Santos", locationName: "GOAT CLUB", priceCents: 8000, imageUrl: "https://images.sympla.com.br/event.jpg" });
  });

  it("normaliza Zig a partir de JSON-LD", () => {
    expect(parseZigEventMetadata(fixture("zig-santos.html"), "https://zig.tickets/eventos/osuco-black-and-white")).toMatchObject({ title: "Osuco Black And White", city: "Santos", locationName: "Santos Convention Center", priceCents: 8000, imageUrl: "https://cdn.zig.tickets/osuco.jpg" });
  });

  it("normaliza WeTicket com preço em português", () => {
    expect(parseWeTicketEventMetadata(fixture("weticket-santos.html"), "https://www.weticket.com.br/ape-22-especial-halloween")).toMatchObject({ title: "APÊ 22 — Especial Halloween", city: "Santos", priceCents: 4500, imageUrl: "https://cdn.weticket.com.br/ape22.jpg" });
  });

  it("normaliza Articket com JSON-LD e imagem", () => {
    expect(parseArticketEventMetadata(fixture("articket-santos.html"), "https://articket.com.br/e/7163/feijuca-no-arcos-tiee")).toMatchObject({ title: "Feijuca no Arcos", city: "Santos", priceCents: 5000, imageUrl: "https://cdn.example/feijuca.jpg" });
  });

  it("normaliza O Encontro do Articket e corrige a cidade pelo venue oficial", () => {
    expect(parseArticketEventMetadata(fixture("articket-o-encontro.html"), "https://articket.com.br/e/7160/o-encontro?utm_source=instagram")).toMatchObject({
      title: "O ENCONTRO",
      eventDate: "2026-11-28T20:00:00-03:00",
      locationName: "Santos Convention Center",
      city: "Santos",
      priceCents: 6000,
      imageUrl: "https://cdn.articket.com.br/user_content/event_images/event_image-o-encontro.webp",
    });
  });

  it("normaliza Black Pass a partir do payload do catálogo", () => {
    expect(parseBlackPassCatalogEvent(JSON.parse(fixture("blackpass-santos.json")))).toMatchObject({ title: "Jungle Room - Pink Edition", city: "Santos", locationName: "GOAT CLUB", priceCents: 7550, imageUrl: "https://api.blackpass.com.br/web/events/jungle.jpg" });
  });

  it("mantém Blacktag no fluxo de descoberta pública", () => {
    expect(extractPublicEventLinks(fixture("blacktag-santos.html"), "https://blacktag.com.br/")).toEqual(["https://blacktag.com.br/eventos/festa-house-goat", "https://blacktag.com.br/eventos/pagode-santos"]);
  });

  it("normaliza Ingresse via contrato JSON público", async () => {
    const payload = JSON.parse(fixture("ingresse-guaruja.json"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } })));
    const result = await fetchIngresseEventApi("https://www.ingresse.com/reveillon-guaruja-2027/", { read: vi.fn().mockResolvedValue(undefined), write: vi.fn().mockResolvedValue(undefined) }, { dryRun: true });
    expect(result.structured).toMatchObject({ title: "Réveillon Guarujá 2027", city: "Guarujá", locationName: "Guarujá Golf Club", eventDate: "2030-12-31T22:00:00-03:00" });
  });

  it("normaliza Mr Ingressos via JSON-LD", () => {
    expect(parseMrIngressosEventMetadata(fixture("mr-ingressos-guaruja.html"), "https://mringressos.com.br/comprar/439/isso-e-boteco")).toMatchObject({ title: "Isso é Boteco", city: "Guarujá", locationName: "Boteco Almare", priceCents: 4550 });
  });

  it("normaliza Parque Valongo e preserva o venue oficial", () => {
    expect(parseParqueValongoEventMetadata(fixture("parque-valongo-santos.html"), "https://www.turismosantos.com.br/pt-br/eventos/parque-valongo-musica")).toMatchObject({ title: "Festival de Música no Parque Valongo", city: "Santos", locationName: "Parque Valongo" });
  });

  it("mantém Eventos Litoral como fonte de descoberta, sem fabricar campos", () => {
    const parsed = parseEventosLitoralOrganizerMetadata(fixture("eventos-litoral.html"), "https://articket.com.br/o/58/eventos-litoral");
    expect(parsed).toMatchObject({ sourceUrl: "https://articket.com.br/o/58/eventos-litoral" });
    expect(parsed?.text).toContain("Feijuca no Arcos");
  });

  it("extrai cards musicais futuros da agenda Blue Med", () => {
    expect(parseBlueMedAgendaEvents(fixture("blue-med-santos.html"), "https://santosconventioncenter.com.br/agenda-2026/")).toMatchObject([{ title: "PAGODIN COM BELO", city: "Santos", locationName: "Santos Convention Center", genre: "samba_pagode", sourceUrl: "https://eventim.com.br/pagodin" }]);
  });

  it("aceita novas edições sem depender do subtítulo da marca", () => {
    const variants = JSON.parse(fixture("brand-variants.json")) as { weticket: Array<{ title: string; html: string }>; zig: Array<{ title: string; html: string }> };
    for (const variant of variants.weticket) {
      const parsed = parseWeTicketEventMetadata(variant.html, `https://www.weticket.com.br/${variant.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
      expect(parsed?.title).toBe(variant.title);
      expect(getTrackedPublicBrand(`${variant.title} O Beco`, "public:weticket")).toBe("APÊ 22");
    }
    for (const variant of variants.zig) {
      const parsed = parseZigEventMetadata(variant.html, "https://zig.tickets/eventos/osuco-edition");
      expect(parsed?.title).toBe(variant.title);
      expect(getTrackedPublicBrand(variant.title, "public:zig")).toBe("OSUCO");
    }
  });

  it("deduplica a mesma marca no mesmo dia e cria identidade para nova edição", () => {
    const sunset = buildPublicEventIdentity("public:weticket", "APÊ 22 — Sunset", "2031-03-12T22:00:00-03:00", "https://www.weticket.com.br/ape-22-sunset");
    const halloween = buildPublicEventIdentity("public:weticket", "APÊ 22 — Especial Halloween", "2031-03-12T22:00:00-03:00", "https://www.weticket.com.br/ape-22-helloween");
    const nextEdition = buildPublicEventIdentity("public:weticket", "APÊ 22 — Especial Halloween", "2031-03-19T22:00:00-03:00", "https://www.weticket.com.br/ape-22-helloween");
    expect(sunset).toBe(halloween);
    expect(nextEdition).not.toBe(sunset);
    expect(buildPublicEventIdentity("public:zig", "OSUCO Gold Edition", "2031-10-16T22:00:00-03:00", "https://zig.tickets/eventos/osuco-gold")).toBe(buildPublicEventIdentity("public:zig", "OSUCO Sunset", "2031-10-16T22:00:00-03:00", "https://zig.tickets/eventos/osuco-sunset"));
    expect(buildPublicEventIdentity("public:articket", "O ENCONTRO", "2031-11-28T20:00:00-03:00", "https://articket.com.br/e/7160/o-encontro?utm_source=x")).toBe(buildPublicEventIdentity("public:articket", "O ENCONTRO - nova descrição", "2031-11-28T20:00:00-03:00", "https://articket.com.br/e/7160/o-encontro"));
    expect(buildPublicEventIdentity("public:articket", "O ENCONTRO", "2031-12-05T20:00:00-03:00", "https://articket.com.br/e/7160/o-encontro")).not.toBe(buildPublicEventIdentity("public:articket", "O ENCONTRO", "2031-11-28T20:00:00-03:00", "https://articket.com.br/e/7160/o-encontro"));
  });
});
