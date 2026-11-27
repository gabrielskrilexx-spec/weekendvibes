import { describe, expect, it, vi } from "vitest";
import { listOperationalAlerts, operationalAlertFingerprint, recordOperationalAlert, resolveOperationalAlert, resolveAllOperationalAlerts, purgeResolvedOperationalAlerts } from "./db";

describe("operational alerts", () => {
  it("gera fingerprint estável por integração e mensagem normalizada", () => {
    expect(operationalAlertFingerprint("meta", " Meta retornou 503 ")).toBe(operationalAlertFingerprint("meta", "Meta retornou 503"));
    expect(operationalAlertFingerprint("meta", "Meta retornou 503")).not.toBe(operationalAlertFingerprint("ocr", "Meta retornou 503"));
  });

  it("persiste o alerta com deduplicação e reabre um alerta repetido", async () => {
    const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onDuplicateKeyUpdate });
    const fakeDb = { insert: vi.fn().mockReturnValue({ values }) } as never;

    const result = await recordOperationalAlert({ dbOverride: fakeDb, integration: "openai", title: "Falha OpenAI", message: "timeout" });

    expect(result).toEqual(expect.objectContaining({ integration: "openai", fingerprint: expect.any(String), isResolved: 0 }));
    expect(onDuplicateKeyUpdate).toHaveBeenCalledWith(expect.objectContaining({ set: expect.objectContaining({ isResolved: 0 }) }));
  });

  it("retorna runId sanitizado e preserva null nos alertas listados", async () => {
    const rows = [
      { id: 146, alertType: "ingestion_run_timeout", severity: "CRITICAL", title: "Run expirado", message: "timeout_exceeded_2h", runId: "146", isResolved: 0, createdAt: new Date("2026-11-26T10:00:00Z"), updatedAt: new Date("2026-11-26T10:00:00Z") },
      { id: 147, alertType: "partial", severity: "WARNING", title: "Coleta parcial", message: "uma URL falhou", runId: null, isResolved: 0, createdAt: new Date("2026-11-26T09:00:00Z"), updatedAt: new Date("2026-11-26T09:00:00Z") },
    ];
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const execute = vi.fn(() => { throw new Error("DDL must never execute during alert reads"); });
    const fakeDb = { select: vi.fn().mockReturnValue({ from }), execute } as never;

    await expect(listOperationalAlerts(10, fakeDb)).resolves.toEqual([
      expect.objectContaining({ runId: "146", isResolved: false }),
      expect.objectContaining({ runId: null, isResolved: false }),
    ]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("serializa datas como Date, string ISO, null ou inválida sem lançar TypeError", async () => {
    const rows = [
      { id: 201, alertType: "date", severity: "INFO", title: "Date", message: "date", runId: null, isResolved: 0, createdAt: new Date("2026-11-26T10:00:00.000Z"), updatedAt: new Date("2026-11-26T10:01:00.000Z") },
      { id: 202, alertType: "string", severity: "INFO", title: "String", message: "string", runId: null, isResolved: 0, createdAt: "2026-11-26T11:00:00.000Z", updatedAt: "2026-11-26T11:01:00.000Z" },
      { id: 203, alertType: "null", severity: "INFO", title: "Null", message: "null", runId: null, isResolved: 0, createdAt: null, updatedAt: undefined },
      { id: 204, alertType: "invalid", severity: "INFO", title: "Invalid", message: "invalid", runId: null, isResolved: 0, createdAt: "not-a-date", updatedAt: "also-not-a-date" },
    ];
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const fakeDb = { select: vi.fn().mockReturnValue({ from }) } as never;

    await expect(listOperationalAlerts(10, fakeDb)).resolves.toEqual([
      expect.objectContaining({ id: 201, createdAt: "2026-11-26T10:00:00.000Z", updatedAt: "2026-11-26T10:01:00.000Z" }),
      expect.objectContaining({ id: 202, createdAt: "2026-11-26T11:00:00.000Z", updatedAt: "2026-11-26T11:01:00.000Z" }),
      expect.objectContaining({ id: 203, createdAt: null, updatedAt: null }),
      expect.objectContaining({ id: 204, createdAt: null, updatedAt: null }),
    ]);
  });

  it("resolve um alerta pelo id para uso exclusivo do painel administrativo", async () => {
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const fakeDb = { update: vi.fn().mockReturnValue({ set: updateSet }) } as never;

    await resolveOperationalAlert(4, fakeDb);
    expect(updateWhere).toHaveBeenCalled();
  });

  it("arquiva todos os alertas abertos e retorna a contagem sem apagar histórico", async () => {
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const fakeDb = {
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 4 }, { id: 5 }]) }) }),
      update: vi.fn().mockReturnValue({ set: updateSet }),
    } as never;

    await expect(resolveAllOperationalAlerts(fakeDb)).resolves.toEqual({ resolvedCount: 2 });
    expect(updateWhere).toHaveBeenCalledOnce();
  });

  it("purga apenas alertas resolvidos além da retenção mínima de 30 dias", async () => {
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const fakeDb = {
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 9 }]) }) }),
      delete: vi.fn().mockReturnValue({ where: deleteWhere }),
    } as never;
    const now = new Date("2026-08-26T12:00:00.000Z");

    await expect(purgeResolvedOperationalAlerts(7, now, fakeDb)).resolves.toEqual({ purgedCount: 1, cutoff: "2026-07-27T12:00:00.000Z" });
    expect(deleteWhere).toHaveBeenCalledOnce();
  });
});
