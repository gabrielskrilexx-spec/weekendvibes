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

  it("rejects a Carnaval title dated outside the seasonal window", () => {
    expect(() => assertEventDateIsCurrentOrFuture(new Date("2026-08-29T03:00:00.000Z"), now, "Carnaval do Ativa")).toThrow("Carnaval");
  });

  it("keeps a legitimate future Reveillon event", () => {
    expect(() => assertEventDateIsCurrentOrFuture(new Date("2026-12-31T03:00:00.000Z"), now, "Réveillon 2027")).not.toThrow();
  });

  it("rejects a Natal title dated outside December", () => {
    expect(() => assertEventDateIsCurrentOrFuture(new Date("2026-08-29T03:00:00.000Z"), now, "Natal no Laroc")).toThrow("Natal");
  });
});

export {};
