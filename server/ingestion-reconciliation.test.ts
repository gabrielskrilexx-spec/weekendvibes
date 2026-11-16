import { describe, expect, it } from "vitest";
import { isInstagramRunStale, INSTAGRAM_STALE_RUN_MAX_AGE_MS } from "./ingestion-reports";
import { containsTargetVenue, isHealthyEmptyPublicPage } from "./ingestion";

describe("reconciliação e leitura vazia das fontes públicas", () => {
  it("considera stale um run Instagram running com mais de duas horas", () => {
    const now = new Date("2026-11-16T15:00:00.000Z");
    expect(isInstagramRunStale("2026-11-16T12:59:59.999Z", now)).toBe(true);
    expect(isInstagramRunStale("2026-11-16T13:00:00.001Z", now)).toBe(false);
    expect(INSTAGRAM_STALE_RUN_MAX_AGE_MS).toBe(7_200_000);
  });

  it("classifica HTTP 200 sem conteúdo de WeTicket/Zig como leitura vazia saudável", () => {
    expect(isHealthyEmptyPublicPage({ adapter: "weticket", emptyHealthy: true, text: "" })).toBe(true);
    expect(isHealthyEmptyPublicPage({ adapter: "zig", emptyHealthy: true, text: "  " })).toBe(true);
    expect(isHealthyEmptyPublicPage({ adapter: "zig", emptyHealthy: false, text: "" })).toBe(false);
  });

  it("normaliza a grafia O BĒCO para o alias O Beco", () => {
    expect(containsTargetVenue("O BĒCO, Santos", ["o beco"])).toBe(true);
  });
});
