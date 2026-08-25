import { afterEach, describe, expect, it, vi } from "vitest";
import { runIngestionPipeline } from "./ingestion";

const mocks = vi.hoisted(() => ({
  saveEvent: vi.fn(),
  invokeLLM: vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ events: [{ title: "Show Dry-run", summary: "Evento musical", eventDate: "2030-08-14T20:00:00Z", locationName: "Vallum Garden", address: "Rua A, Santos", city: "Santos", category: "show", genre: "funk", priceCents: 1000, sourceUrl: "https://source.example/events", imageUrl: "", latitude: "", longitude: "" }] }) } }] }),
}));

vi.mock("./db", () => ({
  saveEvent: mocks.saveEvent,
  listActiveLocationAliasValues: vi.fn().mockResolvedValue([]),
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
});
