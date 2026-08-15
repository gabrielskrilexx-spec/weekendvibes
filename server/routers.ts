import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { deleteEvent, getEventBySlug, listEvents, listRecentInstagramAgendaEvents, listTodayEvents, resolveOperationalAlert, saveEvent, updateEvent, listFavoriteEventIds, toggleFavoriteEvent, setEventReminder, listUserReminders } from "./db";
import { invokeLLM } from "./_core/llm";
import { getTuesdayRoutineStatus, runTuesdayRoutineNow } from "./manual-ingestion";
import { listIngestionReport, reprocessIngestionSource } from "./ingestion-reports";
import { createLocationAlias, deleteLocationAlias, listLocationAliases, updateLocationAlias } from "./db";
import { listGeocodingSummary, processPendingGeocoding } from "./geocoding";

const eventInput = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().min(3).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(5000).optional(),
  eventDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  locationName: z.string().trim().min(2).max(180),
  address: z.string().trim().max(300).optional(),
  city: z.enum(["Santos", "Guarujá"]),
  category: z.enum(["show", "balada", "evento_musical"]),
  genre: z.enum(["funk", "house_eletronica", "samba_pagode", "rap_trap"]).optional(),
  priceCents: z.number().int().min(0).default(0),
  sourceUrl: z.string().url().refine(value => value === "" || /^https:\/\//i.test(value), "A fonte deve usar HTTPS").optional().or(z.literal("")),
  imageUrl: z.string().url().refine(value => value === "" || /^https:\/\//i.test(value), "A imagem deve usar HTTPS").optional().or(z.literal("")),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  sourceHash: z.string().optional(),
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
    status: adminOnly.query(() => getTuesdayRoutineStatus()),
    runNow: adminOnly.mutation(async () => runTuesdayRoutineNow()),
  }),
  locationAliases: router({
    list: adminOnly.query(() => listLocationAliases()),
    create: adminOnly.input(z.object({ alias: z.string().trim().min(2).max(180), canonicalName: z.string().trim().min(2).max(180), city: z.enum(["Santos", "Guarujá"]) })).mutation(({ input }) => createLocationAlias(input)),
    update: adminOnly.input(z.object({ id: z.number().int().positive(), alias: z.string().trim().min(2).max(180), canonicalName: z.string().trim().min(2).max(180), city: z.enum(["Santos", "Guarujá"]), isActive: z.boolean() })).mutation(({ input }) => updateLocationAlias(input.id, input)),
    remove: adminOnly.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteLocationAlias(input.id)),
  }),
  ingestionReports: router({
    summary: adminOnly.query(() => listIngestionReport()),
    geocoding: adminOnly.query(() => listGeocodingSummary()),
    reprocess: adminOnly.input(z.object({ sourceKey: z.enum(["public", "instagram"]) })).mutation(({ input }) => reprocessIngestionSource(input.sourceKey)),
    geocodeNow: adminOnly.mutation(() => processPendingGeocoding(10)),
  }),
  operationalAlerts: router({
    resolve: adminOnly.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => resolveOperationalAlert(input.id)),
  }),
  events: router({
    list: publicProcedure.input(z.object({ day: z.string().optional(), date: z.string().optional(), startDate: z.string().optional(), endDate: z.string().optional(), timeFrom: z.string().optional(), timeTo: z.string().optional(), city: z.string().optional(), category: z.string().optional(), genre: z.string().optional(), venue: z.string().optional(), minPriceCents: z.number().int().min(0).optional(), maxPriceCents: z.number().int().min(0).optional(), page: z.number().int().min(1).optional(), size: z.number().int().min(1).max(100).optional() }).optional()).query(({ input }) => listEvents(input ?? {})),
    today: publicProcedure.input(z.object({ size: z.number().int().min(1).max(20).optional() }).optional()).query(({ input }) => listTodayEvents(input ?? {})),
    recentInstagramAgenda: publicProcedure.input(z.object({ lookbackDays: z.number().int().min(1).max(14).optional(), size: z.number().int().min(1).max(12).optional() }).optional()).query(({ input }) => listRecentInstagramAgendaEvents(input ?? {})),
    bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(({ input }) => getEventBySlug(input.slug)),
    favoriteIds: protectedProcedure.query(({ ctx }) => listFavoriteEventIds(ctx.user.id)),
    toggleFavorite: protectedProcedure.input(z.object({ eventId: z.number().int().positive() })).mutation(({ ctx, input }) => toggleFavoriteEvent(ctx.user.id, input.eventId)),
    reminders: protectedProcedure.query(({ ctx }) => listUserReminders(ctx.user.id)),
    setReminder: protectedProcedure.input(z.object({ eventId: z.number().int().positive(), active: z.boolean(), hoursBefore: z.union([z.literal(3), z.literal(24), z.literal(72)]).optional() })).mutation(({ ctx, input }) => setEventReminder(ctx.user.id, input.eventId, input.active, input.hoursBefore ?? 24)),
    create: adminOnly.input(eventInput).mutation(({ input }) => saveEvent(input)),
    update: adminOnly.input(z.object({ id: z.number(), data: eventInput.partial() })).mutation(({ input }) => updateEvent(input.id, input.data)),
    remove: adminOnly.input(z.object({ id: z.number() })).mutation(({ input }) => deleteEvent(input.id)),
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
