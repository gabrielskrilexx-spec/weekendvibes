import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const guestContext: TrpcContext = {
  user: null,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("prioridades altas de eventos", () => {
  it("aceita filtros combináveis incluindo preço, data e horário", async () => {
    const result = await appRouter.createCaller(guestContext).events.list({
      city: "Santos",
      genre: "samba_pagode",
      venue: "Meu Lugar",
      date: "2026-08-15",
      minPriceCents: 0,
      maxPriceCents: 5000,
      timeFrom: "18:00",
      timeTo: "23:59",
      size: 10,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("expõe a consulta pública de eventos de hoje", async () => {
    const result = await appRouter.createCaller(guestContext).events.today({ size: 6 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("não permite favoritos ou lembretes para visitantes", async () => {
    const caller = appRouter.createCaller(guestContext);
    await expect(caller.events.favoriteIds()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.events.reminders()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.events.toggleFavorite({ eventId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.events.setReminder({ eventId: 1, active: true, hoursBefore: 24 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
