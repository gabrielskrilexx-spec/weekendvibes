import fs from "node:fs";
import type { Express, NextFunction, Request, Response } from "express";
import { getEventById, getEventBySlug, listPublicEventsForSitemap, getVenuePageData, listIndexableVenueCatalogForTest } from "./db";
import { buildBreadcrumbJsonLd, buildEventCanonicalUrl, buildEventJsonLd, buildSitemapXml, buildVenueBreadcrumbJsonLd, buildVenueCanonicalUrl, buildVenueItemListJsonLd, buildVenueJsonLd, DEFAULT_PUBLIC_ORIGIN, absolutePublicUrl } from "./seo";
import { escapeHtml, formatSocialEventDate, injectSocialMetadata, renderSocialCardPng, resolvePublicOrigins, type SocialCardInput, type SocialMetadata } from "./social-meta";

const VENUES_TITLE = "Palcos da Baixada — WeekendVibes";
const VENUES_DESCRIPTION = "Explore os espaços e casas de shows de Santos e Guarujá. Descubra seu próximo rolê na Baixada Santista com o WeekendVibes.";
function publicOrigins() {
  const origins = resolvePublicOrigins();
  return { canonical: origins.canonicalOrigin ?? DEFAULT_PUBLIC_ORIGIN, deployment: origins.deploymentOrigin ?? origins.canonicalOrigin ?? DEFAULT_PUBLIC_ORIGIN };
}
function homeMetadata(pathname: string): SocialMetadata {
  const origins = publicOrigins();
  const path = pathname === "/palcos-da-baixada" ? "/palcos-da-baixada" : pathname;
  const title = pathname === "/agenda" ? "Agenda de eventos — WeekendVibes" : VENUES_TITLE;
  const description = pathname === "/agenda" ? "Encontre festas, shows e experiências em Santos e Guarujá neste fim de semana." : VENUES_DESCRIPTION;
  return { title, description, canonicalUrl: `${origins.canonical}${path}`, imageUrl: `${origins.deployment}/og/palcos-da-baixada.png`, type: "website", bodyFallback: { heading: title, paragraphs: [description], href: "/agenda", linkLabel: "Ver a agenda de eventos" } };
}
type EventRoute = "slug" | "id";
function eventMetadata(event: NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>, route: EventRoute = "slug"): { metadata: SocialMetadata; card: SocialCardInput } {
  const origins = publicOrigins();
  const pathname = route === "id" ? `/evento/${event.id}` : `/eventos/${encodeURIComponent(event.slug)}`;
  const canonicalUrl = route === "id" ? `${origins.canonical}${pathname}` : buildEventCanonicalUrl(event, origins.canonical);
  const imageUrl = `${origins.deployment}/og/event/${encodeURIComponent(event.slug)}.png`;
  const date = formatSocialEventDate(event.eventDate);
  const location = [event.locationName, event.city].filter(Boolean).join(", ");
  const description = [event.description?.trim(), location, date].filter(Boolean).join(" · ").slice(0, 180);
  const jsonLd = [buildEventJsonLd(event, origins.canonical, canonicalUrl), buildBreadcrumbJsonLd(event, origins.canonical, canonicalUrl)];
  return { metadata: { title: `${event.title} • ${event.locationName}, ${event.city} | WeekendVibes`, description, canonicalUrl, imageUrl, imageAlt: `Flyer do evento ${event.title} em ${event.locationName}`, type: "event", jsonLd, bodyFallback: { heading: event.title, paragraphs: [event.description?.trim() || "Uma experiência especial na Baixada Santista.", `${location}${date ? ` · ${date}` : ""}`], href: "/agenda", linkLabel: "Explorar mais eventos" } }, card: { title: event.title, description: event.description?.trim() || "Festas, shows e experiências na Baixada Santista.", location, date, kind: "event" } };
}
function venueMetadata(venue: NonNullable<Awaited<ReturnType<typeof getVenuePageData>>>) {
  const origins = publicOrigins();
  const canonicalUrl = buildVenueCanonicalUrl(venue, origins.canonical);
  const count = venue.events.length;
  const description = `${venue.description} Confira ${count} ${count === 1 ? "próximo evento" : "próximos eventos"} e programe sua experiência na Baixada Santista.`.slice(0, 180);
  return { title: `Agenda ${venue.canonicalName} (${venue.city}) • Próximos Eventos | WeekendVibes`, description, canonicalUrl, imageUrl: absolutePublicUrl(venue.imageUrl, origins.deployment), imageAlt: `Logo de ${venue.canonicalName}`, type: "website" as const, jsonLd: [buildVenueJsonLd(venue, venue.events, origins.canonical), buildVenueItemListJsonLd(venue.events, origins.canonical), buildVenueBreadcrumbJsonLd(venue, origins.canonical)], bodyFallback: { heading: venue.canonicalName, paragraphs: [description], href: "/agenda", linkLabel: "Voltar para a agenda" } };
}
function notFoundMetadata(): SocialMetadata {
  return { title: "Evento não encontrado — WeekendVibes", description: "Este evento não está disponível.", noIndex: true, bodyFallback: { heading: "Evento não encontrado", paragraphs: ["Este evento não está disponível no WeekendVibes."], href: "/agenda", linkLabel: "Voltar para a agenda" } };
}
function sendHtml(res: Response, template: string, metadata: SocialMetadata, status = 200) { res.status(status).type("html").send(injectSocialMetadata(template, metadata)); }
function loadTemplate(indexHtmlPath: string) { try { return fs.readFileSync(indexHtmlPath, "utf8"); } catch { return undefined; } }
function sendPng(res: Response, card: SocialCardInput) { const png = renderSocialCardPng(card); res.status(200).type("png").set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800").set("X-Content-Type-Options", "nosniff").send(png); }

export function registerSocialRoutes(app: Express, indexHtmlPath: string) {
  const template = loadTemplate(indexHtmlPath);
  if (!template) return;
  app.get("/sitemap.xml", (_req, res, next) => { void (async () => { const events = await listPublicEventsForSitemap(); res.status(200).type("application/xml").set("Cache-Control", "public, max-age=300, s-maxage=900, stale-while-revalidate=3600").send(buildSitemapXml(events, publicOrigins().canonical, new Date(), (typeof listIndexableVenueCatalogForTest === "function" ? listIndexableVenueCatalogForTest() : []))); })().catch(next); });
  app.get("/robots.txt", (_req, res) => { const origin = publicOrigins().canonical; res.status(200).type("text/plain").set("Cache-Control", "public, max-age=3600, s-maxage=86400").send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`); });
  app.get("/og/palcos-da-baixada.png", (_req, res) => sendPng(res, { title: "Palcos da Baixada", description: "Explore os espaços e casas de shows da região.", location: "Santos · Guarujá", kind: "venues" }));
  app.get("/og/event/:slug.png", (req: Request, res: Response, next: NextFunction) => { void (async () => { const slug = String(req.params.slug ?? "").trim(); if (!slug || slug.length > 160) return res.status(404).end(); const event = await getEventBySlug(slug); if (!event) return res.status(404).end(); return sendPng(res, eventMetadata(event).card); })().catch(next); });
  app.get(["/", "/agenda", "/palcos-da-baixada"], (req, res) => { res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=60"); sendHtml(res, template, homeMetadata(req.path)); });
  app.get("/palcos/:slug", (req: Request, res: Response, next: NextFunction) => { void (async () => { const venue = await getVenuePageData(String(req.params.slug ?? "")); if (!venue) return sendHtml(res, template, { title: "Palco não encontrado — WeekendVibes", description: "Este palco não está disponível.", noIndex: true, bodyFallback: { heading: "Palco não encontrado", paragraphs: ["Não encontramos este palco no catálogo oficial."], href: "/palcos-da-baixada", linkLabel: "Voltar para Palcos da Baixada" } }, 404); res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=60"); return sendHtml(res, template, venueMetadata(venue)); })().catch(next); });
  app.get("/evento/:id", (req: Request, res: Response, next: NextFunction) => { void (async () => { const rawId = String(req.params.id ?? "").trim(); const id = /^\d+$/.test(rawId) ? Number(rawId) : 0; if (!id) return sendHtml(res, template, notFoundMetadata(), 404); const event = await getEventById(id); if (!event) return sendHtml(res, template, notFoundMetadata(), 404); res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=60"); return sendHtml(res, template, eventMetadata(event, "id").metadata); })().catch(next); });
  app.get("/eventos/:slug", (req: Request, res: Response, next: NextFunction) => { void (async () => { const slug = String(req.params.slug ?? "").trim(); if (!slug || slug.length > 160) return sendHtml(res, template, notFoundMetadata(), 404); const event = await getEventBySlug(slug); if (!event) return sendHtml(res, template, notFoundMetadata(), 404); res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=60"); return sendHtml(res, template, eventMetadata(event).metadata); })().catch((error: unknown) => { console.warn("[Social metadata] Could not load event metadata", error instanceof Error ? error.message : "unknown error"); return sendHtml(res, template, { title: "WeekendVibes — Eventos na Baixada", description: VENUES_DESCRIPTION, noIndex: true, bodyFallback: { heading: "Agenda temporariamente indisponível", paragraphs: ["Não foi possível carregar os detalhes deste evento agora."], href: "/agenda", linkLabel: "Voltar para a agenda" } }, 503); }); });
}
export function createSocialMetadataForTest(event: NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>) { return eventMetadata(event).metadata; }
export function socialMetadataEscapingForTest(value: unknown) { return escapeHtml(value); }
export function eventMetadataForTest(event: NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>, route: EventRoute = "slug") { return eventMetadata(event, route).metadata; }
export function buildSitemapForTest(events: Array<Pick<NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>, "id" | "slug" | "eventDate" | "updatedAt">>) { return buildSitemapXml(events, DEFAULT_PUBLIC_ORIGIN); }
export function absoluteImageUrlForTest(value: string | null | undefined) { return absolutePublicUrl(value); }
