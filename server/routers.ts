import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { deleteEvent, getEventBySlug, listEvents, saveEvent, updateEvent } from "./db";
import { invokeLLM } from "./_core/llm";

const eventInput = z.object({
  title: z.string().min(3),
  slug: z.string().min(3),
  description: z.string().optional(),
  eventDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  locationName: z.string().min(2),
  address: z.string().optional(),
  city: z.string().min(2),
  category: z.enum(["show", "balada", "evento_musical"]),
  genre: z.enum(["funk", "house_eletronica", "samba_pagode", "rap_trap"]).optional(),
  priceCents: z.number().int().min(0).default(0),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  imageUrl: z.string().url().optional().or(z.literal("")),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  sourceHash: z.string().optional(),
  isPublished: z.number().int().min(0).max(1).default(1),
});

const adminOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new Error("Acesso restrito ao painel administrativo");
  return next();
});

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
  events: router({
    list: publicProcedure.input(z.object({ day: z.string().optional(), city: z.string().optional(), category: z.string().optional(), genre: z.string().optional(), maxPriceCents: z.number().optional(), page: z.number().optional(), size: z.number().optional() }).optional()).query(({ input }) => listEvents(input ?? {})),
    bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(({ input }) => getEventBySlug(input.slug)),
    create: adminOnly.input(eventInput).mutation(({ input }) => saveEvent(input)),
    update: adminOnly.input(z.object({ id: z.number(), data: eventInput.partial() })).mutation(({ input }) => updateEvent(input.id, input.data)),
    remove: adminOnly.input(z.object({ id: z.number() })).mutation(({ input }) => deleteEvent(input.id)),
    enrich: adminOnly.input(z.object({ rawText: z.string().min(20) })).mutation(async ({ input }) => {
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
