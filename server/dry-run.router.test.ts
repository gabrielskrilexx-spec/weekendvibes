import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";

const runDryRun = vi.hoisted(() => vi.fn().mockResolvedValue({
  dryRun: true,
  startedAt: "2026-08-25T12:00:00.000Z",
  finishedAt: "2026-08-25T12:00:01.000Z",
  durationMs: 1000,
  sources: [{ routine: "public-agenda", sourceKey: "public:blackpass", read: 2, filtered: 1, persistable: 1, duplicates: 0, errors: [], rejectionReasons: { fetchFailed: 0, outsideTargetVenue: 1, invalidStructuredEvent: 0, duplicate: 0, pastEvent: 0 } }],
  totals: { read: 2, filtered: 1, persistable: 1, duplicates: 0, errors: 0 },
}));
vi.mock("./dry-run", () => ({ runDryRun }));

const context = (role: "admin" | "user") => ({
  user: { id: 1, openId: "dry-run-test", name: "Dry Run Test", email: null, loginMethod: null, role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as any,
  res: {} as any,
});

describe("ingestionReports.dryRun", () => {
  it("permite o relatório somente para admin e mantém o contrato estruturado", async () => {
    const result = await appRouter.createCaller(context("admin")).ingestionReports.dryRun();
    expect(runDryRun).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ dryRun: true, totals: { read: 2, persistable: 1 }, sources: [{ sourceKey: "public:blackpass" }] });
  });

  it("rejeita usuário sem papel administrativo", async () => {
    await expect(appRouter.createCaller(context("user")).ingestionReports.dryRun()).rejects.toThrow();
    expect(runDryRun).toHaveBeenCalledTimes(1);
  });
});
