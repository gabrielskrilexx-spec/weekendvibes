export const CANONICAL_GENRES = ["trap", "rap", "funk", "eletrônica"] as const;
export type CanonicalGenre = typeof CANONICAL_GENRES[number];
export type PersistedGenre = "funk" | "house_eletronica" | "rap_trap";

const FUNK_CONTEXT = /\bfunk\b|baile\s+funk|funk\s+(?:carioca|mandel[aã]o|consciente|ostenta[cç][aã]o)|(?:mega|super)\s+funk|mandel[aã]o/i;
const TRAP_CONTEXT = /\btrap\b|trap\s+(?:nacional|br|brasileiro)/i;
const RAP_CONTEXT = /\brap\b|hip[ -]?hop|boom\s*bap|\bdrill\b|\bgrime\b/i;
const ELECTRONIC_CONTEXT = /m[uú]sica\s+eletr[oô]nica|\b(?:electro|electronic|tech\s*house|afro\s*house|deep\s*house|bass\s*house|melodic\s*(?:techno|house)|house\s*music|techno|trance|psytrance|progressive\s*house|edm|drum\s*(?:and|&)\s*bass|dnb)\b|\bsunset\s+eletr[oô]nico\b|\b(?:dj|djs)\s+(?:set|session|live)|\b(?:line[- ]?up|lineup)\b[^.!?]{0,100}\b(?:dj|djs|techno|house|trance|edm)\b/i;
const ADMINISTRATIVE_ELECTRONIC = /ingressos?\s+eletr[oô]nicos?|ingresso\s+eletr[oô]nico|bilhete\s+eletr[oô]nico|documento\s+eletr[oô]nico|pagamento\s+eletr[oô]nico|meia[- ]entrada\s+eletr[oô]nica/gi;

export function classifyCanonicalGenres(parts: Array<string | null | undefined> | string): CanonicalGenre[] {
  const text = (Array.isArray(parts) ? parts.filter(Boolean).join(" ") : parts).normalize("NFC").replace(ADMINISTRATIVE_ELECTRONIC, " ");
  const genres: CanonicalGenre[] = [];
  if (TRAP_CONTEXT.test(text)) genres.push("trap");
  if (RAP_CONTEXT.test(text)) genres.push("rap");
  if (FUNK_CONTEXT.test(text)) genres.push("funk");
  if (ELECTRONIC_CONTEXT.test(text)) genres.push("eletrônica");
  return genres;
}

export function canonicalGenreToPersisted(genre: CanonicalGenre): PersistedGenre {
  if (genre === "funk") return "funk";
  if (genre === "eletrônica") return "house_eletronica";
  return "rap_trap";
}

export function canonicalGenresToPersisted(genres: readonly CanonicalGenre[]): PersistedGenre | "" {
  const first = ["funk", "eletrônica", "trap", "rap"].find(genre => genres.includes(genre as CanonicalGenre)) as CanonicalGenre | undefined;
  return first ? canonicalGenreToPersisted(first) : "";
}

export function inferPersistedGenre(parts: Array<string | null | undefined> | string): PersistedGenre | "" {
  return canonicalGenresToPersisted(classifyCanonicalGenres(parts));
}
