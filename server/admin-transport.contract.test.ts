import { beforeEach, describe, expect, it, vi } from "vitest";

const maintenanceMocks = vi.hoisted(() => ({
  resolveOperationalAlertsBefore: vi.fn().mockResolvedValue({ resolvedCount: 3, before: "2026-08-20T15:00:00.000Z" }),
  resetActiveIngestionSourceCircuitBreakers: vi.fn().mockResolvedValue({ resetCount: 2, sourceKeys: ["instagram:bar", "public:agenda"] }),
  reactivateIngestionSourceCircuitBreaker: vi.fn().mockResolvedValue(undefined),
  markIngestionSourceResult: vi.fn().mockResolvedValue(undefined),
  recordIngestionSourceAction: vi.fn().mockResolvedValue(undefined),
  listIngestionSourceOperationalTimeline: vi.fn().mockResolvedValue({ items: [{ id: "action-1", sourceKey: "instagram:mimadafesta", action: "reprocessed", actorOpenId: "admin", details: "Sucesso: 10 eventos lidos, 2 persistidos.", occurredAt: "2026-10-16T12:00:00.000Z" }], page: 1, pageSize: 500, total: 1, hasNextPage: false }),
  getExecutiveObservabilityReport: vi.fn().mockResolvedValue({ generatedAt: "2026-10-16T12:00:00.000Z", sources: { active: 1, open: 0, waf: 0, meta110: 0, network: 0 }, series: [], trends: { waf: { current: 0, previous: 0, delta: 0, percentage: 0, direction: "flat" }, meta110: { current: 0, previous: 0, delta: 0, percentage: 0, direction: "flat" }, network: { current: 0, previous: 0, delta: 0, percentage: 0, direction: "flat" }, succeeded: { current: 0, previous: 0, delta: 0, percentage: 0, direction: "flat" }, successRate: { current: 0, previous: 0, delta: 0, percentage: 0, direction: "flat" } } }),
  runIngestionSourceChunk: vi.fn().mockResolvedValue({ sourceKey: "public:ingresse", dryRun: true, result: { read: 1, persisted: 1, filtered: 0, sandboxRestricted: false, previewMock: false } }),
}));

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
  listFilteredIngestionSources: vi.fn().mockResolvedValue([{ id: 1, sourceKey: "public", createdAt: new Date("2026-08-26T12:00:00.000Z") }]),
  getIngestionSourceSummary: vi.fn().mockResolvedValue({ active: 1, open: 0, waf: 0, meta110: 0, network: 0 }),
  getConsolidatedIngestionSourceReport: vi.fn().mockResolvedValue({ generatedAt: "2026-10-16T12:00:00.000Z", totalSources: 1, activeSources: 1, pausedSources: 0, sources: [{ sourceKey: "public", name: "Agenda \"Litoral\"", kind: "public", handle: null, url: "https://example.test", isEnabled: true, lastStatus: "succeeded", lastAttemptAt: null, lastSuccessAt: new Date("2026-10-16T12:00:00.000Z"), lastFailureReason: null, lastHttpStatus: 200, circuitState: "closed", circuitFailureCount: 0, circuitNextAttemptAt: null, consecutive403Count: 0 }] }),
  listCatalogSnapshots: vi.fn().mockResolvedValue([{ id: 1, snapshotHash: "a".repeat(64), generatedAt: new Date("2026-10-16T12:00:00.000Z"), sourceCount: 1, createdAt: new Date("2026-10-16T12:00:00.000Z") }]),
  getExecutiveObservabilityReport: vi.fn().mockResolvedValue({ generatedAt: "2026-10-16T12:00:00.000Z", sources: { active: 1, open: 0, waf: 0, meta110: 0, network: 0 }, series: [], trends: { waf: { current: 0, previous: 0, delta: 0, percentage: 0, direction: "flat" }, meta110: { current: 0, previous: 0, delta: 0, percentage: 0, direction: "flat" }, network: { current: 0, previous: 0, delta: 0, percentage: 0, direction: "flat" }, succeeded: { current: 0, previous: 0, delta: 0, percentage: 0, direction: "flat" }, successRate: { current: 0, previous: 0, delta: 0, percentage: 0, direction: "flat" } } }),
  listIngestionSourceHandleAudit: vi.fn().mockResolvedValue([
    { id: 2, sourceKey: "instagram:mimadafesta", previousHandle: "mimadafesta-old", nextHandle: "mimadafesta", changedAt: new Date("2026-10-16T12:00:00.000Z") },
  ]),
  listGeocodingSummary: vi.fn(),
  createLocationAlias: vi.fn(),
  updateLocationAlias: vi.fn(),
  deleteLocationAlias: vi.fn(),
  updateIngestionSource: vi.fn(),
  resolveOperationalAlert: vi.fn(),
  resolveOperationalAlertsBefore: maintenanceMocks.resolveOperationalAlertsBefore,
  resetActiveIngestionSourceCircuitBreakers: maintenanceMocks.resetActiveIngestionSourceCircuitBreakers,
  reactivateIngestionSourceCircuitBreaker: maintenanceMocks.reactivateIngestionSourceCircuitBreaker,
  markIngestionSourceResult: maintenanceMocks.markIngestionSourceResult,
  recordIngestionSourceAction: maintenanceMocks.recordIngestionSourceAction,
  listIngestionSourceOperationalTimeline: maintenanceMocks.listIngestionSourceOperationalTimeline,
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
  runIngestionSourceChunk: maintenanceMocks.runIngestionSourceChunk,
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

  it("encaminha o saneamento temporal e o reset do Circuit Breaker com ACKs JSON", async () => {
    const caller = appRouter.createCaller(adminContext);
    await expect(caller.operationalAlerts.archiveBefore({ before: "2026-08-20T15:00:00.000Z", alertTypes: ["reconciliation_divergence"] })).resolves.toEqual({ ok: true, resolvedCount: 3, before: "2026-08-20T15:00:00.000Z" });
    await expect(caller.circuitBreaker.resetActive()).resolves.toEqual({ success: true, resetCount: 2, sourceKeys: ["instagram:bar", "public:agenda"] });
    expect(maintenanceMocks.resolveOperationalAlertsBefore).toHaveBeenCalledWith({ before: new Date("2026-08-20T15:00:00.000Z"), alertTypes: ["reconciliation_divergence"] });
    expect(maintenanceMocks.resetActiveIngestionSourceCircuitBreakers).toHaveBeenCalledWith();
  });

  it("reativa uma fonte somente após teste controlado bem-sucedido", async () => {
    const result = await appRouter.createCaller(adminContext).circuitBreaker.reactivateAndTest({ sourceKey: "public:ingresse" });
    expect(result).toEqual({ success: true, sourceKey: "public:ingresse", status: "reactivated", read: 1, persisted: 1, message: "Teste concluído; fonte reativada para o próximo ciclo." });
    expect(maintenanceMocks.runIngestionSourceChunk).toHaveBeenCalledWith({ sourceKey: "public:ingresse", dryRun: true });
    expect(maintenanceMocks.reactivateIngestionSourceCircuitBreaker).toHaveBeenCalledWith("public:ingresse");
  });

  it("reativa e dispara reprocessamento imediato somente quando solicitado", async () => {
    const caller = appRouter.createCaller(adminContext);
    const result = await caller.ingestionSources.reactivate({ sourceKey: "instagram:mimadafesta", reprocessNow: true });
    expect(result).toEqual({ ok: true, sourceKey: "instagram:mimadafesta", reprocess: "succeeded" });
    expect(maintenanceMocks.reactivateIngestionSourceCircuitBreaker).toHaveBeenCalledWith("instagram:mimadafesta", "admin", "Reprocessamento imediato solicitado");
    expect(maintenanceMocks.runIngestionSourceChunk).toHaveBeenCalledWith({ sourceKey: "instagram:mimadafesta", dryRun: false });
  });

  it("expõe o histórico de alterações do ID Meta como JSON seguro", async () => {
    const result = await appRouter.createCaller(adminContext).ingestionSources.auditLog({ sourceKey: "instagram:mimadafesta" });
    expect(result).toEqual([{ id: 2, sourceKey: "instagram:mimadafesta", previousHandle: "mimadafesta-old", nextHandle: "mimadafesta", changedAt: "2026-10-16T12:00:00.000Z" }]);
  });

  it("expõe a exportação completa da timeline como contrato JSON seguro", async () => {
    const result = await appRouter.createCaller(adminContext).ingestionSources.operationalTimelineExport({ sourceKey: "instagram:mimadafesta" });
    expect(result).toEqual({ items: [{ id: "action-1", sourceKey: "instagram:mimadafesta", action: "reprocessed", actorOpenId: "admin", details: "Sucesso: 10 eventos lidos, 2 persistidos.", occurredAt: "2026-10-16T12:00:00.000Z" }], total: 1 });
    expect(maintenanceMocks.listIngestionSourceOperationalTimeline).toHaveBeenCalledWith("instagram:mimadafesta", 1, 500, undefined, undefined, undefined, undefined);
  });

  it("expõe catálogo consolidado em CSV UTF-8 e snapshots versionados", async () => {
    const caller = appRouter.createCaller(adminContext);
    const csv = await caller.ingestionSources.consolidatedCsvExport();
    const snapshots = await caller.ingestionSources.snapshots({ limit: 10 });
    expect(csv.filename).toMatch(/\.csv$/);
    expect(csv.contentType).toBe("text/csv;charset=utf-8");
    expect(csv.csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.csv).toContain("Agenda \"\"Litoral\"\"");
    expect(snapshots[0]?.snapshotHash).toHaveLength(64);
    expect(snapshots[0]?.generatedAt).toBe("2026-10-16T12:00:00.000Z");
  });

  it("encaminha ação, datas e estado para a exportação contextual", async () => {
    await appRouter.createCaller(adminContext).ingestionSources.operationalTimelineJsonExport({ sourceKey: "instagram:mimadafesta", action: "reprocessed", from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T23:59:59.999Z", status: "open" });
    expect(maintenanceMocks.listIngestionSourceOperationalTimeline).toHaveBeenCalledWith("instagram:mimadafesta", 1, 500, "reprocessed", new Date("2026-08-01T00:00:00.000Z"), new Date("2026-08-31T23:59:59.999Z"), "open");
  });

  it("expõe JSON versionado com origem, total e timestamp de exportação", async () => {
    const result = await appRouter.createCaller(adminContext).ingestionSources.operationalTimelineJsonExport({ sourceKey: "instagram:mimadafesta" });
    expect(result.sourceKey).toBe("instagram:mimadafesta");
    expect(result.total).toBe(1);
    expect(result.exportedAt).toMatch(/^2026-.*Z$/);
    expect(result.items[0]?.action).toBe("reprocessed");
  });

  it("expõe KPIs e aceita filtros combinados de fontes", async () => {
    const caller = appRouter.createCaller(adminContext);
    const summary = await caller.ingestionSources.summary();
    const filtered = await caller.ingestionSources.list({ openOnly: true, failureCategory: "waf", since: "2026-10-10T00:00:00.000Z" });
    expect(summary).toEqual({ active: 1, open: 0, waf: 0, meta110: 0, network: 0 });
    expect(filtered).toEqual([{ id: 1, sourceKey: "public", createdAt: "2026-08-26T12:00:00.000Z" }]);
  });

  it("returns forbidden for maintenance mutations outside admin context", async () => {
    const userContext = { ...adminContext, user: { ...adminContext.user, role: "user" as const } };
    await expect(appRouter.createCaller(userContext).circuitBreaker.resetActive()).rejects.toThrow();
    await expect(appRouter.createCaller(userContext).operationalAlerts.archiveBefore({ before: "2026-08-20T15:00:00.000Z" })).rejects.toThrow();
  });

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
