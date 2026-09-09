import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { events, manualReviewEvents } from "../drizzle/schema";
import { getDb, saveEvent } from "./db";

export type ManualReviewStatus = "pending" | "approved" | "rejected";

export type ManualReviewEventInput = {
  title: string;
  eventDate?: string | Date | null;
  endDate?: string | Date | null;
  locationName?: string | null;
  address?: string | null;
  city?: string | null;
  category?: "show" | "balada" | "evento_musical" | null;
  genre?: string | null;
  summary?: string | null;
  priceCents?: number | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  imageUrl?: string | null;
  rawText?: string | null;
  reason: string;
};

export type ManualReviewFilter = {
  status?: ManualReviewStatus;
  sourceType?: string;
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
};

function safeDate(value: string | Date | null | undefined) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function safeIso(value: unknown) {
  if (value == null) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function safeText(value: unknown, max: number) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function sourceTypeFromUrl(sourceUrl: string | null | undefined) {
  return sourceUrl && /instagram\.com/i.test(sourceUrl) ? "instagram" : "public";
}

function toPublicReview(row: typeof manualReviewEvents.$inferSelect) {
  return {
    id: Number(row.id),
    sourceUrl: row.sourceUrl ?? null,
    sourceType: row.sourceType ?? null,
    title: row.title,
    summary: row.summary ?? null,
    eventDate: safeIso(row.eventDate),
    endDate: safeIso(row.endDate),
    locationName: row.locationName ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    category: row.category ?? null,
    genre: row.genre ?? null,
    priceCents: row.priceCents ?? null,
    imageUrl: row.imageUrl ?? null,
    rawText: row.rawText ?? null,
    reason: row.reason,
    status: row.status as ManualReviewStatus,
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: safeIso(row.reviewedAt),
    publishedEventId: row.publishedEventId ?? null,
    createdAt: safeIso(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: safeIso(row.updatedAt) ?? new Date(0).toISOString(),
  } as const;
}

function buildConditions(filters: ManualReviewFilter) {
  const conditions = [] as ReturnType<typeof eq>[];
  if (filters.status) conditions.push(eq(manualReviewEvents.status, filters.status));
  if (filters.sourceType) conditions.push(eq(manualReviewEvents.sourceType, filters.sourceType.slice(0, 64)));
  const from = filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : null;
  if (from && Number.isFinite(from.getTime())) conditions.push(gte(manualReviewEvents.eventDate, from));
  if (to && Number.isFinite(to.getTime())) conditions.push(lte(manualReviewEvents.eventDate, to));
  return conditions;
}

export async function persistManualReviewEvents(items: ManualReviewEventInput[]) {
  const db = await getDb();
  if (!db || items.length === 0) return { inserted: 0 } as const;
  let inserted = 0;
  for (const item of items.slice(0, 100)) {
    const eventDate = safeDate(item.eventDate);
    const endDate = safeDate(item.endDate);
    const duplicate = await db.select({ id: manualReviewEvents.id }).from(manualReviewEvents).where(and(
      eq(manualReviewEvents.title, item.title.slice(0, 255)),
      item.sourceUrl ? eq(manualReviewEvents.sourceUrl, item.sourceUrl.slice(0, 1000)) : isNull(manualReviewEvents.sourceUrl),
      eventDate ? eq(manualReviewEvents.eventDate, eventDate) : isNull(manualReviewEvents.eventDate),
      eq(manualReviewEvents.status, "pending"),
    )).limit(1);
    if (duplicate[0]) continue;
    await db.insert(manualReviewEvents).values({
      title: item.title.trim().slice(0, 255),
      summary: safeText(item.summary, 5000),
      eventDate,
      endDate,
      locationName: safeText(item.locationName, 255),
      address: safeText(item.address, 500),
      city: safeText(item.city, 100),
      category: item.category ?? null,
      genre: safeText(item.genre, 80),
      priceCents: typeof item.priceCents === "number" && Number.isFinite(item.priceCents) ? Math.max(0, Math.trunc(item.priceCents)) : null,
      sourceUrl: safeText(item.sourceUrl, 1000),
      sourceType: safeText(item.sourceType, 64) ?? sourceTypeFromUrl(item.sourceUrl),
      imageUrl: safeText(item.imageUrl, 1000),
      rawText: safeText(item.rawText, 16000),
      reason: item.reason.trim().slice(0, 160),
      status: "pending",
    });
    inserted += 1;
  }
  return { inserted } as const;
}

export async function listManualReviewEvents(filters: ManualReviewFilter = {}) {
  const db = await getDb();
  const offset = Math.max(0, Math.trunc(filters.offset ?? 0));
  const limit = Math.min(100, Math.max(1, Math.trunc(filters.limit ?? 25)));
  if (!db) return { items: [] as ReturnType<typeof toPublicReview>[], total: 0, offset, limit, nextOffset: null, hasNextPage: false } as const;
  const conditions = buildConditions(filters);
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db.select().from(manualReviewEvents).where(where).orderBy(desc(manualReviewEvents.createdAt)).limit(limit).offset(offset);
  const countRows = await db.select({ count: sql<number>`count(*)` }).from(manualReviewEvents).where(where);
  const total = Number(countRows[0]?.count ?? 0) || 0;
  const items = rows.map(toPublicReview);
  const nextOffset = offset + items.length < total ? offset + items.length : null;
  return { items, total, offset, limit, nextOffset, hasNextPage: nextOffset !== null } as const;
}

export async function getManualReviewMetrics() {
  const db = await getDb();
  if (!db) return { published: 0, awaitingReview: 0, rejected: 0, total: 0 } as const;
  const [publishedRows, reviewRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(events).where(and(eq(events.isPublished, 1), eq(events.isArchived, 0))),
    db.select({ status: manualReviewEvents.status, count: sql<number>`count(*)` }).from(manualReviewEvents).groupBy(manualReviewEvents.status),
  ]);
  const metrics = { published: Number(publishedRows[0]?.count ?? 0) || 0, awaitingReview: 0, rejected: 0, total: 0 };
  for (const row of reviewRows) {
    const count = Number(row.count ?? 0) || 0;
    metrics.total += count;
    if (row.status === "pending") metrics.awaitingReview = count;
    if (row.status === "rejected") metrics.rejected = count;
  }
  return metrics;
}

export async function updateManualReviewEvent(input: ManualReviewEventInput & { id: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [existing] = await db.select().from(manualReviewEvents).where(eq(manualReviewEvents.id, input.id)).limit(1);
  if (!existing) throw new Error("Evento pendente não encontrado.");
  const eventDate = safeDate(input.eventDate);
  const endDate = safeDate(input.endDate);
  await db.update(manualReviewEvents).set({
    title: input.title.trim().slice(0, 255),
    summary: safeText(input.summary, 5000),
    eventDate,
    endDate,
    locationName: safeText(input.locationName, 255),
    address: safeText(input.address, 500),
    city: safeText(input.city, 100),
    category: input.category ?? null,
    genre: safeText(input.genre, 80),
    priceCents: typeof input.priceCents === "number" && Number.isFinite(input.priceCents) ? Math.max(0, Math.trunc(input.priceCents)) : null,
    sourceUrl: safeText(input.sourceUrl, 1000),
    sourceType: safeText(input.sourceType, 64) ?? sourceTypeFromUrl(input.sourceUrl),
    imageUrl: safeText(input.imageUrl, 1000),
    rawText: safeText(input.rawText, 16000),
    reason: input.reason.trim().slice(0, 160),
    updatedAt: new Date(),
  }).where(eq(manualReviewEvents.id, input.id));
  const [updated] = await db.select().from(manualReviewEvents).where(eq(manualReviewEvents.id, input.id)).limit(1);
  return updated ? toPublicReview(updated) : null;
}

function normalizeSlug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 150) || "evento-manual";
}

export async function approveManualReviewEvent(id: number, reviewedBy: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [row] = await db.select().from(manualReviewEvents).where(eq(manualReviewEvents.id, id)).limit(1);
  if (!row) throw new Error("Evento pendente não encontrado.");
  if (row.status === "approved" && row.publishedEventId) return toPublicReview(row);
  if (!row.eventDate || !row.locationName || !row.city || !row.category) throw new Error("Preencha data, local, cidade e categoria antes de aprovar.");
  const saved = await saveEvent({
    title: row.title,
    slug: `${normalizeSlug(row.title)}-${row.eventDate.getTime()}`,
    description: row.summary ?? "",
    eventDate: row.eventDate,
    endDate: row.endDate ?? undefined,
    locationName: row.locationName,
    address: row.address ?? undefined,
    city: row.city,
    category: row.category,
    genre: row.genre ?? undefined,
    priceCents: row.priceCents ?? 0,
    sourceUrl: row.sourceUrl ?? "",
    sourceType: row.sourceType ?? "manual-review",
    imageUrl: row.imageUrl ?? "",
    isPublished: 1,
  });
  const publishedEventId = saved.id ?? null;
  if (!publishedEventId) throw new Error("Não foi possível publicar o evento revisado.");
  await db.update(manualReviewEvents).set({ status: "approved", reviewedBy: reviewedBy.slice(0, 160), reviewedAt: new Date(), publishedEventId, updatedAt: new Date() }).where(eq(manualReviewEvents.id, id));
  const [updated] = await db.select().from(manualReviewEvents).where(eq(manualReviewEvents.id, id)).limit(1);
  return updated ? toPublicReview(updated) : null;
}

export async function rejectManualReviewEvent(id: number, reviewedBy: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(manualReviewEvents).set({ status: "rejected", reviewedBy: reviewedBy.slice(0, 160), reviewedAt: new Date(), updatedAt: new Date() }).where(eq(manualReviewEvents.id, id));
  const [updated] = await db.select().from(manualReviewEvents).where(eq(manualReviewEvents.id, id)).limit(1);
  return updated ? toPublicReview(updated) : null;
}

export function buildManualReviewInputFromAgentEvent(item: { title: string; eventDate: string; locationName: string; address: string; city: string; summary: string; sourceUrl: string; reason: string; imageUrl?: string; rawText?: string }) {
  return { ...item, sourceType: sourceTypeFromUrl(item.sourceUrl), imageUrl: item.imageUrl ?? null, rawText: item.rawText ?? null } satisfies ManualReviewEventInput;
}
