import { describe, expect, it, vi } from "vitest";
import { listOperationalAlerts, operationalAlertFingerprint, recordOperationalAlert, resolveOperationalAlert } from "./db";

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

  it("consulta alertas não resolvidos e resolve pelo id", async () => {
    const alert = { id: 4, integration: "ocr", title: "Falha OCR", message: "timeout", createdAt: new Date() };
    const limit = vi.fn().mockResolvedValue([alert]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const fakeDb = { select, update: vi.fn().mockReturnValue({ set: updateSet }) } as never;

    await expect(listOperationalAlerts({ dbOverride: fakeDb, size: 8 })).resolves.toEqual([alert]);
    await resolveOperationalAlert(4, fakeDb);
    expect(updateWhere).toHaveBeenCalled();
    expect(select).toHaveBeenCalled();
  });
});
