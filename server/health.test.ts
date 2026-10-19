import { describe, expect, it } from "vitest";
import { checkDatabaseHealth } from "./db";

describe("database health diagnostics", () => {
  it("reports the PostgreSQL, rate limiter and user persistence dependencies as ready", async () => {
    const health = await checkDatabaseHealth();
    expect(health).toMatchObject({ ok: true, database: "ready", rateLimiter: "ready", userPersistence: "ready" });
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
