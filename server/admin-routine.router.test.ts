import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { getWednesdayRoutineStatus, runWednesdayRoutineNow, runIngestionSourceChunk } from "./manual-ingestion";

vi.mock("./manual-ingestion", () => ({
  getWednesdayRoutineStatus: vi.fn(() => ({ enabled: true, runMode: "full_auto", timezone: "America/Sao_Paulo", cron: "0 0 10 * * 3", nextExecutionAt: "2026-08-19T13:00:00.000Z", isRunning: false, recentRuns: [{ id: 77, filteredStories: [{ id: "story-1", username: "meulugar.bar", mediaOrigin: "story", imageUrl: "https://example.com/story.png", sourceUrl: "https://instagram.com/meulugar.bar", postedAt: new Date("2026-08-29T01:00:00.000Z"), expiresAt: null, ocrText: "Rolê hoje", rawText: "Rolê hoje", reasons: ["sem data"], status: "approved", approvedBy: "admin-open-id", approvedAt: new Date("2026-08-29T02:00:00.000Z") }, { id: "story-2", username: "outra-fonte", mediaOrigin: "highlight", imageUrl: "https://example.com/highlight.png", sourceUrl: "https://instagram.com/outra-fonte", postedAt: null, expiresAt: null, ocrText: "", rawText: "", reasons: ["baixa confiança"], status: "pending" }] }] })),
  runWednesdayRoutineNow: vi.fn().mockResolvedValue({ archived: 0, publicSources: { imported: 2 }, instagram: { imported: 1 }, startedAt: "2026-08-12T13:00:00.000Z", finishedAt: "2026-08-12T13:00:02.000Z" }),
  runIngestionSourceChunk: vi.fn().mockResolvedValue({ sourceKey: "instagram", dryRun: false, result: { sourceReports: [{ read: 1, errors: [] }], sandboxRestricted: true, previewMock: true, degraded: false } }),
}));

const context = (role: "admin" | "user") => ({
  user: { id: 1, openId: "routine-test", name: "Routine Test", email: null, loginMethod: null, role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as any,
  res: {} as any,
});

describe("adminRoutine tRPC contract", () => {
  beforeEach(() => vi.clearAllMocks());
  it("retorna o status da rotina para administradores", async () => {
    const result = await appRouter.createCaller(context("admin")).adminRoutine.status();
    expect(result.nextExecutionAt).toBe("2026-08-19T13:00:00.000Z");
    expect(getWednesdayRoutineStatus).toHaveBeenCalled();
  });
  it("encaminha o disparo manual somente para administradores", async () => {
    const result = await appRouter.createCaller(context("admin")).adminRoutine.runNow();
    expect(result.publicSources).toEqual({ imported: 2 });
    expect(runWednesdayRoutineNow).toHaveBeenCalledTimes(1);
  });
  it("pagina e filtra Stories, preservando auditoria sanitizada", async () => {
    const result = await appRouter.createCaller(context("admin")).adminRoutine.filteredStories({ offset: 0, limit: 1, reason: "SEM DATA" });
    expect(result).toMatchObject({ total: 1, offset: 0, limit: 1, hasNextPage: false });
    expect(result.items[0]).toMatchObject({ id: "story-1", approvedBy: "admin-open-id", status: "approved" });
    expect(result.items[0]?.postedAt).toBe("2026-08-29T01:00:00.000Z");
    expect(result.items[0]?.approvedAt).toBe("2026-08-29T02:00:00.000Z");
  });
  it("retorna acknowledgement JSON estrito ao sincronizar Stories", async () => {
    const result = await appRouter.createCaller(context("admin")).adminRoutine.syncStories({});
    expect(result).toEqual({ success: true });
    expect(runIngestionSourceChunk).toHaveBeenCalledWith({ sourceKey: "instagram", dryRun: false, storiesOnly: true });
  });
  it("converte ECONNREFUSED do Instagram em fallback sandbox serializável", async () => {
    vi.mocked(runIngestionSourceChunk).mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await appRouter.createCaller(context("admin")).adminRoutine.runSource({ sourceKey: "instagram", dryRun: false });
    expect(result).toMatchObject({ ok: true, sourceKey: "instagram", status: "SANDBOX_RESTRICTED", sandboxRestricted: true, previewMock: true, errors: ["Fonte restrita no ambiente de preview; fallback sandbox aplicado."] });
  });
  it("converte falha de proxy em acknowledgement sandbox no syncStories", async () => {
    vi.mocked(runIngestionSourceChunk).mockRejectedValueOnce(new Error("Failed to fetch ECONNREFUSED"));
    const result = await appRouter.createCaller(context("admin")).adminRoutine.syncStories({});
    expect(result).toEqual({ success: true });
  });
  it("rejeita o disparo manual por usuário comum", async () => {
    await expect(appRouter.createCaller(context("user")).adminRoutine.runNow()).rejects.toThrow();
    expect(runWednesdayRoutineNow).not.toHaveBeenCalled();
    await expect(appRouter.createCaller(context("user")).adminRoutine.syncStories({})).rejects.toThrow();
  });
});
