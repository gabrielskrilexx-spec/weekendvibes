import { describe, expect, it } from "vitest";
import { assertEventDateIsCurrentOrFuture, getTodayEventWindow, saoPauloHour } from "./db";

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

  it("rejects a Carnaval title dated outside the seasonal window", () => {
    expect(() => assertEventDateIsCurrentOrFuture(new Date("2026-08-29T03:00:00.000Z"), now, "Carnaval do Ativa")).toThrow("Carnaval");
  });

  it("keeps a legitimate future Reveillon event", () => {
    expect(() => assertEventDateIsCurrentOrFuture(new Date("2026-12-31T03:00:00.000Z"), now, "Réveillon 2027")).not.toThrow();
  });

  it("rejects a Natal title dated outside December", () => {
    expect(() => assertEventDateIsCurrentOrFuture(new Date("2026-08-29T03:00:00.000Z"), now, "Natal no Laroc")).toThrow("Natal");
  });

  it("interprets midnight in Sao Paulo as hour zero", () => {
    expect(saoPauloHour(new Date("2026-08-28T03:00:00.000Z"))).toBe(0);
  });

  it("keeps the previous calendar day in the visible window during early Saturday morning", () => {
    const window = getTodayEventWindow(new Date("2026-08-29T08:30:00.000Z"));
    expect(window.windowStartUtc.toISOString()).toBe("2026-08-28T03:00:00.000Z");
    expect(window.windowEndUtc.toISOString()).toBe("2026-08-30T03:00:00.000Z");
    expect(window.rolloverHour).toBe(6);
  });

  it("starts a new daily window at exactly 06:00 in Sao Paulo", () => {
    const window = getTodayEventWindow(new Date("2026-08-29T09:00:00.000Z"));
    expect(window.windowStartUtc.toISOString()).toBe("2026-08-29T03:00:00.000Z");
  });
});

export {};
