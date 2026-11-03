import { afterEach, describe, expect, it, vi } from "vitest";
import { checkDatabaseHealth, getDb } from "./db";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("health diagnostics", () => {
  it("reports ready when the injected database and dependency tables are present", async () => {
    const fakeDb = {
      execute: vi.fn().mockResolvedValue([{
        database_name: "weekendvibes_test",
        rate_limit_table: '"rateLimitBuckets"',
        users_table: '"users"',
      }]),
    } as unknown as NonNullable<Awaited<ReturnType<typeof getDb>>>;
    const getDbProvider = vi.fn().mockResolvedValue(fakeDb);

    const result = await checkDatabaseHealth(getDbProvider);

    expect(result).toMatchObject({ ok: true, database: "ready", rateLimiter: "ready", userPersistence: "ready" });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(getDbProvider).toHaveBeenCalledOnce();
    expect(fakeDb.execute).toHaveBeenCalledOnce();
  });

  it("reports unavailable when the database provider has no connection", async () => {
    const getDbProvider = vi.fn().mockResolvedValue(null);
    await expect(checkDatabaseHealth(getDbProvider)).resolves.toMatchObject({
      ok: false, database: "unavailable", rateLimiter: "unavailable", userPersistence: "unavailable",
    });
    expect(getDbProvider).toHaveBeenCalledOnce();
  });

  it("reports rate limiter and user persistence unavailable when their tables are missing", async () => {
    const fakeDb = {
      execute: vi.fn().mockResolvedValue([{ database_name: "weekendvibes_test", rate_limit_table: null, users_table: null }]),
    } as unknown as NonNullable<Awaited<ReturnType<typeof getDb>>>;
    await expect(checkDatabaseHealth(async () => fakeDb)).resolves.toMatchObject({
      ok: false, database: "ready", rateLimiter: "unavailable", userPersistence: "unavailable",
    });
  });
});
