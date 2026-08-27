import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";

vi.mock("./db", () => ({
  listEvents: vi.fn().mockResolvedValue([]),
  getEventBySlug: vi.fn().mockResolvedValue(undefined),
  saveEvent: vi.fn().mockResolvedValue(undefined),
  updateEvent: vi.fn().mockResolvedValue({ updated: true, id: 1 }),
  deleteEvent: vi.fn().mockResolvedValue({ deleted: true, id: 1 }),
  deleteEvents: vi.fn().mockResolvedValue({ deleted: 2, deletedIds: [1, 2] }),
  updateEventsPublication: vi
    .fn()
    .mockResolvedValue({ updated: 2, ids: [1, 2] }),
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi
    .fn()
    .mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Festival de Verão",
              summary: "Uma noite tropical",
              eventDate: "2026-08-14T20:00:00Z",
              locationName: "Casa do Sol",
              address: "Av. Atlântica, 1",
              city: "Santos",
              category: "show",
              priceCents: 5000,
            }),
          },
        },
      ],
    }),
}));

const base = {
  title: "Festival de Verão",
  slug: "festival-de-verao",
  description: "Uma noite tropical",
  eventDate: new Date("2026-08-14T20:00:00Z"),
  locationName: "Casa do Sol",
  address: "Av. Atlântica, 1",
  city: "Santos",
  category: "show" as const,
  priceCents: 5000,
  sourceUrl: "https://example.com/tickets",
  imageUrl: "",
  latitude: "-23.96",
  longitude: "-46.33",
  isPublished: 1,
};
const ctx = (role: "admin" | "user" = "admin") => ({
  user: {
    id: 1,
    openId: "test",
    name: "Test",
    email: null,
    loginMethod: null,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as any,
  res: {} as any,
});

describe("events admin procedures", () => {
  it("allows admin CRUD operations with serializable contracts", async () => {
    const caller = appRouter.createCaller(ctx());
    await expect(caller.events.create(base)).resolves.toEqual({
      created: false,
      id: null,
      duplicate: false,
      updated: false,
    });
    await expect(
      caller.events.update({ id: 1, data: { title: "Festival Atualizado" } })
    ).resolves.toEqual({ ok: true, updated: true, id: 1 });
    await expect(caller.events.remove({ id: 1 })).resolves.toEqual({
      success: true,
      deletedId: 1,
    });
  });
  it("returns serializable contracts for bulk approval and deletion", async () => {
    const caller = appRouter.createCaller(ctx());
    await expect(caller.events.publishMany({ ids: [1, 2] })).resolves.toEqual({
      ok: true,
      updated: 2,
      ids: [1, 2],
    });
    await expect(caller.events.removeMany({ ids: [1, 2] })).resolves.toEqual({
      ok: true,
      deleted: 2,
      deletedIds: [1, 2],
    });
    await expect(
      caller.collisionReview.resolveMany({ ids: [2] })
    ).resolves.toEqual({ ok: true, deleted: 2, deletedIds: [1, 2] });
  });
  it("rejects invalid update IDs before reaching the database", async () => {
    const caller = appRouter.createCaller(ctx());
    await expect(
      caller.events.update({ id: 0, data: { title: "Inválido" } })
    ).rejects.toThrow();
  });
  it("rejects invalid event IDs before reaching the database", async () => {
    const caller = appRouter.createCaller(ctx());
    await expect(caller.events.remove({ id: 0 })).rejects.toThrow();
  });
  it("rejects regular users", async () => {
    const caller = appRouter.createCaller(ctx("user"));
    await expect(caller.events.remove({ id: 1 })).rejects.toThrow();
  });
  it("returns the structured LLM enrichment contract", async () => {
    const result = await appRouter
      .createCaller(ctx())
      .events.enrich({
        rawText:
          "Festival de verão em Santos na sexta-feira, às 20h, na Casa do Sol, ingressos a R$ 50.",
      });
    expect(result).toMatchObject({
      title: "Festival de Verão",
      city: "Santos",
      category: "show",
      priceCents: 5000,
    });
  });
});
