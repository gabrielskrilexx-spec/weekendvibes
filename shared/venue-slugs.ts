export type IndexableVenue = {
  slug: string;
  canonicalName: string;
  city: "Santos" | "Guarujá";
  aliases: string[];
  imageUrl: string;
  description: string;
};

export function normalizeVenueValue(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function canonicalVenueSlug(value: string) {
  return normalizeVenueValue(value).replace(/\s+/g, "-");
}

export function dedupeVenueAliases(values: string[]) {
  const seen = new Set<string>();
  return values.map(value => value.trim()).filter(value => {
    const key = normalizeVenueValue(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveVenueBySlug(venues: IndexableVenue[], value: string) {
  const normalized = canonicalVenueSlug(value);
  return venues.find(venue => venue.slug === normalized || [venue.canonicalName, ...venue.aliases].some(alias => canonicalVenueSlug(alias) === normalized || normalizeVenueValue(alias) === normalizeVenueValue(value)));
}
