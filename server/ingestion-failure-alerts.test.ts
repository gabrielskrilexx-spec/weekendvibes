import { describe, expect, it, vi } from "vitest";
import {
  buildIngestionFailureFingerprint,
  handleIngestionFailureAlert,
  notifyConsecutiveFailureWebhook,
} from "./ingestion-failure-alerts";

function fakeDb(existing?: { id: number; isResolved: number }) {
  const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onDuplicateKeyUpdate });
  const limit = vi.fn().mockResolvedValue(existing ? [existing] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const tx = { select, insert: vi.fn().mockReturnValue({ values }) };
  const db = { transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) };
  return { db: db as never, onDuplicateKeyUpdate, values, tx };
}

const baseInput = {
  routine: "instagram-agenda",
  sourceKey: "instagram:mobydicksantos",
  integration: "meta" as const,
  status: 400,
  errorCode: 200,
  message: "API access blocked\nsegredo não deve aparecer",
  runId: 42,
};

describe("ingestion failure alerts", () => {
  it("gera fingerprint determinística que muda com o contexto operacional", () => {
    expect(buildIngestionFailureFingerprint(baseInput)).toBe(buildIngestionFailureFingerprint({ ...baseInput }));
    expect(buildIngestionFailureFingerprint(baseInput)).not.toBe(buildIngestionFailureFingerprint({ ...baseInput, status: 503 }));
    expect(buildIngestionFailureFingerprint(baseInput)).not.toBe(buildIngestionFailureFingerprint({ ...baseInput, routine: "public-agenda" }));
  });

  it("notifica uma nova falha e persiste mensagem sanitizada", async () => {
    const { db, onDuplicateKeyUpdate } = fakeDb();
    const notify = vi.fn().mockResolvedValue(undefined);

    const result = await handleIngestionFailureAlert(baseInput, { dbOverride: db, notify });

    expect(result).toMatchObject({ notified: true, reopened: false, deduplicated: false });
    expect(notify).toHaveBeenCalledOnce();
    expect(onDuplicateKeyUpdate).toHaveBeenCalledWith(expect.objectContaining({ set: expect.objectContaining({ isResolved: 0 }) }));
    expect(notify.mock.calls[0][0].message).not.toMatch(/\n/);
    expect(notify.mock.calls[0][0].message).not.toContain("token=");
  });

  it("deduplica uma falha ainda aberta e não envia nova notificação", async () => {
    const { db } = fakeDb({ id: 7, isResolved: 0 });
    const notify = vi.fn().mockResolvedValue(undefined);

    const result = await handleIngestionFailureAlert(baseInput, { dbOverride: db, notify });

    expect(result).toMatchObject({ notified: false, reopened: false, deduplicated: true });
    expect(notify).not.toHaveBeenCalled();
  });

  it("reabre uma falha resolvida e envia uma nova notificação", async () => {
    const { db } = fakeDb({ id: 7, isResolved: 1 });
    const notify = vi.fn().mockResolvedValue(undefined);

    const result = await handleIngestionFailureAlert(baseInput, { dbOverride: db, notify });

    expect(result).toMatchObject({ notified: true, reopened: true, deduplicated: false });
    expect(notify).toHaveBeenCalledOnce();
  });
});

describe("critical alert webhook configuration", () => {
  it("envia payload sanitizado e deduplica o mesmo conjunto de runs", async () => {
    const previous = process.env.CRITICAL_ALERT_WEBHOOK_URL;
    process.env.CRITICAL_ALERT_WEBHOOK_URL = "https://hooks.example.test/critical";
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const input = { routine: "public-agenda", count: 2, runIds: [901, 900], latestStartedAt: "2026-08-22T03:00:00.000Z", message: "Falha temporária access_token=secret123" };
    await expect(notifyConsecutiveFailureWebhook(input, fetcher)).resolves.toMatchObject({ sent: true });
    await expect(notifyConsecutiveFailureWebhook(input, fetcher)).resolves.toMatchObject({ sent: false, skipped: true });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ alert: "consecutive_ingestion_failures", routine: "public-agenda", count: 2, runIds: [901, 900] });
    expect(JSON.stringify(JSON.parse(fetcher.mock.calls[0][1].body))).not.toContain("secret123");
    if (previous === undefined) delete process.env.CRITICAL_ALERT_WEBHOOK_URL;
    else process.env.CRITICAL_ALERT_WEBHOOK_URL = previous;
  });

  it("aceita a URL opcional sem expor seu valor", () => {
    const previous = process.env.CRITICAL_ALERT_WEBHOOK_URL;
    process.env.CRITICAL_ALERT_WEBHOOK_URL = "https://hooks.example.test/critical";
    expect(new URL(process.env.CRITICAL_ALERT_WEBHOOK_URL).protocol).toBe("https:");
    expect(JSON.stringify({ configured: Boolean(process.env.CRITICAL_ALERT_WEBHOOK_URL) })).toBe('{"configured":true}');
    if (previous === undefined) delete process.env.CRITICAL_ALERT_WEBHOOK_URL;
    else process.env.CRITICAL_ALERT_WEBHOOK_URL = previous;
  });
});
