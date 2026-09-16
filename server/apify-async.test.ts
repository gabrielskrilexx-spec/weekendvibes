import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startIngestionRun: vi.fn().mockResolvedValue(42),
  linkIngestionRunToApifyActor: vi.fn().mockResolvedValue(true),
  setIngestionRunDetails: vi.fn().mockResolvedValue(true),
  finishIngestionRun: vi.fn().mockResolvedValue(undefined),
  findIngestionRunByApifyActor: vi.fn(),
}));

vi.mock("./ingestion-reports", () => ({
  startIngestionRun: mocks.startIngestionRun,
  linkIngestionRunToApifyActor: mocks.linkIngestionRunToApifyActor,
  setIngestionRunDetails: mocks.setIngestionRunDetails,
  finishIngestionRun: mocks.finishIngestionRun,
  findIngestionRunByApifyActor: mocks.findIngestionRunByApifyActor,
}));

import { apifyInstagramWebhookHandler, asyncIngestInstagramHandler, getConfiguredApifyStoriesActorId, startAsyncApifyStoriesRun } from "./apify-async";

describe("Apify async Stories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startIngestionRun.mockResolvedValue(42);
    mocks.linkIngestionRunToApifyActor.mockResolvedValue(true);
    mocks.setIngestionRunDetails.mockResolvedValue(true);
    process.env.APIFY_API_TOKEN = "test-token";
    process.env.SCHEDULED_TASK_ENDPOINT_BASE = "https://weekendvib-jscaalye.manus.space";
    process.env.INTERNAL_CRON_SECRET = "cron-secret";
  });

  it("inicia o Actor sem esperar o dataset e vincula o ingestionRun", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "actor-run-1", defaultDatasetId: "dataset-1" } }), { status: 201, headers: { "content-type": "application/json" } })
    );

    const result = await startAsyncApifyStoriesRun();

    expect(result).toEqual({ runId: 42, actorRunId: "actor-run-1", status: "QUEUED" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(getConfiguredApifyStoriesActorId()).toBe("zaver.api~instagram-stories-highlights-scraper");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v2/acts/zaver.api~instagram-stories-highlights-scraper/runs?");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("webhooks=");
    expect(mocks.linkIngestionRunToApifyActor).toHaveBeenCalledWith({ runId: 42, actorRunId: "actor-run-1" });
    expect(mocks.setIngestionRunDetails).toHaveBeenCalledWith(42, expect.objectContaining({ actorRunId: "actor-run-1", datasetId: "dataset-1", status: "QUEUED" }));
    fetchMock.mockRestore();
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
    expect(JSON.stringify((res as any).json.mock.calls)).not.toContain("Task not found");
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
    await apifyInstagramWebhookHandler({ query: { token: "wrong" }, body: { resource: { id: "actor-run-invalid" } } } as never, res);
    expect((res as any).status).toHaveBeenCalledWith(403);
    expect(mocks.finishIngestionRun).not.toHaveBeenCalled();
  });

  it("finaliza como failed quando o Actor não conclui com sucesso", async () => {
    mocks.findIngestionRunByApifyActor.mockResolvedValueOnce({ id: 78, status: "running", details: JSON.stringify({ callbackToken: "expected" }) });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await apifyInstagramWebhookHandler({ query: { token: "expected" }, body: { resource: { id: "actor-run-failed", status: "FAILED" } } } as never, res);
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
    expect((res as any).status).toHaveBeenCalledWith(202);
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ accepted: true, status: "QUEUED" }));
    expect(authLog).toHaveBeenCalledWith("[Instagram async] cron authentication accepted", { mode: "header" });
    expect(authLog.mock.calls.flat()).not.toContain(process.env.INTERNAL_CRON_SECRET);
    fetchMock.mockRestore();
    authLog.mockRestore();
  });

  it("responde HTTP 202 no callback autenticado por M2M", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "actor-run-2", defaultDatasetId: "dataset-2" } }), { status: 201, headers: { "content-type": "application/json" } })
    );
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;

    await asyncIngestInstagramHandler({ headers: { "x-cron-secret": "cron-secret" } } as never, res);

    expect((res as any).status).toHaveBeenCalledWith(202);
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, accepted: true, status: "QUEUED" }));
    fetchMock.mockRestore();
  });
});
