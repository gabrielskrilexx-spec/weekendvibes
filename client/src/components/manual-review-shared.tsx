import React from "react";

export type ManualReviewStatus = "pending" | "approved" | "rejected";
export type ManualReviewCategory = "show" | "balada" | "evento_musical";

export type ManualReviewEvent = {
  id: number;
  sourceUrl: string | null;
  sourceType: string | null;
  title: string;
  summary: string | null;
  eventDate: string | null;
  endDate: string | null;
  locationName: string | null;
  address: string | null;
  city: string | null;
  category: ManualReviewCategory | null;
  genre: string | null;
  priceCents: number | null;
  imageUrl: string | null;
  rawText: string | null;
  reason: string;
  status: ManualReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  publishedEventId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ManualReviewDraft = {
  title: string;
  eventDate: string;
  endDate: string;
  locationName: string;
  address: string;
  city: "" | "Santos" | "Guarujá";
  category: "" | ManualReviewCategory;
  genre: string;
  summary: string;
  priceCents: string;
  sourceUrl: string;
  sourceType: string;
  imageUrl: string;
  rawText: string;
  reason: string;
};

export type RawTextTokenKind = "time" | "date";
export type RawTextToken = { value: string; kind: RawTextTokenKind };
export type RawTextSegment = { text: string; token?: RawTextToken };

const RAW_TEXT_HIGHLIGHT_PATTERN = /(^|[^A-Za-zÀ-ÿ0-9])((?:[01]?\d|2[0-3])(?:[:hH][0-5]\d|h)|(?:segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?|(?:amanhã|amanha|hoje)|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)(?![A-Za-zÀ-ÿ0-9])/gi;

function tokenKind(value: string): RawTextTokenKind {
  return /^(?:[01]?\d|2[0-3])(?:[:hH][0-5]\d|h)$/i.test(value) ? "time" : "date";
}

/** Regex work happens here once per raw text value; renderers consume the resulting segments. */
export function getRawTextHighlightSegments(text: string): RawTextSegment[] {
  const segments: RawTextSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  RAW_TEXT_HIGHLIGHT_PATTERN.lastIndex = 0;
  while ((match = RAW_TEXT_HIGHLIGHT_PATTERN.exec(text)) !== null) {
    const prefixLength = match[0].length - match[2].length;
    if (match.index + prefixLength > cursor) segments.push({ text: text.slice(cursor, match.index + prefixLength) });
    segments.push({ text: match[2], token: { value: match[2], kind: tokenKind(match[2]) } });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length || segments.length === 0) segments.push({ text: text.slice(cursor) });
  return segments;
}

export type RawTextHighlightOptions = {
  onTokenClick?: (token: RawTextToken) => void;
  onApplyToken?: (token: RawTextToken) => void;
  copiedToken?: string | null;
  appliedToken?: string | null;
};

export function renderRawTextSegments(segments: RawTextSegment[], options: RawTextHighlightOptions = {}): React.ReactNode[] {
  return segments.map((segment, index) => {
    if (!segment.token) return <React.Fragment key={`text-${index}`}>{segment.text}</React.Fragment>;
    if (!options.onTokenClick) return <mark key={`highlight-${index}`} className="rounded bg-amber-300/25 px-1 font-bold text-amber-100 ring-1 ring-inset ring-amber-200/20">{segment.text}</mark>;
    return <span key={`interactive-highlight-${index}`} className="mx-0.5 inline-flex items-center align-baseline rounded bg-amber-300/25 font-bold text-amber-100 ring-1 ring-inset ring-amber-200/20">
      <button type="button" onClick={() => options.onTokenClick?.(segment.token!)} aria-label={`Copiar ${segment.text}`} title="Copiar este valor" className="rounded-l px-1 font-bold underline decoration-dotted underline-offset-2 hover:bg-amber-200/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">{segment.text}</button>
      {options.onApplyToken && <button type="button" onClick={() => options.onApplyToken?.(segment.token!)} aria-label={`Aplicar ${segment.text} ao formulário`} title="Aplicar ao formulário" className="rounded-r border-l border-amber-200/20 px-1.5 text-xs font-black hover:bg-amber-200/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">+</button>}
      {options.copiedToken === segment.text && <span role="status" className="sr-only">Copiado!</span>}
      {options.appliedToken === segment.text && <span role="status" className="sr-only">Aplicado!</span>}
    </span>;
  });
}

export function highlightRawText(text: string, options: RawTextHighlightOptions = {}): React.ReactNode[] {
  return renderRawTextSegments(getRawTextHighlightSegments(text), options);
}

export function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date).reduce<Record<string, string>>((result, part) => { if (part.type !== "literal") result[part.type] = part.value; return result; }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function localDateTimeToIso(value: string) {
  if (!value) return null;
  const date = new Date(`${value}:00-03:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function applyRawTokenToDateTime(currentValue: string, token: RawTextToken, fallbackDate?: string): string | null {
  const datePart = currentValue.slice(0, 10) || fallbackDate || new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (token.kind === "time") {
    const timeMatch = token.value.match(/^(\d{1,2})(?::|h)(\d{2})?$/i);
    if (!timeMatch || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] ?? 0);
    if (!Number.isInteger(hours) || hours > 23 || minutes > 59) return null;
    return `${datePart}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const dateMatch = token.value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!dateMatch) return null;
  const currentYear = datePart.slice(0, 4);
  const year = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : currentYear;
  if (!/^\d{4}$/.test(year)) return null;
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[1]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}${currentValue.slice(10) || "T00:00"}`;
}

export function draftFromEvent(event: ManualReviewEvent): ManualReviewDraft {
  return { title: event.title, eventDate: toDateTimeLocal(event.eventDate), endDate: toDateTimeLocal(event.endDate), locationName: event.locationName ?? "", address: event.address ?? "", city: event.city === "Santos" || event.city === "Guarujá" ? event.city : "", category: event.category ?? "", genre: event.genre ?? "", summary: event.summary ?? "", priceCents: event.priceCents == null ? "" : String(event.priceCents), sourceUrl: event.sourceUrl ?? "", sourceType: event.sourceType ?? "", imageUrl: event.imageUrl ?? "", rawText: event.rawText ?? "", reason: event.reason };
}

export function formatDate(value: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date) : "Data inválida";
}
export function sourceLabel(sourceType: string | null) { return !sourceType ? "Origem não informada" : sourceType === "instagram" ? "Instagram" : sourceType === "public" ? "Agenda pública" : sourceType; }
export function statusLabel(status: ManualReviewStatus) { return status === "pending" ? "Aguardando revisão" : status === "approved" ? "Publicado" : "Rejeitado"; }
export function statusClass(status: ManualReviewStatus) { return status === "pending" ? "bg-amber-300/15 text-amber-100" : status === "approved" ? "bg-emerald-300/15 text-emerald-100" : "bg-red-300/15 text-red-100"; }
