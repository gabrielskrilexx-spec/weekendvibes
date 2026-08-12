import { describe, expect, it, vi } from "vitest";
import { archiveExpiredSoldOutEvents, filterEventsForPublicFeed, getEventBySlug, isPublicEventRecord, PUBLIC_EVENT_STATE, shouldArchiveExpiredSoldOutEvent } from "./db";

describe("event archive eligibility", () => {
  const now = new Date("2026-08-20T12:00:00Z");

  it("archives a published sold-out event after its end date", () => {
    expect(shouldArchiveExpiredSoldOutEvent({
      eventDate: new Date("2026-08-16T23:00:00Z"),
      endDate: new Date("2026-08-17T03:00:00Z"),
      priceNote: "Vendas encerradas — preço não informado",
      ticketStatus: "sold_out",
      isArchived: 0,
      isPublished: 1,
    }, now)).toBe(true);
  });

  it("keeps a sold-out event visible until its event date passes", () => {
    expect(shouldArchiveExpiredSoldOutEvent({
      eventDate: new Date("2026-08-28T23:00:00Z"),
      endDate: null,
      priceNote: "Vendas encerradas",
      ticketStatus: "sold_out",
      isArchived: 0,
      isPublished: 1,
    }, now)).toBe(false);
  });

  it("removes an archived event from the public feed without deleting the record", () => {
    const archivedEvent = { city: "Guarujá", category: "balada", genre: "house_eletronica", priceCents: 0, eventDate: new Date("2026-08-16T23:00:00Z"), isArchived: 1, isPublished: 0 } as const;
    const rawRecords = [archivedEvent];
    expect(rawRecords).toHaveLength(1);
    expect(filterEventsForPublicFeed(rawRecords, {})).toEqual([]);
  });

  it("hides an archived record from the detail lookup without deleting it", async () => {
    const archivedRecord = { slug: "evento-arquivado", isArchived: 1, isPublished: 0 } as const;
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const fakeDb = { select: vi.fn().mockReturnValue({ from }) } as never;
    await expect(getEventBySlug(archivedRecord.slug, fakeDb)).resolves.toBeUndefined();
    expect(isPublicEventRecord(archivedRecord)).toBe(false);
    expect(PUBLIC_EVENT_STATE).toEqual({ isArchived: 0, isPublished: 1 });
    expect(archivedRecord).toEqual(expect.objectContaining({ isArchived: 1, isPublished: 0 }));
    expect(where).toHaveBeenCalledOnce();
    const whereArgument = where.mock.calls[0][0] as { queryChunks?: unknown[] };
    const serializedCondition = JSON.stringify(whereArgument, (_key, value) => {
      if (value && typeof value === "object" && "name" in value && "table" in value) return { name: (value as { name: string }).name };
      return value;
    });
    expect(serializedCondition).toContain("isArchived");
    expect(serializedCondition).toContain("isPublished");
    expect(serializedCondition).toContain("0");
    expect(serializedCondition).toContain("1");
    expect(limit).toHaveBeenCalledOnce();
  });

  it("persists logical archive state without deleting the record", async () => {
    const where = vi.fn().mockResolvedValue({ affectedRows: 1 });
    const set = vi.fn().mockReturnValue({ where });
    const fakeDb = { update: vi.fn().mockReturnValue({ set }) } as never;
    await expect(archiveExpiredSoldOutEvents(fakeDb)).resolves.toBe(1);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ isArchived: 1, isPublished: 0 }));
    expect(where).toHaveBeenCalledOnce();
  });

  it("does not re-archive an already archived event", () => {
    expect(shouldArchiveExpiredSoldOutEvent({
      eventDate: new Date("2026-08-16T23:00:00Z"),
      endDate: null,
      priceNote: "Vendas encerradas",
      ticketStatus: "sold_out",
      isArchived: 1,
      isPublished: 0,
    }, now)).toBe(false);
  });
});
