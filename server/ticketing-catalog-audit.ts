import { sanitizePublicSourceUrl } from "./ingestion";

export type TicketingPlatform = "articket" | "blackpass" | "blacktag" | "ingresse" | "mringressos" | "sympla" | "ticket360" | "weticket" | "zig" | "other";

export type TicketingAuditVenueAlias = {
  alias: string;
  canonicalName: string;
  city: string;
  isActive: number;
};

export type TicketingAuditSource = {
  sourceKey: string;
  name: string;
  kind: string;
  handle?: string | null;
  url: string;
  isEnabled: number;
  lastStatus?: string | null;
  lastHttpStatus?: number | null;
  lastSuccessAt?: Date | string | null;
};

export type TicketingAuditEvent = {
  locationName: string;
  city: string;
  sourceUrl: string | null;
};

const PLATFORM_LABELS: Record<TicketingPlatform, string> = {
  articket: "ArTicket",
  blackpass: "Black Pass",
  blacktag: "Blacktag",
  ingresse: "Ingresse",
  mringressos: "Mr Ingressos",
  sympla: "Sympla",
  ticket360: "Ticket360",
  weticket: "WeTicket",
  zig: "Zig Tickets",
  other: "Outra fonte pública",
};

const VENUE_STOP_WORDS = new Set([
  "a", "as", "o", "os", "e", "de", "da", "das", "do", "dos", "em",
  "bar", "club", "house", "hotel", "resort", "beach", "center", "convention",
  "restaurante", "restaurant", "guaruja", "santos",
]);

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenStem(value: string) {
  return value.length > 5 && value.endsWith("s") ? value.slice(0, -1) : value;
}

function safeUrlPath(input: string) {
  try {
    const url = new URL(sanitizePublicSourceUrl(input));
    return `${url.hostname.toLowerCase()} ${url.pathname}`;
  } catch {
    return input;
  }
}

export function getTicketingPlatform(input: string): TicketingPlatform {
  try {
    const host = new URL(input).hostname.toLowerCase().replace(/^www\./, "");
    if (host.includes("articket")) return "articket";
    if (host.includes("blackpass")) return "blackpass";
    if (host.includes("blacktag")) return "blacktag";
    if (host.includes("ingresse")) return "ingresse";
    if (host.includes("mringressos")) return "mringressos";
    if (host.includes("sympla")) return "sympla";
    if (host.includes("ticket360")) return "ticket360";
    if (host.includes("weticket")) return "weticket";
    if (host.endsWith("zig.tickets")) return "zig";
  } catch {
    return "other";
  }
  return "other";
}

export function ticketingPlatformLabel(platform: TicketingPlatform) {
  return PLATFORM_LABELS[platform];
}

export function normalizeTicketingUrlForComparison(input: string) {
  try {
    const url = new URL(sanitizePublicSourceUrl(input));
    url.search = "";
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return input.trim();
  }
}

export function safeTicketingUrl(input: string) {
  try {
    const url = new URL(sanitizePublicSourceUrl(input));
    url.search = "";
    url.hash = "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

export function isExplicitTicketingEventUrl(input: string) {
  try {
    const url = new URL(input);
    const path = url.pathname.toLowerCase();
    const platform = getTicketingPlatform(input);
    if (platform === "articket") return /^\/e\/\d+(?:\/[^/]+)?\/?$/.test(path);
    if (platform === "blackpass") return /^\/event\/[a-z0-9_-]+(?:\/|$)/.test(path);
    if (platform === "blacktag") return /^\/(?:eventos?|events?)\/[a-z0-9._~-]+(?:\/|$)/.test(path);
    if (platform === "ingresse") {
      const firstSegment = path.split("/").filter(Boolean)[0] ?? "";
      return Boolean(firstSegment) && !["search", "eventos", "events", "tags", "organizador", "o"].includes(firstSegment);
    }
    if (platform === "mringressos") return /^\/comprar\/[a-z0-9_-]+(?:\/|$)/.test(path);
    if (platform === "sympla") return /^\/evento\/[^/]+\/\d+(?:\/|$)/.test(path);
    if (platform === "ticket360") return /^\/evento\/\d+(?:\/|$)/.test(path);
    if (platform === "weticket") {
      const segments = path.split("/").filter(Boolean);
      return segments.length === 1 && !["perguntas-frequentes", "politica-de-privacidade", "termos-de-uso"].includes(segments[0]);
    }
    if (platform === "zig") return /^\/eventos?\/[a-z0-9._~-]+(?:\/|$)/.test(path);
  } catch {
    return false;
  }
  return false;
}

function venueAliasesMatchText(aliases: string[], text: string) {
  const normalizedText = normalizeText(text);
  const textTokens = new Set(normalizedText.split(" ").filter(Boolean).map(tokenStem));
  return aliases.some(alias => {
    const phrase = normalizeText(alias);
    if (!phrase) return false;
    if (phrase.length >= 4 && ` ${normalizedText} `.includes(` ${phrase} `)) return true;
    const tokens = phrase.split(" ").filter(token => token.length >= 3 && !VENUE_STOP_WORDS.has(token)).map(tokenStem);
    if (tokens.length === 0) return false;
    const overlap = tokens.filter(token => textTokens.has(token));
    if (tokens.length === 1) return overlap.length === 1;
    return overlap.length >= 2 || overlap.some(token => token.length >= 6);
  });
}

function eventMatchesVenue(event: TicketingAuditEvent, venue: { city: string; aliases: string[] }) {
  if (normalizeText(event.city) !== normalizeText(venue.city)) return false;
  return venueAliasesMatchText(venue.aliases, event.locationName);
}

function sourceMatchesVenue(source: TicketingAuditSource, venue: { aliases: string[] }) {
  return venueAliasesMatchText(venue.aliases, `${source.name} ${source.sourceKey} ${safeUrlPath(source.url)}`);
}

function groupVenues(rows: TicketingAuditVenueAlias[]) {
  const grouped = new Map<string, { canonicalName: string; city: string; aliases: Set<string> }>();
  for (const row of rows.filter(item => item.isActive === 1)) {
    const key = `${normalizeText(row.city)}|${normalizeText(row.canonicalName)}`;
    const venue = grouped.get(key) ?? { canonicalName: row.canonicalName, city: row.city, aliases: new Set<string>() };
    venue.aliases.add(row.alias);
    venue.aliases.add(row.canonicalName);
    grouped.set(key, venue);
  }
  return Array.from(grouped.values()).map(venue => ({ ...venue, aliases: Array.from(venue.aliases) }));
}

export function buildTicketingCatalogAudit(input: {
  venueAliases: TicketingAuditVenueAlias[];
  sources: TicketingAuditSource[];
  events: TicketingAuditEvent[];
}) {
  const activeSources = input.sources.filter(source => source.isEnabled === 1);
  const publicSources = activeSources.filter(source => source.kind === "public");
  const instagramPartners = activeSources.filter(source => source.kind === "instagram");
  const ticketingEventSources = publicSources.filter(source => isExplicitTicketingEventUrl(source.url));
  const activeSourceUrls = new Set(publicSources.map(source => normalizeTicketingUrlForComparison(source.url)));

  const venues = groupVenues(input.venueAliases).map(venue => {
    const relevantEvents = input.events.filter(event => event.sourceUrl && eventMatchesVenue(event, venue));
    const eventUrls = new Set(
      relevantEvents
        .map(event => event.sourceUrl!)
        .filter(isExplicitTicketingEventUrl)
        .map(normalizeTicketingUrlForComparison),
    );
    const registeredSources = ticketingEventSources.filter(source => eventUrls.has(normalizeTicketingUrlForComparison(source.url)) || sourceMatchesVenue(source, venue));
    const publishedTicketingUrls = Array.from(new Set(
      relevantEvents
        .map(event => event.sourceUrl!)
        .filter(isExplicitTicketingEventUrl)
        .map(safeTicketingUrl)
        .filter(Boolean),
    ));
    const registeredUrlKeys = new Set(registeredSources.map(source => normalizeTicketingUrlForComparison(source.url)));
    const unregisteredPublishedUrls = publishedTicketingUrls.filter(url => !registeredUrlKeys.has(normalizeTicketingUrlForComparison(url)));
    const status = registeredSources.length > 0
      ? "explicit_source_candidate"
      : unregisteredPublishedUrls.length > 0
        ? "published_ticket_url_not_registered"
        : "needs_official_link_validation";

    return {
      canonicalName: venue.canonicalName,
      city: venue.city,
      aliases: venue.aliases,
      status,
      registeredTicketingSources: registeredSources.map(source => ({
        sourceKey: source.sourceKey,
        name: source.name,
        platform: ticketingPlatformLabel(getTicketingPlatform(source.url)),
        url: safeTicketingUrl(source.url),
        lastStatus: source.lastStatus ?? "never",
        lastHttpStatus: source.lastHttpStatus ?? null,
      })),
      publishedTicketingUrls,
      unregisteredPublishedUrls,
    };
  }).sort((left, right) => left.city.localeCompare(right.city, "pt-BR") || left.canonicalName.localeCompare(right.canonicalName, "pt-BR"));

  const platformCounts = new Map<TicketingPlatform, { platform: string; sources: number; explicitEventUrls: number; catalogOrOtherUrls: number }>();
  for (const source of publicSources) {
    const key = getTicketingPlatform(source.url);
    const item = platformCounts.get(key) ?? { platform: ticketingPlatformLabel(key), sources: 0, explicitEventUrls: 0, catalogOrOtherUrls: 0 };
    item.sources += 1;
    if (isExplicitTicketingEventUrl(source.url)) item.explicitEventUrls += 1;
    else item.catalogOrOtherUrls += 1;
    platformCounts.set(key, item);
  }

  const publicSourceRows = publicSources.map(source => ({
    sourceKey: source.sourceKey,
    name: source.name,
    platform: ticketingPlatformLabel(getTicketingPlatform(source.url)),
    urlClass: isExplicitTicketingEventUrl(source.url) ? "event_url" : "catalog_or_other_url",
    url: safeTicketingUrl(source.url),
    lastStatus: source.lastStatus ?? "never",
    lastHttpStatus: source.lastHttpStatus ?? null,
    lastSuccessAt: source.lastSuccessAt ?? null,
  }));
  const instagramRows = instagramPartners.map(source => ({
    sourceKey: source.sourceKey,
    name: source.name,
    handle: source.handle ?? null,
    url: safeTicketingUrl(source.url),
  }));

  return {
    catalogBasis: "locationAliases: não existe tabela venues nem relação formal entre venue e fonte de ingestão; a correspondência por nome é apenas candidata.",
    summary: {
      venueCandidates: venues.length,
      venuesWithExplicitTicketingSourceCandidate: venues.filter(venue => venue.status === "explicit_source_candidate").length,
      venuesWithUnregisteredPublishedTicketUrl: venues.filter(venue => venue.status === "published_ticket_url_not_registered").length,
      venuesNeedingOfficialLinkValidation: venues.filter(venue => venue.status === "needs_official_link_validation").length,
      activeInstagramPartners: instagramRows.length,
      activePublicSources: publicSourceRows.length,
      publicSourcesWithExplicitEventUrl: ticketingEventSources.length,
    },
    activeTicketingPlatforms: Array.from(platformCounts.values()).sort((left, right) => left.platform.localeCompare(right.platform, "pt-BR")),
    venues,
    activeInstagramPartners: instagramRows,
    activePublicSources: publicSourceRows,
  };
}
