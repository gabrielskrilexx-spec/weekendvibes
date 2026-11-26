import { afterEach, describe, expect, it, vi } from "vitest";

describe("leituras administrativas quando o banco está indisponível", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    vi.resetModules();
  });

  it("não transforma indisponibilidade em lista vazia", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const db = await import("./db");
    await expect(db.listOperationalAlerts(5)).rejects.toThrow("database_unavailable");
    await expect(db.listIngestionSources()).rejects.toThrow("database_unavailable");
    await expect(db.listCircuitBreakerStatuses()).rejects.toThrow("database_unavailable");
    await expect(db.listLatestInstagramSyncStatuses()).rejects.toThrow("database_unavailable");
    await expect(db.listLocationAliases()).rejects.toThrow("database_unavailable");
    await expect(db.listPotentialEventCollisions()).rejects.toThrow("database_unavailable");
  });

  it("propaga a falha do catálogo em vez de reportar zero eventos", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const db = await import("./db");
    await expect(db.listEvents()).rejects.toThrow("database_unavailable");
    await expect(db.listDraftEvents()).rejects.toThrow("database_unavailable");
  });
});
