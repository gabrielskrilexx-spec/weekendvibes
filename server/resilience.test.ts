import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMrIngressosWithRetry, MR_INGRESSOS_RETRY_ATTEMPTS, MR_INGRESSOS_RETRY_BASE_DELAY_MS } from "./ingestion";

const dbMocks = vi.hoisted(() => ({
  getCircuitBreakerStatus: vi.fn().mockResolvedValue({ allowed: true }),
  recordCircuitFailure: vi.fn().mockResolvedValue({ openedNow: false, failureCount: 1, nextAttemptAt: null }),
  recordCircuitSuccess: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./db", () => dbMocks);

const circuit = await import("./circuit-breaker");

beforeEach(() => {
  dbMocks.recordCircuitFailure.mockResolvedValue({ openedNow: false, failureCount: 1, nextAttemptAt: null });
  dbMocks.recordCircuitSuccess.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRITICAL_ALERT_WEBHOOK_URL;
  delete process.env.INGESTION_CIRCUIT_BREAKER_FAILURE_THRESHOLD;
});

describe("resiliência dos adaptadores", () => {
  it("repete somente timeouts do Mr Ingressos com backoff exponencial e retorna no sucesso", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }))
      .mockRejectedValueOnce(Object.assign(new Error("request timed out"), { name: "TimeoutError" }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const promise = fetchMrIngressosWithRetry("https://mringressos.com.br/comprar/1/teste", {}, fetchImpl);
    await vi.advanceTimersByTimeAsync(MR_INGRESSOS_RETRY_BASE_DELAY_MS + MR_INGRESSOS_RETRY_BASE_DELAY_MS * 2);
    const response = await promise;
    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(MR_INGRESSOS_RETRY_ATTEMPTS);
    vi.useRealTimers();
  });

  it("não repete uma resposta HTTP 403", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("blocked", { status: 403 }));
    const response = await fetchMrIngressosWithRetry("https://mringressos.com.br/comprar/1/teste", {}, fetchImpl);
    expect(response.status).toBe(403);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("usa um limiar configurável para pausar uma fonte após falhas severas consecutivas", async () => {
    process.env.INGESTION_CIRCUIT_BREAKER_FAILURE_THRESHOLD = "2";
    process.env.CRITICAL_ALERT_WEBHOOK_URL = "https://alerts.example.test/hook";
    const webhook = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    const sourceKey = `instagram:session-test-${Date.now()}`;
    dbMocks.recordCircuitFailure
      .mockResolvedValueOnce({ openedNow: false, failureCount: 1, nextAttemptAt: null })
      .mockResolvedValueOnce({ openedNow: true, failureCount: 2, nextAttemptAt: new Date("2026-09-12T02:00:00.000Z") });
    await circuit.registerSourceFailure({ sourceKey, routine: "instagram-agenda", status: 401, message: "session cookie expired" });
    await circuit.registerSourceFailure({ sourceKey, routine: "instagram-agenda", status: 401, message: "session cookie expired" });
    expect(dbMocks.recordCircuitFailure).toHaveBeenLastCalledWith(sourceKey, "session cookie expired", 401, expect.any(Date), undefined, true);
    expect(webhook).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(webhook.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ type: "circuit_opened", sourceKey, failureCount: 2 });
  });

  it("notifica uma fonte após três HTTP 403 consecutivos, sem expor segredo", async () => {
    process.env.CRITICAL_ALERT_WEBHOOK_URL = "https://alerts.example.test/hook";
    const webhook = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    const sourceKey = `public:ingresse-test-${Date.now()}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await circuit.registerSourceFailure({ sourceKey, routine: "public-agenda", status: 403, message: "Fonte pública respondeu 403" });
    }
    expect(webhook).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(webhook.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ type: "source_http_403_blocked", sourceKey, failureCount: 3 });
    expect(JSON.stringify(body)).not.toContain("token");
  });
});
