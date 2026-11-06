import { afterEach, describe, expect, it, vi } from "vitest";
import { runIngestionPipeline } from "./ingestion";
import { allowSourceAttempt } from "./circuit-breaker";

const mocks = vi.hoisted(() => ({
  saveEvent: vi.fn(),
  listActiveMonitoredBrands: vi.fn().mockResolvedValue([]),
  invokeLLM: vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ events: [{ title: "Show Dry-run", summary: "Evento musical", eventDate: "2030-08-14T20:00:00Z", locationName: "Vallum Garden", address: "Rua A, Santos", city: "Santos", category: "show", genre: "funk", priceCents: 1000, sourceUrl: "https://source.example/events", imageUrl: "", latitude: "", longitude: "" }] }) } }] }),
}));

vi.mock("./db", () => ({
  saveEvent: mocks.saveEvent,
  listActiveMonitoredBrands: mocks.listActiveMonitoredBrands,
  listActiveLocationAliasValues: vi.fn().mockResolvedValue(["vallum garden"]),
  listIngestionSources: vi.fn().mockResolvedValue([]),
  assertEventDateIsCurrentOrFuture: vi.fn(),
  getIngestionPayloadCache: vi.fn().mockResolvedValue(null),
  saveIngestionPayloadCache: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./circuit-breaker", () => ({
  allowSourceAttempt: vi.fn().mockResolvedValue({ allowed: true, state: "closed", nextAttemptAt: null }),
  registerSourceSuccess: vi.fn().mockResolvedValue(undefined),
  registerSourceFailure: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));

describe("public ingestion dry-run", () => {
  const originalFocus = process.env.INGESTION_FOCUS_URLS;

  afterEach(() => {
    if (originalFocus === undefined) delete process.env.INGESTION_FOCUS_URLS;
    else process.env.INGESTION_FOCUS_URLS = originalFocus;
    vi.unstubAllGlobals();
    mocks.saveEvent.mockClear();
    mocks.invokeLLM.mockClear();
    mocks.listActiveMonitoredBrands.mockResolvedValue([]);
    vi.mocked(allowSourceAttempt).mockResolvedValue({ sourceKey: "public:unknown", state: "closed", failureCount: 0, allowed: true, nextAttemptAt: null });
  });

  it("applies parsing and validation while never calling saveEvent", async () => {
    process.env.INGESTION_FOCUS_URLS = "https://source.example/events";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "text/html" },
      text: async () => "Vallum Garden Santos",
      json: async () => ({}),
    }));

    const result = await runIngestionPipeline({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.dryRunAcceptedEvents).toBe(1);
    expect(result.persisted).toBe(0);
    expect(result.sourceReports).toEqual([expect.objectContaining({ sourceKey: "public:unknown", read: 1, persistable: 1 })]);
    expect(mocks.saveEvent).not.toHaveBeenCalled();
  });

  it("pula fonte pública em cooldown sem realizar uma requisição HTTP", async () => {
    process.env.INGESTION_FOCUS_URLS = "https://www.sympla.com.br/eventos/santos-sp";
    vi.mocked(allowSourceAttempt).mockResolvedValue({ sourceKey: "public:sympla", state: "open", failureCount: 1, allowed: false, nextAttemptAt: new Date("2026-11-10T00:00:00.000Z") });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runIngestionPipeline();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.mocked(allowSourceAttempt)).toHaveBeenCalledWith("public:sympla");
    expect(result).toMatchObject({ fetchFailures: [expect.objectContaining({ message: "Fonte pausada pelo Circuit Breaker durante o cooldown." })] });
  });

  it("carrega marcas ativas do Neon e aceita uma edição da cidade configurada", async () => {
    process.env.INGESTION_FOCUS_URLS = "https://source.example/events";
    mocks.listActiveMonitoredBrands.mockClear();
    mocks.listActiveMonitoredBrands.mockResolvedValue([{
      id: 1,
      slug: "plants-santos",
      name: "Plants Santos",
      cities: ["Santos"],
      platforms: ["Bilheterias itinerantes"],
      matchTerms: ["Plants Santos"],
      isActive: 1,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    }]);
    mocks.invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ events: [{ title: "Plants Santos — edição de verão", summary: "Festa da produtora Plants Santos", eventDate: "2030-08-14T20:00:00Z", locationName: "Espaço sem alias", address: "Rua A, Santos", city: "Santos", category: "show", genre: "funk", priceCents: 1000, sourceUrl: "https://source.example/events", imageUrl: "", latitude: "", longitude: "" }] }) } }] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "text/html" },
      text: async () => "Plants Santos — próxima edição em Santos",
      json: async () => ({}),
    }));

    const result = await runIngestionPipeline({ dryRun: true });

    expect(mocks.listActiveMonitoredBrands).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ dryRun: true, dryRunAcceptedEvents: 1, matchedSources: 1 });
    expect(mocks.saveEvent).not.toHaveBeenCalled();
  });
});
