import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordOperationalAlert } = vi.hoisted(() => ({
  recordOperationalAlert: vi.fn().mockResolvedValue({ created: true, fingerprint: "clock-test" }),
}));

vi.mock("./db", () => ({ recordOperationalAlert }));

import { INSTAGRAM_REFERENCE_DATE, getInstagramSaoPauloDate, isInstagramReferenceDateAligned, recordReferenceDateClockAlert } from "./instagram-pipeline";

describe("Instagram reference date clock guard", () => {
  beforeEach(() => recordOperationalAlert.mockClear());

  it("accepts the configured reference date in Sao Paulo", async () => {
    const now = new Date("2026-08-20T15:00:00.000Z");
    expect(getInstagramSaoPauloDate(now)).toBe(INSTAGRAM_REFERENCE_DATE);
    expect(isInstagramReferenceDateAligned(now)).toBe(true);
    await expect(recordReferenceDateClockAlert(now)).resolves.toBe(true);
    expect(recordOperationalAlert).not.toHaveBeenCalled();
  });

  it("records a critical alert when the server date diverges", async () => {
    const now = new Date("2026-08-21T15:00:00.000Z");
    expect(isInstagramReferenceDateAligned(now)).toBe(false);
    await expect(recordReferenceDateClockAlert(now)).resolves.toBe(false);
    expect(recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({
      integration: "pipeline",
      alertType: "reference_date_clock_desync",
      severity: "CRITICAL",
    }));
  });
});
