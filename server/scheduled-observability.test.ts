import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCircuitBreakerStatuses: vi.fn(),
  recordOperationalAlert: vi.fn(),
}));

vi.mock("./db", () => ({
  listCircuitBreakerStatuses: mocks.listCircuitBreakerStatuses,
  recordOperationalAlert: mocks.recordOperationalAlert,
}));

import { observeScheduledIngestion } from "./scheduled-observability";

describe("scheduled ingestion observability", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.listCircuitBreakerStatuses.mockResolvedValue([]);
    mocks.recordOperationalAlert.mockResolvedValue(undefined);
  });

  it("registra alerta quando a execução ultrapassa 45 segundos", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 45_001);
    const result = await observeScheduledIngestion({ routine: "public-agenda", status: "succeeded", startedAtMs: now, runId: 42 });
    expect(result.alerts).toContain("duration_exceeded");
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "scheduled_duration_exceeded", runId: 42 }));
  });

  it("registra alerta quando há qualquer fonte com circuit breaker open", async () => {
    mocks.listCircuitBreakerStatuses.mockResolvedValue([{ sourceKey: "instagram:mimadafesta", circuitState: "open" }]);
    const result = await observeScheduledIngestion({ routine: "instagram-agenda", status: "partial", startedAtMs: Date.now() });
    expect(result.alerts).toContain("circuit_breaker_open");
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "scheduled_circuit_breaker_open", message: expect.stringContaining("instagram:mimadafesta") }));
  });
});
