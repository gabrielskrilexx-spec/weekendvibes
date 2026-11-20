import type { Event } from "../drizzle/schema";
import { resolveVenueCoverFallback } from "../shared/event-media";
import { sanitizeEventText } from "../shared/event-text";

export const DEFAULT_PUBLIC_ORIGIN = "https://weekendvibes-dh6w.vercel.app";

export type SeoEvent = Pick<Event, "id" | "slug" | "title" | "description" | "eventDate" | "endDate" | "locationName" | "address" | "city" | "sourceUrl" | "sourceType" | "imageUrl" | "updatedAt"> & {
  ticketUrl?: string | null;
};

export type EventJsonLd = {
  "@context": "https://schema.org";
  "@type": "Event";
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  eventStatus: "https://schema.org/EventScheduled";
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode";
  location: {
    "@type": "Place";
    name: string;
    address: {
      "@type": "PostalAddress";
      streetAddress?: string;
      addressLocality: string;
      addressRegion: "SP";
      addressCountry: "BR";
    };
  };
  image: string[];
  organizer: { "@type": "Organization"; name: "WeekendVibes"; url: string };
  url: string;
  offers?: { "@type": "Offer"; url: string; availability: "https://schema.org/InStock" };
};

export type BreadcrumbJsonLd = {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
};

function asDate(value: Date | string | null | undefined) {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

/** Formats an instant using the fixed Brazilian event offset requested by the public SEO contract. */
export function formatSaoPauloIso(value: Date | string) {
  const date = asDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;
}

export function absolutePublicUrl(value: string | null | undefined, origin = DEFAULT_PUBLIC_ORIGIN) {
  const raw = value?.trim();
  if (!raw) return `${origin}/venues/vallum-garden.webp`;
  try {
    const url = new URL(raw, origin);
    if (url.protocol === "http:") url.protocol = "https:";
    return url.toString();
  } catch {
    return `${origin}/venues/vallum-garden.webp`;
  }
}

function validExternalUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.hostname === "instagram.com" || url.hostname.endsWith(".instagram.com")) return null;
    if (url.protocol === "http:") url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

export function buildEventCanonicalUrl(event: Pick<Event, "slug">, origin = DEFAULT_PUBLIC_ORIGIN, singular = false) {
  return `${origin}${singular ? "/evento/" : "/eventos/"}${encodeURIComponent(event.slug)}`;
}

export function buildEventJsonLd(event: SeoEvent, origin = DEFAULT_PUBLIC_ORIGIN, routeUrl = buildEventCanonicalUrl(event, origin)) : EventJsonLd {
  const startDate = formatSaoPauloIso(event.eventDate);
  const endDate = formatSaoPauloIso(event.endDate ?? new Date(new Date(event.eventDate).getTime() + 4 * 60 * 60 * 1000));
  const fallbackImage = resolveVenueCoverFallback({ title: event.title, locationName: event.locationName, sourceUrl: event.sourceUrl, sourceType: event.sourceType });
  const image = absolutePublicUrl(event.imageUrl || fallbackImage, origin);
  const description = sanitizeEventText(event.description) || `Evento em ${event.locationName}, ${event.city}.`;
  const locationAddress = {
    "@type": "PostalAddress" as const,
    ...(event.address ? { streetAddress: sanitizeEventText(event.address) } : {}),
    addressLocality: event.city,
    addressRegion: "SP" as const,
    addressCountry: "BR" as const,
  };
  const ticketUrl = validExternalUrl(event.ticketUrl) ?? validExternalUrl(event.sourceUrl);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: sanitizeEventText(event.title),
    description,
    startDate,
    endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: sanitizeEventText(event.locationName), address: locationAddress },
    image: [image],
    organizer: { "@type": "Organization", name: "WeekendVibes", url: origin },
    url: routeUrl,
    ...(ticketUrl ? { offers: { "@type": "Offer" as const, url: ticketUrl, availability: "https://schema.org/InStock" as const } } : {}),
  };
}

export function buildBreadcrumbJsonLd(event: Pick<Event, "slug" | "title" | "city">, origin = DEFAULT_PUBLIC_ORIGIN, routeUrl = buildEventCanonicalUrl(event, origin)) : BreadcrumbJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "WeekendVibes", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: "Agenda", item: `${origin}/agenda` },
      { "@type": "ListItem", position: 3, name: event.city, item: `${origin}/agenda?city=${encodeURIComponent(event.city)}` },
      { "@type": "ListItem", position: 4, name: sanitizeEventText(event.title), item: routeUrl },
    ],
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function buildSitemapXml(events: Array<Pick<Event, "id" | "slug" | "eventDate" | "updatedAt">>, origin = DEFAULT_PUBLIC_ORIGIN, now = new Date()) {
  const urls = [
    `<url><loc>${origin}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...events
      .filter(event => Boolean(event.slug) && new Date(event.eventDate).getTime() >= now.getTime())
      .map(event => `<url><loc>${origin}/evento/${encodeURIComponent(event.id)}</loc><lastmod>${new Date(event.updatedAt).toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}\n</urlset>`;
}
