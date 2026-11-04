import { describe, expect, it } from "vitest";
import { activePlatformCooldownSourceKeys, partitionPlatformCooldownAlerts } from "./paused-platform-alerts";

const now = new Date("2026-11-04T13:00:00.000Z");

describe("platform cooldown alert classification", () => {
  it("only returns BLOCKED_BY_PLATFORM sources with an open circuit and future retry", () => {
    const keys = activePlatformCooldownSourceKeys([
      { sourceKey: "public:active", lastFailureReason: "BLOCKED_BY_PLATFORM", circuitState: "open", circuitNextAttemptAt: new Date("2026-11-05T13:00:00.000Z") },
      { sourceKey: "public:expired", lastFailureReason: "BLOCKED_BY_PLATFORM", circuitState: "open", circuitNextAttemptAt: new Date("2026-11-04T12:59:59.000Z") },
      { sourceKey: "public:closed", lastFailureReason: "BLOCKED_BY_PLATFORM", circuitState: "closed", circuitNextAttemptAt: new Date("2026-11-05T13:00:00.000Z") },
      { sourceKey: "public:other", lastFailureReason: "NETWORK_ERROR", circuitState: "open", circuitNextAttemptAt: new Date("2026-11-05T13:00:00.000Z") },
    ], now);
    expect(keys).toEqual(new Set(["public:active"]));
  });

  it("excludes active WAF cooldown alerts from totals and open while retaining a paused count", () => {
    const result = partitionPlatformCooldownAlerts([
      { alertType: "source_http_403_blocked", title: "403 blocked", message: "Source public:sympla is blocked", isResolved: 0 },
      { alertType: "source_http_403_blocked", title: "403 blocked", message: "Source public:zig is blocked", isResolved: 0 },
      { alertType: "export_job_orphaned", title: "Orphan job", message: "Job stuck", isResolved: 0 },
      { alertType: "source_http_403_blocked", title: "Resolved 403", message: "Source public:sympla blocked earlier", isResolved: 1 },
      { alertType: "source_http_403_blocked", title: "403 other source", message: "Source public:weticket blocked", isResolved: 0 },
    ], new Set(["public:sympla", "public:zig"]));

    expect(result.activeAlerts).toHaveLength(2);
    expect(result.activeAlerts.map(alert => alert.alertType)).toEqual(["export_job_orphaned", "source_http_403_blocked"]);
    expect(result.pausedCount).toBe(2);
  });

  it("keeps WAF alerts visible when there are no active cooldown source keys", () => {
    const alerts = [{ alertType: "source_http_403_blocked", title: "403", message: "BLOCKED_BY_PLATFORM", isResolved: 0 }];
    expect(partitionPlatformCooldownAlerts(alerts, new Set()).activeAlerts).toEqual(alerts);
  });
});
