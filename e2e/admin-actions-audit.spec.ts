import { expect, test } from "@playwright/test";

function trpcPayload(data: unknown) {
  return { result: { data: { json: data } } };
}

const adminUser = {
  id: 1,
  openId: "e2e-admin",
  name: "Admin E2E",
  email: "admin@example.com",
  loginMethod: "test",
  role: "admin",
  isAdmin: true,
  createdAt: "2026-08-25T12:00:00.000Z",
  updatedAt: "2026-08-25T12:00:00.000Z",
  lastSignedIn: "2026-08-25T12:00:00.000Z",
};
const report = {
  totals: {
    read: 12,
    filtered: 3,
    structured: 7,
    persisted: 5,
    rejectedPastEvents: 1,
    rejectedOtherReasons: 2,
    retries: 0,
    imported: 5,
  },
  runs: [],
  alerts: [],
  criticalAlerts: [],
  consecutiveFailures: [],
  freshness: [],
  reconciliationBySource: [],
  sourceMetrics: [],
  timeline: [],
  weeklyTrend: [],
  weeklySummary: {
    retries: 0,
    fallbackList: 0,
    duplicates: 0,
    missingCoordinates: 0,
    outOfBoundsCoordinates: 0,
    rejectedPastEvents: 1,
    rejectedOtherReasons: 2,
    rejectedEvents: 3,
    degradedRuns: 0,
    inconsistentRuns: 0,
  },
  filterEvaluatedAt: "2026-08-25T15:00:00.000Z",
  pastEventRejectionThreshold: 0.5,
  metaStatus: { state: "ok", message: "Meta operacional" },
  scheduleStatus: {
    instagram: { enabled: true, nextExecutionAt: "2026-08-26T10:00:00.000Z" },
    public: { enabled: true, nextExecutionAt: "2026-08-26T06:00:00.000Z" },
  },
};
const collisions = [
  {
    key: "2026-12-31:Laroc",
    civilDate: "31/12/2026",
    venue: "Laroc Club Guarujá",
    similarity: 0.91,
    recommendedKeepId: 100,
    left: {
      id: 100,
      title: "Réveillon Guarujá 2027",
      eventDate: "2026-12-31T22:00:00.000Z",
      locationName: "Laroc Club Guarujá",
      city: "Guarujá",
      priceCents: 12000,
      imageUrl: "https://example.com/event.jpg",
      latitude: "-23.98",
      longitude: "-46.25",
    },
    right: {
      id: 101,
      title: "Réveillon Guarujá 2027 - Laroc",
      eventDate: "2026-12-31T19:00:00.000Z",
      locationName: "Laroc Club Guarujá",
      city: "Guarujá",
      priceCents: 0,
      imageUrl: "",
      latitude: null,
      longitude: null,
    },
  },
];

const source = {
  id: 1,
  sourceKey: "instagram:ativahouse",
  name: "Ativa House",
  kind: "instagram",
  handle: "ativahouse",
  url: "https://www.instagram.com/ativahouse/",
  isEnabled: 1,
  priority: 1,
  frequencyMinutes: 1440,
  lastSuccessAt: "2026-08-25T12:00:00.000Z",
  lastStatus: "succeeded",
};

let routineTriggered = false;
let routineStatusPolls = 0;

function valueForProcedure(procedure: string) {
  if (procedure === "auth.me") return adminUser;
  if (procedure === "events.list")
    return [
      {
        id: 100,
        title: "Réveillon Guarujá 2027",
        eventDate: "2026-12-31T22:00:00.000Z",
        locationName: "Laroc Club Guarujá",
        city: "Guarujá",
        category: "balada",
        genre: "house_eletronica",
        priceCents: 12000,
        description: "Evento",
        address: "Guarujá",
        sourceUrl: "https://example.com/100",
        imageUrl: "https://example.com/100.jpg",
        latitude: "-23.98",
        longitude: "-46.25",
        isPublished: 1,
      },
      {
        id: 101,
        title: "Réveillon Guarujá 2027 - Laroc",
        eventDate: "2026-12-31T19:00:00.000Z",
        locationName: "Laroc Club Guarujá",
        city: "Guarujá",
        category: "balada",
        genre: "house_eletronica",
        priceCents: 0,
        description: "Evento",
        address: "Guarujá",
        sourceUrl: "https://example.com/101",
        imageUrl: "",
        latitude: null,
        longitude: null,
        isPublished: 1,
      },
    ];
  if (procedure === "adminRoutine.status") {
    if (!routineTriggered)
      return {
        enabled: true,
        runMode: "full_auto",
        timezone: "America/Sao_Paulo",
        cron: "0 0 10 * * 3",
        nextExecutionAt: "2026-08-26T13:00:00.000Z",
        lastExecutedAt: null,
        isRunning: false,
        recentRuns: [
          {
            id: 9000,
            routine: "manual-agenda",
            trigger: "manual",
            status: "succeeded",
            startedAt: "2026-08-25T14:00:00.000Z",
            finishedAt: "2026-08-25T14:00:01.200Z",
            httpStatus: 200,
            durationMs: 1200,
            expurgatedCount: 0,
            readCount: 8,
            processedCount: 5,
            persistedEventIds: [501],
            dateFilterValidation: {
              timezone: "America/Sao_Paulo",
              today: "2026-08-25",
            },
          },
        ],
        source: "heartbeat",
      };
    routineStatusPolls += 1;
    const isLive = routineTriggered;
    return {
      enabled: true,
      runMode: "full_auto",
      timezone: "America/Sao_Paulo",
      cron: "0 0 10 * * 3",
      nextExecutionAt: "2026-08-26T13:00:00.000Z",
      lastExecutedAt: null,
      isRunning: isLive,
      progress: {
        isRunning: isLive,
        runId: 9100,
        phase: isLive ? "collecting" : "completed",
        step: isLive ? 2 : 4,
        totalSteps: 4,
        message: isLive
          ? "Coletando fontes públicas e Instagram."
          : "Ingestão concluída com sucesso.",
        error: null,
        sources: [
          {
            sourceKey: "public",
            status: isLive ? "running" : "succeeded",
            read: isLive ? 10 : 12,
            added: isLive ? 0 : 2,
            updated: 0,
            ignored: 0,
          },
          {
            sourceKey: "instagram",
            status: isLive ? "pending" : "succeeded",
            read: 0,
            added: isLive ? 0 : 1,
            updated: 0,
            ignored: 0,
          },
        ],
      },
      recentRuns: [
        {
          id: 9000,
          routine: "manual-agenda",
          trigger: "manual",
          status: "succeeded",
          startedAt: "2026-08-25T14:00:00.000Z",
          finishedAt: "2026-08-25T14:00:01.200Z",
          httpStatus: 200,
          durationMs: 1200,
          expurgatedCount: 0,
          readCount: 8,
          processedCount: 5,
          persistedEventIds: [501],
          dateFilterValidation: {
            timezone: "America/Sao_Paulo",
            today: "2026-08-25",
          },
        },
      ],
      source: "heartbeat",
    };
  }
  if (procedure === "ingestionReports.summary") return report;
  if (procedure === "ingestionReports.logs")
    return { updatedAt: "2026-08-25T15:00:00.000Z", isLive: true, logs: [] };
  if (procedure === "ingestionReports.geocoding")
    return { pending: 0, processing: 0, succeeded: 4, failed: 0 };
  if (procedure === "circuitBreaker.statuses") return [];
  if (procedure === "collisionReview.list") return collisions;
  if (procedure === "adminRoutine.manualReview.list")
    return { items: [], total: 0, offset: 0, limit: 25, hasNextPage: false };
  if (procedure === "adminRoutine.manualReview.metrics")
    return { published: 2, awaitingReview: 0 };
  if (procedure === "adminRoutine.exportJobsMetrics")
    return { total: 0, expiredLeases: 0, orphaned: 0, recoveryExhausted: 0, fileDeletePending: 0, fileDeletePendingPrevious: 0, fileDeletePendingGrowth: 0 };
  if (procedure === "adminRoutine.exportJobsAlertEfficiency")
    return { windowDays: 7, total: 0, resolved: 0, resolutionRate: 0, averageAgeMs: 0, openCount: 0, pausedCount: 0 };
  if (procedure === "adminRoutine.exportJobsAlertEfficiencyTrend")
    return { windowDays: 7, points: [] };
  if (procedure === "adminRoutine.exportJobsAlertSettings")
    return { environment: "development", severity: "WARNING", growthThreshold: 3, minimumQueueSize: 5, consecutiveWindows: 1 };
  if (procedure === "adminRoutine.exportJobsAlertSettingsHistory")
    return { items: [], offset: 0, limit: 10, hasNextPage: false };
  if (procedure === "adminRoutine.exportJobsTrend")
    return { windowDays: 7, points: [] };
  if (procedure === "adminRoutine.exportJobsMetricsTrend")
    return { windowDays: 30, points: [] };
  if (procedure === "heartbeat.executionStats")
    return { successRate: 1, p95DurationMs: 0, incidentCount: 0, totalExecutions: 0, points: [] };
  if (procedure === "heartbeat.healthSettings")
    return { environment: "preview", maxDurationMs: 180000, failureThreshold: 1, cooldownHours: 24, minSuccessRate: 0.8, maxP95DurationMs: 180000, minRegressionSuccessRateDrop: 0.1, maxRegressionP95IncreasePercent: 25, warningRegressionPct: 10, criticalRegressionPct: 25 };
  if (procedure === "heartbeat.healthSettingsHistory")
    return { items: [], offset: 0, limit: 5, hasNextPage: false };
  if (procedure === "ingestionSources.summary")
    return { active: 1, open: 0, waf: 0, meta110: 0, network: 0 };
  if (procedure === "ingestionSources.executiveReport") {
    const trend = { current: 0, previous: 0, percentage: 0, direction: "flat" as const };
    return { series: [], trends: { waf: trend, meta110: trend, network: trend, successRate: { current: 100, previous: 100, percentage: 0, direction: "flat" as const } }, system_health_status: "healthy", healthTransitions: [] };
  }
  if (procedure === "ingestionSources.list") return [source];
  if (procedure === "adminRoutine.sources") return { sources: ["instagram"] };
  if (procedure === "locationAliases.list") return [];
  return [];
}

function mutationValue(procedure: string) {
  if (procedure === "ingestionReports.dryRun")
    return {
      dryRun: true,
      startedAt: "2026-08-25T15:00:00.000Z",
      finishedAt: "2026-08-25T15:00:01.000Z",
      durationMs: 1000,
      sources: [
        {
          routine: "instagram-agenda",
          sourceKey: "instagram",
          durationMs: 100,
          medianDurationMs: 100,
          p95DurationMs: 100,
          read: 3,
          filtered: 1,
          persistable: 2,
          duplicates: 0,
          errors: [],
          rejectionReasons: {
            fetchFailed: 0,
            outsideTargetVenue: 1,
            invalidStructuredEvent: 0,
            duplicate: 0,
            pastEvent: 0,
          },
        },
      ],
      totals: {
        read: 3,
        filtered: 1,
        persistable: 2,
        duplicates: 0,
        errors: 0,
      },
    };
  if (procedure === "adminRoutine.runSource")
    return { ok: true, sourceKey: "instagram", dryRun: true, status: "succeeded", read: 3, added: 0, updated: 0, ignored: 1, errors: [], durationMs: 100, sandboxRestricted: false, previewMock: false };
  if (procedure === "adminRoutine.runNow")
    return {
      ok: true,
      archived: 0,
      publicSources: { imported: 2 },
      instagram: { imported: 1 },
      startedAt: "2026-08-25T15:00:00.000Z",
      finishedAt: "2026-08-25T15:00:01.000Z",
    };
  if (procedure === "events.remove")
    return {
      success: true,
      deletedId: 101,
      deletedDependencies: {
        favorites: 0,
        reminders: 0,
        geocodingJobs: 0,
        geocodingAuditLogs: 0,
      },
    };
  if (procedure === "events.publishMany")
    return { ok: true, updated: 2, ids: [100, 101] };
  if (procedure === "events.removeMany")
    return { ok: true, deleted: 2, deletedIds: [100, 101] };
  if (procedure === "collisionReview.resolveMany")
    return { ok: true, deleted: 1, deletedIds: [101] };
  if (procedure === "ingestionReports.reprocess")
    return {
      ok: true,
      sourceKey: "instagram",
      routine: "instagram-agenda",
      imported: 1,
      counts: { read: 2, filtered: 0, persisted: 1, duplicates: 0 },
      degraded: false,
    };
  if (procedure === "operationalAlerts.resolve") return { ok: true, id: 1 };
  if (procedure === "ingestionSources.update")
    return {
      ok: true,
      id: 1,
      isEnabled: true,
      priority: 1,
      frequencyMinutes: 1440,
    };
  return { ok: true };
}

test("audita fluxos administrativos principais sem ações mortas", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("dialog", dialog => dialog.accept());
  await page.route("**/api/v2/admin/*", async route => {
    const path = new URL(route.request().url()).pathname;
    const isApprove = path.endsWith("/approve-events");
    const isRemove = path.endsWith("/remove-events");
    const isCollision = path.endsWith("/resolve-collision");
    if (!isApprove && !isRemove && !isCollision) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, count: 2, ids: ["100", "101"] }),
    });
  });
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedures = (url.pathname.split("/").pop() ?? "")
      .split(",")
      .filter(Boolean);
    requests.push(...procedures);
    if (procedures.includes("adminRoutine.runNow")) { routineTriggered = true; routineStatusPolls = 0; }
    const values = procedures.map(procedure =>
      route.request().method() === "GET"
        ? trpcPayload(valueForProcedure(procedure))
        : trpcPayload(mutationValue(procedure))
    );
    if (procedures.includes("ingestionReports.dryRun") || procedures.includes("adminRoutine.runSource"))
      await new Promise(resolve => setTimeout(resolve, 120));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        values.length > 1 ? values : (values[0] ?? trpcPayload([]))
      ),
    });
  });
  await page.addInitScript(() =>
    localStorage.setItem("weekendvibes-cookie-consent", "rejected")
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Painel de eventos" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dry-run da ingestão" })
  ).toBeVisible();
  const dryRunButton = page.getByRole("button", {
    name: "Simular ingestão (Dry-run)",
  });
  await dryRunButton.click();
  await expect(page.getByTestId("dry-run-loading-skeleton")).toBeVisible();
  await expect(
    page.getByText("Simulação concluída sem persistência")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simular ingestão (Dry-run)" })
  ).toBeEnabled();

  await page.setViewportSize({ width: 390, height: 844 });
  const selectAllEvents = page.getByRole("checkbox", {
    name: "Selecionar todos os eventos",
  });
  await expect(selectAllEvents).toBeVisible();
  await selectAllEvents.check();
  await page
    .getByRole("button", { name: "Aprovar selecionados" })
    .first()
    .click();
  await expect(page.getByText(/aprovados com sucesso/)).toBeVisible();
  await selectAllEvents.check();
  await page.getByRole("button", { name: "Excluir selecionados" }).click();
  await expect(page.getByText(/removidos com sucesso/)).toBeVisible();

  const routineButton = page.getByRole("button", {
    name: "Executar ingestão manual agora",
  });
  await routineButton.click();
  await expect(page.getByRole("status").filter({ hasText: "Ingestão concluída: 1 fonte(s) processada(s)." })).toBeVisible();
  await expect(page.getByTestId("manual-execution-history")).toBeVisible();
  await expect(page.getByText("Run #9000")).toBeVisible();

  const filters = page.getByTestId("ingestion-filters");
  await filters.getByLabel("Rotina").selectOption("instagram-agenda");
  await expect(filters.getByText(/Filtro avaliado no servidor/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Revisar possíveis colisões" })
  ).toBeVisible();
  const selectAllCollisions = page.getByRole("checkbox", {
    name: "Selecionar todas as colisões",
  });
  await selectAllCollisions.check();
  await page
    .getByRole("button", { name: "Aprovar selecionadas" })
    .last()
    .click();
  await expect(
    page.getByText(/duplicata\(s\) resolvida\(s\) com sucesso/)
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir duplicata sugerida" })
    .click();
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(
    page.getByText("Registro 101 removido.", { exact: false })
  ).toBeVisible();

  expect(requests).toContain("adminRoutine.status");
});
