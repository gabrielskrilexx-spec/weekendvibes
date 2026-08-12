import { beforeEach, describe, expect, it, vi } from "vitest";
import { eventIdentityKey } from "./db";

const { saveEventMock, invokeLLMMock } = vi.hoisted(() => ({ saveEventMock: vi.fn(), invokeLLMMock: vi.fn() }));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, saveEvent: saveEventMock };
});
vi.mock("./_core/llm", () => ({ invokeLLM: invokeLLMMock }));

import { ingestAgentDocuments } from "./agent-ingestion";

describe("agent ingestion persistence identity", () => {
  beforeEach(() => {
    saveEventMock.mockReset();
    invokeLLMMock.mockReset();
    invokeLLMMock
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ events: [{ title: "Festa do Branco", summary: "Noite musical", eventDate: "2026-08-22T20:00:00-03:00", locationName: "Curvão Surf House", address: "Guarujá", city: "Guarujá", category: "balada", genre: "house_eletronica", priceCents: 0, sourceUrl: "https://zig.tickets/eventos/festa-do-branco-22-08", imageUrl: "", latitude: "", longitude: "" }] }) } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ events: [{ title: "FESTA DO BRANCO 22-08", summary: "Noite musical atualizada", eventDate: "2026-08-22T20:00:00-03:00", locationName: "CURVAO SURF HOUSE", address: "Guarujá", city: "Guarujá", category: "balada", genre: "house_eletronica", priceCents: 0, sourceUrl: "https://zig.tickets/eventos/festa-do-branco-22-08", imageUrl: "", latitude: "", longitude: "" }] }) } }] });
  });

  it("accepts the new Ingresse sources and includes their venues in the enrichment policy", async () => {
    await ingestAgentDocuments([
      { sourceUrl: "https://www.ingresse.com/reveillon-guaruja-2027/", text: "Réveillon Guarujá 2027 Guarujá Golf Club" },
      { sourceUrl: "https://www.ingresse.com/laroc-guaruja-apresenta-meduza/", text: "Laroc Guarujá apresenta Meduza" },
    ]);
    expect(invokeLLMMock).toHaveBeenCalledOnce();
    const systemPrompt = String(invokeLLMMock.mock.calls[0][0].messages[0].content);
    expect(systemPrompt).toContain("Laroc Club Guarujá");
    expect(systemPrompt).toContain("Guarujá Golf Club");
    expect(String(invokeLLMMock.mock.calls[0][0].messages[1].content)).toContain("reveillon-guaruja-2027");
  });

  it("persists both new Ingresse events with source identities", async () => {
    invokeLLMMock.mockReset();
    saveEventMock.mockReset();
    const payload = { events: [
      { title: "Réveillon Guarujá 2027", summary: "Festa eletrônica", eventDate: "2026-12-31T22:00:00-03:00", locationName: "Guarujá Golf Club", address: "Guarujá", city: "Guarujá", category: "balada", genre: "house_eletronica", priceCents: 0, sourceUrl: "https://www.ingresse.com/reveillon-guaruja-2027/", imageUrl: "", latitude: "", longitude: "" },
      { title: "Laroc Guarujá apresenta Meduza", summary: "Show eletrônico", eventDate: "2027-01-09T22:00:00-03:00", locationName: "Laroc Club Guarujá", address: "Guarujá", city: "Guarujá", category: "balada", genre: "house_eletronica", priceCents: 0, sourceUrl: "https://www.ingresse.com/laroc-guaruja-apresenta-meduza/", imageUrl: "", latitude: "", longitude: "" },
    ] };
    const llmResponse = { choices: [{ message: { content: JSON.stringify(payload) } }] };
    invokeLLMMock.mockResolvedValueOnce(llmResponse).mockResolvedValueOnce(llmResponse);
    const documents = [
      { sourceUrl: "https://www.ingresse.com/reveillon-guaruja-2027/", text: "Réveillon Guarujá 2027 Guarujá Golf Club" },
      { sourceUrl: "https://www.ingresse.com/laroc-guaruja-apresenta-meduza/", text: "Laroc Guarujá apresenta Meduza" },
    ];
    await ingestAgentDocuments(documents);
    await ingestAgentDocuments(documents);
    expect(saveEventMock).toHaveBeenCalledTimes(4);
    const persistedUrls = saveEventMock.mock.calls.map(([event]) => event.sourceUrl);
    expect(persistedUrls).toEqual(expect.arrayContaining([
      "https://www.ingresse.com/reveillon-guaruja-2027/",
      "https://www.ingresse.com/laroc-guaruja-apresenta-meduza/",
    ]));
    const identities = saveEventMock.mock.calls.map(([event]) => eventIdentityKey(event.sourceUrl, event.eventDate));
    expect(new Set(identities).size).toBe(2);
    expect(identities.filter(identity => identity.startsWith("https://www.ingresse.com/reveillon-guaruja-2027/|")).length).toBe(2);
    expect(identities.filter(identity => identity.startsWith("https://www.ingresse.com/laroc-guaruja-apresenta-meduza/|")).length).toBe(2);
  });

  it("produces one persistence identity when the same source/date is ingested twice", async () => {
    const documents = [{ sourceUrl: "https://zig.tickets/eventos/festa-do-branco-22-08", text: "Festa do Branco Curvão Surf House Guarujá" }];
    await ingestAgentDocuments(documents);
    await ingestAgentDocuments(documents);

    expect(saveEventMock).toHaveBeenCalledTimes(2);
    const identities = saveEventMock.mock.calls.map(([event]) => eventIdentityKey(event.sourceUrl, event.eventDate));
    expect(new Set(identities).size).toBe(1);
    expect(identities[0]).toBe("https://zig.tickets/eventos/festa-do-branco-22-08|2026-08-22");
  });
});


type _KeepIdentityImportUsed = typeof eventIdentityKey;
void (0 as unknown as _KeepIdentityImportUsed);

