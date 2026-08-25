import { describe, expect, it } from "vitest";
import { getMapReconnectDelay } from "./Map";
import { MAP_SCRIPT_POLL_LIMIT, shouldFailMapScriptPoll, transitionMapState } from "@/hooks/useGoogleMapsController";

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

describe("map script readiness guard", () => {
  it("abandona o polling quando o Maps não fica pronto", () => {
    expect(shouldFailMapScriptPoll(MAP_SCRIPT_POLL_LIMIT - 1)).toBe(false);
    expect(shouldFailMapScriptPoll(MAP_SCRIPT_POLL_LIMIT)).toBe(true);
    expect(shouldFailMapScriptPoll(MAP_SCRIPT_POLL_LIMIT + 10)).toBe(true);
  });
});

describe("transitionMapState", () => {
  it("percorre idle, loading, success e error com eventos explícitos", () => {
    expect(transitionMapState("idle", "INTERSECT")).toBe("loading");
    expect(transitionMapState("loading", "LOAD_SUCCESS")).toBe("success");
    expect(transitionMapState("loading", "LOAD_ERROR")).toBe("error");
    expect(transitionMapState("error", "RETRY")).toBe("loading");
  });

  it("não altera estados para eventos incompatíveis", () => {
    expect(transitionMapState("success", "INTERSECT")).toBe("success");
    expect(transitionMapState("error", "INTERSECT")).toBe("error");
  });
});
