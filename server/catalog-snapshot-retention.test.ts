import { describe, expect, it, vi } from "vitest";
import { catalogSnapshotRetentionCutoff, deleteCatalogSnapshotsOlderThan } from "./db";

describe("catalog snapshot retention", () => {
  it("calcula uma janela exata de 30 dias", () => {
    const now = new Date("2026-10-17T12:00:00.000Z");
    expect(catalogSnapshotRetentionCutoff(30, now).toISOString()).toBe("2026-09-17T12:00:00.000Z");
  });

  it("remove somente registros anteriores ao cutoff e retorna a contagem do banco", async () => {
    const where = vi.fn().mockResolvedValue({ affectedRows: 2 });
    const fakeDb = { delete: vi.fn(() => ({ where })) };
    const deleted = await deleteCatalogSnapshotsOlderThan(30, new Date("2026-10-17T12:00:00.000Z"), fakeDb as never);
    expect(fakeDb.delete).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
    expect(deleted).toBe(2);
  });

  it("não reporta remoções quando o banco não encontra snapshots expirados", async () => {
    const fakeDb = { delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue({ affectedRows: 0 }) })) };
    expect(await deleteCatalogSnapshotsOlderThan(30, new Date("2026-10-17T12:00:00.000Z"), fakeDb as never)).toBe(0);
  });
});
