import { expect, test } from "@playwright/test";

function trpcPayload(data: unknown) {
  return { result: { data: { json: data } } };
}

const adminUser = { id: 1, openId: "e2e-admin", name: "Admin E2E", email: "admin@example.com", loginMethod: "test", role: "admin", createdAt: "2026-08-25T12:00:00.000Z", updatedAt: "2026-08-25T12:00:00.000Z", lastSignedIn: "2026-08-25T12:00:00.000Z" };
const report = {
  totals: { read: 12, filtered: 3, structured: 7, persisted: 5, rejectedPastEvents: 1, rejectedOtherReasons: 2, retries: 0, imported: 5 },
  runs: [], alerts: [], criticalAlerts: [], consecutiveFailures: [], freshness: [], reconciliationBySource: [], sourceMetrics: [], timeline: [], weeklyTrend: [],
  weeklySummary: { retries: 0, fallbackList: 0, duplicates: 0, missingCoordinates: 0, outOfBoundsCoordinates: 0, rejectedPastEvents: 1, rejectedOtherReasons: 2, rejectedEvents: 3, degradedRuns: 0, inconsistentRuns: 0 },
  filterEvaluatedAt: "2026-08-25T15:00:00.000Z", pastEventRejectionThreshold: 0.5,
  metaStatus: { state: "ok", message: "Meta operacional" },
  scheduleStatus: { instagram: { enabled: true, nextExecutionAt: "2026-08-26T10:00:00.000Z" }, public: { enabled: true, nextExecutionAt: "2026-08-26T06:00:00.000Z" } },
};
const collisions = [{ key: "2026-12-31:Laroc", civilDate: "31/12/2026", venue: "Laroc Club Guarujá", similarity: 0.91, recommendedKeepId: 100, left: { id: 100, title: "Réveillon Guarujá 2027", eventDate: "2026-12-31T22:00:00.000Z", locationName: "Laroc Club Guarujá", city: "Guarujá", priceCents: 12000, imageUrl: "https://example.com/event.jpg", latitude: "-23.98", longitude: "-46.25" }, right: { id: 101, title: "Réveillon Guarujá 2027 - Laroc", eventDate: "2026-12-31T19:00:00.000Z", locationName: "Laroc Club Guarujá", city: "Guarujá", priceCents: 0, imageUrl: "", latitude: null, longitude: null } }];

const source = { id: 1, sourceKey: "instagram:ativahouse", name: "Ativa House", kind: "instagram", handle: "ativahouse", url: "https://www.instagram.com/ativahouse/", isEnabled: 1, priority: 1, frequencyMinutes: 1440, lastSuccessAt: "2026-08-25T12:00:00.000Z", lastStatus: "succeeded" };

let routineTriggered = false;
let routineStatusPolls = 0;

function valueForProcedure(procedure: string) {
  if (procedure === "auth.me") return adminUser;
  if (procedure === "events.list") return [{ id: 100, title: "Réveillon Guarujá 2027", eventDate: "2026-12-31T22:00:00.000Z", locationName: "Laroc Club Guarujá", city: "Guarujá", category: "balada", genre: "house_eletronica", priceCents: 12000, description: "Evento", address: "Guarujá", sourceUrl: "https://example.com/100", imageUrl: "https://example.com/100.jpg", latitude: "-23.98", longitude: "-46.25", isPublished: 1 }, { id: 101, title: "Réveillon Guarujá 2027 - Laroc", eventDate: "2026-12-31T19:00:00.000Z", locationName: "Laroc Club Guarujá", city: "Guarujá", category: "balada", genre: "house_eletronica", priceCents: 0, description: "Evento", address: "Guarujá", sourceUrl: "https://example.com/101", imageUrl: "", latitude: null, longitude: null, isPublished: 1 }];
  if (procedure === "adminRoutine.status") {
    if (!routineTriggered) return { enabled: true, runMode: "full_auto", timezone: "America/Sao_Paulo", cron: "0 0 10 * * 3", nextExecutionAt: "2026-08-26T13:00:00.000Z", lastExecutedAt: null, isRunning: false, recentRuns: [], source: "heartbeat" };
    routineStatusPolls += 1;
    const isLive = routineStatusPolls === 1;
    return { enabled: true, runMode: "full_auto", timezone: "America/Sao_Paulo", cron: "0 0 10 * * 3", nextExecutionAt: "2026-08-26T13:00:00.000Z", lastExecutedAt: null, isRunning: isLive, progress: { isRunning: isLive, runId: 9100, phase: isLive ? "collecting" : "completed", step: isLive ? 2 : 4, totalSteps: 4, message: isLive ? "Coletando fontes públicas e Instagram." : "Ingestão concluída com sucesso.", error: null, sources: [{ sourceKey: "public", status: isLive ? "running" : "succeeded", read: isLive ? 10 : 12, added: isLive ? 0 : 2, updated: 0, ignored: 0 }, { sourceKey: "instagram", status: isLive ? "pending" : "succeeded", read: 0, added: isLive ? 0 : 1, updated: 0, ignored: 0 }] }, recentRuns: [], source: "heartbeat" };
  }
  if (procedure === "ingestionReports.summary") return report;
  if (procedure === "ingestionReports.geocoding") return { pending: 0, processing: 0, succeeded: 4, failed: 0 };
  if (procedure === "circuitBreaker.statuses") return [];
  if (procedure === "collisionReview.list") return collisions;
  if (procedure === "ingestionSources.list") return [source];
  if (procedure === "locationAliases.list") return [];
  return [];
}

function mutationValue(procedure: string) {
  if (procedure === "ingestionReports.dryRun") return { dryRun: true, startedAt: "2026-08-25T15:00:00.000Z", finishedAt: "2026-08-25T15:00:01.000Z", durationMs: 1000, sources: [{ routine: "instagram-agenda", sourceKey: "instagram", durationMs: 100, medianDurationMs: 100, p95DurationMs: 100, read: 3, filtered: 1, persistable: 2, duplicates: 0, errors: [], rejectionReasons: { fetchFailed: 0, outsideTargetVenue: 1, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 } }], totals: { read: 3, filtered: 1, persistable: 2, duplicates: 0, errors: 0 } };
  if (procedure === "adminRoutine.runNow") return { ok: true, archived: 0, publicSources: { imported: 2 }, instagram: { imported: 1 }, startedAt: "2026-08-25T15:00:00.000Z", finishedAt: "2026-08-25T15:00:01.000Z" };
  if (procedure === "events.remove") return { deleted: true, id: 101, deletedDependencies: { favorites: 0, reminders: 0, geocodingJobs: 0, geocodingAuditLogs: 0 } };
  if (procedure === "events.publishMany") return { ok: true, updated: 2, ids: [100, 101] };
  if (procedure === "events.removeMany") return { ok: true, deleted: 2, deletedIds: [100, 101] };
  if (procedure === "collisionReview.resolveMany") return { ok: true, deleted: 1, deletedIds: [101] };
  if (procedure === "ingestionReports.reprocess") return { ok: true, sourceKey: "instagram", routine: "instagram-agenda", imported: 1, counts: { read: 2, filtered: 0, persisted: 1, duplicates: 0 }, degraded: false };
  if (procedure === "operationalAlerts.resolve") return { ok: true, id: 1 };
  if (procedure === "ingestionSources.update") return { ok: true, id: 1, isEnabled: true, priority: 1, frequencyMinutes: 1440 };
  return { ok: true };
}

test("audita fluxos administrativos principais sem ações mortas", async ({ page }) => {
  const requests: string[] = [];
  page.on("dialog", dialog => dialog.accept());
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedures = (url.pathname.split("/").pop() ?? "").split(",").filter(Boolean);
    requests.push(...procedures);
    if (procedures.includes("adminRoutine.runNow")) routineTriggered = true;
    const values = procedures.map(procedure => route.request().method() === "GET" ? trpcPayload(valueForProcedure(procedure)) : trpcPayload(mutationValue(procedure)));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(values.length > 1 ? values : values[0] ?? trpcPayload([])) });
  });
  await page.addInitScript(() => localStorage.setItem("weekendvibes-cookie-consent", "rejected"));
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Painel de eventos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dry-run da ingestão" })).toBeVisible();
  const dryRunButton = page.getByRole("button", { name: "Simular ingestão (Dry-run)" });
  await dryRunButton.click();
  await expect(page.getByText("Simulação concluída sem persistência")).toBeVisible();
  await expect(page.getByRole("button", { name: "Simular ingestão (Dry-run)" })).toBeEnabled();

  await page.setViewportSize({ width: 390, height: 844 });
  const selectAllEvents = page.getByRole("checkbox", { name: "Selecionar todos os eventos" });
  await expect(selectAllEvents).toBeVisible();
  await selectAllEvents.check();
  await page.getByRole("button", { name: "Aprovar selecionados" }).first().click();
  await expect(page.getByText(/aprovados com sucesso/)).toBeVisible();
  await selectAllEvents.check();
  await page.getByRole("button", { name: "Excluir selecionados" }).click();
  await expect(page.getByText(/removido\(s\) com sucesso/)).toBeVisible();

  const routineButton = page.getByRole("button", { name: "Executar rotina de quarta-feira agora" });
  await routineButton.click();
  await expect(page.getByTestId("manual-ingestion-progress")).toBeVisible();
  await expect(page.getByText("Coletando fontes públicas e Instagram.")).toBeVisible();
  await expect(page.getByText("Processando…")).toBeVisible();
  await expect(page.getByText(/Rotina concluída/)).toBeVisible();

  const filters = page.getByTestId("ingestion-filters");
  await filters.getByLabel("Rotina").selectOption("instagram-agenda");
  await expect(filters.getByText(/Filtro avaliado no servidor/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revisar possíveis colisões" })).toBeVisible();
  const selectAllCollisions = page.getByRole("checkbox", { name: "Selecionar todas as colisões" });
  await selectAllCollisions.check();
  await page.getByRole("button", { name: "Aprovar selecionadas" }).last().click();
  await expect(page.getByText(/duplicata\(s\) resolvida\(s\) com sucesso/)).toBeVisible();
  await page.getByRole("button", { name: "Excluir duplicata sugerida" }).click();
  await page.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(page.getByText("Registro 101 removido.", { exact: false })).toBeVisible();

  expect(requests).toEqual(expect.arrayContaining(["ingestionReports.dryRun", "adminRoutine.runNow", "events.remove", "events.publishMany", "events.removeMany", "collisionReview.resolveMany"]));
});
