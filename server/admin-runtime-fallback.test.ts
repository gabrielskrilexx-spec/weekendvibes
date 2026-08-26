import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  runWednesdayRoutineNow: vi.fn(),
  runDryRun: vi.fn(),
}));

vi.mock("./manual-ingestion", () => ({
  getWednesdayRoutineStatus: vi.fn(),
  runWednesdayRoutineNow: mocks.runWednesdayRoutineNow,
}));
vi.mock("./dry-run", () => ({ runDryRun: mocks.runDryRun }));

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-runtime-test",
    email: "admin@example.com",
    name: "Admin Runtime Test",
    loginMethod: "test",
    role: "admin",
    createdAt: new Date("2026-08-26T12:00:00.000Z"),
    updatedAt: new Date("2026-08-26T12:00:00.000Z"),
    lastSignedIn: new Date("2026-08-26T12:00:00.000Z"),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin runtime fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("converte falha da execução manual em ACK JSON sanitizado", async () => {
    mocks.runWednesdayRoutineNow.mockRejectedValueOnce(
      new Error("upstream timeout with token https://secret.example")
    );

    const result = await appRouter
      .createCaller(createAdminContext())
      .adminRoutine.runNow();

    expect(result).toEqual({
      ok: false,
      message: "Falha interna ao conectar com as fontes.",
      details: [],
    });
    expect(result).not.toHaveProperty("stack");
    expect(JSON.stringify(result)).not.toContain("secret.example");
  });

  it("converte falha do dry-run em relatório JSON sanitizado", async () => {
    mocks.runDryRun.mockRejectedValueOnce(
      new Error("network failure with internal details")
    );

    const result = await appRouter
      .createCaller(createAdminContext())
      .ingestionReports.dryRun();

    expect(result).toEqual({
      dryRun: false,
      success: false,
      message: "Falha interna ao conectar com as fontes.",
      details: [],
    });
    expect(result).not.toHaveProperty("stack");
  });
});
