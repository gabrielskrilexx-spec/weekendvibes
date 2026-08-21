import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordOperationalAlert } = vi.hoisted(() => ({
  recordOperationalAlert: vi.fn().mockResolvedValue({ created: true, fingerprint: "clock-test" }),
}));

vi.mock("./db", () => ({ recordOperationalAlert }));

import { getInstagramReferenceDate, getInstagramSaoPauloDate, isInstagramReferenceDateAligned, recordReferenceDateClockAlert } from "./instagram-pipeline";

describe("Instagram reference date clock guard", () => {
  beforeEach(() => recordOperationalAlert.mockClear());

  it("accepts the dynamically calculated reference date in Sao Paulo", async () => {
    const now = new Date("2026-08-20T15:00:00.000Z");
    const referenceDate = getInstagramReferenceDate(now);
    expect(getInstagramSaoPauloDate(now)).toBe("2026-08-20");
    expect(isInstagramReferenceDateAligned(referenceDate, now)).toBe(true);
    await expect(recordReferenceDateClockAlert(referenceDate, now)).resolves.toBe(true);
    expect(recordOperationalAlert).not.toHaveBeenCalled();
  });

  it("records a critical alert when the execution reference diverges", async () => {
    const now = new Date("2026-08-21T15:00:00.000Z");
    const staleReferenceDate = "2026-08-20";
    expect(isInstagramReferenceDateAligned(staleReferenceDate, now)).toBe(false);
    await expect(recordReferenceDateClockAlert(staleReferenceDate, now)).resolves.toBe(false);
    expect(recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({
      integration: "pipeline",
      alertType: "reference_date_clock_desync",
      severity: "CRITICAL",
    }));
  });
});
