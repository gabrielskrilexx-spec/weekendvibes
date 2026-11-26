export type RelatedEventCandidate = {
  id: number;
  eventDate: Date | string;
  locationName: string;
  city: string;
};

function saoPauloParts(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return {
    weekday: parts.weekday,
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

function weekendKey(value: Date | string) {
  const parts = saoPauloParts(value);
  if (!["Fri", "Sat", "Sun"].includes(parts.weekday)) return `${parts.year}-${parts.month}-${parts.day}`;
  const date = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00-03:00`);
  const daysFromFriday = parts.weekday === "Fri" ? 0 : parts.weekday === "Sat" ? 1 : 2;
  date.setDate(date.getDate() - daysFromFriday);
  return date.toISOString().slice(0, 10);
}

export function selectRelatedEvents<T extends RelatedEventCandidate>(current: RelatedEventCandidate, candidates: T[], limit = 4) {
  const currentVenue = current.locationName.trim().toLocaleLowerCase("pt-BR");
  const currentCity = current.city.trim().toLocaleLowerCase("pt-BR");
  const currentWeekend = weekendKey(current.eventDate);
  return candidates
    .filter(candidate => candidate.id !== current.id)
    .map((candidate, index) => {
      const sameVenue = candidate.locationName.trim().toLocaleLowerCase("pt-BR") === currentVenue;
      const sameCity = candidate.city.trim().toLocaleLowerCase("pt-BR") === currentCity;
      const sameWeekend = weekendKey(candidate.eventDate) === currentWeekend;
      const score = (sameVenue ? 100 : 0) + (sameCity ? 40 : 0) + (sameWeekend ? 20 : 0);
      return { candidate, score, timestamp: new Date(candidate.eventDate).getTime(), index };
    })
    .sort((left, right) => right.score - left.score || left.timestamp - right.timestamp || left.index - right.index)
    .slice(0, Math.max(0, Math.min(limit, 4)))
    .map(item => item.candidate);
}

export function buildEventShareUrl(eventId: number, origin = "") {
  const base = `${origin}/evento/${encodeURIComponent(eventId)}`;
  return `${base}?utm_source=share&utm_medium=social&utm_campaign=event_share`;
}

export function buildCanonicalEventUrl(eventId: number, origin = "") {
  return `${origin}/evento/${encodeURIComponent(eventId)}`;
}
