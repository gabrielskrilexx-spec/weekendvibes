import { describe, expect, it, vi } from "vitest";
import { buildCircuitOpenedPayload, CircuitBreakerMachine, notifyCircuitOpened } from "./circuit-breaker";

describe("Circuit Breaker", () => {
  it("opens after three failures, blocks during cooldown, then enters half-open", () => {
    const start = new Date("2026-08-22T12:00:00.000Z");
    const machine = new CircuitBreakerMachine(3, 12 * 60 * 60 * 1000);
    expect(machine.canAttempt(start)).toBe(true);
    expect(machine.recordFailure(start).state).toBe("closed");
    expect(machine.recordFailure(start).state).toBe("closed");
    const opened = machine.recordFailure(start);
    expect(opened).toMatchObject({ state: "open", failureCount: 3, openedNow: true });
    expect(opened.nextAttemptAt?.toISOString()).toBe("2026-08-23T00:00:00.000Z");
    expect(machine.canAttempt(new Date("2026-08-22T23:59:59.000Z"))).toBe(false);
    expect(machine.canAttempt(new Date("2026-08-23T00:00:00.000Z"))).toBe(true);
    expect(machine.snapshot().state).toBe("half_open");
  });

  it("reopens after a failed half-open probe and closes after a successful probe", () => {
    const machine = new CircuitBreakerMachine(3, 60_000);
    machine.recordFailure();
    machine.recordFailure();
    machine.recordFailure(new Date("2026-08-22T12:00:00.000Z"));
    expect(machine.canAttempt(new Date("2026-08-22T12:01:00.000Z"))).toBe(true);
    expect(machine.recordFailure(new Date("2026-08-22T12:01:00.000Z")).state).toBe("open");
    expect(machine.canAttempt(new Date("2026-08-22T12:02:00.000Z"))).toBe(true);
    expect(machine.recordSuccess()).toMatchObject({ state: "closed", failureCount: 0, nextAttemptAt: null });
  });

  it("sends a sanitized optional webhook when a circuit opens", async () => {
    const originalFetch = globalThis.fetch;
    const originalEndpoint = process.env.CRITICAL_ALERT_WEBHOOK_URL;
    process.env.CRITICAL_ALERT_WEBHOOK_URL = "https://alerts.example.test/webhook";
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    try {
      const payload = buildCircuitOpenedPayload({ sourceKey: "instagram:ativahouse", routine: "instagram-agenda", nextAttemptAt: new Date("2026-08-23T00:00:00.000Z"), failureCount: 3, message: "HTTP 403 token=super-secret" });
      expect(payload.message).not.toContain("super-secret");
      await expect(notifyCircuitOpened(payload)).resolves.toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: "POST", body: expect.stringContaining("circuit_opened") }));
    } finally {
      globalThis.fetch = originalFetch;
      if (originalEndpoint === undefined) delete process.env.CRITICAL_ALERT_WEBHOOK_URL;
      else process.env.CRITICAL_ALERT_WEBHOOK_URL = originalEndpoint;
    }
  });

  it("does not call any external endpoint when webhook is absent", async () => {
    const originalFetch = globalThis.fetch;
    const originalEndpoint = process.env.CRITICAL_ALERT_WEBHOOK_URL;
    delete process.env.CRITICAL_ALERT_WEBHOOK_URL;
    globalThis.fetch = vi.fn();
    try {
      await expect(notifyCircuitOpened(buildCircuitOpenedPayload({ sourceKey: "instagram:test", routine: "instagram-agenda", nextAttemptAt: new Date("2026-08-23T00:00:00.000Z"), failureCount: 3, message: "HTTP 502" }))).resolves.toBe(false);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      if (originalEndpoint !== undefined) process.env.CRITICAL_ALERT_WEBHOOK_URL = originalEndpoint;
    }
  });
});
