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

import { apifyInstagramWebhookHandler, asyncIngestInstagramHandler, startAsyncApifyStoriesRun } from "./apify-async";

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
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v2/acts/automation-lab~instagram-stories-scraper/runs?");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("webhooks=");
    expect(mocks.linkIngestionRunToApifyActor).toHaveBeenCalledWith({ runId: 42, actorRunId: "actor-run-1" });
    expect(mocks.setIngestionRunDetails).toHaveBeenCalledWith(42, expect.objectContaining({ actorRunId: "actor-run-1", datasetId: "dataset-1", status: "QUEUED" }));
    fetchMock.mockRestore();
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
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "actor-run-secret", defaultDatasetId: "dataset-secret" } }), { status: 201, headers: { "content-type": "application/json" } })
    );
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as never;
    await asyncIngestInstagramHandler({ headers: { "x-cron-secret": process.env.INTERNAL_CRON_SECRET } } as never, res);
    expect((res as any).status).toHaveBeenCalledWith(202);
    expect((res as any).json).toHaveBeenCalledWith(expect.objectContaining({ accepted: true, status: "QUEUED" }));
    fetchMock.mockRestore();
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
