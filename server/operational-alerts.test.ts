import { describe, expect, it, vi } from "vitest";
import { operationalAlertFingerprint, recordOperationalAlert, resolveOperationalAlert, resolveAllOperationalAlerts } from "./db";

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
});
