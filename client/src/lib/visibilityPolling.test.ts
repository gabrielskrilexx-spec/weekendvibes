import { describe, expect, it, vi } from "vitest";
import { getVisibilityAwarePollingInterval, shouldPollWhenVisible } from "./visibilityPolling";

describe("visibility-aware polling", () => {
  it("pauses polling while the document is hidden", () => {
    const environment = { visibilityState: "hidden" };
    expect(getVisibilityAwarePollingInterval(30_000, { environment })).toBe(false);
    expect(shouldPollWhenVisible(environment)).toBe(false);
  });

  it("keeps polling visible documents and applies bounded jitter", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const environment = { visibilityState: "visible" };
    expect(getVisibilityAwarePollingInterval(30_000, { environment })).toBe(33_000);
    expect(shouldPollWhenVisible(environment)).toBe(true);
    vi.restoreAllMocks();
  });

  it("clamps unsafe intervals and supports deterministic polling", () => {
    const environment = { visibilityState: "visible" };
    expect(getVisibilityAwarePollingInterval(1, { environment, jitterRatio: 0 })).toBe(250);
    expect(getVisibilityAwarePollingInterval(1_000, { environment, jitterRatio: 0 })).toBe(1_000);
  });
});
