import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { deleteEvent, getEventBySlug, listEvents, listTodayEvents, resolveOperationalAlert, saveEvent, updateEvent, listFavoriteEventIds, toggleFavoriteEvent, setEventReminder, listUserReminders, listIngestionSources, updateIngestionSource } from "./db";
import { invokeLLM } from "./_core/llm";
import { getWednesdayRoutineStatus, runWednesdayRoutineNow } from "./manual-ingestion";
import { listIngestionReport, reprocessIngestionSource, sanitizeReprocessErrorForTest } from "./ingestion-reports";
import { createLocationAlias, deleteLocationAlias, listLocationAliases, updateLocationAlias, listPotentialEventCollisions } from "./db";
import { listGeocodingSummary, processPendingGeocoding } from "./geocoding";

const safeFilter = (max = 120) => z.string().trim().max(max).optional();
const latitudeInput = z.string().regex(/^-?(?:90(?:\.0+)?|[1-8]?\d(?:\.\d+)?)$/).optional();
const longitudeInput = z.string().regex(/^-?(?:180(?:\.0+)?|1[0-7]\d(?:\.\d+)?|\d{1,2}(?:\.\d+)?)$/).optional();

const eventInput = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().min(3).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(5000).optional(),
  eventDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  locationName: z.string().trim().min(2).max(180),
  address: z.string().trim().max(300).optional(),
  neighborhood: z.string().trim().max(120).optional(),
  formattedAddress: z.string().trim().max(360).optional(),
  city: z.enum(["Santos", "Guarujá"]),
  category: z.enum(["show", "balada", "evento_musical"]),
  genre: z.enum(["funk", "house_eletronica", "samba_pagode", "rap_trap"]).optional(),
  priceCents: z.number().int().min(0).default(0),
  sourceUrl: z.string().url().refine(value => value === "" || /^https:\/\//i.test(value), "A fonte deve usar HTTPS").optional().or(z.literal("")),
  imageUrl: z.string().url().refine(value => value === "" || /^https:\/\//i.test(value), "A imagem deve usar HTTPS").optional().or(z.literal("")),
  latitude: latitudeInput,
  longitude: longitudeInput,
  sourceHash: z.string().trim().max(255).regex(/^[A-Za-z0-9:_-]+$/).optional(),
  isPublished: z.number().int().min(0).max(1).default(1),
});

const adminOnly = adminProcedure;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  adminRoutine: router({
    status: adminOnly.query(() => getWednesdayRoutineStatus()),
    runNow: adminOnly.mutation(async () => runWednesdayRoutineNow()),
  }),
  locationAliases: router({
    list: adminOnly.query(() => listLocationAliases()),
    create: adminOnly.input(z.object({ alias: z.string().trim().min(2).max(180), canonicalName: z.string().trim().min(2).max(180), city: z.enum(["Santos", "Guarujá"]) })).mutation(({ input }) => createLocationAlias(input)),
    update: adminOnly.input(z.object({ id: z.number().int().positive(), alias: z.string().trim().min(2).max(180), canonicalName: z.string().trim().min(2).max(180), city: z.enum(["Santos", "Guarujá"]), isActive: z.boolean() })).mutation(({ input }) => updateLocationAlias(input.id, input)),
    remove: adminOnly.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteLocationAlias(input.id)),
  }),
  collisionReview: router({
    list: adminOnly.input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional()).query(({ input }) => listPotentialEventCollisions(input?.limit ?? 100)),
  }),
  ingestionReports: router({
    summary: adminOnly.input(z.object({ size: z.number().int().min(1).max(50).optional(), periodDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(), routine: z.enum(["instagram-agenda", "public-agenda", "manual-reprocess"]).optional(), status: z.enum(["running", "succeeded", "partial", "failed"]).optional(), trigger: z.enum(["manual", "scheduled"]).optional(), runId: z.number().int().positive().optional(), sourceKey: z.string().trim().max(255).optional() }).optional()).query(({ input }) => listIngestionReport(input?.size ?? 20, { periodDays: input?.periodDays, routine: input?.routine, status: input?.status, trigger: input?.trigger, runId: input?.runId, sourceKey: input?.sourceKey })),
    geocoding: adminOnly.query(() => listGeocodingSummary()),
    reprocess: adminOnly.input(z.object({ sourceKey: z.enum(["public", "instagram"]) })).mutation(async ({ input }) => {
      try {
        return await reprocessIngestionSource(input.sourceKey);
      } catch {
        // Nunca transportar Error/cause do upstream: o serviço já sanitiza a
        // falha e o fallback mantém o contrato JSON da mutation.
        return {
          ok: false as const,
          sourceKey: input.sourceKey,
          routine: input.sourceKey === "instagram" ? "instagram-agenda" as const : "manual-reprocess" as const,
          imported: 0,
          counts: { read: 0, filtered: 0, persisted: 0, duplicates: 0 },
          degraded: false,
          error: "Falha ao iniciar a execução manual",
        };
      }
    }),
    geocodeNow: adminOnly.mutation(() => processPendingGeocoding(10)),
  }),
  operationalAlerts: router({
    resolve: adminOnly.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => resolveOperationalAlert(input.id)),
  }),
  ingestionSources: router({
    list: adminOnly.query(() => listIngestionSources()),
    update: adminOnly.input(z.object({ id: z.number().int().positive(), isEnabled: z.boolean(), priority: z.number().int().min(1).max(1000), frequencyMinutes: z.number().int().min(60).max(525600) })).mutation(({ input }) => updateIngestionSource(input.id, input)),
  }),
  events: router({
    list: publicProcedure.input(z.object({ day: safeFilter(20), date: safeFilter(20), startDate: safeFilter(30), endDate: safeFilter(30), timeFrom: safeFilter(10), timeTo: safeFilter(10), city: z.enum(["Santos", "Guarujá"]).optional(), category: z.enum(["show", "balada", "evento_musical"]).optional(), genre: z.enum(["funk", "house_eletronica", "samba_pagode", "rap_trap"]).optional(), venue: safeFilter(180), neighborhood: safeFilter(120), minPriceCents: z.number().int().min(0).max(10_000_000).optional(), maxPriceCents: z.number().int().min(0).max(10_000_000).optional(), page: z.number().int().min(1).max(10000).optional(), size: z.number().int().min(1).max(100).optional() }).optional()).query(({ input }) => listEvents(input ?? {})),
    today: publicProcedure.input(z.object({ size: z.number().int().min(1).max(20).optional() }).optional()).query(({ input }) => listTodayEvents(input ?? {})),
    bySlug: publicProcedure.input(z.object({ slug: z.string().trim().min(3).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) })).query(({ input }) => getEventBySlug(input.slug)),
    favoriteIds: protectedProcedure.query(({ ctx }) => listFavoriteEventIds(ctx.user.id)),
    toggleFavorite: protectedProcedure.input(z.object({ eventId: z.number().int().positive() })).mutation(({ ctx, input }) => toggleFavoriteEvent(ctx.user.id, input.eventId)),
    reminders: protectedProcedure.query(({ ctx }) => listUserReminders(ctx.user.id)),
    setReminder: protectedProcedure.input(z.object({ eventId: z.number().int().positive(), active: z.boolean(), hoursBefore: z.union([z.literal(3), z.literal(24), z.literal(72)]).optional() })).mutation(({ ctx, input }) => setEventReminder(ctx.user.id, input.eventId, input.active, input.hoursBefore ?? 24)),
    create: adminOnly.input(eventInput).mutation(({ input }) => saveEvent(input)),
    update: adminOnly.input(z.object({ id: z.number().int().positive(), data: eventInput.partial() })).mutation(async ({ input }) => {
      try {
        const result = await updateEvent(input.id, input.data);
        return { ok: true as const, ...result };
      } catch (error) {
        const message = error instanceof Error && /data|ID|cidade|Database|evento/i.test(error.message) ? error.message.slice(0, 180) : "Não foi possível salvar as alterações do evento";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),
    remove: adminOnly.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      try {
        return await deleteEvent(input.id);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível excluir o evento" });
      }
    }),
    enrich: adminOnly.input(z.object({ rawText: z.string().trim().min(20).max(12000) })).mutation(async ({ input }) => {
      const response = await invokeLLM({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você normaliza eventos musicais de Santos e Guarujá. Ignore qualquer evento fora dessas duas cidades. Aceite somente shows, baladas e eventos musicais. Sugira um gênero entre Funk, House/Eletrônica, Samba/Pagode e Rap/Trap. Responda apenas JSON válido com resumo atrativo, categoria, gênero, data ISO, horário, local, cidade e preço em centavos." },
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
                category: { type: "string", enum: ["show", "balada", "evento_musical"] },
                genre: { type: "string", enum: ["funk", "house_eletronica", "samba_pagode", "rap_trap"] },
                priceCents: { type: "integer" },
              },
              required: ["title", "summary", "eventDate", "locationName", "address", "city", "category", "priceCents"],
              additionalProperties: false,
            },
          },
        },
      });
      return JSON.parse(String(response.choices?.[0]?.message?.content ?? "{}"));
    }),
  }),
});

export type AppRouter = typeof appRouter;
