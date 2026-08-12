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

