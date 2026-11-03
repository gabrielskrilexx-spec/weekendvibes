import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startIngestionRun: vi.fn().mockResolvedValue(42),
  linkIngestionRunToApifyActor: vi.fn().mockResolvedValue(true),
  setIngestionRunDetails: vi.fn().mockResolvedValue(true),
  finishIngestionRun: vi.fn().mockResolvedValue(undefined),
  findIngestionRunByApifyActor: vi.fn(),
  claimApifyDailyRequest: vi.fn().mockResolvedValue({ allowed: true, dateKey: "2026-09-18", requestCount: 1, dailyLimit: 100, persistence: true }),
  getApifyBudgetBlockAlert: vi.fn((budget: { blockedReason?: string }) => budget.blockedReason === "kill_switch"
    ? { alertType: "apify_kill_switch_active", severity: "CRITICAL" as const, message: "Extração Apify bloqueada pelo kill switch operacional." }
    : budget.blockedReason === "claim_unconfirmed"
      ? { alertType: "apify_budget_claim_unconfirmed", severity: "WARNING" as const, message: "Reserva de orçamento Apify não confirmada; o dispatch foi bloqueado por segurança." }
      : budget.blockedReason === "budget_unavailable"
        ? { alertType: "apify_budget_unavailable", severity: "CRITICAL" as const, message: "Orçamento Apify indisponível; o dispatch foi bloqueado." }
        : { alertType: "apify_daily_limit_reached", severity: "CRITICAL" as const, message: "Cota diária Apify insuficiente; o dispatch não foi iniciado." }),
  recordOperationalAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./ingestion-reports", () => ({
  startIngestionRun: mocks.startIngestionRun,
  linkIngestionRunToApifyActor: mocks.linkIngestionRunToApifyActor,
  setIngestionRunDetails: mocks.setIngestionRunDetails,
  finishIngestionRun: mocks.finishIngestionRun,
  findIngestionRunByApifyActor: mocks.findIngestionRunByApifyActor,
}));

vi.mock("./db", () => ({
  claimApifyDailyRequest: mocks.claimApifyDailyRequest,
  getApifyBudgetBlockAlert: mocks.getApifyBudgetBlockAlert,
  recordOperationalAlert: mocks.recordOperationalAlert,
}));

import { apifyInstagramWebhookHandler, asyncIngestInstagramHandler, getConfiguredApifyStoriesActorId, normalizeApifyActorId, readApifyErrorDetail, sanitizeApifyDiagnostic, sanitizeApifyWebhookBaseUrl, startAsyncApifyStoriesRun } from "./apify-async";

describe("Apify async Stories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startIngestionRun.mockResolvedValue(42);
    mocks.linkIngestionRunToApifyActor.mockResolvedValue(true);
    mocks.setIngestionRunDetails.mockResolvedValue(true);
    mocks.claimApifyDailyRequest.mockResolvedValue({ allowed: true, dateKey: "2026-09-18", requestCount: 1, dailyLimit: 100, persistence: true });
    process.env.APIFY_API_TOKEN = "test-token";
    process.env.SCHEDULED_TASK_ENDPOINT_BASE = "https://weekendvib-jscaalye.manus.space";
    process.env.INTERNAL_CRON_SECRET = "cron-secret";
  });

  it("normaliza o identificador autor/actor para o separador exigido pela API v2", () => {
    expect(normalizeApifyActorId("zaver.api/instagram-stories-highlights-scraper")).toBe("zaver.api~instagram-stories-highlights-scraper");
    expect(normalizeApifyActorId(" zaver.api~instagram-stories-highlights-scraper ")).toBe("zaver.api~instagram-stories-highlights-scraper");
  });

  it("remove Markdown da URL base do webhook e exige HTTPS absoluto", () => {
    expect(sanitizeApifyWebhookBaseUrl("[https://weekendvibes-dh6w.vercel.app](https://weekendvibes-dh6w.vercel.app)/"))
      .toBe("https://weekendvibes-dh6w.vercel.app");
    expect(sanitizeApifyWebhookBaseUrl(" https://example.test/base/?ignored=yes#fragment "))
      .toBe("https://example.test/base");
    expect(() => sanitizeApifyWebhookBaseUrl("http://example.test")).toThrow("HTTPS");
    expect(() => sanitizeApifyWebhookBaseUrl("[not-a-url](not-a-url)")).toThrow("URL HTTPS absoluta válida");
  });

  it("extrai details do erro e remove credenciais e parâmetros sensíveis", () => {
    const payload = { error: { message: "Input invalid", details: { field: "targets", token: "apify_api_secret", url: "https://api.example.test/run?token=secret&keep=yes" } } };
    const detail = readApifyErrorDetail(payload);
    expect(detail).toContain("targets");
    expect(detail).toContain("token");
    expect(detail).not.toContain("apify_api_secret");
    expect(detail).not.toContain("token=secret");
    expect(sanitizeApifyDiagnostic("Authorization: Bearer very-secret-value")).toContain("[redacted]");
    expect(sanitizeApifyDiagnostic("Authorization: Bearer very-secret-value")).not.toContain("very-secret-value");
  });

  it("inicia o Actor sem esperar o dataset e vincula o ingestionRun", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "actor-run-1", defaultDatasetId: "dataset-1" } }), { status: 201, headers: { "content-type": "application/json" } })
    );

    const result = await startAsyncApifyStoriesRun({ targets: [{ username: "venue-test" }] });

    expect(result).toEqual({ runId: 42, actorRunId: "actor-run-1", status: "QUEUED" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(getConfiguredApifyStoriesActorId()).toBe("zaver.api~instagram-stories-highlights-scraper");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v2/acts/zaver.api~instagram-stories-highlights-scraper/runs?");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("webhooks=");
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const webhookInput = requestUrl.searchParams.get("webhooks") ?? "";
    const webhooks = JSON.parse(Buffer.from(webhookInput, "base64").toString("utf8")) as Array<Record<string, unknown>>;
    const runDetails = mocks.setIngestionRunDetails.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(requestUrl.searchParams.has("token")).toBe(false);
    expect(webhookInput).toBe(Buffer.from(JSON.stringify(webhooks), "utf8").toString("base64"));
    expect(requestInit?.headers).toMatchObject({ Authorization: "Bearer test-token" });
    expect(JSON.parse(String(requestInit?.body))).toEqual({ targets: ["venue-test"], scrapeType: "both", maxHighlights: 2, onlyNew: true });
    expect(webhooks).toEqual([expect.objectContaining({
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT"],
      requestUrl: "https://weekendvib-jscaalye.manus.space/api/webhooks/apify/instagram",
      headersTemplate: JSON.stringify({ "x-apify-signature": runDetails.callbackToken }),
      payloadTemplate: '{"resource":{{resource}}}',
    })]);
    expect(webhooks[0]).not.toHaveProperty("requestHeaders");
    expect(mocks.linkIngestionRunToApifyActor).toHaveBeenCalledWith({ runId: 42, actorRunId: "actor-run-1" });
    expect(mocks.setIngestionRunDetails).toHaveBeenCalledWith(42, expect.objectContaining({ actorRunId: "actor-run-1", datasetId: "dataset-1", status: "QUEUED" }));
    fetchMock.mockRestore();
  });

  it("não deixa o override de alvos contornar orçamento nem kill switch", async () => {
    const targets = Array.from({ length: 14 }, (_, index) => ({ username: `venue${index}` }));
    const fetchMock = vi.spyOn(globalThis, "fetch");
    mocks.claimApifyDailyRequest.mockResolvedValueOnce({ allowed: false, dateKey: "2026-10-30", requestCount: 95, dailyLimit: 100, persistence: true, units: 14, blockedReason: "daily_limit" });
    await expect(startAsyncApifyStoriesRun({ trigger: "manual", targets })).rejects.toThrow("Cota diária Apify insuficiente");
    expect(mocks.claimApifyDailyRequest).toHaveBeenCalledWith({ units: 14 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.startIngestionRun).not.toHaveBeenCalled();
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "apify_daily_limit_reached", severity: "CRITICAL" }));
    fetchMock.mockRestore();

    const unconfirmedFetch = vi.spyOn(globalThis, "fetch");
    mocks.claimApifyDailyRequest.mockResolvedValueOnce({ allowed: false, dateKey: "2026-10-30", requestCount: 14, dailyLimit: 100, persistence: true, units: 14, blockedReason: "claim_unconfirmed" });
    await expect(startAsyncApifyStoriesRun({ trigger: "manual", targets })).rejects.toThrow("Reserva de orçamento Apify não confirmada");
    expect(unconfirmedFetch).not.toHaveBeenCalled();
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "apify_budget_claim_unconfirmed", severity: "WARNING" }));
    unconfirmedFetch.mockRestore();

    const killSwitchFetch = vi.spyOn(globalThis, "fetch");
    mocks.claimApifyDailyRequest.mockResolvedValueOnce({ allowed: false, dateKey: "2026-10-30", requestCount: 0, dailyLimit: 100, persistence: true, units: 14, blockedReason: "kill_switch" });
    await expect(startAsyncApifyStoriesRun({ trigger: "manual", targets })).rejects.toThrow("kill switch operacional");
    expect(killSwitchFetch).not.toHaveBeenCalled();
    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(expect.objectContaining({ alertType: "apify_kill_switch_active", severity: "CRITICAL" }));
    killSwitchFetch.mockRestore();
  });

  it("retorna diagnóstico sanitizado quando o Actor público não existe", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Task not found" } }), { status: 404, headers: { "content-type": "application/json" } })
    );
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await asyncIngestInstagramHandler({ headers: { "x-cron-secret": process.env.INTERNAL_CRON_SECRET } } as never, res);
    expect((res as any).status).toHaveBeenCalledWith(502);
    expect((res as any).json).toHaveBeenCalledWith({
      ok: false,
      status: 502,
      error: "APIFY_ACTOR_NOT_FOUND",
      message: expect.stringContaining("Erro na Apify (404)"),
    });
    expect(JSON.stringify((res as any).json.mock.calls)).toContain("Task not found");
    fetchMock.mockRestore();
  });

  it("retorna diagnóstico sanitizado quando o payload do Actor é inválido", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "invalid input" } }), { status: 400, headers: { "content-type": "application/json" } })
    );
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await asyncIngestInstagramHandler({ headers: { "x-cron-secret": process.env.INTERNAL_CRON_SECRET } } as never, res);
    expect((res as any).status).toHaveBeenCalledWith(502);
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      error: "APIFY_ACTOR_REQUEST_INVALID",
      message: expect.stringContaining("Erro na Apify (400)"),
    }));
    fetchMock.mockRestore();
  });

  it("persiste o detalhe sanitizado devolvido pela Apify no HTTP 400", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Input is not valid", details: { field: "targets", token: "apify_api_secret" } } }), { status: 400, headers: { "content-type": "application/json" } })
    );
    await expect(startAsyncApifyStoriesRun({ targets: [{ username: "meulugar.bar" }] })).rejects.toThrow("targets");
    expect(mocks.finishIngestionRun).toHaveBeenCalledWith(42, expect.objectContaining({ details: expect.objectContaining({ providerDetail: expect.stringContaining("targets") }) }));
    expect(JSON.stringify(mocks.finishIngestionRun.mock.calls)).not.toContain("apify_api_secret");
    fetchMock.mockRestore();
  });

  it("classifica HTTP 403 do Actor como sessão inválida sem expor o cookie", async () => {
    process.env.APIFY_INSTAGRAM_SESSION_COOKIE = "session-cookie-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Instagram session cookie expired" } }), { status: 403, headers: { "content-type": "application/json" } })
    );
    await expect(startAsyncApifyStoriesRun({ trigger: "automatic" })).rejects.toThrow("credencial de sessão");
    expect(mocks.finishIngestionRun).toHaveBeenCalledWith(42, expect.objectContaining({ httpStatus: 403, details: expect.objectContaining({ error: "SESSION_COOKIE_INVALID_OR_EXPIRED", kind: "session_credentials" }) }));
    expect(JSON.stringify(mocks.finishIngestionRun.mock.calls)).not.toContain("session-cookie-secret");
    fetchMock.mockRestore();
    delete process.env.APIFY_INSTAGRAM_SESSION_COOKIE;
  });

  it("rejeita token inválido do webhook sem alterar o run", async () => {
    mocks.findIngestionRunByApifyActor.mockResolvedValueOnce({ id: 77, status: "running", details: JSON.stringify({ callbackToken: "expected" }) });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await apifyInstagramWebhookHandler({ headers: { "x-apify-signature": "wrong" }, body: { resource: { id: "actor-run-invalid" } } } as never, res);
    expect((res as any).status).toHaveBeenCalledWith(403);
    expect(mocks.finishIngestionRun).not.toHaveBeenCalled();
  });

  it("finaliza como failed quando o Actor não conclui com sucesso", async () => {
    mocks.findIngestionRunByApifyActor.mockResolvedValueOnce({ id: 78, status: "running", details: JSON.stringify({ callbackToken: "expected" }) });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await apifyInstagramWebhookHandler({ headers: { "x-apify-signature": "expected" }, body: { resource: { id: "actor-run-failed", status: "FAILED" } } } as never, res);
    expect((res as any).status).toHaveBeenCalledWith(202);
    expect(mocks.finishIngestionRun).toHaveBeenCalledWith(78, expect.objectContaining({ status: "failed", httpStatus: 502 }));
  });

  it("valida o segredo M2M no endpoint leve sem expô-lo", async () => {
    const authLog = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "actor-run-secret", defaultDatasetId: "dataset-secret" } }), { status: 201, headers: { "content-type": "application/json" } })
    );
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await asyncIngestInstagramHandler({ headers: { "x-cron-secret": process.env.INTERNAL_CRON_SECRET } } as never, res);
    expect((res as any).status).toHaveBeenCalledWith(200);
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ accepted: true, status: "QUEUED" }));
    expect(authLog.mock.calls.flat()).not.toContain(process.env.INTERNAL_CRON_SECRET);
    fetchMock.mockRestore();
    authLog.mockRestore();
  });

  it("responde HTTP 200 no disparo autenticado por M2M", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "actor-run-2", defaultDatasetId: "dataset-2" } }), { status: 201, headers: { "content-type": "application/json" } })
    );
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;

    await asyncIngestInstagramHandler({ headers: { "x-cron-secret": "cron-secret" } } as never, res);

    expect((res as any).status).toHaveBeenCalledWith(200);
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, accepted: true, status: "QUEUED" }));
    fetchMock.mockRestore();
  });
});
