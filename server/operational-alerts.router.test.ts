import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { resolveOperationalAlert } from "./db";

vi.mock("./db", () => ({
  deleteEvent: vi.fn(),
  getEventBySlug: vi.fn(),
  listEvents: vi.fn(),
  listRecentInstagramAgendaEvents: vi.fn(),
  listTodayEvents: vi.fn(),
  resolveOperationalAlert: vi.fn().mockResolvedValue(undefined),
  saveEvent: vi.fn(),
  updateEvent: vi.fn(),
}));

const context = (role: "admin" | "user") => ({
  user: { id: 1, openId: "alert-test", name: "Alert Test", email: null, loginMethod: null, role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as any,
  res: {} as any,
});

describe("operationalAlerts tRPC contract", () => {
  beforeEach(() => vi.clearAllMocks());
  it("encaminha a resolução para o banco quando o usuário é admin", async () => {
    await appRouter.createCaller(context("admin")).operationalAlerts.resolve({ id: 12 });
    expect(resolveOperationalAlert).toHaveBeenCalledWith(12);
  });

  it("rejeita resolução por usuário comum", async () => {
    await expect(appRouter.createCaller(context("user")).operationalAlerts.resolve({ id: 12 })).rejects.toThrow();
    expect(resolveOperationalAlert).not.toHaveBeenCalled();
  });
});
