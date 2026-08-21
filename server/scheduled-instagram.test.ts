import { beforeEach, describe, expect, it, vi } from "vitest";
import { sdk } from "./_core/sdk";
import { ingestInstagramHandler } from "./scheduled-instagram";
import { hasRegionalHashtag, runInstagramPipeline, InstagramIntegrationFailure } from "./instagram-pipeline";
import { archiveExpiredSoldOutEvents, saveEvent } from "./db";
import { handleIngestionFailureAlert } from "./ingestion-failure-alerts";

vi.mock("./ingestion-failure-alerts", () => ({
  handleIngestionFailureAlert: vi.fn().mockResolvedValue({ fingerprint: "test", notified: false, reopened: false, deduplicated: false }),
}));

vi.mock("./db", () => ({
  INSTAGRAM_AGENDA_SOURCE_TYPE: "instagram_agenda_weekend",
  getDb: vi.fn().mockResolvedValue(null),
  archiveExpiredSoldOutEvents: vi.fn().mockResolvedValue(0),
  listActiveLocationAliasValues: vi.fn().mockResolvedValue([]),
  listEnabledInstagramSources: vi.fn().mockResolvedValue([]),
  markIngestionSourceResult: vi.fn().mockResolvedValue(undefined),
  saveEvent: vi.fn().mockResolvedValue(undefined),
  recordOperationalAlert: vi.fn().mockResolvedValue({ created: true, fingerprint: "test-clock" }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

describe("scheduled Instagram ingestion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(saveEvent).mockClear();
    vi.mocked(archiveExpiredSoldOutEvents).mockClear();
    vi.mocked(handleIngestionFailureAlert).mockClear();
    process.env.META_INSTAGRAM_TOKEN = "test-meta-token";
    process.env.META_INSTAGRAM_ACCOUNT_ID = "17841438723866203";
    process.env.OPENAI_API_KEY = "test-openai";
  });

  it("rejects non-cron callers before running the pipeline", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: false } as never);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await ingestInstagramHandler({} as never, res);
    expect((res as any).status).toHaveBeenCalledWith(403);
    expect(archiveExpiredSoldOutEvents).not.toHaveBeenCalled();
  });

  it("degrada falha upstream conhecida da Meta para HTTP 200 sem importar dados", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true } as never);
    vi.spyOn(await import("./instagram-pipeline"), "runInstagramPipeline").mockRejectedValueOnce(new InstagramIntegrationFailure("meta", "Meta Graph API retornou HTTP 503"));
    const res = { json: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() } as never;

    await ingestInstagramHandler({} as never, res);

    expect(handleIngestionFailureAlert).toHaveBeenCalledWith(expect.objectContaining({ integration: "meta", routine: "instagram-agenda", status: 503, severity: "WARNING" }));
    expect((res as any).status).toHaveBeenCalledWith(200);
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, degraded: true, integration: "meta", error: "upstream_unavailable", upstreamStatus: 503, imported: 0 }));
  });

  it("trata Meta HTTP 400 como bloqueio de credencial antes do downstream", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true } as never);
    const pipeline = vi.spyOn(await import("./instagram-pipeline"), "runInstagramPipeline").mockRejectedValueOnce(new InstagramIntegrationFailure("meta", "Meta Graph API retornou HTTP 400: acesso bloqueado"));
    const res = { json: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() } as never;

    await ingestInstagramHandler({} as never, res);

    expect(pipeline).toHaveBeenCalledOnce();
    expect((res as any).status).toHaveBeenCalledWith(400);
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, degraded: false, integration: "meta", error: "meta_credentials_or_permissions", upstreamStatus: 400, counts: { read: 0, filtered: 0, persisted: 0 } }));
  });

  it("mantém HTTP 500 para falha interna sem status upstream conhecido", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true } as never);
    vi.spyOn(await import("./instagram-pipeline"), "runInstagramPipeline").mockRejectedValueOnce(new InstagramIntegrationFailure("meta", "Falha de configuração local"));
    const res = { json: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() } as never;

    await ingestInstagramHandler({} as never, res);

    expect((res as any).status).toHaveBeenCalledWith(500);
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, integration: "meta", error: "internal_error" }));
  });

  it.each(["ocr", "openai"] as const)("classifica falha de %s no alerta operacional", async (integration) => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true } as never);
    vi.spyOn(await import("./instagram-pipeline"), "runInstagramPipeline").mockRejectedValueOnce(new InstagramIntegrationFailure(integration, `Falha simulada em ${integration}`));
    const res = { json: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() } as never;

    await ingestInstagramHandler({} as never, res);

    expect(handleIngestionFailureAlert).toHaveBeenCalledWith(expect.objectContaining({ integration, routine: "instagram-agenda", severity: "CRITICAL" }), expect.anything());
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, integration }));
  });

  it("recognizes both regional hashtags in the scheduled ingestion context", () => {
    expect(hasRegionalHashtag("Agenda da semana #Sexta-Feira #Guarujá")).toBe(true);
    expect(hasRegionalHashtag("Agenda da semana #Sábado #Santos")).toBe(true);
  });

  it("archives first and executes the Instagram pipeline for cron callers", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true } as never);
    vi.mocked(archiveExpiredSoldOutEvents).mockResolvedValueOnce(2);
    const pipeline = vi.spyOn(await import("./instagram-pipeline"), "runInstagramPipeline").mockResolvedValueOnce({ receivedPosts: 1, approvedPosts: 1, structuredEvents: 1, imported: 1 });
    const res = { json: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() } as never;
    await ingestInstagramHandler({} as never, res);
    expect(pipeline).toHaveBeenCalledOnce();
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, archived: 2, result: expect.objectContaining({ imported: 1 }) }));
  });

  it("processes a captioned post through structured classification", async () => {
    const originalFetch = globalThis.fetch;
    const sourceUrl = "https://www.instagram.com/p/ocr-agenda/";
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.resolve(new Response(JSON.stringify({ business_discovery: { media: { data: [{ id: "1", permalink: sourceUrl, caption: "Confira novidades da casa", timestamp: new Date().toISOString(), media_url: "https://cdn.example/ocr-agenda.jpg" }] } } }), { status: 200 }));
      if (call <= 8) return Promise.resolve(new Response(JSON.stringify({ business_discovery: { media: { data: [] } } }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ events: [{ title: "Sábado no Moby", summary: "Agenda musical classificada", eventDate: "2099-08-15T22:00:00.000Z", locationName: "Moby House", address: "Av. Vicente de Carvalho, 30, Santos", city: "Santos", category: "balada", genre: "house_eletronica", priceCents: 0, imageUrl: "https://cdn.example/ocr-agenda.jpg", sourceUrl }] }) } }] }), { status: 200 }));
    });
    try {
      const result = await runInstagramPipeline();
      expect(result).toMatchObject({ receivedPosts: 1, approvedPosts: 1, structuredEvents: 1, imported: 1, persisted: 1, duplicates: 0, missingCoordinates: 1 });
      expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl, title: "Sábado no Moby" }));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("filters an approved post and persists the structured event", async () => {
    const originalFetch = globalThis.fetch;
    const sourceUrl = "https://www.instagram.com/p/agenda123/";
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      call += 1;
      if (call === 1) return Promise.resolve(new Response(JSON.stringify({ business_discovery: { media: { data: [{ id: "1", permalink: sourceUrl, caption: "Agenda da semana\\n#Sexta-Feira", timestamp: new Date().toISOString(), media_url: "https://cdn.example/agenda.jpg" }] } } }), { status: 200 }));
      if (call <= 8) return Promise.resolve(new Response(JSON.stringify({ business_discovery: { media: { data: [] } } }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ events: [{ title: "Sexta no Moby", summary: "Agenda musical", eventDate: "2099-08-14T22:00:00.000Z", locationName: "Moby House", address: "Av. Vicente de Carvalho, 30, Santos", city: "Santos", category: "balada", genre: "house_eletronica", priceCents: 0, imageUrl: "https://cdn.example/agenda.jpg", sourceUrl }] }) } }] }), { status: 200 }));
    });
    try {
      const result = await runInstagramPipeline();
      expect(result).toMatchObject({ receivedPosts: 1, approvedPosts: 1, structuredEvents: 1, imported: 1, persisted: 1, duplicates: 0, missingCoordinates: 1 });
      expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl, city: "Santos", genre: "house_eletronica", isPublished: 1, isArchived: 0 }));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
