import type { Event } from "../../../drizzle/schema";

export type EventActionKind = "ticket" | "instagram" | "none";

export type EventActionCta = {
  kind: EventActionKind;
  url: string | null;
  label: "Garantir ingresso" | "Ver no Instagram" | null;
};

type EventActionInput = { sourceUrl?: string | null; sourceType?: string | null; ticketUrl?: string | null };

function parseValidUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function isInstagramUrl(url: URL) {
  return url.hostname === "instagram.com" || url.hostname.endsWith(".instagram.com");
}

export function resolveEventActionCta(event: EventActionInput): EventActionCta {
  const candidates = [event.ticketUrl, event.sourceUrl]
    .map(parseValidUrl)
    .filter((url): url is URL => Boolean(url));
  const externalUrl = candidates.find(url => !isInstagramUrl(url));
  if (externalUrl) return { kind: "ticket", url: externalUrl.toString(), label: "Garantir ingresso" };
  const instagramUrl = candidates.find(isInstagramUrl);
  if (instagramUrl) return { kind: "instagram", url: instagramUrl.toString(), label: "Ver no Instagram" };
  return { kind: "none", url: null, label: null };
}

export function isInstagramEvent(event: { sourceType?: string | null; sourceUrl?: string | null; ticketUrl?: string | null }) {
  return event.sourceType?.toLowerCase().startsWith("instagram") === true
    || resolveEventActionCta(event).kind === "instagram";
}
