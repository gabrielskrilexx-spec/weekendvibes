import fs from "node:fs";
import type { Express, NextFunction, Request, Response } from "express";
import { getEventBySlug } from "./db";
import { escapeHtml, formatSocialEventDate, injectSocialMetadata, renderSocialCardPng, resolvePublicOrigins, type SocialCardInput, type SocialMetadata } from "./social-meta";

const VENUES_TITLE = "Palcos da Baixada — WeekendVibes";
const VENUES_DESCRIPTION = "Explore os espaços e casas de shows de Santos e Guarujá. Descubra seu próximo rolê na Baixada Santista com o WeekendVibes.";

function homeMetadata(pathname: string): SocialMetadata {
  const origins = resolvePublicOrigins();
  const path = pathname === "/palcos-da-baixada" ? "/palcos-da-baixada" : pathname;
  const title = pathname === "/agenda" ? "Agenda de eventos — WeekendVibes" : VENUES_TITLE;
  const description = pathname === "/agenda" ? "Encontre festas, shows e experiências em Santos e Guarujá neste fim de semana." : VENUES_DESCRIPTION;
  const canonicalUrl = origins.canonicalOrigin ? `${origins.canonicalOrigin}${path}` : undefined;
  const imageUrl = origins.deploymentOrigin ? `${origins.deploymentOrigin}/og/palcos-da-baixada.png` : undefined;
  return { title, description, canonicalUrl, imageUrl, type: "website", bodyFallback: { heading: title, paragraphs: [description], href: "/agenda", linkLabel: "Ver a agenda de eventos" } };
}

function eventMetadata(event: NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>): { metadata: SocialMetadata; card: SocialCardInput } {
  const origins = resolvePublicOrigins();
  const pathname = `/eventos/${encodeURIComponent(event.slug)}`;
  const canonicalUrl = origins.canonicalOrigin ? `${origins.canonicalOrigin}${pathname}` : undefined;
  const imageUrl = origins.deploymentOrigin ? `${origins.deploymentOrigin}/og/event/${encodeURIComponent(event.slug)}.png` : undefined;
  const date = formatSocialEventDate(event.eventDate);
  const location = [event.locationName, event.city].filter(Boolean).join(", ");
  const description = [event.description?.trim(), location, date].filter(Boolean).join(" · ").slice(0, 180);
  return {
    metadata: { title: `${event.title} — WeekendVibes`, description, canonicalUrl, imageUrl, type: "event", bodyFallback: { heading: event.title, paragraphs: [event.description?.trim() || "Uma experiência especial na Baixada Santista.", `${location}${date ? ` · ${date}` : ""}`], href: "/agenda", linkLabel: "Explorar mais eventos" } },
    card: { title: event.title, description: event.description?.trim() || "Festas, shows e experiências na Baixada Santista.", location, date, kind: "event" },
  };
}

function sendHtml(res: Response, template: string, metadata: SocialMetadata, status = 200) {
  res.status(status).type("html").send(injectSocialMetadata(template, metadata));
}

function loadTemplate(indexHtmlPath: string) {
  try {
    return fs.readFileSync(indexHtmlPath, "utf8");
  } catch {
    return undefined;
  }
}

function sendPng(res: Response, card: SocialCardInput) {
  const png = renderSocialCardPng(card);
  res.status(200)
    .type("png")
    .set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800")
    .set("X-Content-Type-Options", "nosniff")
    .send(png);
}

export function registerSocialRoutes(app: Express, indexHtmlPath: string) {
  const template = loadTemplate(indexHtmlPath);
  if (!template) return;

  app.get("/og/palcos-da-baixada.png", (_req, res) => {
    sendPng(res, { title: "Palcos da Baixada", description: "Explore os espaços e casas de shows da região.", location: "Santos · Guarujá", kind: "venues" });
  });

  app.get("/og/event/:slug.png", (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const slug = String(req.params.slug ?? "").trim();
      if (!slug || slug.length > 160) return res.status(404).end();
      const event = await getEventBySlug(slug);
      if (!event) return res.status(404).end();
      const { card } = eventMetadata(event);
      return sendPng(res, card);
    })().catch(next);
  });

  app.get(["/", "/agenda", "/palcos-da-baixada"], (req, res) => {
    const metadata = homeMetadata(req.path);
    res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=60");
    sendHtml(res, template, metadata);
  });

  app.get("/eventos/:slug", (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const slug = String(req.params.slug ?? "").trim();
      if (!slug || slug.length > 160) return sendHtml(res, template, { title: "Evento não encontrado — WeekendVibes", description: "Este evento não está disponível.", noIndex: true, bodyFallback: { heading: "Evento não encontrado", paragraphs: ["Este evento não está disponível no WeekendVibes."], href: "/agenda", linkLabel: "Voltar para a agenda" } }, 404);
      const event = await getEventBySlug(slug);
      if (!event) return sendHtml(res, template, { title: "Evento não encontrado — WeekendVibes", description: "Este evento não está disponível.", noIndex: true, bodyFallback: { heading: "Evento não encontrado", paragraphs: ["Este evento não está disponível no WeekendVibes."], href: "/agenda", linkLabel: "Voltar para a agenda" } }, 404);
      const { metadata } = eventMetadata(event);
      res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=60");
      return sendHtml(res, template, metadata);
    })().catch((error: unknown) => {
      console.warn("[Social metadata] Could not load event metadata", error instanceof Error ? error.message : "unknown error");
      return sendHtml(res, template, { title: "WeekendVibes — Eventos na Baixada", description: VENUES_DESCRIPTION, noIndex: true, bodyFallback: { heading: "Agenda temporariamente indisponível", paragraphs: ["Não foi possível carregar os detalhes deste evento agora."], href: "/agenda", linkLabel: "Voltar para a agenda" } }, 503);
    });
  });
}

export function createSocialMetadataForTest(event: NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>) {
  return eventMetadata(event).metadata;
}

export function socialMetadataEscapingForTest(value: unknown) {
  return escapeHtml(value);
}
