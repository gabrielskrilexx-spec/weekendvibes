import { describe, expect, it, vi } from "vitest";
import { recordIngestionSourceReportSummary } from "./db";

describe("source report ledger persistence", () => {
  it("updates only lastMessage and updatedAt for the matching source", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const db = { update: vi.fn().mockReturnValue({ set }) } as never;
    const message = "Coleta concluída: 81 lidos, 0 novos, 6 atualizados, 74 ignorados; 0 erro(s).";

    await recordIngestionSourceReportSummary("public:articket", message, db);

    expect(db.update).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith({ lastMessage: message, updatedAt: expect.any(Date) });
    expect(where).toHaveBeenCalledOnce();
  });
});
