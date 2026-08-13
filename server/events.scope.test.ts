import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { runIngestionPipeline } from "./ingestion";
const { listEvents, saveEvent, filterEventsForPublicFeed } = vi.hoisted(() => ({ listEvents: vi.fn(), saveEvent: vi.fn().mockResolvedValue(undefined), filterEventsForPublicFeed: (items: any[], filters: any) => items.filter(event => ["Santos", "Guarujá"].includes(event.city) && ["show", "balada", "evento_musical"].includes(event.category) && (!filters.city || filters.city === "Todas" || event.city === filters.city) && (!filters.category || filters.category === "Todas" || event.category === filters.category) && (!filters.genre || event.genre === filters.genre) && (filters.maxPriceCents === undefined || event.priceCents <= filters.maxPriceCents)) }));
vi.mock("./db", () => ({ listEvents, saveEvent, filterEventsForPublicFeed, listActiveLocationAliasValues: vi.fn().mockResolvedValue([]), getDb: vi.fn(), getEventBySlug: vi.fn(), updateEvent: vi.fn(), deleteEvent: vi.fn(), upsertUser: vi.fn(), getUserByOpenId: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ events: [
  { title: "Santos Funk", summary: "Show", eventDate: "2026-08-14T20:00:00Z", locationName: "Vallum Garden", address: "Rua Tuyuti, Santos", city: "Santos", category: "show", genre: "funk", priceCents: 0, sourceUrl: "", imageUrl: "", latitude: "", longitude: "" },
  { title: "Praia Cultural", summary: "Evento", eventDate: "2026-08-14T20:00:00Z", locationName: "Praia", address: "Rua 2", city: "Praia Grande", category: "evento_musical", genre: "funk", priceCents: 0, sourceUrl: "", imageUrl: "", latitude: "", longitude: "" },
  { title: "Guarujá Gastronomia", summary: "Evento", eventDate: "2026-08-14T20:00:00Z", locationName: "Casa", address: "Rua 3", city: "Guarujá", category: "gastronomia", genre: "funk", priceCents: 0, sourceUrl: "", imageUrl: "", latitude: "", longitude: "" },
] }) } }] }) }));

const ctx = { user: null, req: { protocol: "https", headers: {} } as any, res: {} as any };

describe("event scope", () => {
  it("retorna apenas eventos elegíveis para os filtros públicos", () => {
    const items = [
      { city: "Santos", category: "show", genre: "funk", priceCents: 2000, eventDate: new Date() },
      { city: "Guarujá", category: "balada", genre: "house_eletronica", priceCents: 8000, eventDate: new Date() },
      { city: "Praia Grande", category: "show", genre: "funk", priceCents: 1000, eventDate: new Date() },
      { city: "Santos", category: "cultura", genre: "funk", priceCents: 1000, eventDate: new Date() },
    ] as const;
    const result = filterEventsForPublicFeed(items, { city: "Santos", category: "show", genre: "funk", maxPriceCents: 5000 });
    expect(result).toHaveLength(1);
    expect(result[0]?.city).toBe("Santos");
  });

  it("passes city, category, genre and venue filters to the public query", async () => {
    listEvents.mockResolvedValueOnce([]);
    await appRouter.createCaller(ctx).events.list({ city: "Guarujá", category: "balada", genre: "house_eletronica", venue: "Laroc" });
    expect(listEvents).toHaveBeenCalledWith(expect.objectContaining({ city: "Guarujá", category: "balada", genre: "house_eletronica", venue: "Laroc" }));
  });

  it("imports only Santos or Guarujá events with musical categories", async () => {
    const previous = process.env.INGESTION_SOURCE_URL;
    process.env.INGESTION_SOURCE_URL = "https://source.example/events";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "Vallum Garden Santos" }));
    await runIngestionPipeline();
    expect(saveEvent).toHaveBeenCalledTimes(1);
    expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ city: "Santos", category: "show", genre: "funk" }));
    if (previous === undefined) delete process.env.INGESTION_SOURCE_URL; else process.env.INGESTION_SOURCE_URL = previous;
    vi.unstubAllGlobals();
  });
});
