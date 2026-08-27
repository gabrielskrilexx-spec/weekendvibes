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
  saveEvent,
  updateEvent,
  updateEventsPublication,
  listFavoriteEventIds,
  toggleFavoriteEvent,
  setEventReminder,
  listUserReminders,
  listIngestionSources,
  updateIngestionSource,
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
import { runDryRun } from "./dry-run";
import { normalizeJsonForTransport } from "./transport";
import { getSandboxMockSettings, setSandboxMocksAllowed, shouldUseSandboxMocks } from "./ingestion-preview-settings";

const safeFilter = (max = 120) => z.string().trim().max(max).optional();
const latitudeInput = z
  .string()
  .regex(/^-?(?:90(?:\.0+)?|[1-8]?\d(?:\.\d+)?)$/)
  .optional();
const longitudeInput = z
  .string()
  .regex(/^-?(?:180(?:\.0+)?|1[0-7]\d(?:\.\d+)?|\d{1,2}(?:\.\d+)?)$/)
  .optional();

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
  status: z.enum(["succeeded", "partial", "SANDBOX_RESTRICTED"]),
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
const storiesSyncOutput = z.union([
  z.object({ success: z.literal(true), sourceKey: z.literal("instagram"), status: z.enum(["succeeded", "partial", "SANDBOX_RESTRICTED"]), message: z.string().max(240).optional(), read: z.number().int().nonnegative(), durationMs: z.number().int().nonnegative(), sandboxRestricted: z.boolean(), previewMock: z.boolean() }).strict(),
  z.object({ success: z.literal(false), sourceKey: z.literal("instagram"), status: z.literal("failed"), message: z.string().min(1).max(240), durationMs: z.number().int().nonnegative(), sandboxRestricted: z.boolean() }).strict(),
]);
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
const reprocessOutput = z
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
  adminRoutine: router({
    status: adminOnly.query(async () =>
      normalizeJsonForTransport(await getWednesdayRoutineStatus())
    ),
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
          const status = errors.length > 0 || result.skipped === true ? "partial" : "succeeded";
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
        const startedAt = Date.now();
        try {
          const raw = await runIngestionSourceChunk({ sourceKey: "instagram", dryRun: false, storiesOnly: true });
          const result = raw.result && typeof raw.result === "object" ? raw.result as Record<string, unknown> : {};
          const report = Array.isArray(result.sourceReports) ? result.sourceReports[0] as Record<string, unknown> | undefined : undefined;
          const errors = Array.isArray(report?.errors) ? report.errors : [];
          const durationMs = Math.max(1, Date.now() - startedAt);
          const sandboxRestricted = result.sandboxRestricted === true;
          if (errors.length > 0 || result.degraded === true || raw.result === undefined) {
            if (sandboxRestricted && shouldUseSandboxMocks()) return { success: true as const, sourceKey: "instagram" as const, status: "SANDBOX_RESTRICTED" as const, message: "Sincronizado via sandbox", read: 0, durationMs, sandboxRestricted: true, previewMock: true };
            return { success: false as const, sourceKey: "instagram" as const, status: "failed" as const, message: sandboxRestricted ? "SANDBOX_RESTRICTED: fonte externa bloqueada no ambiente de preview." : "A sincronização de Stories não pôde ser concluída.", durationMs, sandboxRestricted };
          }
          return { success: true as const, sourceKey: "instagram" as const, status: "succeeded" as const, read: Math.max(0, Math.trunc(Number(report?.read ?? result.read ?? result.receivedPosts ?? 0))), durationMs, sandboxRestricted, previewMock: result.previewMock === true };
        } catch (error) {
          const sandboxRestricted = isSandboxRestrictedError(error);
          if (sandboxRestricted && shouldUseSandboxMocks()) return { success: true as const, sourceKey: "instagram" as const, status: "SANDBOX_RESTRICTED" as const, message: "Sincronizado via sandbox", read: 0, durationMs: Math.max(1, Date.now() - startedAt), sandboxRestricted: true, previewMock: true };
          return { success: false as const, sourceKey: "instagram" as const, status: "failed" as const, message: sandboxRestricted ? "SANDBOX_RESTRICTED: fonte externa bloqueada no ambiente de preview." : "A sincronização de Stories não pôde ser concluída.", durationMs: Math.max(1, Date.now() - startedAt), sandboxRestricted };
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
      .output(mutationAckOutput)
      .mutation(async ({ input }) => {
        await deleteLocationAlias(input.id);
        return { ok: true as const, id: input.id };
      }),
  }),
  circuitBreaker: router({
    statuses: adminOnly.query(async () =>
      normalizeJsonForTransport(await listCircuitBreakerStatuses())
    ),
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
      .output(
        z
          .object({
            ok: z.literal(true),
            deleted: z.number().int().nonnegative(),
            deletedIds: z.array(z.number().int().positive()),
          })
          .strict()
      )
      .mutation(async ({ input }) => {
        try {
          const result = await deleteEvents(input.ids);
          return {
            ok: true as const,
            deleted: result.deleted,
            deletedIds: result.deletedIds,
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
        } catch {
          // Nunca transportar Error/cause do upstream: o serviço já sanitiza a
          // falha e o fallback mantém o contrato JSON da mutation.
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
  }),
  ingestionSources: router({
    list: adminOnly.query(async () =>
      normalizeJsonForTransport(await listIngestionSources())
    ),
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
      .output(
        z
          .object({
            ok: z.literal(true),
            updated: z.number().int().nonnegative(),
            ids: z.array(z.number().int().positive()),
          })
          .strict()
      )
      .mutation(async ({ input }) => {
        try {
          const result = await updateEventsPublication(input.ids);
          return {
            ok: true as const,
            updated: result.updated,
            ids: result.ids,
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
      .output(
        z
          .object({
            ok: z.literal(true),
            deleted: z.number().int().nonnegative(),
            deletedIds: z.array(z.number().int().positive()),
          })
          .strict()
      )
      .mutation(async ({ input }) => {
        try {
          const result = await deleteEvents(input.ids);
          return {
            ok: true as const,
            deleted: result.deleted,
            deletedIds: result.deletedIds,
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
