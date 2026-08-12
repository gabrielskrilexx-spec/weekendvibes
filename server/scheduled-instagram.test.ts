import { beforeEach, describe, expect, it, vi } from "vitest";
import { sdk } from "./_core/sdk";
import { ingestInstagramHandler } from "./scheduled-instagram";
import { runInstagramPipeline } from "./instagram-pipeline";
import { archiveExpiredSoldOutEvents, saveEvent } from "./db";

vi.mock("./db", () => ({
  INSTAGRAM_AGENDA_SOURCE_TYPE: "instagram_agenda_weekend",
  archiveExpiredSoldOutEvents: vi.fn().mockResolvedValue(0),
  saveEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("scheduled Instagram ingestion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(saveEvent).mockClear();
    vi.mocked(archiveExpiredSoldOutEvents).mockClear();
    process.env.APIFY_API_TOKEN = "test-apify";
    process.env.OPENAI_API_KEY = "test-openai";
  });

  it("rejects non-cron callers before running the pipeline", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: false } as never);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await ingestInstagramHandler({} as never, res);
    expect((res as any).status).toHaveBeenCalledWith(403);
    expect(archiveExpiredSoldOutEvents).not.toHaveBeenCalled();
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

  it("approves a post from OCR when its caption fails the strict filter", async () => {
    const originalFetch = globalThis.fetch;
    const sourceUrl = "https://www.instagram.com/p/ocr-agenda/";
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ url: sourceUrl, caption: "Confira nossos próximos eventos", timestamp: "2026-08-11T12:00:00.000Z", displayUrl: "https://cdn.example/ocr-agenda.jpg" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "Agenda da semana\\n#Sábado\\nMoby House Santos" } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ events: [{ title: "Sábado no Moby", summary: "Agenda musical aprovada por OCR", eventDate: "2026-08-15T22:00:00.000Z", locationName: "Moby House", address: "Av. Vicente de Carvalho, 30, Santos", city: "Santos", category: "balada", genre: "house_eletronica", priceCents: 0, imageUrl: "https://cdn.example/ocr-agenda.jpg", sourceUrl }] }) } }] }), { status: 200 }));
    try {
      const result = await runInstagramPipeline();
      expect(result).toEqual({ receivedPosts: 1, approvedPosts: 1, structuredEvents: 1, imported: 1 });
      expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl, title: "Sábado no Moby" }));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("filters an approved post and persists the structured event", async () => {
    const originalFetch = globalThis.fetch;
    const sourceUrl = "https://www.instagram.com/p/agenda123/";
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ url: sourceUrl, caption: "Agenda da semana\n#Sexta-Feira", timestamp: "2026-08-11T12:00:00.000Z", displayUrl: "https://cdn.example/agenda.jpg" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ events: [{ title: "Sexta no Moby", summary: "Agenda musical", eventDate: "2026-08-14T22:00:00.000Z", locationName: "Moby House", address: "Av. Vicente de Carvalho, 30, Santos", city: "Santos", category: "balada", genre: "house_eletronica", priceCents: 0, imageUrl: "https://cdn.example/agenda.jpg", sourceUrl }] }) } }] }), { status: 200 }));
    try {
      const result = await runInstagramPipeline();
      expect(result).toEqual({ receivedPosts: 1, approvedPosts: 1, structuredEvents: 1, imported: 1 });
      expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl, city: "Santos", genre: "house_eletronica", isPublished: 1, isArchived: 0 }));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
