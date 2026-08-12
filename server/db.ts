import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { Event, InsertEvent, InsertUser, events, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export const ALLOWED_CITIES = ["Santos", "Guarujá"] as const;
export const MUSICAL_CATEGORIES = ["show", "balada", "evento_musical"] as const;
export const MUSICAL_GENRES = ["funk", "house_eletronica", "samba_pagode", "rap_trap"] as const;

export function eventIdentityKey(sourceUrl: string, eventDate: Date | string) {
  return `${sourceUrl}|${new Date(eventDate).toISOString().slice(0, 10)}`;
}

export function isPublicEventRecord(event: Pick<Event, "isArchived" | "isPublished">) {
  return event.isArchived === 0 && event.isPublished === 1;
}

export function filterEventsForPublicFeed<T extends Pick<Event, "city" | "category" | "genre" | "priceCents" | "eventDate" | "locationName"> & Partial<Pick<Event, "address" | "isArchived" | "isPublished">>>(items: T[], filters: { city?: string; category?: string; genre?: string; venue?: string; maxPriceCents?: number }) {
  return items.filter(event => ((event.isArchived === undefined && event.isPublished === undefined) || isPublicEventRecord(event as Pick<Event, "isArchived" | "isPublished">)) && ALLOWED_CITIES.includes(event.city as typeof ALLOWED_CITIES[number]) && MUSICAL_CATEGORIES.includes(event.category as typeof MUSICAL_CATEGORIES[number]) && (!filters.city || filters.city === "Todas" || event.city === filters.city) && (!filters.category || filters.category === "Todas" || event.category === filters.category) && (!filters.genre || event.genre === filters.genre) && (!filters.venue || event.locationName.toLowerCase().includes(filters.venue.toLowerCase()) || (event.address?.toLowerCase().includes(filters.venue.toLowerCase()) ?? false)) && (filters.maxPriceCents === undefined || event.priceCents <= filters.maxPriceCents));
}

export async function listEvents(filters: { day?: string; city?: string; category?: string; genre?: string; venue?: string; maxPriceCents?: number; page?: number; size?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(events.isPublished, 1), eq(events.isArchived, 0), sql`${events.city} IN (${sql.join(ALLOWED_CITIES.map(city => sql`${city}`), sql`, `)})`];
  if (filters.city && filters.city !== "Todas" && ALLOWED_CITIES.includes(filters.city as typeof ALLOWED_CITIES[number])) conditions.push(eq(events.city, filters.city));
  if (filters.category && filters.category !== "Todas") conditions.push(eq(events.category, filters.category as Event["category"]));
  if (filters.genre) conditions.push(eq(events.genre, filters.genre));
  if (filters.venue?.trim()) { const venueSearch = `%${filters.venue.trim()}%`; conditions.push(or(like(events.locationName, venueSearch), like(events.address, venueSearch))!); }
  if (filters.maxPriceCents !== undefined) conditions.push(sql`${events.priceCents} <= ${filters.maxPriceCents}`);
  if (filters.day === "sexta") conditions.push(sql`DAYOFWEEK(${events.eventDate}) = 6`);
  if (filters.day === "sabado") conditions.push(sql`DAYOFWEEK(${events.eventDate}) = 7`);
  const page = Math.max(filters.page ?? 1, 1);
  const size = Math.min(Math.max(filters.size ?? 24, 1), 100);
  return db.select().from(events).where(and(...conditions)).orderBy(asc(events.eventDate)).limit(size).offset((page - 1) * size);
}

export const PUBLIC_EVENT_STATE = { isPublished: 1 as const, isArchived: 0 as const };

export async function getEventBySlug(slug: string, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(events).where(and(eq(events.slug, slug), eq(events.isPublished, PUBLIC_EVENT_STATE.isPublished), eq(events.isArchived, PUBLIC_EVENT_STATE.isArchived))).limit(1);
  return rows[0];
}

export async function saveEvent(data: InsertEvent) {
  if (!ALLOWED_CITIES.includes(data.city as typeof ALLOWED_CITIES[number])) throw new Error("WeekendVibes aceita apenas eventos em Santos e Guarujá");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select({ id: events.id }).from(events).where(and(sql`${events.sourceUrl} = ${data.sourceUrl}`, eq(events.eventDate, data.eventDate))).limit(1);
  if (existing[0]) {
    await db.update(events).set({ ...data, updatedAt: new Date() }).where(eq(events.id, existing[0].id));
    return;
  }
  await db.insert(events).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
}

export async function updateEvent(id: number, input: Partial<InsertEvent>) {
  if (input.city && !ALLOWED_CITIES.includes(input.city as typeof ALLOWED_CITIES[number])) throw new Error("WeekendVibes aceita apenas eventos em Santos e Guarujá");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(events).set({ ...input, updatedAt: new Date() }).where(eq(events.id, id));
}

export async function deleteEvent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(events).where(eq(events.id, id));
}

export function shouldArchiveExpiredSoldOutEvent(event: Pick<Event, "eventDate" | "endDate" | "priceNote" | "ticketStatus" | "isArchived" | "isPublished">, now = new Date()) {
  const soldOut = event.ticketStatus === "sold_out" || (event.ticketStatus === undefined && (event.priceNote?.toLowerCase().includes("vendas encerradas") ?? false));
  const eventEnd = event.endDate ?? event.eventDate;
  return event.isArchived === 0 && event.isPublished === 1 && soldOut && new Date(eventEnd).getTime() < now.getTime();
}

export async function archiveExpiredSoldOutEvents(dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.update(events)
    .set({ isArchived: 1, isPublished: 0, updatedAt: new Date() })
    .where(and(
      eq(events.isArchived, 0),
      eq(events.isPublished, 1),
      sql`COALESCE(${events.endDate}, ${events.eventDate}) < NOW()`,
      eq(events.ticketStatus, "sold_out"),
    ));
  return Number((result as { affectedRows?: number }).affectedRows ?? 0);
}
