import { createHash } from "node:crypto";

export const REGIONAL_BOUNDS = {
  minLatitude: -24.08,
  maxLatitude: -23.88,
  minLongitude: -46.46,
  maxLongitude: -46.15,
} as const;

const NOISE_PATTERNS = [
  /#[A-Za-z0-9À-ÿ_-]+/g,
  /https?:\/\/\S+/gi,
  /\b(link na bio|ingressos? (?:pelo|no|em)|saiba mais|reservas?|chame no direct)\b[^\n]*/gi,
  /[\u2600-\u27BF\uD800-\uDFFF]/g,
];

const NEIGHBORHOOD_FALLBACKS = {
  Santos: {
    gonzaga: { latitude: -23.9674, longitude: -46.3406, label: "Gonzaga" },
    boqueirao: { latitude: -23.9678, longitude: -46.3279, label: "Boqueirão" },
    pompeia: { latitude: -23.9731, longitude: -46.3422, label: "Pompéia" },
    "jose menino": { latitude: -23.9718, longitude: -46.3515, label: "José Menino" },
    "centro": { latitude: -23.9356, longitude: -46.3315, label: "Centro" },
  },
  Guarujá: {
    enseada: { latitude: -23.9907, longitude: -46.2187, label: "Enseada" },
    pitangueiras: { latitude: -23.9938, longitude: -46.2565, label: "Pitangueiras" },
    asturias: { latitude: -24.0005, longitude: -46.2702, label: "Astúrias" },
    tombo: { latitude: -24.0069, longitude: -46.2802, label: "Tombo" },
    pernambuco: { latitude: -23.9318, longitude: -46.1855, label: "Pernambuco" },
  },
} as const;

export function normalizeLocationText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => NOISE_PATTERNS.reduce((current, pattern) => current.replace(pattern, " "), line))
    .join(", ")
    .replace(/[|•·]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*,+/g, ",")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim()
    .slice(0, 500);
}

export function normalizeComparableLocation(value: string | null | undefined) {
  return normalizeLocationText(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function extractNeighborhood(address: string | null | undefined, locationName: string | null | undefined, city: "Santos" | "Guarujá") {
  const comparable = normalizeComparableLocation(`${address ?? ""}, ${locationName ?? ""}`);
  const dictionary = NEIGHBORHOOD_FALLBACKS[city] as Record<string, { latitude: number; longitude: number; label: string }>;
  const known = Object.keys(dictionary).find(name => comparable.includes(name));
  return known ? dictionary[known].label : null;
}

export function geocodingAddressHash(address: string, city: string) {
  return createHash("sha256").update(`${normalizeComparableLocation(address)}|${normalizeComparableLocation(city)}`).digest("hex");
}

export function getRegionalFallback(eventId: number, city: "Santos" | "Guarujá", address: string | null | undefined, locationName: string | null | undefined) {
  const cityFallback = city === "Santos" ? { latitude: -23.9608, longitude: -46.3336, label: "Santos" } : { latitude: -23.9931, longitude: -46.2564, label: "Guarujá" };
  const comparable = normalizeComparableLocation(`${address ?? ""}, ${locationName ?? ""}`);
  const dictionary = NEIGHBORHOOD_FALLBACKS[city] as Record<string, { latitude: number; longitude: number; label: string }>;
  const key = Object.keys(dictionary).find(name => comparable.includes(name));
  const base = key ? dictionary[key] : cityFallback;
  const digest = createHash("sha256").update(`${eventId}|${comparable}`).digest();
  const offset = ((digest[0] % 7) - 3) * 0.00018;
  return { latitude: (base.latitude + offset).toFixed(7), longitude: (base.longitude + offset).toFixed(7), neighborhood: key ? base.label : null, formattedAddress: `${base.label}, ${city} - SP, Brasil` };
}

export function isWithinRegionalBounds(latitude: number, longitude: number) {
  return latitude >= REGIONAL_BOUNDS.minLatitude && latitude <= REGIONAL_BOUNDS.maxLatitude && longitude >= REGIONAL_BOUNDS.minLongitude && longitude <= REGIONAL_BOUNDS.maxLongitude;
}

export function buildRegionalGeocodingQuery(address: string | null | undefined, locationName: string | null | undefined, city: "Santos" | "Guarujá") {
  const cleaned = normalizeLocationText(address || locationName || "")
    .replace(/\bAlmeida de Morais\b/gi, "Almeida de Moraes");
  const venue = normalizeLocationText(locationName);
  const neighborhood = extractNeighborhood(address, locationName, city);
  return [cleaned, venue, neighborhood, city, "São Paulo", "Brasil"]
    .filter(Boolean)
    .join(", ");
}

export type RegionalFallback = ReturnType<typeof getRegionalFallback>;
