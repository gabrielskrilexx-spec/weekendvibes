import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { getWednesdayRoutineStatus, runWednesdayRoutineNow } from "./manual-ingestion";

vi.mock("./manual-ingestion", () => ({
  getWednesdayRoutineStatus: vi.fn(() => ({ enabled: true, runMode: "full_auto", timezone: "America/Sao_Paulo", cron: "0 0 10 * * 3", nextExecutionAt: "2026-08-19T13:00:00.000Z", isRunning: false })),
  runWednesdayRoutineNow: vi.fn().mockResolvedValue({ archived: 0, publicSources: { imported: 2 }, instagram: { imported: 1 }, startedAt: "2026-08-12T13:00:00.000Z", finishedAt: "2026-08-12T13:00:02.000Z" }),
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
  it("rejeita o disparo manual por usuário comum", async () => {
    await expect(appRouter.createCaller(context("user")).adminRoutine.runNow()).rejects.toThrow();
    expect(runWednesdayRoutineNow).not.toHaveBeenCalled();
  });
});
