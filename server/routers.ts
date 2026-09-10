import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  publicProcedure,
  protectedProcedure,
  router,
} from "./_core/trpc";
import {
  deleteEvent,
  deleteEvents,
  getEventBySlug,
  listEvents,
  listTodayEvents,
  resolveOperationalAlert,
  resolveAllOperationalAlerts,
  resolveOperationalAlertsBefore,
  resetActiveIngestionSourceCircuitBreakers,
  saveEvent,
  updateEvent,
  updateEventsPublication,
  listFavoriteEventIds,
  toggleFavoriteEvent,
  setEventReminder,
  listUserReminders,
  listIngestionSources,
  createIngestionSource,
  updateIngestionSource,
  getPublicFeedRolloverHour,
  setPublicFeedRolloverHour,
  listOperationalAlerts,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { isSandboxRestrictedError } from "./external-fetch";
import {
  getWednesdayRoutineStatus,
  runWednesdayRoutineNow,
  getIngestionChunkSources,
  runIngestionSourceChunk,
} from "./manual-ingestion";
import {
  listIngestionReport,
  listIngestionLogs,
  reprocessIngestionSource,
  sanitizeReprocessErrorForTest,
  updateIngestionRunOcrText,
  reprocessIngestionRunOcr,
  approveFilteredInstagramStory,
  listFilteredStoriesPage,
  listAllFilteredStories,
  buildFilteredStoriesCsv,
  getFilteredStoryDetail,
  listFilteredStoryAuditPage,
} from "./ingestion-reports";
import {
  createLocationAlias,
  deleteLocationAlias,
  listLocationAliases,
  updateLocationAlias,
  listPotentialEventCollisions,
  listCircuitBreakerStatuses,
} from "./db";
import { listGeocodingSummary, processPendingGeocoding } from "./geocoding";
import { approveManualReviewEvent, approveManualReviewEvents, getManualReviewMetrics, listManualReviewEvents, rejectManualReviewEvent, rejectManualReviewEvents, updateManualReviewEvent, type ManualReviewEventInput } from "./manual-review";
import { runDryRun } from "./dry-run";
import { normalizeJsonForTransport } from "./transport";
import { getSandboxMockSettings, setSandboxMocksAllowed, shouldUseSandboxMocks } from "./ingestion-preview-settings";
import { createPersistentExportJob, getPersistentExportJobStatus, getPersistentExportDownload, cancelPersistentExportJob, purgePersistentExportJobs, recoverOrphanedExportJobs, listExportHistory, listPendingFileDeleteQueue, getExportJobsMetrics, evaluateExportJobsOperationalAlerts, getExportJobsMetricsTrend, getExportJobAlertDetail, getExportJobsAlertSettings, updateExportJobsAlertSettings, getExportJobsTrendBucket, getExportJobsAlertEfficiency, compareExportJobsEfficiency, listExportJobsAlertSettingsHistory, recordExportAlertEvaluationSnapshot, listExportAlertEvaluationSnapshots, getExportJobsEfficiencyBucket, getExportJobsAlertEfficiencyTrend } from "./filtered-story-export-jobs";
import { compareHeartbeatExecutionStats, evaluateHeartbeatHealth, evaluateHeartbeatPerformance, getHeartbeatExecutionStats, getHeartbeatHealthSettings, getHeartbeatExecutionSummary, listHeartbeatExecutionEvents, listHeartbeatHealthSettingsHistory, listHeartbeatIncidentsByRegression, recordHeartbeatExecutionEvent, updateHeartbeatHealthSettings, type HeartbeatEventType, type HeartbeatHealthEnvironment } from "./heartbeat-observability";

const safeFilter = (max = 120) => z.string().trim().max(max).optional();
const latitudeInput = z
  .string()
  .regex(/^-?(?:90(?:\.0+)?|[1-8]?\d(?:\.\d+)?)$/)
  .optional();
const longitudeInput = z
  .string()
  .regex(/^-?(?:180(?:\.0+)?|1[0-7]\d(?:\.\d+)?|\d{1,2}(?:\.\d+)?)$/)
  .optional();

const manualReviewStatusInput = z.enum(["pending", "approved", "rejected"]);
const manualReviewFiltersInput = z.object({
  status: manualReviewStatusInput.optional(),
  sourceType: z.string().trim().max(64).optional(),
  from: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
  to: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive().max(100).default(25),
}).strict();
const manualReviewEventInput = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().trim().min(3).max(255),
  eventDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  locationName: z.string().trim().max(255).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  city: z.enum(["Santos", "Guarujá"]).nullable().optional(),
  category: z.enum(["show", "balada", "evento_musical"]).nullable().optional(),
  genre: z.string().trim().max(80).nullable().optional(),
  summary: z.string().max(5000).nullable().optional(),
  priceCents: z.number().int().nonnegative().nullable().optional(),
  sourceUrl: z.string().trim().max(1000).nullable().optional(),
  sourceType: z.string().trim().max(64).nullable().optional(),
  imageUrl: z.string().trim().max(1000).nullable().optional(),
  rawText: z.string().max(16000).nullable().optional(),
  reason: z.string().trim().min(1).max(160),
}).strict();
const manualReviewEventOutput = z.object({
  id: z.number().int().positive(),
  sourceUrl: z.string().nullable(),
  sourceType: z.string().nullable(),
  title: z.string(),
  summary: z.string().nullable(),
  eventDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  locationName: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  category: z.enum(["show", "balada", "evento_musical"]).nullable(),
  genre: z.string().nullable(),
  priceCents: z.number().int().nullable(),
  imageUrl: z.string().nullable(),
  rawText: z.string().nullable(),
  reason: z.string(),
  status: manualReviewStatusInput,
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  publishedEventId: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
const manualReviewPageOutput = z.object({
  items: z.array(manualReviewEventOutput).max(100),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive().max(100),
  nextOffset: z.number().int().nonnegative().nullable(),
  hasNextPage: z.boolean(),
}).strict();
const manualReviewMetricsOutput = z.object({
  published: z.number().int().nonnegative(),
  awaitingReview: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
}).strict();
const manualReviewBulkInput = z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) }).strict();
const manualReviewBulkOutput = z.object({ success: z.literal(true), count: z.number().int().nonnegative(), ids: z.array(z.number().int().positive()).max(100) }).strict();

function throwSanitizedAdminMutationError(
  error: unknown,
  fallback: string
): never {
  const raw = error instanceof Error ? error.message : "";
  const message = /Database unavailable|timeout|network|fetch/i.test(raw)
    ? "O serviço está temporariamente indisponível. Tente novamente."
    : /foreign|constraint|referenc|depend/i.test(raw)
      ? "Não foi possível concluir a ação porque existem dependências relacionadas."
      : fallback;
  throw new TRPCError({
    code: /Database unavailable/i.test(raw)
      ? "SERVICE_UNAVAILABLE"
      : "INTERNAL_SERVER_ERROR",
    message,
  });
}

const eventInput = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(5000).optional(),
  eventDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  locationName: z.string().trim().min(2).max(180),
  address: z.string().trim().max(300).optional(),
  neighborhood: z.string().trim().max(120).optional(),
  formattedAddress: z.string().trim().max(360).optional(),
  city: z.enum(["Santos", "Guarujá"]),
  category: z.enum(["show", "balada", "evento_musical"]),
  genre: z
    .enum(["funk", "house_eletronica", "samba_pagode", "rap_trap"])
    .optional(),
  priceCents: z.number().int().min(0).default(0),
  sourceUrl: z
    .string()
    .url()
    .refine(
      value => value === "" || /^https:\/\//i.test(value),
      "A fonte deve usar HTTPS"
    )
    .optional()
    .or(z.literal("")),
  imageUrl: z
    .string()
    .url()
    .refine(
      value => value === "" || /^https:\/\//i.test(value),
      "A imagem deve usar HTTPS"
    )
    .optional()
    .or(z.literal("")),
  latitude: latitudeInput,
  longitude: longitudeInput,
  sourceHash: z
    .string()
    .trim()
    .max(255)
    .regex(/^[A-Za-z0-9:_-]+$/)
    .optional(),
  isPublished: z.number().int().min(0).max(1).default(1),
});

const adminOnly = adminProcedure;
const ingestionLogsOutput = z
  .object({
    updatedAt: z.string(),
    isLive: z.boolean(),
    logs: z.array(
      z
        .object({
          id: z.string(),
          runId: z.string(),
          kind: z.enum(["heartbeat", "ingestion", "retry", "alert"]),
          timestamp: z.string(),
          label: z.string(),
          status: z.string(),
          sourceKey: z.string().nullable(),
          message: z.string().nullable(),
          sandboxRestricted: z.boolean().optional(),
        })
        .strict()
    ),
  })
  .strict();
const adminRoutineSuccessOutput = z
  .object({
    ok: z.literal(true),
    archived: z.number().int().nonnegative(),
    publicSources: z
      .object({ imported: z.number().int().nonnegative() })
      .strict(),
    instagram: z.object({ imported: z.number().int().nonnegative() }).strict(),
    startedAt: z.string(),
    finishedAt: z.string(),
  })
  .strict();
const adminRoutineFailureOutput = z
  .object({
    ok: z.literal(false),
    message: z.string().min(1).max(240),
    details: z.array(z.string().max(240)).max(20),
  })
  .strict();
const adminRoutineOutput = z.union([
  adminRoutineSuccessOutput,
  adminRoutineFailureOutput,
]);
const ingestionChunkSuccessOutput = z.object({
  ok: z.literal(true),
  sourceKey: z.string().min(1).max(160),
  dryRun: z.boolean(),
  status: z.enum(["succeeded", "partial", "queued", "SANDBOX_RESTRICTED"]),
  read: z.number().int().nonnegative(),
  added: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  ignored: z.number().int().nonnegative(),
  errors: z.array(z.string().max(240)).max(20),
  durationMs: z.number().int().nonnegative(),
  sandboxRestricted: z.boolean().optional(),
  previewMock: z.boolean().optional(),
}).strict();
const ingestionChunkFailureOutput = z.object({
  ok: z.literal(false),
  sourceKey: z.string().min(1).max(160),
  dryRun: z.boolean(),
  status: z.literal("failed"),
  message: z.string().min(1).max(240),
  errors: z.array(z.string().max(240)).max(20),
  durationMs: z.number().int().nonnegative(),
  sandboxRestricted: z.boolean().optional(),
  previewMock: z.boolean().optional(),
}).strict();
const ingestionChunkOutput = z.union([ingestionChunkSuccessOutput, ingestionChunkFailureOutput]);
const mutationAckOutput = z
  .object({ ok: z.literal(true), id: z.number().int().positive().optional() })
  .strict();
const adminBatchMutationOutput = z
  .object({
    success: z.literal(true),
    count: z.number().int().nonnegative(),
    ids: z.array(z.string().min(1).max(32)),
  })
  .strict();
const aliasRemoveOutput = z
  .object({ success: z.literal(true), deletedId: z.string().min(1).max(32) })
  .strict();
const ocrEditOutput = z
  .object({ success: z.literal(true), runId: z.number().int().positive(), entryIndex: z.number().int().nonnegative().max(24), ocrText: z.string().max(5000) })
  .strict();
const eventCreateOutput = z
  .object({
    created: z.boolean(),
    id: z.number().int().positive().nullable(),
    duplicate: z.boolean(),
    updated: z.boolean(),
  })
  .strict();
const eventUpdateOutput = z
  .object({
    ok: z.literal(true),
    updated: z.boolean(),
    id: z.number().int().positive(),
  })
  .strict();
const favoriteOutput = z.object({ isFavorite: z.boolean() }).strict();
const reminderOutput = z
  .object({
    active: z.boolean(),
    hoursBefore: z.number().int().positive(),
    remindAt: z.string().nullable(),
  })
  .strict();
const eventRemoveOutput = z.object({ success: z.literal(true), deletedId: z.string().min(1).max(32) }).strict();
const storiesSyncOutput = z.object({ success: z.literal(true) }).strict();
const filteredStoriesFilterInput = z.object({
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive().max(100).default(25),
  reason: z.string().trim().max(120).optional(),
  username: z.string().trim().max(160).optional(),
  status: z.enum(["pending", "approved"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.array(z.object({ column: z.enum(["date", "source", "status"]), direction: z.enum(["asc", "desc"]) }).strict()).min(1).max(3).default([{ column: "date", direction: "desc" }]),
}).strict();
const filteredStoryOutput = z.object({
  id: z.string().min(1).max(500),
  runId: z.number().int().positive(),
  username: z.string().max(160),
  mediaOrigin: z.enum(["story", "highlight"]),
  imageUrl: z.string().url().or(z.literal("")),
  sourceUrl: z.string().url().or(z.literal("")),
  postedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  ocrText: z.string().max(5000),
  rawText: z.string().max(5000),
  reasons: z.array(z.string().max(240)).max(20),
  status: z.enum(["pending", "approved"]),
  approvedBy: z.string().max(160).nullable(),
  approvedAt: z.string().nullable(),
}).strict();
const filteredStoriesPageOutput = z.object({
  items: z.array(filteredStoryOutput),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive().max(50),
  nextOffset: z.number().int().nonnegative().nullable(),
  hasNextPage: z.boolean(),
}).strict();
const filteredStoryAuditOutput = z.object({
  action: z.enum(["ocr_edit", "approval"]),
  previousText: z.string().nullable(),
  nextText: z.string().nullable(),
  status: z.string().nullable(),
  actorOpenId: z.string().min(1).max(160),
  createdAt: z.string(),
}).strict();
const filteredStoryAuditPageOutput = z.object({
  items: z.array(filteredStoryAuditOutput).max(50),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive().max(50),
  nextOffset: z.number().int().nonnegative().nullable(),
  hasNextPage: z.boolean(),
}).strict();
const exportHistoryItemOutput = z.object({ jobId: z.string(), status: z.enum(["queued", "processing", "completed", "failed", "cancelled", "expired"]), progress: z.number().int().min(0).max(100), fileName: z.string().nullable(), contentType: z.string().nullable(), error: z.string().nullable(), fileDeletePending: z.boolean(), createdAt: z.string(), updatedAt: z.string(), format: z.enum(["csv", "json"]) }).strict();
const exportHistoryPageOutput = z.object({ items: z.array(exportHistoryItemOutput).max(50), total: z.number().int().nonnegative(), offset: z.number().int().nonnegative(), limit: z.number().int().positive().max(50), nextOffset: z.number().int().nonnegative().nullable(), hasNextPage: z.boolean() }).strict();
const heartbeatEventTypeInput = z.enum(["started", "step", "log", "alert", "completed", "failed", "timeout"]);
const heartbeatEnvironmentInput = z.enum(["development", "preview", "production"]);
const heartbeatExecutionIdInput = z.object({ heartbeatExecutionId: z.string().trim().min(1).max(160) }).strict();
const heartbeatTimelineInput = heartbeatExecutionIdInput.extend({ eventType: heartbeatEventTypeInput.optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), offset: z.number().int().nonnegative().default(0), limit: z.number().int().positive().max(100).default(50) }).strict();
const heartbeatTimelineEventOutput = z.object({ id: z.string(), heartbeatExecutionId: z.string(), eventType: heartbeatEventTypeInput, sequence: z.number().int().nonnegative(), timestamp: z.string().datetime(), durationMs: z.number().int().nonnegative().nullable(), status: z.string().nullable(), message: z.string().nullable(), metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])) }).strict();
const heartbeatTimelinePageOutput = z.object({ items: z.array(heartbeatTimelineEventOutput).max(100), total: z.number().int().nonnegative(), offset: z.number().int().nonnegative(), limit: z.number().int().positive().max(100), nextOffset: z.number().int().nonnegative().nullable(), hasNextPage: z.boolean() }).strict();
const heartbeatSummaryOutput = z.object({ heartbeatExecutionId: z.string(), startedAt: z.string().datetime().nullable(), finishedAt: z.string().datetime().nullable(), durationMs: z.number().int().nonnegative().nullable(), status: z.enum(["running", "succeeded", "failed", "timeout", "unknown"]), eventCount: z.number().int().nonnegative(), alertCount: z.number().int().nonnegative() }).strict();
const heartbeatHealthSettingsOutput = z.object({ environment: heartbeatEnvironmentInput, maxDurationMs: z.number().int().min(100).max(600000), failureThreshold: z.number().int().min(1).max(10), cooldownHours: z.number().int().min(1).max(168), minSuccessRate: z.number().min(0).max(1), maxP95DurationMs: z.number().int().min(100).max(600000), minRegressionSuccessRateDrop: z.number().min(0).max(1), maxRegressionP95IncreasePercent: z.number().min(0).max(500), warningRegressionPct: z.number().min(0).max(500), criticalRegressionPct: z.number().min(0).max(1000) }).strict();
const heartbeatHealthUpdateOutput = heartbeatHealthSettingsOutput.extend({ changedByOpenId: z.string().min(1).max(160), changedAt: z.string().datetime() }).strict();
const heartbeatHealthHistoryOutput = z.object({ items: z.array(z.object({ id: z.string(), environment: heartbeatEnvironmentInput, previousValue: z.string(), nextValue: z.string(), changedByOpenId: z.string(), changedAt: z.string().datetime() }).strict()).max(50), offset: z.number().int().nonnegative(), limit: z.number().int().positive().max(50), nextOffset: z.number().int().nonnegative().nullable(), hasNextPage: z.boolean() }).strict();
const heartbeatStatsPointOutput = z.object({ bucketStart: z.string().datetime(), totalExecutions: z.number().int().nonnegative(), successfulExecutions: z.number().int().nonnegative(), successRate: z.number().min(0).max(1), p95DurationMs: z.number().int().nonnegative(), incidentCount: z.number().int().nonnegative() }).strict();
const heartbeatStatsOutput = z.object({ from: z.string().datetime(), to: z.string().datetime(), totalExecutions: z.number().int().nonnegative(), successfulExecutions: z.number().int().nonnegative(), successRate: z.number().min(0).max(1), p95DurationMs: z.number().int().nonnegative(), incidentCount: z.number().int().nonnegative(), points: z.array(heartbeatStatsPointOutput).max(366) }).strict();
const heartbeatPeriodInput = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() }).strict();
const heartbeatCompareOutput = z.object({ first: heartbeatStatsOutput, second: heartbeatStatsOutput, deltas: z.object({ successRate: z.object({ absolute: z.number(), percent: z.number() }).strict(), p95DurationMs: z.object({ absolute: z.number(), percent: z.number() }).strict(), incidentCount: z.object({ absolute: z.number(), percent: z.number() }).strict() }).strict() }).strict();
const heartbeatPerformanceOutput = z.object({ heartbeatExecutionId: z.string(), settings: heartbeatHealthSettingsOutput, alerts: z.array(z.enum(["heartbeat_success_rate_degraded", "heartbeat_p95_degraded", "heartbeat_period_regression"])).max(3), evaluatedAt: z.string().datetime() }).strict();
const heartbeatIncidentPageOutput = z.object({ items: z.array(z.object({ id: z.string(), heartbeatExecutionId: z.string(), eventType: heartbeatEventTypeInput, sequence: z.number().int().nonnegative(), timestamp: z.string().datetime(), durationMs: z.number().int().nonnegative().nullable(), status: z.string().nullable(), message: z.string().nullable(), metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])) }).strict()).max(100), offset: z.number().int().nonnegative(), limit: z.number().int().positive().max(100), nextOffset: z.number().int().nonnegative().nullable(), hasNextPage: z.boolean() }).strict();
const dryRunSuccessOutput = z
  .object({
    dryRun: z.literal(true),
    startedAt: z.string(),
    finishedAt: z.string(),
    durationMs: z.number().nonnegative(),
    sources: z.array(
      z
        .object({
          routine: z.enum(["public-agenda", "instagram-agenda"]),
          sourceKey: z.string(),
          durationMs: z.number().nonnegative().default(0),
          medianDurationMs: z.number().nonnegative().default(0),
          p95DurationMs: z.number().nonnegative().default(0),
          read: z.number().nonnegative(),
          filtered: z.number().nonnegative(),
          persistable: z.number().nonnegative(),
          duplicates: z.number().nonnegative(),
          errors: z.array(
            z
              .object({
                sourceUrl: z.string().optional(),
                status: z.number().nullable(),
                message: z.string(),
              })
              .strict()
          ),
          rejectionReasons: z.record(z.string(), z.number().nonnegative()),
          sandboxRestricted: z.boolean().optional(),
          previewMock: z.boolean().optional(),
        })
        .strict()
    ),
    totals: z
      .object({
        read: z.number().nonnegative(),
        filtered: z.number().nonnegative(),
        persistable: z.number().nonnegative(),
        duplicates: z.number().nonnegative(),
        errors: z.number().nonnegative(),
      })
      .strict(),
  })
  .strict();
const dryRunFailureOutput = z
  .object({
    dryRun: z.literal(false),
    success: z.literal(false),
    message: z.string().min(1).max(240),
    details: z.array(z.string().max(240)).max(20),
  })
  .strict();
const dryRunOutput = z.union([dryRunSuccessOutput, dryRunFailureOutput]);
const sourceTelemetryOutput = z.array(z.object({ sourceKey: z.string(), runs: z.number().int().nonnegative(), successes: z.number().int().nonnegative(), successRate: z.number().min(0).max(1), averageLatencyMs: z.number().int().nonnegative(), p95LatencyMs: z.number().int().nonnegative(), simulatedExecutions: z.number().int().nonnegative(), errors: z.array(z.object({ category: z.enum(["anti_bot", "proxy", "timeout_dns", "sandbox", "other"]), count: z.number().int().nonnegative() }).strict()) }).strict());
const reprocessResultOutput = z
  .object({
    ok: z.boolean(),
    sourceKey: z.enum(["public", "instagram"]),
    routine: z.enum(["instagram-agenda", "manual-reprocess"]),
    imported: z.number().int().nonnegative(),
    counts: z
      .object({
        read: z.number().int().nonnegative(),
        filtered: z.number().int().nonnegative(),
        persisted: z.number().int().nonnegative(),
        duplicates: z.number().int().nonnegative(),
      })
      .strict(),
    degraded: z.boolean(),
    accepted: z.boolean(),
    error: z.string().nullable(),
  })
  .strict();
const reprocessSandboxOutput = z
  .object({
    success: z.literal(true),
    status: z.literal("SANDBOX_RESTRICTED"),
    read: z.literal(0),
    persisted: z.literal(0),
  })
  .strict();
const reprocessOutput = z.union([reprocessResultOutput, reprocessSandboxOutput]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => normalizeJsonForTransport(opts.ctx.user)),
    logout: publicProcedure
      .output(z.object({ success: z.literal(true) }).strict())
      .mutation(({ ctx }) => {
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        return { success: true } as const;
      }),
  }),
  heartbeat: router({
    health: router({
      updateSettings: adminOnly
        .input(heartbeatHealthSettingsOutput.omit({ environment: true, minRegressionSuccessRateDrop: true, maxRegressionP95IncreasePercent: true, warningRegressionPct: true, criticalRegressionPct: true }).extend({ environment: heartbeatEnvironmentInput, minRegressionSuccessRateDrop: z.number().min(0).max(1).optional(), maxRegressionP95IncreasePercent: z.number().min(0).max(500).optional(), warningRegressionPct: z.number().min(0).max(500).optional(), criticalRegressionPct: z.number().min(0).max(1000).optional() }).strict())
        .output(heartbeatHealthUpdateOutput)
        .mutation(({ ctx, input }) => updateHeartbeatHealthSettings({ ...input, changedByOpenId: ctx.user.openId })),
      exportSettingsHistory: adminOnly
        .input(z.object({ format: z.enum(["csv", "json"]), environment: heartbeatEnvironmentInput, adminOpenId: z.string().trim().min(1).max(160).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() }).strict())
        .output(z.object({ jobId: z.string().min(16).max(128), status: z.literal("queued"), progress: z.literal(0) }).strict())
        .mutation(({ ctx, input }) => createPersistentExportJob({ format: input.format, filters: { kind: "settings-history", environment: input.environment, from: input.from, to: input.to, adminOpenId: input.adminOpenId }, createdByOpenId: ctx.user.openId })),
    }),
    timeline: adminOnly
      .input(heartbeatTimelineInput)
      .output(heartbeatTimelinePageOutput)
      .query(({ input }) => listHeartbeatExecutionEvents(input)),
    summary: adminOnly
      .input(heartbeatExecutionIdInput)
      .output(heartbeatSummaryOutput)
      .query(({ input }) => getHeartbeatExecutionSummary(input.heartbeatExecutionId)),
    healthSettings: adminOnly
      .input(z.object({ environment: heartbeatEnvironmentInput.optional() }).strict())
      .output(heartbeatHealthSettingsOutput)
      .query(({ input }) => getHeartbeatHealthSettings(input.environment)),
    updateHealthSettings: adminOnly
      .input(heartbeatHealthSettingsOutput.omit({ environment: true, minRegressionSuccessRateDrop: true, maxRegressionP95IncreasePercent: true, warningRegressionPct: true, criticalRegressionPct: true }).extend({ environment: heartbeatEnvironmentInput, minRegressionSuccessRateDrop: z.number().min(0).max(1).optional(), maxRegressionP95IncreasePercent: z.number().min(0).max(500).optional(), warningRegressionPct: z.number().min(0).max(500).optional(), criticalRegressionPct: z.number().min(0).max(1000).optional() }).strict())
      .output(heartbeatHealthUpdateOutput)
      .mutation(({ ctx, input }) => updateHeartbeatHealthSettings({ ...input, changedByOpenId: ctx.user.openId })),
    recordEvent: adminOnly
      .input(z.object({ heartbeatExecutionId: z.string().trim().min(1).max(160), eventType: heartbeatEventTypeInput, sequence: z.number().int().nonnegative(), timestamp: z.string().datetime().optional(), durationMs: z.number().int().nonnegative().nullable().optional(), status: z.string().max(64).nullable().optional(), message: z.string().max(20000).nullable().optional(), metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional() }).strict())
      .output(z.object({ id: z.string(), heartbeatExecutionId: z.string(), sequence: z.number().int().nonnegative() }).strict())
      .mutation(({ input }) => recordHeartbeatExecutionEvent({ ...input, timestamp: input.timestamp ? new Date(input.timestamp) : undefined })),
    evaluateHealth: adminOnly
      .input(z.object({ heartbeatExecutionId: z.string().trim().min(1).max(160), status: z.enum(["running", "succeeded", "failed", "timeout", "unknown"]), durationMs: z.number().int().nonnegative().nullable(), errorMessage: z.string().max(5000).nullable().optional(), environment: heartbeatEnvironmentInput.optional() }).strict())
      .output(z.object({ heartbeatExecutionId: z.string(), settings: heartbeatHealthSettingsOutput, alerts: z.array(z.enum(["heartbeat_execution_failed", "heartbeat_duration_anomaly"])).max(2), evaluatedAt: z.string().datetime() }).strict())
      .mutation(({ input }) => evaluateHeartbeatHealth(input)),
    healthSettingsHistory: adminOnly
      .input(z.object({ environment: heartbeatEnvironmentInput, offset: z.number().int().nonnegative().default(0), limit: z.number().int().positive().max(50).default(20) }).strict())
      .output(heartbeatHealthHistoryOutput)
      .query(({ input }) => listHeartbeatHealthSettingsHistory(input)),
    exportSettingsHistory: adminOnly
      .input(z.object({ format: z.enum(["csv", "json"]), environment: heartbeatEnvironmentInput, adminOpenId: z.string().trim().min(1).max(160).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() }).strict())
      .output(z.object({ jobId: z.string().min(16).max(128), status: z.literal("queued"), progress: z.literal(0) }).strict())
      .mutation(({ ctx, input }) => createPersistentExportJob({ format: input.format, filters: { kind: "settings-history", environment: input.environment, from: input.from, to: input.to, adminOpenId: input.adminOpenId }, createdByOpenId: ctx.user.openId })),
    incidents: router({
      listByRegression: adminOnly
        .input(z.object({ heartbeatExecutionId: z.string().trim().min(1).max(160), from: z.string().datetime().optional(), to: z.string().datetime().optional(), offset: z.number().int().nonnegative().default(0), limit: z.number().int().positive().max(100).default(25) }).strict())
        .output(heartbeatIncidentPageOutput)
        .query(({ input }) => listHeartbeatIncidentsByRegression(input)),
    }),
    executionStats: adminOnly
      .input(z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional(), environment: heartbeatEnvironmentInput.optional() }).strict())
      .output(heartbeatStatsOutput)
      .query(({ input }) => getHeartbeatExecutionStats(input)),
    compareExecutionStats: adminOnly
      .input(z.object({ first: heartbeatPeriodInput, second: heartbeatPeriodInput }).strict())
      .output(heartbeatCompareOutput)
      .query(({ input }) => compareHeartbeatExecutionStats(input)),
    evaluatePerformance: adminOnly
      .input(z.object({ heartbeatExecutionId: z.string().trim().min(1).max(160), successRate: z.number().min(0).max(1), p95DurationMs: z.number().int().nonnegative(), previousSuccessRate: z.number().min(0).max(1).optional(), previousP95DurationMs: z.number().int().nonnegative().optional(), environment: heartbeatEnvironmentInput.optional() }).strict())
      .output(heartbeatPerformanceOutput)
      .mutation(({ input }) => evaluateHeartbeatPerformance(input)),
    startStatsExport: adminOnly
      .input(z.object({ format: z.enum(["csv", "json"]), first: heartbeatPeriodInput, second: heartbeatPeriodInput, environment: heartbeatEnvironmentInput.optional(), adminOpenId: z.string().trim().min(1).max(160).optional() }).strict())
      .output(z.object({ jobId: z.string().min(16).max(128), status: z.literal("queued"), progress: z.literal(0) }).strict())
      .mutation(({ ctx, input }) => createPersistentExportJob({ format: input.format, filters: { kind: "heartbeat-stats-comparison", first: input.first, second: input.second, environment: input.environment, adminOpenId: input.adminOpenId }, createdByOpenId: ctx.user.openId })),
    startTimelineExport: adminOnly
      .input(z.object({ format: z.enum(["csv", "json"]), heartbeatExecutionId: z.string().trim().min(1).max(160), eventType: heartbeatEventTypeInput.optional(), environment: heartbeatEnvironmentInput.optional(), adminOpenId: z.string().trim().min(1).max(160).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() }).strict())
      .output(z.object({ jobId: z.string().min(16).max(128), status: z.literal("queued"), progress: z.literal(0) }).strict())
      .mutation(({ ctx, input }) => createPersistentExportJob({ format: input.format, filters: { kind: "heartbeat-timeline", heartbeatExecutionId: input.heartbeatExecutionId, eventType: input.eventType as HeartbeatEventType | undefined, environment: input.environment, adminOpenId: input.adminOpenId, from: input.from, to: input.to }, createdByOpenId: ctx.user.openId })),
    exportStatus: adminOnly
      .input(z.object({ jobId: z.string().min(16).max(128) }).strict())
      .output(z.object({ jobId: z.string(), status: z.enum(["queued", "processing", "completed", "failed", "cancelled", "expired"]), progress: z.number().int().min(0).max(100), fileName: z.string().nullable(), contentType: z.string().nullable(), error: z.string().nullable(), fileDeletePending: z.boolean() }).strict())
      .query(({ ctx, input }) => getPersistentExportJobStatus(input.jobId, ctx.user.openId)),
    exportDownload: adminOnly
      .input(z.object({ jobId: z.string().min(16).max(128) }).strict())
      .output(z.object({ fileName: z.string(), contentType: z.string(), downloadUrl: z.string() }).strict())
      .query(({ ctx, input }) => getPersistentExportDownload(input.jobId, ctx.user.openId)),
  }),
  adminRoutine: router({
    rolloverHour: adminOnly
      .output(z.object({ rolloverHour: z.number().int().min(0).max(23) }).strict())
      .query(async () => ({ rolloverHour: await getPublicFeedRolloverHour() })),
    setRolloverHour: adminOnly
      .input(z.object({ rolloverHour: z.number().int().min(0).max(23) }).strict())
      .output(z.object({ success: z.literal(true), rolloverHour: z.number().int().min(0).max(23) }).strict())
      .mutation(async ({ input }) => {
        try {
          const rolloverHour = await setPublicFeedRolloverHour(input.rolloverHour);
          return { success: true as const, rolloverHour };
        } catch (error) {
          return throwSanitizedAdminMutationError(error, "Não foi possível salvar o horário de virada.");
        }
      }),
    status: adminOnly.query(async () =>
      normalizeJsonForTransport(await getWednesdayRoutineStatus())
    ),
    manualReview: router({
      list: adminOnly
        .input(manualReviewFiltersInput)
        .output(manualReviewPageOutput)
        .query(({ input }) => listManualReviewEvents(input)),
      metrics: adminOnly
        .output(manualReviewMetricsOutput)
        .query(() => getManualReviewMetrics()),
      update: adminOnly
        .input(manualReviewEventInput.extend({ id: z.number().int().positive() }).strict())
        .output(manualReviewEventOutput)
        .mutation(async ({ input }) => {
          const result = await updateManualReviewEvent(input as ManualReviewEventInput & { id: number });
          if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Evento pendente não encontrado." });
          return result;
        }),
      approve: adminOnly
        .input(z.object({ id: z.number().int().positive() }).strict())
        .output(manualReviewEventOutput)
        .mutation(async ({ ctx, input }) => {
          const result = await approveManualReviewEvent(input.id, ctx.user.openId);
          if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Evento pendente não encontrado." });
          return result;
        }),
      approveMany: adminOnly
        .input(manualReviewBulkInput)
        .output(manualReviewBulkOutput)
        .mutation(({ ctx, input }) => approveManualReviewEvents(input.ids, ctx.user.openId)),
      reject: adminOnly
        .input(z.object({ id: z.number().int().positive() }).strict())
        .output(manualReviewEventOutput)
        .mutation(async ({ ctx, input }) => {
          const result = await rejectManualReviewEvent(input.id, ctx.user.openId);
          if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Evento pendente não encontrado." });
          return result;
        }),
      rejectMany: adminOnly
        .input(manualReviewBulkInput)
        .output(manualReviewBulkOutput)
        .mutation(({ ctx, input }) => rejectManualReviewEvents(input.ids, ctx.user.openId)),
    }),
    filteredStories: adminOnly
      .input(filteredStoriesFilterInput)
      .output(filteredStoriesPageOutput)
      .query(async ({ input }) => {
        return await listFilteredStoriesPage(input);
      }),
    filteredStoriesCsv: adminOnly
      .input(filteredStoriesFilterInput)
      .output(z.object({ fileName: z.string().min(1).max(180), contentType: z.literal("text/csv;charset=utf-8"), csv: z.string() }).strict())
      .query(async ({ input }) => ({ fileName: `stories-filtrados-${new Date().toISOString().slice(0, 10)}.csv`, contentType: "text/csv;charset=utf-8" as const, csv: buildFilteredStoriesCsv(await listAllFilteredStories(input)) })),
    startFilteredStoriesExport: adminOnly
      .input(z.object({ format: z.enum(["csv", "json"]), filters: filteredStoriesFilterInput }).strict())
      .output(z.object({ jobId: z.string().min(16).max(128), status: z.literal("queued"), progress: z.literal(0) }).strict())
      .mutation(({ ctx, input }) => createPersistentExportJob({ ...input, createdByOpenId: ctx.user.openId })),
    filteredStoriesExportStatus: adminOnly
      .input(z.object({ jobId: z.string().min(16).max(128) }).strict())
      .output(z.object({ jobId: z.string(), status: z.enum(["queued", "processing", "completed", "failed", "cancelled", "expired"]), progress: z.number().int().min(0).max(100), fileName: z.string().nullable(), contentType: z.string().nullable(), error: z.string().nullable(), fileDeletePending: z.boolean() }).strict())
      .query(({ ctx, input }) => getPersistentExportJobStatus(input.jobId, ctx.user.openId)),
    filteredStoriesExportDownload: adminOnly
      .input(z.object({ jobId: z.string().min(16).max(128) }).strict())
      .output(z.object({ fileName: z.string(), contentType: z.string(), downloadUrl: z.string() }).strict())
      .query(({ ctx, input }) => getPersistentExportDownload(input.jobId, ctx.user.openId)),
    cancelFilteredStoriesExport: adminOnly
      .input(z.object({ jobId: z.string().min(16).max(128) }).strict())
      .output(z.object({ success: z.literal(true), jobId: z.string(), status: z.literal("cancelled") }).strict())
      .mutation(({ ctx, input }) => cancelPersistentExportJob(input.jobId, ctx.user.openId)),
    purgeFilteredStoriesExports: adminOnly
      .input(z.object({ before: z.string().datetime().optional() }).strict())
      .output(z.object({ success: z.literal(true), deletedJobs: z.number().int().nonnegative(), deletedFiles: z.number().int().nonnegative(), pendingFiles: z.number().int().nonnegative() }).strict())
      .mutation(({ input }) => purgePersistentExportJobs(input.before)),
    recoverFilteredStoriesExports: adminOnly
      .input(z.object({ limit: z.number().int().positive().max(20).default(5) }).strict())
      .output(z.object({ success: z.literal(true), recovered: z.number().int().nonnegative(), skipped: z.number().int().nonnegative() }).strict())
      .mutation(({ input }) => recoverOrphanedExportJobs(input.limit)),
    exportHistory: adminOnly
      .input(z.object({ format: z.enum(["csv", "json"]).optional(), status: z.enum(["queued", "processing", "completed", "failed", "cancelled", "expired"]).optional(), from: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(), to: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(), offset: z.number().int().nonnegative().default(0), limit: z.number().int().positive().max(50).default(20) }).strict())
      .output(exportHistoryPageOutput)
      .query(({ ctx, input }) => listExportHistory({ ...input, ownerOpenId: ctx.user.openId })),
    exportJobsMetricsTrend: adminOnly
      .input(z.object({ windowDays: z.number().int().min(1).max(90).default(30) }).strict())
      .output(z.object({ windowDays: z.number().int().positive(), points: z.array(z.object({ bucketStart: z.string().datetime(), pendingDelete: z.number().int().nonnegative(), expiredLeases: z.number().int().nonnegative() }).strict()).max(90) }).strict())
      .query(({ input }) => getExportJobsMetricsTrend(input.windowDays)),
    exportJobAlertDetail: adminOnly
      .input(z.object({ alertId: z.string().trim().min(1).max(128) }).strict())
      .output(z.object({ alert: z.object({ id: z.string(), type: z.string(), severity: z.enum(["INFO", "WARNING", "CRITICAL"]), message: z.string(), createdAt: z.string().datetime(), resolvedAt: z.string().datetime().nullable() }).strict(), affectedJobs: z.array(z.object({ jobId: z.string(), status: z.string(), recoveryAttempts: z.number().int().nonnegative(), leaseExpiresAt: z.string().datetime().nullable(), fileDeletePending: z.boolean() }).strict()).max(100), timeline: z.array(z.object({ event: z.enum(["created", "lease_expired", "recovered", "retry_exhausted", "cancelled", "expired", "file_delete_pending"]), occurredAt: z.string().datetime(), jobId: z.string().nullable(), message: z.string() }).strict()).max(200) }).strict())
      .query(({ ctx, input }) => getExportJobAlertDetail(input.alertId, ctx.user.openId)),
    exportJobsAlertSettings: adminOnly
      .input(z.object({ environment: z.enum(["development", "preview", "production"]) }).strict())
      .output(z.object({ environment: z.enum(["development", "preview", "production"]), severity: z.enum(["INFO", "WARNING", "CRITICAL"]), growthThreshold: z.number().int().min(1).max(100000), minimumQueueSize: z.number().int().nonnegative().max(100000), consecutiveWindows: z.number().int().min(1).max(10) }).strict())
      .query(({ input }) => getExportJobsAlertSettings(input.environment)),
    updateExportJobsAlertSettings: adminOnly
      .input(z.object({ environment: z.enum(["development", "preview", "production"]), severity: z.enum(["INFO", "WARNING", "CRITICAL"]), growthThreshold: z.number().int().min(1).max(100000), minimumQueueSize: z.number().int().nonnegative().max(100000), consecutiveWindows: z.number().int().min(1).max(10) }).strict())
      .output(z.object({ environment: z.enum(["development", "preview", "production"]), severity: z.enum(["INFO", "WARNING", "CRITICAL"]), growthThreshold: z.number().int().min(1).max(100000), minimumQueueSize: z.number().int().nonnegative().max(100000), consecutiveWindows: z.number().int().min(1).max(10) }).strict())
      .mutation(({ ctx, input }) => updateExportJobsAlertSettings({ ...input, changedByOpenId: ctx.user.openId })),
    exportJobsAlertSettingsHistory: adminOnly
      .input(z.object({ environment: z.enum(["development", "preview", "production"]), offset: z.number().int().nonnegative().default(0), limit: z.number().int().positive().max(50).default(20) }).strict())
      .output(z.object({ items: z.array(z.object({ id: z.string(), environment: z.enum(["development", "preview", "production"]), previousValue: z.string(), nextValue: z.string(), changedByOpenId: z.string(), changedAt: z.string().datetime() }).strict()).max(50), offset: z.number().int().nonnegative(), limit: z.number().int().positive(), hasNextPage: z.boolean() }).strict())
      .query(({ ctx, input }) => listExportJobsAlertSettingsHistory({ ...input, ownerOpenId: ctx.user.openId })),
    exportJobsMetricsTrendBucket: adminOnly
      .input(z.object({ from: z.string().datetime(), to: z.string().datetime() }).strict())
      .output(z.object({ from: z.string().datetime(), to: z.string().datetime(), jobs: z.array(z.object({ jobId: z.string(), status: z.string(), recoveryAttempts: z.number().int().nonnegative(), leaseExpiresAt: z.string().datetime().nullable(), fileDeletePending: z.boolean() }).strict()).max(100), alerts: z.array(z.object({ id: z.string(), alertType: z.string(), severity: z.enum(["INFO", "WARNING", "CRITICAL"]), title: z.string(), message: z.string(), isResolved: z.boolean(), createdAt: z.string().datetime(), updatedAt: z.string().datetime() }).strict()).max(100) }).strict())
      .query(({ ctx, input }) => getExportJobsTrendBucket({ ...input, ownerOpenId: ctx.user.openId })),
    exportJobsAlertEfficiency: adminOnly
      .input(z.object({ windowDays: z.number().int().min(1).max(90).default(30) }).strict())
      .output(z.object({ windowDays: z.number().int().positive(), total: z.number().int().nonnegative(), resolved: z.number().int().nonnegative(), resolutionRate: z.number().min(0).max(1), averageAgeMs: z.number().nonnegative(), openCount: z.number().int().nonnegative() }).strict())
      .query(({ ctx, input }) => getExportJobsAlertEfficiency({ ...input, ownerOpenId: ctx.user.openId })),
    exportJobsAlertEfficiencyCompare: adminOnly
      .input(z.object({ first: z.object({ from: z.string().datetime(), to: z.string().datetime() }).strict(), second: z.object({ from: z.string().datetime(), to: z.string().datetime() }).strict() }).strict())
      .output(z.object({ first: z.object({ from: z.string().datetime(), to: z.string().datetime(), total: z.number().int().nonnegative(), resolved: z.number().int().nonnegative(), resolutionRate: z.number().min(0).max(1), averageAgeMs: z.number().nonnegative(), openCount: z.number().int().nonnegative() }).strict(), second: z.object({ from: z.string().datetime(), to: z.string().datetime(), total: z.number().int().nonnegative(), resolved: z.number().int().nonnegative(), resolutionRate: z.number().min(0).max(1), averageAgeMs: z.number().nonnegative(), openCount: z.number().int().nonnegative() }).strict(), delta: z.object({ total: z.number().int(), resolved: z.number().int(), resolutionRate: z.number().nullable(), averageAgeMs: z.number().nullable(), openCount: z.number().int() }).strict() }).strict())
      .query(({ ctx, input }) => compareExportJobsEfficiency({ ...input, ownerOpenId: ctx.user.openId })),
    exportJobsAlertEfficiencyTrend: adminOnly
      .input(z.object({ windowDays: z.number().int().min(1).max(90).default(30) }).strict())
      .output(z.object({ windowDays: z.number().int().positive(), points: z.array(z.object({ bucketStart: z.string().datetime(), total: z.number().int().nonnegative(), resolved: z.number().int().nonnegative(), resolutionRate: z.number().min(0).max(1), averageAgeMs: z.number().nonnegative() }).strict()).max(90) }).strict())
      .query(({ input }) => getExportJobsAlertEfficiencyTrend(input.windowDays)),
    exportJobsMetrics: adminOnly
      .input(z.object({ windowHours: z.number().int().positive().max(720).default(24) }).strict())
      .output(z.object({ windowHours: z.number().int().positive(), total: z.number().int().nonnegative(), queued: z.number().int().nonnegative(), processing: z.number().int().nonnegative(), completed: z.number().int().nonnegative(), failed: z.number().int().nonnegative(), cancelled: z.number().int().nonnegative(), expired: z.number().int().nonnegative(), expiredLeases: z.number().int().nonnegative(), recoveryExhausted: z.number().int().nonnegative(), orphaned: z.number().int().nonnegative(), fileDeletePending: z.number().int().nonnegative(), fileDeletePendingPrevious: z.number().int(), fileDeletePendingGrowth: z.number() }).strict())
      .query(({ input }) => getExportJobsMetrics(input.windowHours)),
    exportJobsPendingDeletion: adminOnly
      .input(z.object({ limit: z.number().int().positive().max(50).default(20) }).strict())
      .output(z.object({ items: z.array(z.object({ jobId: z.string(), hasFile: z.boolean(), expiresAt: z.string() }).strict()).max(50) }).strict())
      .query(async ({ input }) => ({ items: await listPendingFileDeleteQueue(input.limit) })),
    evaluateExportJobsAlerts: adminOnly
      .input(z.object({ windowHours: z.number().int().positive().max(720).default(24) }).strict())
      .output(z.object({ metrics: z.object({ windowHours: z.number().int().positive(), total: z.number().int().nonnegative(), queued: z.number().int().nonnegative(), processing: z.number().int().nonnegative(), completed: z.number().int().nonnegative(), failed: z.number().int().nonnegative(), cancelled: z.number().int().nonnegative(), expired: z.number().int().nonnegative(), expiredLeases: z.number().int().nonnegative(), recoveryExhausted: z.number().int().nonnegative(), orphaned: z.number().int().nonnegative(), fileDeletePending: z.number().int().nonnegative() }).strict(), alerts: z.array(z.string()).max(10) }).strict())
      .query(({ input }) => evaluateExportJobsOperationalAlerts(input.windowHours)),
    exportJobsEfficiencyBucket: adminOnly
      .input(z.object({ from: z.string().datetime(), to: z.string().datetime() }).strict())
      .output(z.object({ from: z.string().datetime(), to: z.string().datetime(), total: z.number().int().nonnegative(), resolved: z.number().int().nonnegative(), resolutionRate: z.number().min(0).max(1), averageAgeMs: z.number().nonnegative(), openCount: z.number().int().nonnegative(), snapshots: z.array(z.object({ snapshotId: z.string(), queueSize: z.number().int().nonnegative(), queueGrowth: z.number().int(), decision: z.enum(["NO_ALERT", "ALERT_CREATED", "DEDUPLICATED"]), evaluatedAt: z.string().datetime() }).strict()).max(100) }).strict())
      .query(({ ctx, input }) => getExportJobsEfficiencyBucket({ ...input, ownerOpenId: ctx.user.openId })),
    exportAlertEvaluationSnapshots: adminOnly
      .input(z.object({ environment: z.enum(["development", "preview", "production"]).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), offset: z.number().int().nonnegative().default(0), limit: z.number().int().positive().max(100).default(25) }).strict())
      .output(z.object({ items: z.array(z.object({ snapshotId: z.string(), environment: z.enum(["development", "preview", "production"]), windowStartedAt: z.string().datetime(), windowEndedAt: z.string().datetime(), queueSize: z.number().int().nonnegative(), previousQueueSize: z.number().int().nonnegative(), queueGrowth: z.number().int(), expiredLeases: z.number().int().nonnegative(), orphanedJobs: z.number().int().nonnegative(), growthThreshold: z.number().int().positive(), minimumQueueSize: z.number().int().nonnegative(), consecutiveWindows: z.number().int().positive(), severity: z.enum(["INFO", "WARNING", "CRITICAL"]), decision: z.enum(["NO_ALERT", "ALERT_CREATED", "DEDUPLICATED"]), evaluatedByOpenId: z.string(), heartbeatExecutionId: z.string().nullable(), evaluatedAt: z.string().datetime() }).strict()).max(100), offset: z.number().int().nonnegative(), limit: z.number().int().positive(), hasNextPage: z.boolean() }).strict())
      .query(({ input }) => listExportAlertEvaluationSnapshots(input)),
    exportAlertEvaluationSnapshotsExportAsync: adminOnly
      .input(z.object({ format: z.enum(["csv", "json"]), environment: z.enum(["development", "preview", "production"]).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() }).strict())
      .output(z.object({ jobId: z.string().min(16).max(128), status: z.literal("queued"), progress: z.literal(0) }).strict())
      .mutation(({ ctx, input }) => createPersistentExportJob({ format: input.format, filters: { kind: "alert-snapshots", environment: input.environment, from: input.from, to: input.to }, createdByOpenId: ctx.user.openId })),
    exportAlertEvaluationSnapshotsExport: adminOnly
      .input(z.object({ format: z.enum(["csv", "json"]), environment: z.enum(["development", "preview", "production"]).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() }).strict())
      .output(z.object({ fileName: z.string(), contentType: z.string(), content: z.string() }).strict())
      .query(async ({ input }) => {
        const page = await listExportAlertEvaluationSnapshots({ ...input, offset: 0, limit: 100 });
        const rows = page.items;
        const content = input.format === "json" ? JSON.stringify(rows) : ["snapshotId,environment,windowStartedAt,windowEndedAt,queueSize,queueGrowth,severity,decision,evaluatedByOpenId,evaluatedAt", ...rows.map(row => [row.snapshotId, row.environment, row.windowStartedAt, row.windowEndedAt, row.queueSize, row.queueGrowth, row.severity, row.decision, row.evaluatedByOpenId, row.evaluatedAt].map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\\r\\n");
        return { fileName: `export-alert-snapshots-${new Date().toISOString().slice(0, 10)}.${input.format}`, contentType: input.format === "json" ? "application/json" : "text/csv;charset=utf-8", content };
      }),
    exportAlertSettingsHistoryExportAsync: adminOnly
      .input(z.object({ format: z.enum(["csv", "json"]), environment: z.enum(["development", "preview", "production"]), from: z.string().datetime().optional(), to: z.string().datetime().optional() }).strict())
      .output(z.object({ jobId: z.string().min(16).max(128), status: z.literal("queued"), progress: z.literal(0) }).strict())
      .mutation(({ ctx, input }) => createPersistentExportJob({ format: input.format, filters: { kind: "settings-history", environment: input.environment, from: input.from, to: input.to }, createdByOpenId: ctx.user.openId })),
    exportAlertSettingsHistoryExport: adminOnly
      .input(z.object({ format: z.enum(["csv", "json"]), environment: z.enum(["development", "preview", "production"]) }).strict())
      .output(z.object({ fileName: z.string(), contentType: z.string(), content: z.string() }).strict())
      .query(async ({ input, ctx }) => {
        const page = await listExportJobsAlertSettingsHistory({ environment: input.environment, offset: 0, limit: 50, ownerOpenId: ctx.user.openId });
        const content = input.format === "json" ? JSON.stringify(page.items) : ["id,environment,previousValue,nextValue,changedByOpenId,changedAt", ...page.items.map(row => [row.id, row.environment, row.previousValue, row.nextValue, row.changedByOpenId, row.changedAt].map(value => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\\r\\n");
        return { fileName: `export-alert-settings-${new Date().toISOString().slice(0, 10)}.${input.format}`, contentType: input.format === "json" ? "application/json" : "text/csv;charset=utf-8", content };
      }),
    filteredStoriesJson: adminOnly
      .input(filteredStoriesFilterInput)
      .output(z.object({ fileName: z.string().min(1).max(180), contentType: z.literal("application/json"), json: z.string() }).strict())
      .query(async ({ input }) => ({ fileName: `stories-filtrados-${new Date().toISOString().slice(0, 10)}.json`, contentType: "application/json" as const, json: JSON.stringify(await listAllFilteredStories(input)) })),
    filteredStoryDetail: adminOnly
      .input(z.object({ storyId: z.string().trim().min(1).max(500) }).strict())
      .output(z.object({ story: filteredStoryOutput.nullable(), history: z.array(filteredStoryAuditOutput).max(100) }).strict())
      .query(({ input }) => getFilteredStoryDetail(input.storyId)),
    filteredStoryAuditHistory: adminOnly
      .input(z.object({ storyId: z.string().trim().min(1).max(500), offset: z.number().int().nonnegative().default(0), limit: z.number().int().positive().max(50).default(20) }).strict())
      .output(filteredStoryAuditPageOutput)
      .query(({ input }) => listFilteredStoryAuditPage(input.storyId, input.offset, input.limit)),
    sources: adminOnly
      .output(z.object({ sources: z.array(z.string().min(1).max(160)).max(80) }).strict())
      .query(() => ({ sources: getIngestionChunkSources() })),
    runSource: adminOnly
      .input(z.object({ sourceKey: z.string().trim().min(1).max(160), dryRun: z.boolean().default(false), storiesOnly: z.boolean().default(false) }).strict())
      .output(ingestionChunkOutput)
      .mutation(async ({ input }) => {
        const startedAt = Date.now();
        try {
          const raw = await runIngestionSourceChunk(input);
          const durationMs = Date.now() - startedAt;
          const result = raw.result && typeof raw.result === "object" ? raw.result as Record<string, unknown> : {};
          const report = Array.isArray(result.sourceReports) ? result.sourceReports[0] as Record<string, unknown> | undefined : undefined;
          const errors = Array.isArray(report?.errors) ? report.errors.slice(0, 20).map(error => String(error && typeof error === "object" && "message" in error ? (error as { message?: unknown }).message ?? "Falha sanitizada" : error).slice(0, 240)) : [];
          const read = Number(report?.read ?? result.read ?? result.receivedPosts ?? result.discovered ?? 0);
          const added = Number(report?.added ?? result.added ?? result.imported ?? 0);
          const updated = Number(report?.updated ?? result.updated ?? 0);
          const ignored = Number(report?.ignored ?? result.ignored ?? result.filtered ?? 0);
          const queued = result.status === "QUEUED";
          const status = queued ? "queued" : errors.length > 0 || result.skipped === true ? "partial" : "succeeded";
          return { ok: true as const, sourceKey: raw.sourceKey, dryRun: raw.dryRun, status, read: Math.max(0, Math.trunc(read)), added: Math.max(0, Math.trunc(added)), updated: Math.max(0, Math.trunc(updated)), ignored: Math.max(0, Math.trunc(ignored)), errors, durationMs, sandboxRestricted: result.sandboxRestricted === true, previewMock: result.previewMock === true };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha interna ao processar a fonte.";
          const sandboxRestricted = isSandboxRestrictedError(error);
          if (sandboxRestricted && shouldUseSandboxMocks()) return { ok: true as const, sourceKey: input.sourceKey, dryRun: input.dryRun, status: "SANDBOX_RESTRICTED" as const, read: 0, added: 0, updated: 0, ignored: 0, errors: ["Fonte restrita no ambiente de preview; fallback sandbox aplicado."], durationMs: Math.max(1, Date.now() - startedAt), sandboxRestricted: true, previewMock: true };
          return { ok: false as const, sourceKey: input.sourceKey, dryRun: input.dryRun, status: "failed" as const, message: sandboxRestricted ? "SANDBOX_RESTRICTED: fonte externa bloqueada no ambiente de preview." : message.replace(/https?:\/\/[^\s]+/gi, "fonte pública").slice(0, 240), errors: [sandboxRestricted ? "Fonte restrita no ambiente de preview do Manus." : "A fonte não pôde ser processada nesta etapa."], durationMs: Math.max(1, Date.now() - startedAt), sandboxRestricted };
        }
      }),
    syncStories: adminOnly
      .input(z.object({}).strict())
      .output(storiesSyncOutput)
      .mutation(async () => {
        try {
          await runIngestionSourceChunk({ sourceKey: "instagram", dryRun: false, storiesOnly: true });
        } catch {
          // O processamento já registra a falha; o acknowledgement permanece serializável.
        }
        return { success: true as const };
      }),
    updateOcrText: adminOnly
      .input(z.object({ runId: z.number().int().positive(), entryIndex: z.number().int().nonnegative().max(24), ocrText: z.string().max(5000) }).strict())
      .output(ocrEditOutput)
      .mutation(async ({ input, ctx }) => {
        try {
          return await updateIngestionRunOcrText({ ...input, changedByOpenId: String(ctx.user.openId ?? ctx.user.name ?? "admin") });
        } catch (error) {
          return throwSanitizedAdminMutationError(error, "Não foi possível salvar a revisão do OCR.");
        }
      }),
    reprocessOcr: adminOnly
      .input(z.object({ runId: z.number().int().positive(), entryIndex: z.number().int().nonnegative().max(24) }).strict())
      .output(ocrEditOutput)
      .mutation(async ({ input, ctx }) => {
        try {
          return await reprocessIngestionRunOcr({ ...input, changedByOpenId: String(ctx.user.openId ?? ctx.user.name ?? "admin") });
        } catch (error) {
          return throwSanitizedAdminMutationError(error, "Não foi possível reprocessar o OCR.");
        }
      }),
    approveFilteredStory: adminOnly
      .input(z.object({ runId: z.number().int().positive(), storyId: z.string().trim().min(1).max(500) }).strict())
      .output(z.object({ success: z.literal(true), runId: z.number().int().positive(), storyId: z.string(), status: z.literal("approved"), approvedBy: z.string().min(1).max(160), approvedAt: z.string() }).strict())
      .mutation(async ({ input, ctx }) => {
        try {
          return await approveFilteredInstagramStory({ runId: input.runId, storyId: input.storyId, approvedBy: String(ctx.user.openId ?? ctx.user.name ?? "admin") });
        } catch (error) {
          return throwSanitizedAdminMutationError(error, "Não foi possível aprovar o Story filtrado.");
        }
      }),
    runNow: adminOnly.output(adminRoutineOutput).mutation(async () => {
      try {
        const result = await runWednesdayRoutineNow();
        const importedFrom = (value: unknown) =>
          value &&
          typeof value === "object" &&
          "imported" in value &&
          typeof (value as { imported?: unknown }).imported === "number"
            ? Math.max(0, Math.trunc((value as { imported: number }).imported))
            : 0;
        return {
          ok: true as const,
          archived: Math.max(0, Math.trunc(result.archived)),
          publicSources: { imported: importedFrom(result.publicSources) },
          instagram: { imported: importedFrom(result.instagram) },
          startedAt: String(result.startedAt),
          finishedAt: String(result.finishedAt),
        };
      } catch {
        return {
          ok: false as const,
          message: "Falha interna ao conectar com as fontes.",
          details: [],
        };
      }
    }),
  }),
  locationAliases: router({
    list: adminOnly.query(async () =>
      normalizeJsonForTransport(await listLocationAliases())
    ),
    create: adminOnly
      .input(
        z.object({
          alias: z.string().trim().min(2).max(180),
          canonicalName: z.string().trim().min(2).max(180),
          city: z.enum(["Santos", "Guarujá"]),
        })
      )
      .output(mutationAckOutput)
      .mutation(async ({ input }) => {
        await createLocationAlias(input);
        return { ok: true as const };
      }),
    update: adminOnly
      .input(
        z.object({
          id: z.number().int().positive(),
          alias: z.string().trim().min(2).max(180),
          canonicalName: z.string().trim().min(2).max(180),
          city: z.enum(["Santos", "Guarujá"]),
          isActive: z.boolean(),
        })
      )
      .output(mutationAckOutput)
      .mutation(async ({ input }) => {
        await updateLocationAlias(input.id, input);
        return { ok: true as const, id: input.id };
      }),
    remove: adminOnly
      .input(z.object({ id: z.number().int().positive() }))
      .output(aliasRemoveOutput)
      .mutation(async ({ input }) => {
        await deleteLocationAlias(input.id);
        return { success: true as const, deletedId: String(input.id) };
      }),
  }),
  circuitBreaker: router({
    statuses: adminOnly.query(async () =>
      normalizeJsonForTransport(await listCircuitBreakerStatuses())
    ),
    resetActive: adminOnly
      .output(z.object({ success: z.literal(true), resetCount: z.number().int().nonnegative(), sourceKeys: z.array(z.string().min(1).max(120)).max(100) }).strict())
      .mutation(async () => {
        try {
          const result = await resetActiveIngestionSourceCircuitBreakers();
          return { success: true as const, resetCount: result.resetCount, sourceKeys: result.sourceKeys };
        } catch (error) {
          return throwSanitizedAdminMutationError(error, "Não foi possível resetar o Circuit Breaker das fontes ativas.");
        }
      }),
  }),
  collisionReview: router({
    list: adminOnly
      .input(
        z
          .object({ limit: z.number().int().min(1).max(100).optional() })
          .optional()
      )
      .query(async ({ input }) =>
        normalizeJsonForTransport(
          await listPotentialEventCollisions(input?.limit ?? 100)
        )
      ),
    resolveMany: adminOnly
      .input(
        z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) })
      )
      .output(adminBatchMutationOutput)
      .mutation(async ({ input }) => {
        try {
          const result = await deleteEvents(input.ids);
          return {
            success: true as const,
            count: Number(result.deleted),
            ids: result.deletedIds.map(id => String(id)),
          };
        } catch (error) {
          return throwSanitizedAdminMutationError(
            error,
            "Não foi possível resolver as colisões."
          );
        }
      }),
  }),
  ingestionReports: router({
    logs: adminOnly
      .input(
        z
          .object({ limit: z.number().int().min(10).max(120).optional() })
          .optional()
      )
      .output(ingestionLogsOutput)
      .query(({ input }) => listIngestionLogs(input?.limit ?? 80)),
    summary: adminOnly
      .input(
        z
          .object({
            size: z.number().int().min(1).max(50).optional(),
            periodDays: z
              .union([z.literal(7), z.literal(15), z.literal(30), z.literal(90), z.literal("all")])
              .optional(),
            routine: z
              .enum(["instagram-agenda", "public-agenda", "manual-reprocess"])
              .optional(),
            status: z
              .enum(["running", "succeeded", "partial", "failed"])
              .optional(),
            trigger: z.enum(["manual", "scheduled"]).optional(),
            runId: z.number().int().positive().optional(),
            sourceKey: z.string().trim().max(255).optional(),
            executionKind: z.enum(["all", "real", "simulated"]).optional(),
          })
          .optional()
      )
      .query(({ input }) =>
        listIngestionReport(input?.size ?? 20, {
          periodDays: input?.periodDays,
          routine: input?.routine,
          status: input?.status,
          trigger: input?.trigger,
          runId: input?.runId,
          sourceKey: input?.sourceKey,
          executionKind: input?.executionKind,
        })
      ),
    geocoding: adminOnly.query(async () =>
      normalizeJsonForTransport(await listGeocodingSummary())
    ),
    telemetry: adminOnly.query(async () => {
      const report = await listIngestionReport(50, { periodDays: 7 });
      return { sourceTelemetry: sourceTelemetryOutput.parse(report.sourceTelemetry) };
    }),
    dryRun: adminOnly.output(dryRunOutput).mutation(async () => {
      try {
        return normalizeJsonForTransport(await runDryRun());
      } catch {
        return {
          dryRun: false as const,
          success: false as const,
          message: "Falha interna ao conectar com as fontes.",
          details: [],
        };
      }
    }),
    reprocess: adminOnly
      .input(z.object({ sourceKey: z.enum(["public", "instagram"]) }))
      .output(reprocessOutput)
      .mutation(async ({ input }) => {
        try {
          const result = await reprocessIngestionSource(input.sourceKey);
          const error =
            "error" in result && typeof result.error === "string"
              ? result.error.slice(0, 240)
              : null;
          return {
            ...result,
            accepted: "accepted" in result && result.accepted === true,
            error,
          };
        } catch (e) {
          if (input.sourceKey === "instagram" && shouldUseSandboxMocks()) {
            return { success: true as const, status: "SANDBOX_RESTRICTED" as const, read: 0, persisted: 0 };
          }
          return {
            ok: false as const,
            sourceKey: input.sourceKey,
            routine:
              input.sourceKey === "instagram"
                ? ("instagram-agenda" as const)
                : ("manual-reprocess" as const),
            imported: 0,
            counts: { read: 0, filtered: 0, persisted: 0, duplicates: 0 },
            degraded: false,
            accepted: false,
            error: "Falha ao iniciar a execução manual",
          };
        }
      }),
    mockSettings: adminOnly.query(() => getSandboxMockSettings()),
    setMockSettings: adminOnly
      .input(z.object({ allowSandboxMocks: z.boolean() }).strict())
      .output(z.object({ allowSandboxMocks: z.boolean(), environment: z.enum(["preview", "production"]) }).strict())
      .mutation(({ input }) => setSandboxMocksAllowed(input.allowSandboxMocks)),
    geocodeNow: adminOnly
      .output(
        z
          .object({
            processed: z.number().int().nonnegative(),
            succeeded: z.number().int().nonnegative(),
            failed: z.number().int().nonnegative(),
            pending: z.number().int().nonnegative(),
          })
          .strict()
      )
      .mutation(() => processPendingGeocoding(10)),
  }),
  operationalAlerts: router({
    list: adminOnly
      .input(z.object({ limit: z.number().int().positive().max(100).default(25) }).strict())
      .output(z.array(z.object({ id: z.number().int().positive(), alertType: z.string(), severity: z.enum(["INFO", "WARNING", "CRITICAL"]), title: z.string(), message: z.string(), isResolved: z.boolean(), createdAt: z.string().datetime(), updatedAt: z.string().datetime() }).strict()).max(100))
      .query(({ input }) => listOperationalAlerts(input.limit)),
    resolve: adminOnly
      .input(z.object({ id: z.number().int().positive() }))
      .output(
        z
          .object({ ok: z.literal(true), id: z.number().int().positive() })
          .strict()
      )
      .mutation(async ({ input }) => {
        await resolveOperationalAlert(input.id);
        return { ok: true as const, id: input.id };
      }),
    resolveAll: adminOnly
      .output(z.object({ ok: z.literal(true), resolvedCount: z.number().int().nonnegative() }).strict())
      .mutation(async () => {
        const result = await resolveAllOperationalAlerts();
        return { ok: true as const, resolvedCount: result.resolvedCount };
      }),
    archiveBefore: adminOnly
      .input(z.object({ before: z.string().datetime(), alertTypes: z.array(z.string().trim().min(1).max(80)).max(20).optional() }).strict())
      .output(z.object({ ok: z.literal(true), resolvedCount: z.number().int().nonnegative(), before: z.string().datetime() }).strict())
      .mutation(async ({ input }) => {
        try {
          const result = await resolveOperationalAlertsBefore({ before: new Date(input.before), alertTypes: input.alertTypes });
          return { ok: true as const, resolvedCount: result.resolvedCount, before: result.before };
        } catch (error) {
          return throwSanitizedAdminMutationError(error, "Não foi possível arquivar os alertas obsoletos.");
        }
      }),
  }),
  ingestionSources: router({
    list: adminOnly.query(async () =>
      normalizeJsonForTransport(await listIngestionSources())
    ),
    create: adminOnly
      .input(
        z
          .object({
            name: z.string().trim().min(2).max(180),
            kind: z.enum(["instagram", "public"]),
            handle: z.string().trim().max(180).optional(),
            url: z.string().trim().url().refine(value => /^https:\/\//i.test(value), "A fonte deve usar HTTPS").optional(),
          })
          .strict()
          .refine(input => Boolean(input.handle?.replace(/^@+/, "").trim() || input.url), {
            message: "Informe um handle ou uma URL válida",
            path: ["handle"],
          })
      )
      .output(z.object({ ok: z.literal(true), id: z.number().int().positive(), sourceKey: z.string().min(1).max(120) }).strict())
      .mutation(async ({ input }) => {
        const normalizedHandle = input.handle?.trim().replace(/^@+/, "").replace(/\/$/, "") || undefined;
        const url = input.url ?? (normalizedHandle ? `https://www.instagram.com/${normalizedHandle}/` : undefined);
        if (!url) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um handle ou uma URL válida" });
        try {
          const created = await createIngestionSource({ name: input.name, kind: input.kind, handle: normalizedHandle, url });
          return { ok: true as const, id: created.id, sourceKey: created.sourceKey };
        } catch (error) {
          throwSanitizedAdminMutationError(error, "Não foi possível cadastrar a fonte. Verifique se ela já existe.");
        }
      }),
    update: adminOnly
      .input(
        z.object({
          id: z.number().int().positive(),
          isEnabled: z.boolean(),
          priority: z.number().int().min(1).max(1000),
          frequencyMinutes: z.number().int().min(60).max(525600),
          p95LatencyThresholdMs: z.number().int().min(500).max(60000).default(3000),
        })
      )
      .output(
        z
          .object({
            ok: z.literal(true),
            id: z.number().int().positive(),
            isEnabled: z.boolean(),
            priority: z.number().int().min(1).max(1000),
            frequencyMinutes: z.number().int().min(60).max(525600),
            p95LatencyThresholdMs: z.number().int().min(500).max(60000),
          })
          .strict()
      )
      .mutation(async ({ input }) => {
        await updateIngestionSource(input.id, input);
        return {
          ok: true as const,
          id: input.id,
          isEnabled: input.isEnabled,
          priority: input.priority,
          frequencyMinutes: input.frequencyMinutes,
          p95LatencyThresholdMs: input.p95LatencyThresholdMs,
        };
      }),
  }),
  events: router({
    list: publicProcedure
      .input(
        z
          .object({
            day: safeFilter(20),
            date: safeFilter(20),
            startDate: safeFilter(30),
            endDate: safeFilter(30),
            timeFrom: safeFilter(10),
            timeTo: safeFilter(10),
            city: z.enum(["Santos", "Guarujá"]).optional(),
            category: z.enum(["show", "balada", "evento_musical"]).optional(),
            genre: z
              .enum(["funk", "house_eletronica", "samba_pagode", "rap_trap"])
              .optional(),
            venue: safeFilter(180),
            neighborhood: safeFilter(120),
            minPriceCents: z.number().int().min(0).max(10_000_000).optional(),
            maxPriceCents: z.number().int().min(0).max(10_000_000).optional(),
            page: z.number().int().min(1).max(10000).optional(),
            size: z.number().int().min(1).max(100).optional(),
          })
          .optional()
      )
      .query(async ({ input }) =>
        normalizeJsonForTransport(await listEvents(input ?? {}))
      ),
    today: publicProcedure
      .input(
        z
          .object({ size: z.number().int().min(1).max(20).optional() })
          .optional()
      )
      .query(async ({ input }) =>
        normalizeJsonForTransport(await listTodayEvents(input ?? {}))
      ),
    bySlug: publicProcedure
      .input(
        z.object({
          slug: z
            .string()
            .trim()
            .min(3)
            .max(180)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        })
      )
      .query(async ({ input }) =>
        normalizeJsonForTransport(await getEventBySlug(input.slug))
      ),
    favoriteIds: protectedProcedure.query(({ ctx }) =>
      listFavoriteEventIds(ctx.user.id)
    ),
    toggleFavorite: protectedProcedure
      .input(z.object({ eventId: z.number().int().positive() }))
      .output(favoriteOutput)
      .mutation(async ({ ctx, input }) =>
        normalizeJsonForTransport(
          await toggleFavoriteEvent(ctx.user.id, input.eventId)
        )
      ),
    reminders: protectedProcedure.query(async ({ ctx }) =>
      normalizeJsonForTransport(await listUserReminders(ctx.user.id))
    ),
    setReminder: protectedProcedure
      .input(
        z.object({
          eventId: z.number().int().positive(),
          active: z.boolean(),
          hoursBefore: z
            .union([z.literal(3), z.literal(24), z.literal(72)])
            .optional(),
        })
      )
      .output(reminderOutput)
      .mutation(async ({ ctx, input }) => {
        const result = await setEventReminder(
          ctx.user.id,
          input.eventId,
          input.active,
          input.hoursBefore ?? 24
        );
        return {
          active: result.active,
          hoursBefore: result.hoursBefore,
          remindAt:
            result.remindAt instanceof Date
              ? result.remindAt.toISOString()
              : null,
        };
      }),
    create: adminOnly
      .input(eventInput)
      .output(eventCreateOutput)
      .mutation(async ({ input }) => {
        const result = await saveEvent(input);
        return {
          created: Boolean(result?.created),
          id: result?.id ? Number(result.id) : null,
          duplicate: Boolean(result?.duplicate),
          updated: Boolean(result?.updated),
        };
      }),
    update: adminOnly
      .input(
        z.object({
          id: z.number().int().positive(),
          data: eventInput.partial(),
        })
      )
      .output(eventUpdateOutput)
      .mutation(async ({ input }) => {
        try {
          const result = await updateEvent(input.id, input.data);
          return {
            ok: true as const,
            updated: Boolean(result.updated),
            id: Number(result.id),
          };
        } catch (error) {
          const message =
            error instanceof Error &&
            /data|ID|cidade|Database|evento/i.test(error.message)
              ? error.message.slice(0, 180)
              : "Não foi possível salvar as alterações do evento";
          throw new TRPCError({ code: "BAD_REQUEST", message });
        }
      }),
    publishMany: adminOnly
      .input(
        z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) })
      )
      .output(adminBatchMutationOutput)
      .mutation(async ({ input }) => {
        try {
          const result = await updateEventsPublication(input.ids);
          return {
            success: true as const,
            count: Number(result.updated),
            ids: result.ids.map(id => String(id)),
          };
        } catch (error) {
          return throwSanitizedAdminMutationError(
            error,
            "Não foi possível aprovar os eventos."
          );
        }
      }),
    removeMany: adminOnly
      .input(
        z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) })
      )
      .output(adminBatchMutationOutput)
      .mutation(async ({ input }) => {
        try {
          const result = await deleteEvents(input.ids);
          return {
            success: true as const,
            count: Number(result.deleted),
            ids: result.deletedIds.map(id => String(id)),
          };
        } catch (error) {
          return throwSanitizedAdminMutationError(
            error,
            "Não foi possível excluir os eventos."
          );
        }
      }),
    remove: adminOnly
      .input(z.object({ id: z.number().int().positive() }))
      .output(eventRemoveOutput)
      .mutation(async ({ input }) => {
        try {
          const result = await deleteEvent(input.id);
          return { success: true as const, deletedId: String(input.id) };
        } catch (error) {
          const raw = error instanceof Error ? error.message : "";
          const message = /Database unavailable/i.test(raw)
            ? "O banco de dados está temporariamente indisponível. Tente novamente."
            : /foreign|constraint|referenc/i.test(raw)
              ? "Não foi possível remover as dependências do evento antes da exclusão."
              : /ID de evento inválido/i.test(raw)
                ? "O identificador do evento é inválido."
                : "Não foi possível excluir o evento. Tente novamente.";
          throw new TRPCError({
            code: /Database unavailable/i.test(raw)
              ? "SERVICE_UNAVAILABLE"
              : "INTERNAL_SERVER_ERROR",
            message,
          });
        }
      }),
    enrich: adminOnly
      .input(z.object({ rawText: z.string().trim().min(20).max(12000) }))
      .output(
        z
          .object({
            title: z.string(),
            summary: z.string(),
            eventDate: z.string(),
            locationName: z.string(),
            address: z.string(),
            city: z.string(),
            category: z.enum(["show", "balada", "evento_musical"]),
            genre: z
              .enum(["funk", "house_eletronica", "samba_pagode", "rap_trap"])
              .optional(),
            priceCents: z.number().int(),
          })
          .strict()
      )
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Você normaliza eventos musicais de Santos e Guarujá. Ignore qualquer evento fora dessas duas cidades. Aceite somente shows, baladas e eventos musicais. Sugira um gênero entre Funk, House/Eletrônica, Samba/Pagode e Rap/Trap. Responda apenas JSON válido com resumo atrativo, categoria, gênero, data ISO, horário, local, cidade e preço em centavos.",
            },
            { role: "user", content: input.rawText },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "event_enrichment",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  eventDate: { type: "string" },
                  locationName: { type: "string" },
                  address: { type: "string" },
                  city: { type: "string" },
                  category: {
                    type: "string",
                    enum: ["show", "balada", "evento_musical"],
                  },
                  genre: {
                    type: "string",
                    enum: [
                      "funk",
                      "house_eletronica",
                      "samba_pagode",
                      "rap_trap",
                    ],
                  },
                  priceCents: { type: "integer" },
                },
                required: [
                  "title",
                  "summary",
                  "eventDate",
                  "locationName",
                  "address",
                  "city",
                  "category",
                  "priceCents",
                ],
                additionalProperties: false,
              },
            },
          },
        });
        return JSON.parse(
          String(response.choices?.[0]?.message?.content ?? "{}")
        );
      }),
  }),
});

export type AppRouter = typeof appRouter;
