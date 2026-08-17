export type CalendarEventInput = {
  title: string;
  start: string | Date;
  end?: string | Date | null;
  description?: string | null;
  location?: string | null;
  url?: string | null;
};

function asDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Data de evento inválida");
  return date;
}

function googleDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

function icsDate(date: Date) {
  return googleDate(date);
}

export function buildGoogleCalendarUrl(input: CalendarEventInput) {
  const start = asDate(input.start);
  const end = input.end ? asDate(input.end) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${googleDate(start)}/${googleDate(end)}`,
    details: [input.description, input.url ? `Link do evento: ${input.url}` : ""].filter(Boolean).join("\n\n"),
    location: input.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsCalendar(input: CalendarEventInput) {
  const start = asDate(input.start);
  const end = input.end ? asDate(input.end) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const description = [input.description, input.url ? `Link do evento: ${input.url}` : ""].filter(Boolean).join("\n\n");
  const uid = `${encodeURIComponent(input.url || input.title)}@weekendvibes`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WeekendVibes//Event Calendar//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escapeIcs(input.title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(input.location ?? "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
