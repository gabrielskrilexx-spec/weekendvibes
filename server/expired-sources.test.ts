import { describe, expect, it, vi } from "vitest";
import { deactivateExpiredSources, findExpiredSourceKeysForTest, isContinuousIngestionSource, normalizeExpiredSourceMatchUrl } from "./db";

describe("expired ingestion source policy", () => {
  it("protects Instagram/Apify profiles", () => {
    expect(isContinuousIngestionSource({ kind: "instagram", sourceKey: "instagram:curvaosurfhouse" })).toBe(true);
  });

  it("protects global ticketing feeds", () => {
    expect(isContinuousIngestionSource({ kind: "public", sourceKey: "public:ingresse" })).toBe(true);
    expect(isContinuousIngestionSource({ kind: "public", sourceKey: "public:zig" })).toBe(true);
  });

  it("allows event-specific public sources to expire", () => {
    expect(isContinuousIngestionSource({ kind: "public", sourceKey: "public:articket-7358" })).toBe(false);
    expect(isContinuousIngestionSource({ kind: "public", sourceKey: "public:zig-inside-001" })).toBe(false);
  });

  it("normalizes tracking parameters, query order and trailing slashes without dropping event identifiers", () => {
    expect(normalizeExpiredSourceMatchUrl("https://tickets.example/events/show/?utm_source=instagram&event=42#tickets"))
      .toBe(normalizeExpiredSourceMatchUrl("https://tickets.example/events/show?event=42"));
    expect(normalizeExpiredSourceMatchUrl("https://tickets.example/events/show?event=42"))
      .not.toBe(normalizeExpiredSourceMatchUrl("https://tickets.example/events/show?event=43"));
  });

  it("matches expired source URLs canonically and leaves continuous, disabled and non-public sources untouched", () => {
    const sourceRows = [
      { sourceKey: "public:event-1", kind: "public", isEnabled: 1, url: "https://tickets.example/events/show/?utm_campaign=feed" },
      { sourceKey: "public:zig", kind: "public", isEnabled: 1, url: "https://zig.tickets/events" },
      { sourceKey: "public:event-disabled", kind: "public", isEnabled: 0, url: "https://tickets.example/disabled" },
      { sourceKey: "instagram:venue", kind: "instagram", isEnabled: 1, url: "https://instagram.com/venue" },
    ] as const;
    expect(findExpiredSourceKeysForTest(sourceRows, ["https://tickets.example/events/show#tickets"])).toEqual(["public:event-1"]);
  });

  it("reconciles event URLs and source URLs in separate database queries", async () => {
    const eventRows = [{ sourceUrl: "https://tickets.example/events/show#tickets" }];
    const sourceRows = [{ sourceKey: "public:event-1", kind: "public", isEnabled: 1, url: "https://tickets.example/events/show/?utm_source=feed" }];
    const queryResults = [eventRows, sourceRows];
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(queryResults.shift()) })) }));
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) }));
    const fakeDb = { select, update } as never;

    await expect(deactivateExpiredSources(new Date("2026-11-03T12:00:00.000Z"), fakeDb)).resolves.toEqual({ deactivatedCount: 1, sourceKeys: ["public:event-1"] });
    expect(select).toHaveBeenCalledTimes(2);
    expect(updateWhere).toHaveBeenCalledOnce();
  });
});
