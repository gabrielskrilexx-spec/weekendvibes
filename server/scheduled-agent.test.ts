import { describe, expect, it, vi } from "vitest";
import { sdk } from "./_core/sdk";
import { ingestAgentDocuments } from "./agent-ingestion";
import { ingestAgentDocumentsHandler } from "./scheduled-agent";

vi.mock("./agent-ingestion", () => ({ ingestAgentDocuments: vi.fn().mockResolvedValue({ imported: 1, received: 1, acceptedDocuments: 1 }) }));

describe("scheduled agent ingestion", () => {
  it("rejects non-cron callers", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: false } as never);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await ingestAgentDocumentsHandler({ body: { documents: [] } } as never, res);
    expect((res as any).status).toHaveBeenCalledWith(403);
  });

  it("accepts only bounded public-source documents for cron callers", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ isCron: true } as never);
    const res = { json: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() } as never;
    await ingestAgentDocumentsHandler({ body: { documents: [
      { sourceUrl: "https://articket.com.br/e/1/show", text: "Vallum Garden Santos" },
      { sourceUrl: "https://zig.tickets/eventos/festa-do-branco-22-08", text: "Curvão Surf House Guarujá" },
      { sourceUrl: "https://www.ingresse.com/nosso-after-mc-luuky/", text: "Lucky Scope Guarujá" },
      { sourceUrl: "https://www.ingresse.com/reveillon-guaruja-2027/", text: "Réveillon Guarujá 2027 Guarujá Golf Club" },
      { sourceUrl: "https://www.ingresse.com/laroc-guaruja-apresenta-meduza/", text: "Laroc Guarujá apresenta Meduza" },
      { sourceUrl: "https://evil.example/x", text: "não deve ser persistido" },
    ] } } as never, res);
    expect(ingestAgentDocuments).toHaveBeenCalledWith([
      { sourceUrl: "https://articket.com.br/e/1/show", text: "Vallum Garden Santos" },
      { sourceUrl: "https://zig.tickets/eventos/festa-do-branco-22-08", text: "Curvão Surf House Guarujá" },
      { sourceUrl: "https://www.ingresse.com/nosso-after-mc-luuky/", text: "Lucky Scope Guarujá" },
      { sourceUrl: "https://www.ingresse.com/reveillon-guaruja-2027/", text: "Réveillon Guarujá 2027 Guarujá Golf Club" },
      { sourceUrl: "https://www.ingresse.com/laroc-guaruja-apresenta-meduza/", text: "Laroc Guarujá apresenta Meduza" },
    ]);
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, result: { imported: 1, received: 1, acceptedDocuments: 1 } }));
  });
});
