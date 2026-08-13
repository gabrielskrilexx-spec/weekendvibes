import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { INSTAGRAM_AGENDA_SOURCE_TYPE, isRecentInstagramAgendaEvent } from "./db";

function collectQueryText(value: unknown, seen = new WeakSet<object>()): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  if (seen.has(value)) return "";
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => collectQueryText(item, seen)).join(" ");
  return Object.values(value).map(item => collectQueryText(item, seen)).join(" ");
}

describe("events.recentInstagramAgenda", () => {
  it("retorna uma lista pública estável quando o banco não está disponível", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const result = await appRouter.createCaller(ctx).events.recentInstagramAgenda({ lookbackDays: 5, size: 8 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("emite a consulta dedicada com os predicados de Agenda e updatedAt recente", async () => {
    const now = new Date();
    const agendaReingerida = {
      id: 101,
      sourceType: INSTAGRAM_AGENDA_SOURCE_TYPE,
      isPublished: 1,
      isArchived: 0,
      createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      eventDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      city: "Santos",
    };
    const instagramNaoAgenda = {
      ...agendaReingerida,
      id: 102,
      sourceType: "instagram_other",
    };
    const ingresseAgenda = {
      ...agendaReingerida,
      id: 103,
      sourceType: "ingresse",
    };
    const rows = [agendaReingerida, instagramNaoAgenda, ingresseAgenda];
    let whereClause: unknown;
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: (clause: unknown) => {
            whereClause = clause;
            return {
              orderBy: () => ({
                limit: async () => rows,
              }),
            };
          },
        }),
      }),
    } as never;

    const { listRecentInstagramAgendaEvents } = await import("./db");
    const result = await listRecentInstagramAgendaEvents({ dbOverride: fakeDb, lookbackDays: 5, size: 8 });

    expect(result.map((event) => event.id)).toEqual([101, 102, 103]);
    const queryText = collectQueryText(whereClause);
    expect(whereClause).toBeTruthy();
    expect(queryText).toContain(INSTAGRAM_AGENDA_SOURCE_TYPE);
    expect(queryText).toMatch(/updated_at|updatedAt/i);
    expect(queryText).toMatch(/event_date|eventDate/i);
    expect(queryText).toContain("Santos");
    expect(queryText).toContain("Guarujá");
  });

  it("filtra semanticamente sourceType diferente e mantém createdAt antigo quando updatedAt é recente", () => {
    const now = new Date("2026-08-12T12:00:00.000Z");
    const base = { isPublished: 1, isArchived: 0, createdAt: new Date("2026-05-01T12:00:00.000Z"), updatedAt: new Date("2026-08-11T12:00:00.000Z"), eventDate: new Date("2026-08-15T22:00:00.000Z") } as const;
    const agendaReingerida = { ...base, sourceType: INSTAGRAM_AGENDA_SOURCE_TYPE };
    const instagramNaoAgenda = { ...base, sourceType: "instagram_other" };
    const ingresseAgenda = { ...base, sourceType: "ingresse" };
    expect(isRecentInstagramAgendaEvent(agendaReingerida, now)).toBe(true);
    expect(isRecentInstagramAgendaEvent(ingresseAgenda, now)).toBe(true);
    expect(isRecentInstagramAgendaEvent(instagramNaoAgenda, now)).toBe(false);
    expect(isRecentInstagramAgendaEvent({ ...agendaReingerida, updatedAt: new Date("2026-08-01T12:00:00.000Z") }, now)).toBe(false);
  });
});
