import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  eventDate: timestamp("eventDate").notNull(),
  endDate: timestamp("endDate"),
  locationName: varchar("locationName", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 100 }).notNull(),
  category: mysqlEnum("category", ["show", "balada", "evento_musical"]).notNull(),
  genre: varchar("genre", { length: 80 }),
  priceCents: int("priceCents").default(0).notNull(),
  priceNote: varchar("priceNote", { length: 255 }),
  ticketStatus: mysqlEnum("ticketStatus", ["available", "sold_out", "unknown"]).default("unknown").notNull(),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  sourceType: varchar("sourceType", { length: 64 }),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  latitude: varchar("latitude", { length: 32 }),
  longitude: varchar("longitude", { length: 32 }),
  sourceHash: varchar("sourceHash", { length: 64 }).unique(),
  isPublished: int("isPublished").default(1).notNull(),
  isArchived: int("isArchived").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

export const operationalAlerts = mysqlTable("operationalAlerts", {
  id: int("id").autoincrement().primaryKey(),
  integration: mysqlEnum("integration", ["apify", "ocr", "openai", "pipeline"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull().unique(),
  isResolved: int("isResolved").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OperationalAlert = typeof operationalAlerts.$inferSelect;
export type InsertOperationalAlert = typeof operationalAlerts.$inferInsert;

export const eventFavorites = mysqlTable("eventFavorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventId: int("eventId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  userEventUnique: uniqueIndex("eventFavorites_user_event_unique").on(table.userId, table.eventId),
}));

export type EventFavorite = typeof eventFavorites.$inferSelect;
export type InsertEventFavorite = typeof eventFavorites.$inferInsert;

export const eventReminders = mysqlTable("eventReminders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventId: int("eventId").notNull(),
  hoursBefore: int("hoursBefore").default(24).notNull(),
  remindAt: timestamp("remindAt").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  userEventUnique: uniqueIndex("eventReminders_user_event_unique").on(table.userId, table.eventId),
}));

export type EventReminder = typeof eventReminders.$inferSelect;
export type InsertEventReminder = typeof eventReminders.$inferInsert;

export const ingestionRuns = mysqlTable("ingestionRuns", {
  id: int("id").autoincrement().primaryKey(),
  routine: varchar("routine", { length: 64 }).notNull(),
  sourceKey: varchar("sourceKey", { length: 255 }),
  status: mysqlEnum("status", ["running", "succeeded", "failed", "partial"]).default("running").notNull(),
  importedCount: int("importedCount").default(0).notNull(),
  failedCount: int("failedCount").default(0).notNull(),
  details: text("details"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});

export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type InsertIngestionRun = typeof ingestionRuns.$inferInsert;

export const geocodingJobs = mysqlTable("geocodingJobs", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull().unique(),
  addressHash: varchar("addressHash", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "succeeded", "failed"]).default("pending").notNull(),
  attempts: int("attempts").default(0).notNull(),
  provider: varchar("provider", { length: 64 }),
  confidence: varchar("confidence", { length: 32 }),
  lastError: text("lastError"),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GeocodingJob = typeof geocodingJobs.$inferSelect;
export type InsertGeocodingJob = typeof geocodingJobs.$inferInsert;
