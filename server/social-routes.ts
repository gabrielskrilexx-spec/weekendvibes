import fs from "node:fs";
import type { Express, NextFunction, Request, Response } from "express";
import { getEventById, getEventBySlug } from "./db";
import { escapeHtml, formatSocialEventDate, formatSocialEventShareDescription, injectSocialMetadata, renderSocialCardPng, resolvePublicOrigins, type SocialCardInput, type SocialMetadata } from "./social-meta";

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

const DEFAULT_PUBLIC_ORIGIN = "https://weekendvibes-dh6w.vercel.app";
const VENUE_SOCIAL_IMAGES: Array<{ terms: string[]; path: string }> = [
  { terms: ["curvão", "curvao", "surf house"], path: "/images/venues/curvao.jpg" },
  { terms: ["lucky scope", "nosso after", "walter belian"], path: "/images/venues/lucky-scope.jpg" },
  { terms: ["praiô", "praio"], path: "/images/venues/praio.jpg" },
  { terms: ["praia verde"], path: "/images/venues/praia-verde-beach-club.jpg" },
  { terms: ["dolores"], path: "/images/venues/dolores.jpg" },
  { terms: ["yellow house"], path: "/images/venues/yellow-house.jpg" },
  { terms: ["meu lugar"], path: "/images/venues/meu-lugar.jpg" },
  { terms: ["moby dick", "moby house", "moby"], path: "/images/venues/moby-dick.jpg" },
];

function publicOrigin() {
  return resolvePublicOrigins().canonicalOrigin ?? DEFAULT_PUBLIC_ORIGIN;
}

function toAbsoluteImageUrl(value: string | null | undefined, origin: string) {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^https:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${origin}${raw}`;
  return undefined;
}

function resolveEventSocialImage(event: NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>, origin: string) {
  const persisted = toAbsoluteImageUrl(event.imageUrl, origin);
  if (persisted) return { url: persisted, type: /^https:\/\/.*\.(?:png|webp)(?:[?#]|$)/i.test(persisted) ? "image/png" : "image/jpeg" };
  const searchable = `${event.title} ${event.locationName} ${event.address ?? ""}`.toLocaleLowerCase("pt-BR");
  const match = VENUE_SOCIAL_IMAGES.find(item => item.terms.some(term => searchable.includes(term)));
  return { url: `${origin}${match?.path ?? "/og/palcos-da-baixada.png"}`, type: match ? "image/jpeg" : "image/png" };
}

function eventMetadata(event: NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>): { metadata: SocialMetadata; card: SocialCardInput } {
  const origins = resolvePublicOrigins();
  const origin = origins.canonicalOrigin ?? DEFAULT_PUBLIC_ORIGIN;
  const pathname = `/evento/${event.id}`;
  const canonicalUrl = `${origin}${pathname}`;
  const socialImage = resolveEventSocialImage(event, origin);
  const date = formatSocialEventDate(event.eventDate);
  const location = [event.locationName, event.city].filter(Boolean).join(", ");
  const description = formatSocialEventShareDescription(event.eventDate, event.locationName, event.city);
  const title = `${event.title} • ${event.locationName}`;
  return {
    metadata: { title, description, canonicalUrl, imageUrl: socialImage.url, imageType: socialImage.type, type: "website", bodyFallback: { heading: event.title, paragraphs: [event.description?.trim() || "Uma experiência especial na Baixada Santista.", `${location}${date ? ` · ${date}` : ""}`], href: "/agenda", linkLabel: "Explorar mais eventos" } },
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

  app.get("/evento/:id", (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const id = Number.parseInt(String(req.params.id ?? ""), 10);
      const event = Number.isSafeInteger(id) && id > 0 ? await getEventById(id) : undefined;
      if (!event) return sendHtml(res, template, homeMetadata("/"));
      const { metadata } = eventMetadata(event);
      res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=60");
      return sendHtml(res, template, metadata);
    })().catch((error: unknown) => {
      console.warn("[Social metadata] Could not load canonical event metadata", error instanceof Error ? error.message : "unknown error");
      return sendHtml(res, template, homeMetadata("/"));
    });
  });
}

export function createSocialMetadataForTest(event: NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>) {
  return eventMetadata(event).metadata;
}

export function socialMetadataEscapingForTest(value: unknown) {
  return escapeHtml(value);
}
