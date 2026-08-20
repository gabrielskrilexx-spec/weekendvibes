import { describe, expect, it } from "vitest";
import { assertEventDateIsCurrentOrFuture } from "./db";

describe("hard date gate for persisted events", () => {
  const now = new Date("2026-08-20T15:00:00.000Z");

  it("rejects a date before the Sao Paulo civil day", () => {
    expect(() => assertEventDateIsCurrentOrFuture(new Date("2026-08-19T23:59:59.000Z"), now)).toThrow("data anterior ao dia atual");
  });

  it("rejects invalid dates", () => {
    expect(() => assertEventDateIsCurrentOrFuture(new Date("invalid"), now)).toThrow("data nula ou inválida");
  });

  it("accepts today and future dates", () => {
    expect(() => assertEventDateIsCurrentOrFuture(new Date("2026-08-20T03:00:00.000Z"), now)).not.toThrow();
    expect(() => assertEventDateIsCurrentOrFuture(new Date("2026-08-21T00:00:00.000Z"), now)).not.toThrow();
  });
});

export {};
