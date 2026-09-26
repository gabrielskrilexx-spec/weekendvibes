import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, gte, inArray, isNull, like, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { Event, InsertEvent, InsertUser, events, users, appSettings, operationalAlerts, InsertOperationalAlert, OperationalAlert, eventFavorites, eventReminders, locationAliases, LocationAlias, ingestionSources, IngestionSource, geocodingJobs, geocodingAuditLogs, ingestionPayloadCache, IngestionPayloadCache, apifyDailyUsage, rateLimitBuckets, apifyProcessedItems } from "../drizzle/schema";
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

export async function claimRateLimitRequest(input: { key: string; windowMs: number }) {
  const db = await getDb();
  if (!db) return null;
  const windowMs = Math.max(1_000, Math.min(input.windowMs, 24 * 60 * 60 * 1000));
  const windowSeconds = Math.ceil(windowMs / 1000);
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const bucketKey = input.key.slice(0, 255);
  try {
    await db.insert(rateLimitBuckets).values({ bucketKey, requestCount: 1, resetAt }).onDuplicateKeyUpdate({
      set: {
        requestCount: sql`IF(${rateLimitBuckets.resetAt} <= UTC_TIMESTAMP(), 1, ${rateLimitBuckets.requestCount} + 1)`,
        resetAt: sql`IF(${rateLimitBuckets.resetAt} <= UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${windowSeconds} SECOND), ${rateLimitBuckets.resetAt})`,
        updatedAt: now,
      },
    });
    const [bucket] = await db.select({ requestCount: rateLimitBuckets.requestCount, resetAt: rateLimitBuckets.resetAt })
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.bucketKey, bucketKey))
      .limit(1);
    return bucket ?? { requestCount: 1, resetAt };
  } catch (error) {
    console.warn("[RateLimit] Persistent bucket unavailable; allowing request until migration is visible", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function claimApifyProcessedItem(input: { fingerprint: string; providerItemId?: string; routine: string; mediaUrl?: string; actorRunId?: string }) {
  const db = await getDb();
  if (!db) return true;
  const fingerprint = input.fingerprint.slice(0, 64);
  const result = await db.insert(apifyProcessedItems).values({
    itemFingerprint: fingerprint,
    providerItemId: input.providerItemId?.slice(0, 255),
    routine: input.routine.slice(0, 64),
    mediaUrl: input.mediaUrl?.slice(0, 1000),
    actorRunId: input.actorRunId?.slice(0, 160),
    status: "processing",
  }).onDuplicateKeyUpdate({ set: { itemFingerprint: sql`${apifyProcessedItems.itemFingerprint}` } });
  const affectedRows = Number((result as unknown as { affectedRows?: number }).affectedRows ?? 1);
  return affectedRows > 0;
}

export async function completeApifyProcessedItem(fingerprint: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(apifyProcessedItems).set({ status: "completed", completedAt: new Date() })
    .where(eq(apifyProcessedItems.itemFingerprint, fingerprint.slice(0, 64)));
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
  return WEEKLY_AGENDA_SOURCE_TYPES.includes(event.sourceType as typeof WEEKLY_AGENDA_SOURCE_TYPES[number]) && event.isPublished === 1 && event.isArchived === 0 && updatedAt.getTime() >= cutoff && updatedAt.getTime() <= now.getTime() && saoPauloDateKey(eventDate) >= saoPauloDateKey(now);
}

export type OperationalIntegration = "meta" | "public" | "ocr" | "openai" | "pipeline";
export type OperationalSeverity = "INFO" | "WARNING" | "CRITICAL";
export function operationalAlertFingerprint(integration: OperationalIntegration, message: string) {
  return createHash("sha256").update(`${integration}:${message.trim()}`).digest("hex");
}

export async function recordOperationalAlert(input: { integration: OperationalIntegration; title: string; message: string; severity?: OperationalSeverity; alertType?: string; slaMinutes?: number; runId?: number | string; dbOverride?: Awaited<ReturnType<typeof getDb>> }) {
  const db = input.dbOverride ?? await getDb();
  if (!db) return undefined;
  const message = input.message.trim().slice(0, 20000);
  const severity = input.severity ?? "WARNING";
  const slaMinutes = Math.min(Math.max(Math.round(input.slaMinutes ?? (severity === "CRITICAL" ? 60 : severity === "WARNING" ? 240 : 1440)), 5), 10080);
  const runId = input.runId === undefined ? null : String(input.runId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || null;
  const values: InsertOperationalAlert = {
    integration: input.integration,
    severity,
    alertType: input.alertType?.trim().slice(0, 80) || "operational",
    slaMinutes,
    runId,
    title: input.title.trim().slice(0, 180),
    message,
    fingerprint: operationalAlertFingerprint(input.integration, message),
    isResolved: 0,
  };
  await db.insert(operationalAlerts).values(values).onDuplicateKeyUpdate({
    set: { severity: values.severity, alertType: values.alertType, slaMinutes: values.slaMinutes, runId: values.runId, title: values.title, message: values.message, isResolved: 0, updatedAt: new Date() },
  });
  return values;
}

export async function listOperationalAlerts(limit = 25, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db.select({ id: operationalAlerts.id, alertType: operationalAlerts.alertType, severity: operationalAlerts.severity, title: operationalAlerts.title, message: operationalAlerts.message, isResolved: operationalAlerts.isResolved, createdAt: operationalAlerts.createdAt, updatedAt: operationalAlerts.updatedAt }).from(operationalAlerts).where(and(eq(operationalAlerts.isResolved, 0), gte(operationalAlerts.createdAt, cutoff))).orderBy(desc(operationalAlerts.createdAt)).limit(Math.min(100, Math.max(1, Math.trunc(limit))));
  return rows.map(row => ({ id: row.id, alertType: row.alertType, severity: row.severity, title: row.title, message: row.message, isResolved: row.isResolved === 1, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));
}

export async function resolveOperationalAlert(id: number, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(operationalAlerts).set({ isResolved: 1, updatedAt: new Date() }).where(eq(operationalAlerts.id, id));
}

export function getApifyDailyRequestLimit() {
  const configured = Number.parseInt(process.env.APIFY_DAILY_REQUEST_LIMIT ?? "", 10);
  return Number.isFinite(configured) ? Math.min(100, Math.max(1, configured)) : 3;
}

const APIFY_DAILY_REQUEST_LIMIT_KEY = "APIFY_DAILY_REQUEST_LIMIT";
const APIFY_INGESTION_KILL_SWITCH_KEY = "APIFY_INGESTION_KILL_SWITCH";
const normalizeApifyDailyRequestLimit = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(1, Math.trunc(parsed))) : getApifyDailyRequestLimit();
};

async function getConfiguredApifyDailyRequestLimit(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return getApifyDailyRequestLimit();
  const [setting] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, APIFY_DAILY_REQUEST_LIMIT_KEY)).limit(1);
  return normalizeApifyDailyRequestLimit(setting?.value);
}

export async function isApifyIngestionKillSwitchEnabled(dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const envEnabled = /^(1|true|yes|on)$/i.test(process.env.APIFY_INGESTION_KILL_SWITCH?.trim() ?? "");
  if (envEnabled) return true;
  const db = dbOverride ?? await getDb();
  if (!db) return false;
  const [setting] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, APIFY_INGESTION_KILL_SWITCH_KEY)).limit(1);
  return /^(1|true|yes|on)$/i.test(setting?.value?.trim() ?? "");
}

export async function setApifyDailyRequestLimit(value: number) {
  const limit = normalizeApifyDailyRequestLimit(value);
  if (limit !== value) throw new Error("O limite diário deve ser um número inteiro entre 1 e 100.");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(appSettings).values({ key: APIFY_DAILY_REQUEST_LIMIT_KEY, value: String(limit) }).onDuplicateKeyUpdate({ set: { value: String(limit), updatedAt: new Date() } });
  const dateKey = saoPauloDateKey(new Date());
  await db.update(apifyDailyUsage).set({ dailyLimit: limit, updatedAt: new Date() }).where(eq(apifyDailyUsage.dateKey, dateKey));
  return limit;
}

export async function claimApifyDailyRequest(input: { now?: Date; units?: number; allowIsolatedManualRun?: boolean; dbOverride?: Awaited<ReturnType<typeof getDb>> }) {
  const db = input.dbOverride ?? await getDb();
  const dateKey = saoPauloDateKey(input.now);
  const units = Math.min(100, Math.max(1, Math.trunc(input.units ?? 1)));
  const isolatedManualRun = input.allowIsolatedManualRun === true && units === 1;
  const isTestWithoutOverride = process.env.NODE_ENV === "test" && !input.dbOverride;
  if (isTestWithoutOverride) {
    const dailyLimit = await getConfiguredApifyDailyRequestLimit(db);
    return { allowed: true, dateKey, requestCount: 0, dailyLimit, persistence: false, units };
  }
  if (/^(1|true|yes|on)$/i.test(process.env.APIFY_INGESTION_KILL_SWITCH?.trim() ?? "") && !isolatedManualRun) return { allowed: false, dateKey, requestCount: 0, dailyLimit: getApifyDailyRequestLimit(), persistence: Boolean(db), units, blockedReason: "kill_switch" as const };
  const dailyLimit = await getConfiguredApifyDailyRequestLimit(db);
  if (await isApifyIngestionKillSwitchEnabled(db) && !isolatedManualRun) return { allowed: false, dateKey, requestCount: 0, dailyLimit, persistence: Boolean(db), blockedReason: "kill_switch" as const };
  if (!db) return { allowed: false, dateKey, requestCount: 0, dailyLimit, persistence: false, blockedReason: "budget_unavailable" as const };
  await db.insert(apifyDailyUsage).values({ dateKey, requestCount: 0, dailyLimit }).onDuplicateKeyUpdate({ set: { dailyLimit, updatedAt: new Date() } });
  const result = await db.update(apifyDailyUsage).set({ requestCount: sql`${apifyDailyUsage.requestCount} + ${units}`, updatedAt: new Date() }).where(and(eq(apifyDailyUsage.dateKey, dateKey), sql`${apifyDailyUsage.requestCount} + ${units} <= ${dailyLimit}`));
  const rows = await db.select({ requestCount: apifyDailyUsage.requestCount, dailyLimit: apifyDailyUsage.dailyLimit }).from(apifyDailyUsage).where(eq(apifyDailyUsage.dateKey, dateKey)).limit(1);
  const row = rows[0] ?? { requestCount: 0, dailyLimit };
  const resultValue = result as unknown as { affectedRows?: number } | [{ affectedRows?: number }, unknown];
  const affectedRows = Number(Array.isArray(resultValue) ? resultValue[0]?.affectedRows ?? 0 : resultValue.affectedRows ?? 0);
  const allowed = affectedRows > 0;
  if (!allowed) await db.update(apifyDailyUsage).set({ lastBlockedAt: new Date(), updatedAt: new Date() }).where(eq(apifyDailyUsage.dateKey, dateKey));
  return { allowed, dateKey, requestCount: row.requestCount, dailyLimit: row.dailyLimit, persistence: true, units, blockedReason: allowed ? undefined : "daily_limit" as const };
}

export async function getApifyDailyUsageStatus(input: { now?: Date; dbOverride?: Awaited<ReturnType<typeof getDb>> } = {}) {
  const db = input.dbOverride ?? await getDb();
  const now = input.now ?? new Date();
  const dateKey = saoPauloDateKey(now);
  const dailyLimit = await getConfiguredApifyDailyRequestLimit(db);
  const nextReleaseAt = new Date(`${dateKey}T00:00:00-03:00`);
  nextReleaseAt.setUTCDate(nextReleaseAt.getUTCDate() + 1);
  if (!db) {
    return { dateKey, requestCount: 0, dailyLimit, remaining: dailyLimit, isLimitReached: false, nextReleaseAt: nextReleaseAt.toISOString(), persistence: false };
  }
  const rows = await db.select({ requestCount: apifyDailyUsage.requestCount, dailyLimit: apifyDailyUsage.dailyLimit }).from(apifyDailyUsage).where(eq(apifyDailyUsage.dateKey, dateKey)).limit(1);
  const row = rows[0];
  const requestCount = Number(row?.requestCount ?? 0);
  const configuredLimit = Number(row?.dailyLimit ?? dailyLimit);
  return { dateKey, requestCount, dailyLimit: configuredLimit, remaining: Math.max(0, configuredLimit - requestCount), isLimitReached: requestCount >= configuredLimit, nextReleaseAt: nextReleaseAt.toISOString(), persistence: true };
}

export async function resolveAllOperationalAlerts(dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  const openAlerts = await db.select({ id: operationalAlerts.id }).from(operationalAlerts).where(eq(operationalAlerts.isResolved, 0));
  if (openAlerts.length > 0) {
    await db.update(operationalAlerts).set({ isResolved: 1, updatedAt: new Date() }).where(eq(operationalAlerts.isResolved, 0));
  }
  return { resolvedCount: openAlerts.length };
}

export async function resolveOperationalAlertsBefore(input: { before: Date; alertTypes?: string[]; dbOverride?: Awaited<ReturnType<typeof getDb>> }) {
  const db = input.dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  const conditions = [eq(operationalAlerts.isResolved, 0), lt(operationalAlerts.createdAt, input.before)];
  if (input.alertTypes?.length) conditions.push(inArray(operationalAlerts.alertType, input.alertTypes));
  const predicate = and(...conditions);
  const openAlerts = await db.select({ id: operationalAlerts.id }).from(operationalAlerts).where(predicate);
  if (openAlerts.length > 0) await db.update(operationalAlerts).set({ isResolved: 1, updatedAt: new Date() }).where(predicate);
  return { resolvedCount: openAlerts.length, before: input.before.toISOString() };
}

export async function purgeResolvedOperationalAlerts(retentionDays = 30, now = new Date(), dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  const safeDays = Number.isFinite(retentionDays) ? Math.max(30, Math.round(retentionDays)) : 30;
  const cutoff = new Date(now.getTime() - safeDays * 24 * 60 * 60 * 1000);
  const expiredAlerts = await db.select({ id: operationalAlerts.id }).from(operationalAlerts).where(and(eq(operationalAlerts.isResolved, 1), lt(operationalAlerts.updatedAt, cutoff)));
  if (expiredAlerts.length > 0) {
    await db.delete(operationalAlerts).where(and(eq(operationalAlerts.isResolved, 1), lt(operationalAlerts.updatedAt, cutoff)));
  }
  return { purgedCount: expiredAlerts.length, cutoff: cutoff.toISOString() };
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
  { sourceKey: "instagram:casa412santos", name: "Casa 412", kind: "instagram" as const, handle: "casa412santos", url: "https://www.instagram.com/casa412santos/" },
  { sourceKey: "instagram:mimadafesta", name: "Mimada Festa", kind: "instagram" as const, handle: "mimadafesta", url: "https://www.instagram.com/mimadafesta/" },
  { sourceKey: "instagram:verilonguinho", name: "Verilonguinho", kind: "instagram" as const, handle: "verilonguinho", url: "https://www.instagram.com/verilonguinho/?hl=pt" },
  { sourceKey: "instagram:goatdiningclub", name: "Goat Club", kind: "instagram" as const, handle: "goatdiningclub", url: "https://www.instagram.com/goatdiningclub/" },
  { sourceKey: "instagram:praioguaruja", name: "Praiô", kind: "instagram" as const, handle: "praioguaruja", url: "https://www.instagram.com/praioguaruja/" },
  { sourceKey: "instagram:botecoalmare", name: "Boteco Almare", kind: "instagram" as const, handle: "botecoalmare", url: "https://www.instagram.com/botecoalmare/" },
  { sourceKey: "instagram:doloresbarerestaurante", name: "Dolores Restaurante e Bar", kind: "instagram" as const, handle: "doloresbarerestaurante", url: "https://www.instagram.com/doloresbarerestaurante/?hl=pt" },
  { sourceKey: "public:articket", name: "ArTicket", kind: "public" as const, handle: null, url: "https://articket.com.br/" },
  { sourceKey: "public:blackpass", name: "Black Pass", kind: "public" as const, handle: null, url: "https://blackpass.com.br/" },
  { sourceKey: "public:mringressos", name: "Mr Ingressos", kind: "public" as const, handle: null, url: "https://mringressos.com.br/" },
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

export async function createIngestionSource(input: { name: string; kind: "instagram" | "public"; handle?: string | null; url: string }, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  const normalizedHandle = input.handle?.trim().replace(/^@+/, "").replace(/\/$/, "") || null;
  const seed = normalizedHandle || input.url.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] || input.name;
  const sourceKey = `${input.kind}:${seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100)}`;
  await db.insert(ingestionSources).values({
    sourceKey,
    name: input.name.trim(),
    kind: input.kind,
    handle: normalizedHandle,
    url: input.url.trim(),
    isEnabled: 1,
    priority: 50,
    frequencyMinutes: 10080,
    p95LatencyThresholdMs: input.kind === "public" ? 15_000 : 3_000,
  });
  const [created] = await db.select({ id: ingestionSources.id, sourceKey: ingestionSources.sourceKey }).from(ingestionSources).where(eq(ingestionSources.sourceKey, sourceKey)).limit(1);
  if (!created) throw new Error("Source creation failed");
  return { id: created.id, sourceKey: created.sourceKey };
}

export async function updateIngestionSource(id: number, input: { isEnabled: boolean; priority: number; frequencyMinutes: number; p95LatencyThresholdMs?: number }, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  const priority = Math.min(Math.max(Math.round(input.priority), 1), 1000);
  const frequencyMinutes = Math.min(Math.max(Math.round(input.frequencyMinutes), 60), 525600);
  const p95LatencyThresholdMs = Math.min(Math.max(Math.round(input.p95LatencyThresholdMs ?? 3000), 500), 60000);
  await db.update(ingestionSources).set({ isEnabled: input.isEnabled ? 1 : 0, priority, frequencyMinutes, p95LatencyThresholdMs, updatedAt: new Date() }).where(eq(ingestionSources.id, id));
  return listIngestionSources(db);
}

export type CircuitState = "closed" | "open" | "half_open";

function circuitCooldownMs() {
  const configuredHours = Number(process.env.INGESTION_CIRCUIT_COOLDOWN_HOURS ?? 18);
  const hours = Number.isFinite(configuredHours) ? Math.min(Math.max(configuredHours, 12), 24) : 18;
  return hours * 60 * 60 * 1000;
}

export async function getCircuitBreakerStatus(sourceKey: string, now = new Date(), dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return { sourceKey, state: "closed" as const, failureCount: 0, allowed: true, nextAttemptAt: null };
  const [source] = await db.select({ sourceKey: ingestionSources.sourceKey, circuitState: ingestionSources.circuitState, circuitFailureCount: ingestionSources.circuitFailureCount, circuitNextAttemptAt: ingestionSources.circuitNextAttemptAt }).from(ingestionSources).where(eq(ingestionSources.sourceKey, sourceKey)).limit(1);
  if (!source) return { sourceKey, state: "closed" as const, failureCount: 0, allowed: true, nextAttemptAt: null };
  if (source.circuitState === "open" && source.circuitNextAttemptAt && new Date(source.circuitNextAttemptAt).getTime() <= now.getTime()) {
    await db.update(ingestionSources).set({ circuitState: "half_open", updatedAt: now }).where(eq(ingestionSources.sourceKey, sourceKey));
    return { sourceKey, state: "half_open" as const, failureCount: source.circuitFailureCount, allowed: true, nextAttemptAt: source.circuitNextAttemptAt };
  }
  return { sourceKey, state: source.circuitState, failureCount: source.circuitFailureCount, allowed: source.circuitState !== "open", nextAttemptAt: source.circuitNextAttemptAt };
}

export async function listCircuitBreakerStatuses(dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return [];
  await ensureDefaultIngestionSources(db);
  return db.select({ sourceKey: ingestionSources.sourceKey, name: ingestionSources.name, kind: ingestionSources.kind, circuitState: ingestionSources.circuitState, circuitFailureCount: ingestionSources.circuitFailureCount, circuitOpenedAt: ingestionSources.circuitOpenedAt, circuitNextAttemptAt: ingestionSources.circuitNextAttemptAt, circuitLastError: ingestionSources.circuitLastError, lastStatus: ingestionSources.lastStatus, lastMessage: ingestionSources.lastMessage, lastHttpStatus: ingestionSources.lastHttpStatus, lastFailureReason: ingestionSources.lastFailureReason }).from(ingestionSources).orderBy(asc(ingestionSources.kind), asc(ingestionSources.name));
}

function circuitFailureThreshold() {
  const configured = Number(process.env.INGESTION_CIRCUIT_BREAKER_FAILURE_THRESHOLD ?? 3);
  return Number.isFinite(configured) ? Math.min(10, Math.max(2, Math.trunc(configured))) : 3;
}

function sanitizedFailureReason(status: number | undefined, message: string) {
  const normalized = message.replace(/(token|secret|key|cookie|authorization)=[^\s&]+/gi, "$1=[redacted]").replace(/\s+/g, " ").trim();
  if (status === 401 || /session|cookie|credential|authentication/i.test(normalized)) return "Falha de Sessão";
  if (status === 403) return "403 - Proibido";
  if (status !== undefined) return `${status} - ${status >= 500 ? "Erro do provedor" : "Falha HTTP"}`;
  return normalized.slice(0, 500) || "Falha de rede";
}

export async function recordCircuitFailure(sourceKey: string, message: string, status?: number, now = new Date(), dbOverride?: Awaited<ReturnType<typeof getDb>>, severe = true) {
  const db = dbOverride ?? await getDb();
  if (!db) return { state: "closed" as const, failureCount: 0, openedNow: false, nextAttemptAt: null };
  const [source] = await db.select({ circuitState: ingestionSources.circuitState, circuitFailureCount: ingestionSources.circuitFailureCount }).from(ingestionSources).where(eq(ingestionSources.sourceKey, sourceKey)).limit(1);
  if (!source) return { state: "closed" as const, failureCount: 0, openedNow: false, nextAttemptAt: null };
  const threshold = circuitFailureThreshold();
  const failureCount = severe ? (source.circuitState === "half_open" ? threshold : source.circuitFailureCount + 1) : 0;
  const shouldOpen = severe && failureCount >= threshold;
  const nextAttemptAt = shouldOpen ? new Date(now.getTime() + circuitCooldownMs()) : null;
  const safeMessage = `${status ? `HTTP ${status}: ` : ""}${message}`.replace(/(token|secret|key|cookie|authorization)=[^\s&]+/gi, "$1=[redacted]").slice(0, 1000);
  await db.update(ingestionSources).set({ circuitState: shouldOpen ? "open" : "closed", circuitFailureCount: failureCount, circuitOpenedAt: shouldOpen ? now : null, circuitNextAttemptAt: nextAttemptAt, circuitLastError: safeMessage, lastStatus: "failed", lastMessage: safeMessage, lastHttpStatus: status ?? null, lastFailureReason: sanitizedFailureReason(status, message), updatedAt: now }).where(eq(ingestionSources.sourceKey, sourceKey));
  return { state: shouldOpen ? "open" as const : "closed" as const, failureCount, openedNow: shouldOpen && source.circuitState !== "open", nextAttemptAt };
}

/** Atomically increments the persisted HTTP 403 streak and claims its alert once. */
export async function recordSource403Failure(sourceKey: string, threshold: number, now = new Date(), dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return { count: 0, shouldAlert: false } as const;
  await db.update(ingestionSources)
    .set({ consecutive403Count: sql`${ingestionSources.consecutive403Count} + 1`, updatedAt: now })
    .where(eq(ingestionSources.sourceKey, sourceKey));
  const [source] = await db.select({ count: ingestionSources.consecutive403Count, alertedAt: ingestionSources.last403AlertedAt }).from(ingestionSources).where(eq(ingestionSources.sourceKey, sourceKey)).limit(1);
  const count = Number(source?.count ?? 0);
  if (!source || count < threshold || source.alertedAt) return { count, shouldAlert: false } as const;
  const claimed = await db.update(ingestionSources)
    .set({ last403AlertedAt: now, updatedAt: now })
    .where(and(eq(ingestionSources.sourceKey, sourceKey), isNull(ingestionSources.last403AlertedAt), gte(ingestionSources.consecutive403Count, threshold)));
  return { count, shouldAlert: Number((claimed as { affectedRows?: number }).affectedRows ?? 0) > 0 } as const;
}

export async function resetSource403State(sourceKey: string, now = new Date(), dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return;
  await db.update(ingestionSources).set({ consecutive403Count: 0, last403AlertedAt: null, updatedAt: now }).where(eq(ingestionSources.sourceKey, sourceKey));
}

export async function recordCircuitSuccess(sourceKey: string, now = new Date(), dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return;
  await db.update(ingestionSources).set({ circuitState: "closed", circuitFailureCount: 0, circuitOpenedAt: null, circuitNextAttemptAt: null, circuitLastError: null, lastStatus: "succeeded", lastSuccessAt: now, lastHttpStatus: 200, lastFailureReason: null, consecutive403Count: 0, last403AlertedAt: null, updatedAt: now }).where(eq(ingestionSources.sourceKey, sourceKey));
}

export async function reactivateIngestionSourceCircuitBreaker(sourceKey: string, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(ingestionSources).set({ circuitState: "closed", circuitFailureCount: 0, circuitOpenedAt: null, circuitNextAttemptAt: null, circuitLastError: null, consecutive403Count: 0, last403AlertedAt: null, updatedAt: new Date() }).where(eq(ingestionSources.sourceKey, sourceKey));
}

export async function resetActiveIngestionSourceCircuitBreakers(dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  const activeSources = await db.select({ sourceKey: ingestionSources.sourceKey }).from(ingestionSources).where(eq(ingestionSources.isEnabled, 1));
  if (activeSources.length > 0) {
    await db.update(ingestionSources).set({ circuitState: "closed", circuitFailureCount: 0, circuitOpenedAt: null, circuitNextAttemptAt: null, circuitLastError: null, consecutive403Count: 0, last403AlertedAt: null, updatedAt: new Date() }).where(eq(ingestionSources.isEnabled, 1));
  }
  return { resetCount: activeSources.length, sourceKeys: activeSources.map(source => source.sourceKey) };
}

export async function markIngestionSourceResult(sourceKey: string, result: { status: "succeeded" | "failed" | "skipped"; message?: string }, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return;
  await db.update(ingestionSources).set({ lastStatus: result.status, lastSuccessAt: result.status === "succeeded" ? new Date() : undefined, lastMessage: result.message?.slice(0, 1000) ?? null, updatedAt: new Date() }).where(eq(ingestionSources.sourceKey, sourceKey));
}

export async function getIngestionPayloadCache(cacheKey: string, dbOverride?: Awaited<ReturnType<typeof getDb>>): Promise<IngestionPayloadCache | undefined> {
  const db = dbOverride ?? await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(ingestionPayloadCache).where(eq(ingestionPayloadCache.cacheKey, cacheKey)).limit(1);
  return row;
}

export async function saveIngestionPayloadCache(input: { cacheKey: string; sourceKey: string; sourceUrl: string; payload: unknown; latitude?: string; longitude?: string }, dbOverride?: Awaited<ReturnType<typeof getDb>>) {
  const db = dbOverride ?? await getDb();
  if (!db) return;
  const serialized = JSON.stringify(input.payload).slice(0, 60000);
  await db.insert(ingestionPayloadCache).values({ cacheKey: input.cacheKey.slice(0, 255), sourceKey: input.sourceKey.slice(0, 120), sourceUrl: input.sourceUrl.slice(0, 1000), payload: serialized, latitude: input.latitude?.slice(0, 32) ?? null, longitude: input.longitude?.slice(0, 32) ?? null, lastGoodAt: new Date() }).onDuplicateKeyUpdate({ set: { sourceKey: input.sourceKey.slice(0, 120), sourceUrl: input.sourceUrl.slice(0, 1000), payload: serialized, latitude: input.latitude?.slice(0, 32) ?? null, longitude: input.longitude?.slice(0, 32) ?? null, lastGoodAt: new Date(), updatedAt: new Date() } });
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


export function saoPauloDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function saoPauloDayStartUtc(date = new Date()) {
  return new Date(`${saoPauloDateKey(date)}T00:00:00-03:00`);
}

export function saoPauloNextDayStartUtc(date = new Date()) {
  return new Date(saoPauloDayStartUtc(date).getTime() + 24 * 60 * 60 * 1000);
}

export function saoPauloHour(date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(date));
}

const PUBLIC_FEED_ROLLOVER_KEY = "public_feed_rollover_hour";
export const DEFAULT_PUBLIC_FEED_ROLLOVER_HOUR = 6;

export function normalizePublicFeedRolloverHour(value: unknown, fallback = DEFAULT_PUBLIC_FEED_ROLLOVER_HOUR) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : fallback;
}

export async function getPublicFeedRolloverHour() {
  const db = await getDb();
  if (!db) return DEFAULT_PUBLIC_FEED_ROLLOVER_HOUR;
  try {
    const [setting] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, PUBLIC_FEED_ROLLOVER_KEY)).limit(1);
    return normalizePublicFeedRolloverHour(setting?.value);
  } catch (error) {
    console.warn("[Settings] Failed to read public feed rollover:", error);
    return DEFAULT_PUBLIC_FEED_ROLLOVER_HOUR;
  }
}

export async function setPublicFeedRolloverHour(value: number) {
  const hour = normalizePublicFeedRolloverHour(value, -1);
  if (hour < 0) throw new Error("Horário de virada inválido");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(appSettings).values({ key: PUBLIC_FEED_ROLLOVER_KEY, value: String(hour) }).onDuplicateKeyUpdate({ set: { value: String(hour), updatedAt: new Date() } });
  return hour;
}

export function getTodayEventWindow(now = new Date(), rolloverHour = DEFAULT_PUBLIC_FEED_ROLLOVER_HOUR) {
  const safeRolloverHour = normalizePublicFeedRolloverHour(rolloverHour);
  const dayStartUtc = saoPauloDayStartUtc(now);
  const startsInRollover = saoPauloHour(now) < safeRolloverHour;
  const windowStartUtc = startsInRollover ? new Date(dayStartUtc.getTime() - 24 * 60 * 60 * 1000) : dayStartUtc;
  return { windowStartUtc, windowEndUtc: saoPauloNextDayStartUtc(now), activeAtUtc: now, rolloverHour: safeRolloverHour };
}

export async function listTodayEvents(options: { size?: number } = {}) {
  const rolloverHour = await getPublicFeedRolloverHour();
  const window = getTodayEventWindow(new Date(), rolloverHour);
  return listEvents({ size: options.size ?? 12, windowStartUtc: window.windowStartUtc, windowEndUtc: window.windowEndUtc, activeAtUtc: window.activeAtUtc });
}

export async function listEvents(filters: { day?: string; date?: string; startDate?: string; endDate?: string; timeFrom?: string; timeTo?: string; city?: string; category?: string; genre?: string; venue?: string; neighborhood?: string; minPriceCents?: number; maxPriceCents?: number; page?: number; size?: number; windowStartUtc?: Date; windowEndUtc?: Date; activeAtUtc?: Date } = {}) {
  const db = await getDb();
  if (!db) return [];
  const dayStartUtc = filters.windowStartUtc ?? saoPauloDayStartUtc();
  const conditions = [eq(events.isPublished, 1), eq(events.isArchived, 0), gte(events.eventDate, dayStartUtc), sql`${events.city} IN (${sql.join(ALLOWED_CITIES.map(city => sql`${city}`), sql`, `)})`];
  if (filters.windowEndUtc) conditions.push(lt(events.eventDate, filters.windowEndUtc));
  if (filters.activeAtUtc) conditions.push(or(isNull(events.endDate), gt(events.endDate, filters.activeAtUtc))!);
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
  const vallumGarden = /vallum|valluns/i.test(`${data.locationName} ${address ?? ""}`) && /garden/i.test(`${data.locationName} ${address ?? ""}`);
  const city = vallumGarden ? "Santos" : data.city;
  const neighborhood = data.neighborhood?.trim() || extractNeighborhood(address, data.locationName, city as "Santos" | "Guarujá");
  const formattedAddress = data.formattedAddress?.trim() || address;
  return { ...data, city, address, neighborhood, formattedAddress };
}

async function queueGeocoding(eventId: number, data: InsertEvent, db: Awaited<ReturnType<typeof getDb>>) {
  if (!db || (data.latitude && data.longitude)) return;
  const rawAddress = data.address || data.locationName;
  await db.insert(geocodingJobs).values({ eventId, addressHash: geocodingAddressHash(rawAddress, data.city), status: "pending", attempts: 0 }).onDuplicateKeyUpdate({ set: { addressHash: geocodingAddressHash(rawAddress, data.city), status: "pending", lastError: null, updatedAt: new Date() } });
}

function saoPauloCalendarDateForDb(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function assertEventDateIsCurrentOrFuture(eventDate: Date, now = new Date(), title?: string) {
  if (!(eventDate instanceof Date) || Number.isNaN(eventDate.getTime())) throw new Error("Evento rejeitado: data nula ou inválida");
  const eventDay = saoPauloCalendarDateForDb(eventDate);
  const today = saoPauloCalendarDateForDb(now);
  if (eventDay < today) throw new Error("Evento rejeitado: data anterior ao dia atual");
  const normalizedTitle = String(title ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const month = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" }).format(eventDate));
  if (/\bcarnaval\b/.test(normalizedTitle) && (month < 2 || month > 3)) throw new Error("Evento rejeitado: data incompatível com o tema sazonal Carnaval");
  if (/(reveillon|ano novo|virada)/.test(normalizedTitle) && month !== 12 && month !== 1) throw new Error("Evento rejeitado: data incompatível com o tema sazonal de Ano Novo");
  if (/\bnatal\b/.test(normalizedTitle) && month !== 12) throw new Error("Evento rejeitado: data incompatível com o tema sazonal Natal");
}

function titleTokens(value: string) {
  return new Set(normalizeLocationText(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(token => token.length > 2));
}

export function fuzzyTitleSimilarity(left: string, right: string) {
  const a = titleTokens(left);
  const b = titleTokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = Array.from(a).filter(token => b.has(token)).length;
  const union = new Set([...Array.from(a), ...Array.from(b)]).size;
  return union > 0 ? intersection / union : 0;
}

export function isFuzzyDuplicateEventForTest(left: Pick<InsertEvent, "title" | "eventDate" | "locationName" | "city">, right: Pick<InsertEvent, "title" | "eventDate" | "locationName" | "city">) {
  return left.city === right.city && saoPauloDateKey(left.eventDate) === saoPauloDateKey(right.eventDate) && normalizeLocationText(left.locationName) === normalizeLocationText(right.locationName) && fuzzyTitleSimilarity(left.title, right.title) >= 0.6;
}

export type PotentialEventCollision = {
  key: string;
  similarity: number;
  civilDate: string;
  venue: string;
  recommendedKeepId: number;
  left: Pick<Event, "id" | "title" | "eventDate" | "locationName" | "city" | "priceCents" | "imageUrl" | "latitude" | "longitude" | "sourceUrl">;
  right: Pick<Event, "id" | "title" | "eventDate" | "locationName" | "city" | "priceCents" | "imageUrl" | "latitude" | "longitude" | "sourceUrl">;
};

export async function listPotentialEventCollisions(limit = 100): Promise<PotentialEventCollision[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: events.id, title: events.title, eventDate: events.eventDate, locationName: events.locationName, city: events.city, priceCents: events.priceCents, imageUrl: events.imageUrl, latitude: events.latitude, longitude: events.longitude, sourceUrl: events.sourceUrl }).from(events).where(and(eq(events.isPublished, 1), eq(events.isArchived, 0))).orderBy(asc(events.eventDate));
  const collisions: PotentialEventCollision[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    for (let next = index + 1; next < rows.length; next += 1) {
      const left = rows[index];
      const right = rows[next];
      if (!isFuzzyDuplicateEventForTest(left as InsertEvent, right as InsertEvent)) continue;
      const similarity = fuzzyTitleSimilarity(left.title, right.title);
      const leftQuality = eventQuality(left);
      const rightQuality = eventQuality(right);
      collisions.push({ key: `${left.id}:${right.id}`, similarity, civilDate: saoPauloDateKey(left.eventDate), venue: left.locationName, recommendedKeepId: rightQuality > leftQuality ? right.id : left.id, left, right });
      if (collisions.length >= limit) return collisions;
    }
  }
  return collisions;
}

function eventQuality(event: Pick<InsertEvent, "priceCents" | "imageUrl" | "latitude" | "longitude" | "description">) {
  return (Number(event.priceCents ?? 0) > 0 ? 2 : 0) + (event.imageUrl ? 1 : 0) + (event.latitude && event.longitude ? 1 : 0) + (event.description ? 1 : 0);
}

export async function saveEvent(data: InsertEvent) {
  const normalized = normalizeEventLocation(data);
  if (!ALLOWED_CITIES.includes(normalized.city as typeof ALLOWED_CITIES[number])) throw new Error("WeekendVibes aceita apenas eventos em Santos e Guarujá");
  assertEventDateIsCurrentOrFuture(normalized.eventDate, new Date(), normalized.title);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select({ id: events.id, title: events.title, eventDate: events.eventDate, locationName: events.locationName, city: events.city, priceCents: events.priceCents, imageUrl: events.imageUrl, latitude: events.latitude, longitude: events.longitude, description: events.description, sourceUrl: events.sourceUrl }).from(events).where(and(sql`${events.sourceUrl} = ${normalized.sourceUrl}`, eq(events.eventDate, normalized.eventDate))).limit(1);
  const dayStartUtc = saoPauloDayStartUtc(normalized.eventDate);
  const nextDayStartUtc = saoPauloNextDayStartUtc(normalized.eventDate);
  const fuzzyCandidates = await db.select({ id: events.id, title: events.title, eventDate: events.eventDate, locationName: events.locationName, city: events.city, priceCents: events.priceCents, imageUrl: events.imageUrl, latitude: events.latitude, longitude: events.longitude, description: events.description, sourceUrl: events.sourceUrl }).from(events).where(and(eq(events.city, normalized.city), gte(events.eventDate, dayStartUtc), sql`${events.eventDate} < ${nextDayStartUtc}`));
  const duplicate = existing[0] ?? fuzzyCandidates.find(candidate => isFuzzyDuplicateEventForTest(normalized, candidate as InsertEvent));
  if (duplicate) {
    const keepIncoming = eventQuality(normalized) > eventQuality(duplicate);
    if (keepIncoming) {
      const merged = { ...normalized, latitude: normalized.latitude || duplicate.latitude, longitude: normalized.longitude || duplicate.longitude, imageUrl: normalized.imageUrl || duplicate.imageUrl, description: normalized.description || duplicate.description, updatedAt: new Date() };
      await db.update(events).set(merged).where(eq(events.id, duplicate.id));
      await queueGeocoding(duplicate.id, merged, db);
    }
    return { created: false, id: duplicate.id, duplicate: true, updated: keepIncoming };
  }
  const inserted = await db.insert(events).values(normalized).onDuplicateKeyUpdate({ set: { ...normalized, updatedAt: new Date() } });
  const eventId = Number(inserted[0]?.insertId ?? 0);
  if (eventId > 0) await queueGeocoding(eventId, normalized, db);
  return { created: eventId > 0, id: eventId > 0 ? eventId : undefined, updated: false };
}

export async function updateEvent(id: number, input: Partial<InsertEvent>) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("ID de evento inválido");
  if (input.city && !ALLOWED_CITIES.includes(input.city as typeof ALLOWED_CITIES[number])) throw new Error("WeekendVibes aceita apenas eventos em Santos e Guarujá");
  if (input.eventDate) assertEventDateIsCurrentOrFuture(input.eventDate, new Date(), input.title);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select({ id: events.id, title: events.title, eventDate: events.eventDate }).from(events).where(eq(events.id, id)).limit(1);
  if (!existing[0]) return { updated: false, id } as const;
  const effectiveDate = input.eventDate ?? existing[0].eventDate;
  const effectiveTitle = input.title ?? existing[0].title;
  assertEventDateIsCurrentOrFuture(effectiveDate, new Date(), effectiveTitle);
  const normalized = { ...input, ...(input.address !== undefined ? { address: input.address ? normalizeLocationText(input.address) : null } : {}), updatedAt: new Date() };
  await db.update(events).set(normalized).where(eq(events.id, id));
  if (input.address !== undefined || input.locationName !== undefined || !input.latitude || !input.longitude) {
    const current = await db.select({ address: events.address, locationName: events.locationName, city: events.city, latitude: events.latitude, longitude: events.longitude }).from(events).where(eq(events.id, id)).limit(1);
    if (current[0]) await queueGeocoding(id, { ...current[0], address: current[0].address ?? undefined, locationName: current[0].locationName, city: current[0].city, latitude: current[0].latitude ?? undefined, longitude: current[0].longitude ?? undefined } as InsertEvent, db);
  }
  return { updated: true, id } as const;
}

export async function updateEventsPublication(ids: number[]) {
  const normalizedIds = Array.from(new Set(ids.filter(id => Number.isInteger(id) && id > 0)));
  if (normalizedIds.length === 0) return { updated: 0, ids: [] as number[] } as const;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.update(events).set({ isPublished: 1, isArchived: 0, updatedAt: new Date() }).where(inArray(events.id, normalizedIds));
  const updated = Number((result as { affectedRows?: number }).affectedRows ?? 0);
  return { updated, ids: normalizedIds.slice(0, updated || normalizedIds.length) } as const;
}

export async function deleteEvents(ids: number[]) {
  const normalizedIds = Array.from(new Set(ids.filter(id => Number.isInteger(id) && id > 0)));
  if (normalizedIds.length === 0) return { deleted: 0, deletedIds: [] as number[] } as const;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const deletedIds: number[] = [];
    for (const id of normalizedIds) {
      await tx.delete(eventFavorites).where(eq(eventFavorites.eventId, id));
      await tx.delete(eventReminders).where(eq(eventReminders.eventId, id));
      await tx.delete(geocodingJobs).where(eq(geocodingJobs.eventId, id));
      await tx.delete(geocodingAuditLogs).where(eq(geocodingAuditLogs.eventId, id));
      const result = await tx.delete(events).where(eq(events.id, id));
      if (Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0) deletedIds.push(id);
    }
    return { deleted: deletedIds.length, deletedIds } as const;
  });
}

export async function deleteEvent(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("ID de evento inválido");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const favorites = await tx.delete(eventFavorites).where(eq(eventFavorites.eventId, id));
    const reminders = await tx.delete(eventReminders).where(eq(eventReminders.eventId, id));
    const geocoding = await tx.delete(geocodingJobs).where(eq(geocodingJobs.eventId, id));
    const geocodingAudit = await tx.delete(geocodingAuditLogs).where(eq(geocodingAuditLogs.eventId, id));
    const result = await tx.delete(events).where(eq(events.id, id));
    const affectedRows = Number((result as { affectedRows?: number }).affectedRows ?? 0);
    return {
      deleted: affectedRows > 0,
      id,
      deletedDependencies: {
        favorites: Number((favorites as { affectedRows?: number }).affectedRows ?? 0),
        reminders: Number((reminders as { affectedRows?: number }).affectedRows ?? 0),
        geocodingJobs: Number((geocoding as { affectedRows?: number }).affectedRows ?? 0),
        geocodingAuditLogs: Number((geocodingAudit as { affectedRows?: number }).affectedRows ?? 0),
      },
    } as const;
  });
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
