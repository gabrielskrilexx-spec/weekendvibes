import { afterEach, describe, expect, it, vi } from "vitest";
import { claimApifyDailyRequest, getApifyDailyRequestLimit, saoPauloDateKey } from "./db";

describe("Apify daily budget", () => {
  afterEach(() => {
    delete process.env.APIFY_DAILY_REQUEST_LIMIT;
    delete process.env.APIFY_INGESTION_KILL_SWITCH;
  });

  it("uses a bounded configurable daily limit with a safe default", () => {
    expect(getApifyDailyRequestLimit()).toBe(3);
    process.env.APIFY_DAILY_REQUEST_LIMIT = "9";
    expect(getApifyDailyRequestLimit()).toBe(9);
    process.env.APIFY_DAILY_REQUEST_LIMIT = "0";
    expect(getApifyDailyRequestLimit()).toBe(1);
    process.env.APIFY_DAILY_REQUEST_LIMIT = "999";
    expect(getApifyDailyRequestLimit()).toBe(100);
  });

  it("derives the usage bucket from America/Sao_Paulo", () => {
    expect(saoPauloDateKey(new Date("2026-09-19T02:30:00.000Z"))).toBe("2026-09-18");
    expect(saoPauloDateKey(new Date("2026-09-19T04:30:00.000Z"))).toBe("2026-09-19");
  });

  it("fails closed when the atomic increment cannot claim a request", async () => {
    process.env.APIFY_DAILY_REQUEST_LIMIT = "2";
    const where = vi.fn().mockResolvedValue({ affectedRows: 0 });
    const set = vi.fn().mockReturnValue({ where });
    const fakeDb = {
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined) }) }),
      update: vi.fn().mockReturnValue({ set }),
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ requestCount: 2, dailyLimit: 2 }]) }) }) }),
    } as never;
    await expect(claimApifyDailyRequest({ now: new Date("2026-09-19T12:00:00.000Z"), dbOverride: fakeDb })).resolves.toMatchObject({ allowed: false, requestCount: 2, dailyLimit: 2, dateKey: "2026-09-19", persistence: true });
    expect(where).toHaveBeenCalledTimes(2);
  });

  it("blocks all paid dispatches when the kill switch is enabled", async () => {
    process.env.APIFY_INGESTION_KILL_SWITCH = "true";
    const fakeDb = {} as never;
    await expect(claimApifyDailyRequest({ units: 14, dbOverride: fakeDb })).resolves.toMatchObject({
      allowed: false,
      blockedReason: "kill_switch",
      persistence: true,
    });
  });
});
