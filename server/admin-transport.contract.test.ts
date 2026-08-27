import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  listEvents: vi
    .fn()
    .mockResolvedValue([
      {
        id: 7,
        title: "Evento",
        eventDate: new Date("2026-09-05T22:00:00.000Z"),
      },
    ]),
  getEventBySlug: vi
    .fn()
    .mockResolvedValue({
      id: 7,
      eventDate: new Date("2026-09-05T22:00:00.000Z"),
    }),
  listLocationAliases: vi
    .fn()
    .mockResolvedValue([
      { id: 1, alias: "casa", createdAt: new Date("2026-08-26T12:00:00.000Z") },
    ]),
  listCircuitBreakerStatuses: vi
    .fn()
    .mockResolvedValue([
      {
        sourceKey: "instagram",
        state: "closed",
        changedAt: new Date("2026-08-26T12:00:00.000Z"),
      },
    ]),
  listPotentialEventCollisions: vi
    .fn()
    .mockResolvedValue([
      {
        key: "1:2",
        left: { id: 1, eventDate: new Date("2026-09-05T22:00:00.000Z") },
        right: { id: 2, eventDate: new Date("2026-09-05T22:00:00.000Z") },
      },
    ]),
  listIngestionSources: vi
    .fn()
    .mockResolvedValue([
      {
        id: 1,
        sourceKey: "public",
        createdAt: new Date("2026-08-26T12:00:00.000Z"),
      },
    ]),
  listGeocodingSummary: vi.fn(),
  createLocationAlias: vi.fn(),
  updateLocationAlias: vi.fn(),
  deleteLocationAlias: vi.fn(),
  updateIngestionSource: vi.fn(),
  resolveOperationalAlert: vi.fn(),
  deleteEvent: vi.fn(),
  deleteEvents: vi.fn(),
  updateEventsPublication: vi.fn(),
  saveEvent: vi.fn(),
  updateEvent: vi.fn(),
  listTodayEvents: vi.fn().mockResolvedValue([]),
  listFavoriteEventIds: vi.fn().mockResolvedValue([]),
  toggleFavoriteEvent: vi.fn().mockResolvedValue({ isFavorite: true }),
  setEventReminder: vi
    .fn()
    .mockResolvedValue({
      active: true,
      hoursBefore: 24,
      remindAt: new Date("2026-09-05T20:00:00.000Z"),
    }),
  listUserReminders: vi.fn().mockResolvedValue([]),
  getDb: vi.fn(),
}));
vi.mock("./manual-ingestion", () => ({
  getWednesdayRoutineStatus: vi
    .fn()
    .mockResolvedValue({
      nextExecutionAt: new Date("2026-08-26T13:00:00.000Z"),
      recentRuns: [],
    }),
  runWednesdayRoutineNow: vi.fn(),
}));
vi.mock("./ingestion-reports", () => ({
  listIngestionReport: vi.fn().mockResolvedValue({ runs: [], alerts: [] }),
  reprocessIngestionSource: vi.fn(),
  sanitizeReprocessErrorForTest: vi.fn(),
}));
vi.mock("./geocoding", () => ({
  listGeocodingSummary: vi
    .fn()
    .mockResolvedValue({
      pending: 0,
      updatedAt: new Date("2026-08-26T12:00:00.000Z"),
    }),
  processPendingGeocoding: vi
    .fn()
    .mockResolvedValue({ processed: 0, succeeded: 0, failed: 0, pending: 0 }),
}));
vi.mock("./dry-run", () => ({ runDryRun: vi.fn() }));

import { appRouter } from "./routers";
import { reprocessIngestionSource } from "./ingestion-reports";

const adminContext = {
  user: {
    id: 1,
    openId: "admin",
    name: "Admin",
    email: null,
    loginMethod: null,
    role: "admin" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as any,
  res: {} as any,
};

describe("admin transport contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the strict sandbox acknowledgement when Instagram reprocess throws", async () => {
    vi.mocked(reprocessIngestionSource).mockRejectedValueOnce(new Error("502 proxy html"));
    const result = await appRouter.createCaller(adminContext).ingestionReports.reprocess({ sourceKey: "instagram" });
    expect(result).toEqual({ success: true, status: "SANDBOX_RESTRICTED", read: 0, persisted: 0 });
  });

  it("normalizes admin-facing lists and detail queries into JSON-safe values", async () => {
    const caller = appRouter.createCaller(adminContext);
    const [events, aliases, breakers, collisions, sources, detail, status] =
      await Promise.all([
        caller.events.list({ size: 10 }),
        caller.locationAliases.list(),
        caller.circuitBreaker.statuses(),
        caller.collisionReview.list({ limit: 10 }),
        caller.ingestionSources.list(),
        caller.events.bySlug({ slug: "evento" }),
        caller.adminRoutine.status(),
      ]);

    expect(events[0]?.eventDate).toBe("2026-09-05T22:00:00.000Z");
    expect(aliases[0]?.createdAt).toBe("2026-08-26T12:00:00.000Z");
    expect(breakers[0]?.changedAt).toBe("2026-08-26T12:00:00.000Z");
    expect(collisions[0]?.left.eventDate).toBe("2026-09-05T22:00:00.000Z");
    expect(sources[0]?.createdAt).toBe("2026-08-26T12:00:00.000Z");
    expect(detail?.eventDate).toBe("2026-09-05T22:00:00.000Z");
    expect(status.nextExecutionAt).toBe("2026-08-26T13:00:00.000Z");
    expect(Object.getPrototypeOf(events[0])).toBe(Object.prototype);
    expect(() =>
      JSON.stringify({
        events,
        aliases,
        breakers,
        collisions,
        sources,
        detail,
        status,
      })
    ).not.toThrow();
  });
});
