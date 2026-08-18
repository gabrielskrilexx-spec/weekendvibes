import { createHash } from "node:crypto";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { Event, InsertEvent, InsertUser, events, users, operationalAlerts, InsertOperationalAlert, OperationalAlert, eventFavorites, eventReminders, locationAliases, LocationAlias, ingestionSources, IngestionSource, geocodingJobs } from "../drizzle/schema";
import { extractNeighborhood, geocodingAddressHash, normalizeLocationText } from "./location";
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
export const INSTAGRAM_AGENDA_SOURCE_TYPE = "instagram_agenda_weekend" as const;
export const WEEKLY_AGENDA_SOURCE_TYPES = [INSTAGRAM_AGENDA_SOURCE_TYPE, "ingresse"] as const;
export const MUSICAL_CATEGORIES = ["show", "balada", "evento_musical"] as const;
export const MUSICAL_GENRES = ["funk", "house_eletronica", "samba_pagode", "rap_trap"] as const;

export function isRecentInstagramAgendaEvent(event: Pick<Event, "sourceType" | "isPublished" | "isArchived" | "updatedAt" | "eventDate">, now = new Date(), lookbackDays = 5) {
  const updatedAt = new Date(event.updatedAt);
  const eventDate = new Date(event.eventDate);
  const cutoff = now.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
  return WEEKLY_AGENDA_SOURCE_TYPES.includes(event.sourceType as typeof WEEKLY_AGENDA_SOURCE_TYPES[number]) && event.isPublished === 1 && event.isArchived === 0 && updatedAt.getTime() >= cutoff && updatedAt.getTime() <= now.getTime() && eventDate.getTime() >= now.getTime();
}

export type OperationalIntegration = "meta" | "public" | "ocr" | "openai" | "pipeline";
export function operationalAlertFingerprint(integration: OperationalIntegration, message: string) {
  return createHash("sha256").update(`${integration}:${message.trim()}`).digest("hex");
}

export async function recordOperationalAlert(input: { integration: OperationalIntegration; title: string; message: string; dbOverride?: Awaited<ReturnType<typeof getDb>> }) {
  const db = input.dbOverride ?? await getDb();
  if (!db) return undefined;
  const message = input.message.trim().slice(0, 20000);
  const values: InsertOperationalAlert = {
    integration: input.integration,
    title: input.title.trim().slice(0, 180),
    message,
    fingerprint: operationalAlertFingerprint(input.integration, message),
    isResolved: 0,
  };
  await db.insert(operationalAlerts).values(values).onDuplicateKeyUpdate({
    set: { title: values.title, message: values.message, isResolved: 0, updatedAt: new Date() },
  });
  return values;
}

export async function resolveOperationalAlert(id: number, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(operationalAlerts).set({ isResolved: 1, updatedAt: new Date() }).where(eq(operationalAlerts.id, id));
}

const normalizeAlias = (value: string) => value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export async function listLocationAliases(dbOverride?: Awaited<ReturnType<typeof getDb>>): Promise<LocationAlias[]> {
  const db = dbOverride ?? await getDb();
  if (!db) return [];
  return db.select().from(locationAliases).orderBy(asc(locationAliases.city), asc(locationAliases.canonicalName), asc(locationAliases.alias));
}

export async function listActiveLocationAliasValues(dbOverride?: Awaited<ReturnType<typeof getDb>>): Promise<string[]> {
  const rows = await listLocationAliases(dbOverride);
  return rows.filter(row => row.isActive === 1).flatMap(row => [row.alias, row.canonicalName]);
}

export async function createLocationAlias(input: { alias: string; canonicalName: string; city: "Santos" | "Guarujá" }, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  const alias = normalizeAlias(input.alias);
  const canonicalName = input.canonicalName.trim().slice(0, 180);
  if (alias.length < 2 || canonicalName.length < 2) throw new Error("Alias e local oficial são obrigatórios");
  await db.insert(locationAliases).values({ alias, canonicalName, city: input.city, isActive: 1 });
  return listLocationAliases(db);
}

export async function updateLocationAlias(id: number, input: { alias: string; canonicalName: string; city: "Santos" | "Guarujá"; isActive: boolean }, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  const alias = normalizeAlias(input.alias);
  await db.update(locationAliases).set({ alias, canonicalName: input.canonicalName.trim().slice(0, 180), city: input.city, isActive: input.isActive ? 1 : 0, updatedAt: new Date() }).where(eq(locationAliases.id, id));
  return listLocationAliases(db);
}

export async function deleteLocationAlias(id: number, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(locationAliases).where(eq(locationAliases.id, id));
}

export const DEFAULT_INGESTION_SOURCES = [
  { sourceKey: "instagram:mobydicksantos", name: "Moby House", kind: "instagram" as const, handle: "mobydicksantos", url: "https://www.instagram.com/mobydicksantos/" },
  { sourceKey: "instagram:projac.bar", name: "Projac Bar", kind: "instagram" as const, handle: "projac.bar", url: "https://www.instagram.com/projac.bar/" },
  { sourceKey: "instagram:meulugar.bar", name: "Meu Lugar Bar e Entretenimento", kind: "instagram" as const, handle: "meulugar.bar", url: "https://www.instagram.com/meulugar.bar/" },
  { sourceKey: "instagram:nossoafterguaruja", name: "Nosso After", kind: "instagram" as const, handle: "nossoafterguaruja", url: "https://www.instagram.com/nossoafterguaruja/" },
  { sourceKey: "instagram:curvaosurfhouse", name: "Curvão Surf House", kind: "instagram" as const, handle: "curvaosurfhouse", url: "https://www.instagram.com/curvaosurfhouse/" },
  { sourceKey: "instagram:flamingomusicbar", name: "Flamingo Bar", kind: "instagram" as const, handle: "flamingomusicbar", url: "https://www.instagram.com/flamingomusicbar/" },
  { sourceKey: "instagram:rocketseaclub", name: "Rocket Sea Club", kind: "instagram" as const, handle: "rocketseaclub", url: "https://www.instagram.com/rocketseaclub/" },
  { sourceKey: "instagram:ativahouse", name: "Ativa House", kind: "instagram" as const, handle: "ativahouse", url: "https://www.instagram.com/ativahouse/" },
  { sourceKey: "public:articket", name: "ArTicket", kind: "public" as const, handle: null, url: "https://articket.com.br/" },
  { sourceKey: "public:blacktag", name: "Blacktag", kind: "public" as const, handle: null, url: "https://blacktag.com.br/" },
  { sourceKey: "public:zig", name: "Zig Tickets", kind: "public" as const, handle: null, url: "https://zig.tickets/" },
  { sourceKey: "public:ingresse", name: "Ingresse", kind: "public" as const, handle: null, url: "https://www.ingresse.com/" },
];

async function ensureDefaultIngestionSources(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  for (const source of DEFAULT_INGESTION_SOURCES) {
    await db.insert(ingestionSources).values(source).onDuplicateKeyUpdate({ set: { name: source.name, url: source.url, handle: source.handle } });
  }
}

export async function listIngestionSources(dbOverride?: Awaited<ReturnType<typeof getDb>>): Promise<IngestionSource[]> {
  const db = dbOverride ?? await getDb();
  if (!db) return [];
  await ensureDefaultIngestionSources(db);
  return db.select().from(ingestionSources).orderBy(asc(ingestionSources.kind), asc(ingestionSources.priority), asc(ingestionSources.name));
}

export async function listEnabledInstagramSources(dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const rows = await listIngestionSources(dbOverride);
  return rows.filter(source => source.kind === "instagram" && source.isEnabled === 1);
}

export async function updateIngestionSource(id: number, input: { isEnabled: boolean; priority: number; frequencyMinutes: number }, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  const priority = Math.min(Math.max(Math.round(input.priority), 1), 1000);
  const frequencyMinutes = Math.min(Math.max(Math.round(input.frequencyMinutes), 60), 525600);
  await db.update(ingestionSources).set({ isEnabled: input.isEnabled ? 1 : 0, priority, frequencyMinutes, updatedAt: new Date() }).where(eq(ingestionSources.id, id));
  return listIngestionSources(db);
}

export async function markIngestionSourceResult(sourceKey: string, result: { status: "succeeded" | "failed" | "skipped"; message?: string }, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return;
  await db.update(ingestionSources).set({ lastStatus: result.status, lastSuccessAt: result.status === "succeeded" ? new Date() : undefined, lastMessage: result.message?.slice(0, 1000) ?? null, updatedAt: new Date() }).where(eq(ingestionSources.sourceKey, sourceKey));
}

export function eventIdentityKey(sourceUrl: string, eventDate: Date | string) {
  return `${sourceUrl}|${new Date(eventDate).toISOString().slice(0, 10)}`;
}

export function isPublicEventRecord(event: Pick<Event, "isArchived" | "isPublished">) {
  return event.isArchived === 0 && event.isPublished === 1;
}

export function filterEventsForPublicFeed<T extends Pick<Event, "city" | "category" | "genre" | "priceCents" | "eventDate" | "locationName"> & Partial<Pick<Event, "address" | "isArchived" | "isPublished">>>(items: T[], filters: { city?: string; category?: string; genre?: string; venue?: string; maxPriceCents?: number }) {
  return items.filter(event => ((event.isArchived === undefined && event.isPublished === undefined) || isPublicEventRecord(event as Pick<Event, "isArchived" | "isPublished">)) && ALLOWED_CITIES.includes(event.city as typeof ALLOWED_CITIES[number]) && MUSICAL_CATEGORIES.includes(event.category as typeof MUSICAL_CATEGORIES[number]) && (!filters.city || filters.city === "Todas" || event.city === filters.city) && (!filters.category || filters.category === "Todas" || event.category === filters.category) && (!filters.genre || event.genre === filters.genre) && (!filters.venue || event.locationName.toLowerCase().includes(filters.venue.toLowerCase()) || (event.address?.toLowerCase().includes(filters.venue.toLowerCase()) ?? false)) && (filters.maxPriceCents === undefined || event.priceCents <= filters.maxPriceCents));
}

export async function listRecentInstagramAgendaEvents(options: { lookbackDays?: number; size?: number; dbOverride?: Awaited<ReturnType<typeof getDb>> } = {}) {
  const db = options.dbOverride ?? await getDb();
  if (!db) return [];
  const lookbackDays = Math.min(Math.max(options.lookbackDays ?? 5, 1), 14);
  const size = Math.min(Math.max(options.size ?? 8, 1), 12);
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  return db.select().from(events).where(and(
    eq(events.isPublished, 1),
    eq(events.isArchived, 0),
    sql`${events.sourceType} IN (${sql.join(WEEKLY_AGENDA_SOURCE_TYPES.map(sourceType => sql`${sourceType}`), sql`, `)})`,
    sql`${events.updatedAt} >= ${cutoff}`,
    sql`${events.eventDate} >= NOW()`,
    sql`${events.city} IN (${sql.join(ALLOWED_CITIES.map(city => sql`${city}`), sql`, `)})`,
  )).orderBy(asc(events.eventDate), desc(events.createdAt)).limit(size);
}

function saoPauloDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function listTodayEvents(options: { size?: number } = {}) {
  return listEvents({ date: saoPauloDateKey(), size: options.size ?? 12 });
}

export async function listEvents(filters: { day?: string; date?: string; startDate?: string; endDate?: string; timeFrom?: string; timeTo?: string; city?: string; category?: string; genre?: string; venue?: string; neighborhood?: string; minPriceCents?: number; maxPriceCents?: number; page?: number; size?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(events.isPublished, 1), eq(events.isArchived, 0), sql`${events.city} IN (${sql.join(ALLOWED_CITIES.map(city => sql`${city}`), sql`, `)})`];
  if (filters.city && filters.city !== "Todas" && ALLOWED_CITIES.includes(filters.city as typeof ALLOWED_CITIES[number])) conditions.push(eq(events.city, filters.city));
  if (filters.category && filters.category !== "Todas") conditions.push(eq(events.category, filters.category as Event["category"]));
  if (filters.genre) conditions.push(eq(events.genre, filters.genre));
  if (filters.venue?.trim()) { const venueSearch = `%${filters.venue.trim()}%`; conditions.push(or(like(events.title, venueSearch), like(events.locationName, venueSearch), like(events.address, venueSearch), like(events.neighborhood, venueSearch), like(events.formattedAddress, venueSearch))!); }
  if (filters.neighborhood?.trim()) { conditions.push(like(events.neighborhood, `%${filters.neighborhood.trim()}%`)); }
  if (filters.minPriceCents !== undefined) conditions.push(sql`${events.priceCents} >= ${filters.minPriceCents}`);
  if (filters.maxPriceCents !== undefined) conditions.push(sql`${events.priceCents} <= ${filters.maxPriceCents}`);
  if (filters.date) conditions.push(sql`DATE(${events.eventDate}) = ${filters.date}`);
  if (filters.startDate) conditions.push(sql`DATE(${events.eventDate}) >= ${filters.startDate}`);
  if (filters.endDate) conditions.push(sql`DATE(${events.eventDate}) <= ${filters.endDate}`);
  if (filters.timeFrom) conditions.push(sql`TIME(${events.eventDate}) >= ${`${filters.timeFrom}:00`}`);
  if (filters.timeTo) conditions.push(sql`TIME(${events.eventDate}) <= ${`${filters.timeTo}:59`}`);
  if (filters.day === "sexta") conditions.push(sql`DAYOFWEEK(${events.eventDate}) = 6`);
  if (filters.day === "sabado") conditions.push(sql`DAYOFWEEK(${events.eventDate}) = 7`);
  const page = Math.max(filters.page ?? 1, 1);
  const size = Math.min(Math.max(filters.size ?? 24, 1), 100);
  return db.select().from(events).where(and(...conditions)).orderBy(asc(events.eventDate)).limit(size).offset((page - 1) * size);
}

export async function listFavoriteEventIds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ eventId: eventFavorites.eventId }).from(eventFavorites).where(eq(eventFavorites.userId, userId));
  return rows.map(row => row.eventId);
}

export async function toggleFavoriteEvent(userId: number, eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const event = await db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), eq(events.isPublished, 1), eq(events.isArchived, 0))).limit(1);
  if (!event[0]) throw new Error("Evento indisponível");
  const existing = await db.select({ id: eventFavorites.id }).from(eventFavorites).where(and(eq(eventFavorites.userId, userId), eq(eventFavorites.eventId, eventId))).limit(1);
  if (existing[0]) {
    await db.delete(eventFavorites).where(eq(eventFavorites.id, existing[0].id));
    return { isFavorite: false } as const;
  }
  await db.insert(eventFavorites).values({ userId, eventId });
  return { isFavorite: true } as const;
}

export async function setEventReminder(userId: number, eventId: number, active: boolean, hoursBefore = 24) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const event = await db.select({ eventDate: events.eventDate }).from(events).where(and(eq(events.id, eventId), eq(events.isPublished, 1), eq(events.isArchived, 0))).limit(1);
  if (!event[0]) throw new Error("Evento indisponível");
  const existing = await db.select({ id: eventReminders.id }).from(eventReminders).where(and(eq(eventReminders.userId, userId), eq(eventReminders.eventId, eventId))).limit(1);
  if (!active) {
    if (existing[0]) await db.delete(eventReminders).where(eq(eventReminders.id, existing[0].id));
    return { active: false, hoursBefore } as const;
  }
  const normalizedHours = [3, 24, 72].includes(hoursBefore) ? hoursBefore : 24;
  const remindAt = new Date(new Date(event[0].eventDate).getTime() - normalizedHours * 60 * 60 * 1000);
  if (existing[0]) {
    await db.update(eventReminders).set({ hoursBefore: normalizedHours, remindAt, isActive: 1, updatedAt: new Date() }).where(eq(eventReminders.id, existing[0].id));
  } else {
    await db.insert(eventReminders).values({ userId, eventId, hoursBefore: normalizedHours, remindAt, isActive: 1 });
  }
  return { active: true, hoursBefore: normalizedHours, remindAt } as const;
}

export async function listUserReminders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ eventId: eventReminders.eventId, hoursBefore: eventReminders.hoursBefore, remindAt: eventReminders.remindAt }).from(eventReminders).where(and(eq(eventReminders.userId, userId), eq(eventReminders.isActive, 1)));
}

export const PUBLIC_EVENT_STATE = { isPublished: 1 as const, isArchived: 0 as const };

export async function getEventBySlug(slug: string, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(events).where(and(eq(events.slug, slug), eq(events.isPublished, PUBLIC_EVENT_STATE.isPublished), eq(events.isArchived, PUBLIC_EVENT_STATE.isArchived))).limit(1);
  return rows[0];
}

function normalizeEventLocation(data: InsertEvent) {
  const address = data.address ? normalizeLocationText(data.address) : null;
  const neighborhood = data.neighborhood?.trim() || extractNeighborhood(address, data.locationName, data.city as "Santos" | "Guarujá");
  const formattedAddress = data.formattedAddress?.trim() || address;
  return { ...data, address, neighborhood, formattedAddress };
}

async function queueGeocoding(eventId: number, data: InsertEvent, db: Awaited<ReturnType<typeof getDb>>) {
  if (!db || (data.latitude && data.longitude)) return;
  const rawAddress = data.address || data.locationName;
  await db.insert(geocodingJobs).values({ eventId, addressHash: geocodingAddressHash(rawAddress, data.city), status: "pending", attempts: 0 }).onDuplicateKeyUpdate({ set: { addressHash: geocodingAddressHash(rawAddress, data.city), status: "pending", lastError: null, updatedAt: new Date() } });
}

export async function saveEvent(data: InsertEvent) {
  if (!ALLOWED_CITIES.includes(data.city as typeof ALLOWED_CITIES[number])) throw new Error("WeekendVibes aceita apenas eventos em Santos e Guarujá");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const normalized = normalizeEventLocation(data);
  const existing = await db.select({ id: events.id }).from(events).where(and(sql`${events.sourceUrl} = ${normalized.sourceUrl}`, eq(events.eventDate, normalized.eventDate))).limit(1);
  if (existing[0]) {
    await db.update(events).set({ ...normalized, updatedAt: new Date() }).where(eq(events.id, existing[0].id));
    await queueGeocoding(existing[0].id, normalized, db);
    return { created: false };
  }
  const inserted = await db.insert(events).values(normalized).onDuplicateKeyUpdate({ set: { ...normalized, updatedAt: new Date() } });
  const eventId = Number(inserted[0]?.insertId ?? 0);
  if (eventId > 0) await queueGeocoding(eventId, normalized, db);
  return { created: eventId > 0 };
}

export async function updateEvent(id: number, input: Partial<InsertEvent>) {
  if (input.city && !ALLOWED_CITIES.includes(input.city as typeof ALLOWED_CITIES[number])) throw new Error("WeekendVibes aceita apenas eventos em Santos e Guarujá");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const normalized = { ...input, ...(input.address !== undefined ? { address: input.address ? normalizeLocationText(input.address) : null } : {}), updatedAt: new Date() };
  await db.update(events).set(normalized).where(eq(events.id, id));
  if (input.address !== undefined || input.locationName !== undefined || !input.latitude || !input.longitude) {
    const current = await db.select({ address: events.address, locationName: events.locationName, city: events.city, latitude: events.latitude, longitude: events.longitude }).from(events).where(eq(events.id, id)).limit(1);
    if (current[0]) await queueGeocoding(id, { ...current[0], address: current[0].address ?? undefined, locationName: current[0].locationName, city: current[0].city, latitude: current[0].latitude ?? undefined, longitude: current[0].longitude ?? undefined } as InsertEvent, db);
  }
}

export async function deleteEvent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(events).where(eq(events.id, id));
}

/**
 * Hard-deletes only events whose scheduled start has passed.
 *
 * eventDate is persisted as an absolute timestamp. UTC_TIMESTAMP() compares
 * that instant independently of the database server timezone; the application
 * presents and schedules this policy in America/Sao_Paulo (UTC-3), so DST or
 * server-local settings cannot shift the deletion boundary.
 */
export async function deleteExpiredEvents(dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.delete(events).where(sql`${events.eventDate} < UTC_TIMESTAMP()`);
  return Number((result as { affectedRows?: number }).affectedRows ?? 0);
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
