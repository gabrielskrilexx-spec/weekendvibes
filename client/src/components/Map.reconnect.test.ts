import { describe, expect, it } from "vitest";
import { getMapReconnectDelay } from "./Map";

describe("getMapReconnectDelay", () => {
  it("usa backoff exponencial progressivo nas primeiras tentativas", () => {
    expect([0, 1, 2, 3].map(getMapReconnectDelay)).toEqual([1000, 2000, 4000, 8000]);
  });

  it("limita o atraso máximo a 30 segundos", () => {
    expect(getMapReconnectDelay(5)).toBe(30_000);
    expect(getMapReconnectDelay(99)).toBe(30_000);
  });

  it("normaliza tentativas inválidas sem produzir atraso negativo", () => {
    expect(getMapReconnectDelay(-4)).toBe(1000);
    expect(getMapReconnectDelay(1.9)).toBe(2000);
  });
});
