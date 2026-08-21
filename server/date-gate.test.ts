import { describe, expect, it } from "vitest";
import { assertEventDateIsCurrentOrFuture } from "./db";

describe("event date hard gate", () => {
  const now = new Date("2026-08-21T02:00:00.000Z"); // 20/08 23:00 em São Paulo

  it("rejects invalid dates", () => {
    expect(() => assertEventDateIsCurrentOrFuture(new Date("invalid"), now)).toThrow("data nula ou inválida");
  });

  it("rejects an event from the previous São Paulo civil day", () => {
    expect(() => assertEventDateIsCurrentOrFuture(new Date("2026-08-20T02:00:00.000Z"), now)).toThrow("data anterior");
  });

  it("accepts an event on the current São Paulo civil day", () => {
    expect(() => assertEventDateIsCurrentOrFuture(new Date("2026-08-21T02:30:00.000Z"), now)).not.toThrow();
  });
});
