import { describe, expect, it } from "vitest";
import { buildEventSourceHash } from "./agent-ingestion";

describe("agent event identity", () => {
  it("uses the same source hash for repeated copies of one event", () => {
    const first = buildEventSourceHash("https://articket.com.br/e/1/show", "Show no Vallum Garden", new Date("2026-08-14T20:00:00Z"));
    const second = buildEventSourceHash("https://articket.com.br/e/1/show", "Show no Vallum Garden", new Date("2026-08-14T23:00:00Z"));
    expect(first).toBe(second);
  });
});
