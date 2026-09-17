import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar, uniqueIndex } from "drizzle-orm/mysql-core";

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

export const appSettings = mysqlTable("appSettings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: varchar("value", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

export const heartbeatExecutionEvents = mysqlTable("heartbeatExecutionEvents", {
  id: varchar("id", { length: 128 }).primaryKey(),
  heartbeatExecutionId: varchar("heartbeatExecutionId", { length: 160 }).notNull(),
  eventType: mysqlEnum("eventType", ["started", "step", "log", "alert", "completed", "failed", "timeout"]).notNull(),
  sequence: int("sequence").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  durationMs: int("durationMs"),
  status: varchar("status", { length: 64 }),
  message: text("message"),
  metadataJson: text("metadataJson"),
}, table => ({
  executionSequenceIdx: index("heartbeatExecutionEvents_execution_sequence_idx").on(table.heartbeatExecutionId, table.sequence),
  executionTimestampIdx: index("heartbeatExecutionEvents_execution_timestamp_idx").on(table.heartbeatExecutionId, table.timestamp),
}));

export type HeartbeatExecutionEvent = typeof heartbeatExecutionEvents.$inferSelect;
export type InsertHeartbeatExecutionEvent = typeof heartbeatExecutionEvents.$inferInsert;

export const exportAlertEvaluationSnapshots = mysqlTable("exportAlertEvaluationSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  environment: mysqlEnum("environment", ["development", "preview", "production"]).notNull(),
  windowStartedAt: timestamp("windowStartedAt").notNull(),
  windowEndedAt: timestamp("windowEndedAt").notNull(),
  queueSize: int("queueSize").notNull(),
  previousQueueSize: int("previousQueueSize").notNull(),
  queueGrowth: int("queueGrowth").notNull(),
  expiredLeases: int("expiredLeases").notNull(),
  orphanedJobs: int("orphanedJobs").notNull(),
  growthThreshold: int("growthThreshold").notNull(),
  minimumQueueSize: int("minimumQueueSize").notNull(),
  consecutiveWindows: int("consecutiveWindows").notNull(),
  severity: mysqlEnum("severity", ["INFO", "WARNING", "CRITICAL"]).notNull(),
  decision: mysqlEnum("decision", ["NO_ALERT", "ALERT_CREATED", "DEDUPLICATED"]).notNull(),
  evaluatedByOpenId: varchar("evaluatedByOpenId", { length: 160 }).notNull(),
  heartbeatExecutionId: varchar("heartbeatExecutionId", { length: 160 }),
  evaluatedAt: timestamp("evaluatedAt").defaultNow().notNull(),
}, table => ({
  environmentTimeIdx: index("exportAlertEvaluationSnapshots_env_time_idx").on(table.environment, table.evaluatedAt),
  decisionTimeIdx: index("exportAlertEvaluationSnapshots_decision_time_idx").on(table.decision, table.evaluatedAt),
  heartbeatTimeIdx: index("exportAlertEvaluationSnapshots_heartbeat_time_idx").on(table.heartbeatExecutionId, table.evaluatedAt),
}));

export type ExportAlertEvaluationSnapshot = typeof exportAlertEvaluationSnapshots.$inferSelect;
export type InsertExportAlertEvaluationSnapshot = typeof exportAlertEvaluationSnapshots.$inferInsert;

export const exportJobsAlertSettingsAudit = mysqlTable("exportJobsAlertSettingsAudit", {
  id: int("id").autoincrement().primaryKey(),
  environment: mysqlEnum("environment", ["development", "preview", "production"]).notNull(),
  previousValue: text("previousValue").notNull(),
  nextValue: text("nextValue").notNull(),
  changedByOpenId: varchar("changedByOpenId", { length: 160 }).notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
}, (table) => ({
  environmentChangedAtIdx: index("export_jobs_alert_settings_audit_env_time_idx").on(table.environment, table.changedAt),
  changedByIdx: index("export_jobs_alert_settings_audit_actor_idx").on(table.changedByOpenId, table.changedAt),
}));

export type ExportJobsAlertSettingsAudit = typeof exportJobsAlertSettingsAudit.$inferSelect;
export type InsertExportJobsAlertSettingsAudit = typeof exportJobsAlertSettingsAudit.$inferInsert;

export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  eventDate: timestamp("eventDate").notNull(),
  endDate: timestamp("endDate"),
  locationName: varchar("locationName", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }),
  neighborhood: varchar("neighborhood", { length: 160 }),
  formattedAddress: varchar("formattedAddress", { length: 500 }),
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
  locationPrecision: varchar("locationPrecision", { length: 24 }).default("exact").notNull(),
  sourceHash: varchar("sourceHash", { length: 64 }).unique(),
  isPublished: int("isPublished").default(1).notNull(),
  isArchived: int("isArchived").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

export const manualReviewEvents = mysqlTable("manualReviewEvents", {
  id: int("id").autoincrement().primaryKey(),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  sourceType: varchar("sourceType", { length: 64 }),
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary"),
  eventDate: timestamp("eventDate"),
  endDate: timestamp("endDate"),
  locationName: varchar("locationName", { length: 255 }),
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 100 }),
  category: mysqlEnum("category", ["show", "balada", "evento_musical"]),
  genre: varchar("genre", { length: 80 }),
  priceCents: int("priceCents"),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  rawText: text("rawText"),
  reason: varchar("reason", { length: 160 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewedBy: varchar("reviewedBy", { length: 160 }),
  reviewedAt: timestamp("reviewedAt"),
  publishedEventId: int("publishedEventId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({
  statusCreatedIdx: index("manualReviewEvents_status_created_idx").on(table.status, table.createdAt),
  sourceStatusIdx: index("manualReviewEvents_source_status_idx").on(table.sourceType, table.status),
  eventDateIdx: index("manualReviewEvents_event_date_idx").on(table.eventDate),
}));

export type ManualReviewEvent = typeof manualReviewEvents.$inferSelect;
export type InsertManualReviewEvent = typeof manualReviewEvents.$inferInsert;

export const manualReviewAuditLogs = mysqlTable("manualReviewAuditLogs", {
  id: int("id").autoincrement().primaryKey(),
  manualReviewEventId: int("manualReviewEventId").notNull(),
  action: mysqlEnum("action", ["edited", "approved", "rejected", "undone"]).notNull(),
  changedFieldsJson: text("changedFieldsJson").notNull(),
  beforeJson: text("beforeJson").notNull(),
  afterJson: text("afterJson").notNull(),
  changedByOpenId: varchar("changedByOpenId", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({
  eventCreatedIdx: index("manualReviewAuditLogs_event_created_idx").on(table.manualReviewEventId, table.createdAt),
  actorCreatedIdx: index("manualReviewAuditLogs_actor_created_idx").on(table.changedByOpenId, table.createdAt),
}));

export type ManualReviewAuditLog = typeof manualReviewAuditLogs.$inferSelect;
export type InsertManualReviewAuditLog = typeof manualReviewAuditLogs.$inferInsert;

export const operationalAlerts = mysqlTable("operationalAlerts", {
  id: int("id").autoincrement().primaryKey(),
  integration: mysqlEnum("integration", ["meta", "public", "ocr", "openai", "pipeline"]).notNull(),
  severity: mysqlEnum("severity", ["INFO", "WARNING", "CRITICAL"]).default("WARNING").notNull(),
  alertType: varchar("alertType", { length: 80 }).default("operational").notNull(),
  slaMinutes: int("slaMinutes").default(1440).notNull(),
  runId: varchar("runId", { length: 32 }),
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
  durationMs: int("duration_ms"),
  httpStatus: int("httpStatus"),
  counts: text("counts"),
  details: text("details"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});

export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type InsertIngestionRun = typeof ingestionRuns.$inferInsert;

export const ingestionStoryAuditLogs = mysqlTable("ingestionStoryAuditLogs", {
  id: int("id").autoincrement().primaryKey(),
  storyId: varchar("storyId", { length: 500 }).notNull(),
  runId: int("runId").notNull(),
  action: mysqlEnum("action", ["ocr_edit", "approval"]).notNull(),
  previousText: text("previousText"),
  nextText: text("nextText"),
  status: varchar("status", { length: 32 }),
  actorOpenId: varchar("actorOpenId", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IngestionStoryAuditLog = typeof ingestionStoryAuditLogs.$inferSelect;
export type InsertIngestionStoryAuditLog = typeof ingestionStoryAuditLogs.$inferInsert;

export const ingestionPayloadCache = mysqlTable("ingestionPayloadCache", {
  id: int("id").autoincrement().primaryKey(),
  cacheKey: varchar("cacheKey", { length: 255 }).notNull().unique(),
  sourceKey: varchar("sourceKey", { length: 120 }).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 1000 }).notNull(),
  payload: text("payload").notNull(),
  latitude: varchar("latitude", { length: 32 }),
  longitude: varchar("longitude", { length: 32 }),
  lastGoodAt: timestamp("lastGoodAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IngestionPayloadCache = typeof ingestionPayloadCache.$inferSelect;
export type InsertIngestionPayloadCache = typeof ingestionPayloadCache.$inferInsert;

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

export const geocodingAuditLogs = mysqlTable("geocodingAuditLogs", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  rawAddress: varchar("rawAddress", { length: 500 }),
  normalizedAddress: varchar("normalizedAddress", { length: 500 }),
  status: mysqlEnum("status", ["invalid", "fallback", "rejected", "succeeded"]).notNull(),
  message: varchar("message", { length: 1000 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeocodingAuditLog = typeof geocodingAuditLogs.$inferSelect;
export type InsertGeocodingAuditLog = typeof geocodingAuditLogs.$inferInsert;

export const locationAliases = mysqlTable("locationAliases", {
  id: int("id").autoincrement().primaryKey(),
  alias: varchar("alias", { length: 180 }).notNull().unique(),
  canonicalName: varchar("canonicalName", { length: 180 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LocationAlias = typeof locationAliases.$inferSelect;
export type InsertLocationAlias = typeof locationAliases.$inferInsert;

export const ingestionSources = mysqlTable("ingestionSources", {
  id: int("id").autoincrement().primaryKey(),
  sourceKey: varchar("sourceKey", { length: 120 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  kind: mysqlEnum("kind", ["instagram", "public"]).notNull(),
  handle: varchar("handle", { length: 180 }),
  url: varchar("url", { length: 1000 }).notNull(),
  isEnabled: int("isEnabled").default(1).notNull(),
  priority: int("priority").default(50).notNull(),
  frequencyMinutes: int("frequencyMinutes").default(10080).notNull(),
  p95LatencyThresholdMs: int("p95LatencyThresholdMs").default(3000).notNull(),
  scheduleTaskUid: varchar("scheduleTaskUid", { length: 65 }),
  lastSuccessAt: timestamp("lastSuccessAt"),
  lastStatus: mysqlEnum("lastStatus", ["never", "succeeded", "failed", "skipped"]).default("never").notNull(),
  lastMessage: text("lastMessage"),
  lastHttpStatus: int("lastHttpStatus"),
  lastFailureReason: varchar("lastFailureReason", { length: 500 }),
  circuitState: mysqlEnum("circuitState", ["closed", "open", "half_open"]).default("closed").notNull(),
  circuitFailureCount: int("circuitFailureCount").default(0).notNull(),
  circuitOpenedAt: timestamp("circuitOpenedAt"),
  circuitNextAttemptAt: timestamp("circuitNextAttemptAt"),
  circuitLastError: text("circuitLastError"),
  consecutive403Count: int("consecutive403Count").default(0).notNull(),
  last403AlertedAt: timestamp("last403AlertedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IngestionSource = typeof ingestionSources.$inferSelect;
export type InsertIngestionSource = typeof ingestionSources.$inferInsert;

export const filteredStoryExportJobs = mysqlTable("filteredStoryExportJobs", {
  id: varchar("id", { length: 128 }).primaryKey(),
  format: mysqlEnum("format", ["csv", "json"]).notNull(),
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed", "cancelled", "expired"]).default("queued").notNull(),
  progress: int("progress").default(0).notNull(),
  filtersJson: text("filtersJson").notNull(),
  fileKey: varchar("fileKey", { length: 512 }),
  fileName: varchar("fileName", { length: 180 }),
  contentType: varchar("contentType", { length: 120 }),
  errorMessage: varchar("errorMessage", { length: 500 }),
  createdByOpenId: varchar("createdByOpenId", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  completedAt: timestamp("completedAt"),
  cancelledAt: timestamp("cancelledAt"),
  leaseOwner: varchar("leaseOwner", { length: 128 }),
  leaseExpiresAt: timestamp("leaseExpiresAt"),
  recoveryAttempts: int("recoveryAttempts").default(0).notNull(),
  lastRecoveredAt: timestamp("lastRecoveredAt"),
  fileDeletePending: int("fileDeletePending").$type<boolean>().default(false).notNull(),
  fileDeletedAt: timestamp("fileDeletedAt"),
}, table => ({
  statusUpdatedIdx: index("filteredStoryExportJobs_status_updated_idx").on(table.status, table.updatedAt),
  expiryIdx: index("filteredStoryExportJobs_expiry_idx").on(table.expiresAt),
  ownerIdx: index("filteredStoryExportJobs_owner_created_idx").on(table.createdByOpenId, table.createdAt),
  leaseIdx: index("filteredStoryExportJobs_status_lease_idx").on(table.status, table.leaseExpiresAt),
}));
export type FilteredStoryExportJob = typeof filteredStoryExportJobs.$inferSelect;
export type InsertFilteredStoryExportJob = typeof filteredStoryExportJobs.$inferInsert;
