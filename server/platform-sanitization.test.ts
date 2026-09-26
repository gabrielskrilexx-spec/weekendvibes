import { describe, expect, it } from "vitest";
import { getStaleHighlightCutoff, isManualReviewEventPastCutoff } from "./manual-review";
import { getStaleAlertCutoff, shouldPausePublicSource } from "./platform-sanitization";

describe("platform sanitization rules", () => {
  it("uses the start of the current Sao Paulo day as the stale cutoff", () => {
    const now = new Date("2026-09-22T02:30:00.000Z");
    expect(getStaleAlertCutoff(now).toISOString()).toBe("2026-09-21T03:00:00.000Z");
  });

  it("expires only review events before today's Brasilia day", () => {
    const now = new Date("2026-09-22T12:00:00.000Z");
    expect(isManualReviewEventPastCutoff(new Date("2026-09-21T23:59:00.000Z"), now)).toBe(true);
    expect(isManualReviewEventPastCutoff(new Date("2026-09-22T03:00:00.000Z"), now)).toBe(false);
    expect(isManualReviewEventPastCutoff(null, now)).toBe(false);
  });

  it("pauses only public sources with persistent 403 or 502 responses", () => {
    expect(shouldPausePublicSource("public", 403)).toBe(true);
    expect(shouldPausePublicSource("public", 502)).toBe(true);
    expect(shouldPausePublicSource("instagram", 403)).toBe(false);
    expect(shouldPausePublicSource("public", 200)).toBe(false);
  });

  it("uses a bounded seven-day retention window for stale highlights", () => {
    const now = new Date("2026-09-26T12:00:00.000Z");
    expect(getStaleHighlightCutoff(now).toISOString()).toBe("2026-09-19T12:00:00.000Z");
    expect(getStaleHighlightCutoff(now, 0).toISOString()).toBe("2026-09-25T12:00:00.000Z");
    expect(getStaleHighlightCutoff(now, 999).toISOString()).toBe("2026-06-28T12:00:00.000Z");
  });
});
