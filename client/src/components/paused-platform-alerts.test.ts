import { describe, expect, it } from "vitest";
import { isAlertPausedForPlatformCooldown, isPlatformCooldownActive } from "./paused-platform-alerts";

const now = new Date("2026-11-04T13:00:00.000Z");
const active = { sourceKey: "public:blocked", lastFailureReason: "BLOCKED_BY_PLATFORM", circuitState: "open", circuitNextAttemptAt: "2026-11-04T13:00:01.000Z" };

describe("platform cooldown alert classification", () => {
  it("only treats BLOCKED_BY_PLATFORM OPEN circuit with future next attempt as active", () => {
    expect(isPlatformCooldownActive(active, now)).toBe(true);
    expect(isPlatformCooldownActive({ ...active, circuitNextAttemptAt: now.toISOString() }, now)).toBe(false);
    expect(isPlatformCooldownActive({ ...active, circuitNextAttemptAt: "2026-11-04T12:59:59.000Z" }, now)).toBe(false);
    expect(isPlatformCooldownActive({ ...active, circuitState: "half_open" }, now)).toBe(false);
    expect(isPlatformCooldownActive({ ...active, lastFailureReason: "HTTP 500" }, now)).toBe(false);
    expect(isPlatformCooldownActive({ ...active, circuitNextAttemptAt: null }, now)).toBe(false);
  });

  it("only matches platform-block alerts associated with the paused source", () => {
    const paused = new Set([active.sourceKey]);
    expect(isAlertPausedForPlatformCooldown({ alertType: "source_http_403_blocked", title: "Bloqueio", message: "A fonte public:blocked respondeu HTTP 403" }, paused)).toBe(true);
    expect(isAlertPausedForPlatformCooldown({ alertType: "source_http_403_blocked", title: "Bloqueio", message: "A fonte public:other respondeu HTTP 403" }, paused)).toBe(false);
    expect(isAlertPausedForPlatformCooldown({ alertType: "pipeline_error", title: "Erro", message: "public:blocked" }, paused)).toBe(false);
  });
});
