import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { getTuesdayRoutineStatus, runTuesdayRoutineNow } from "./manual-ingestion";

vi.mock("./manual-ingestion", () => ({
  getTuesdayRoutineStatus: vi.fn(() => ({ enabled: true, runMode: "full_auto", timezone: "America/Sao_Paulo", cron: "0 0 10 * * 2", nextExecutionAt: "2026-08-18T13:00:00.000Z", isRunning: false })),
  runTuesdayRoutineNow: vi.fn().mockResolvedValue({ archived: 0, publicSources: { imported: 2 }, instagram: { imported: 1 }, startedAt: "2026-08-12T13:00:00.000Z", finishedAt: "2026-08-12T13:00:02.000Z" }),
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
    expect(result.nextExecutionAt).toBe("2026-08-18T13:00:00.000Z");
    expect(getTuesdayRoutineStatus).toHaveBeenCalled();
  });
  it("encaminha o disparo manual somente para administradores", async () => {
    const result = await appRouter.createCaller(context("admin")).adminRoutine.runNow();
    expect(result.publicSources).toEqual({ imported: 2 });
    expect(runTuesdayRoutineNow).toHaveBeenCalledTimes(1);
  });
  it("rejeita o disparo manual por usuário comum", async () => {
    await expect(appRouter.createCaller(context("user")).adminRoutine.runNow()).rejects.toThrow();
    expect(runTuesdayRoutineNow).not.toHaveBeenCalled();
  });
});
