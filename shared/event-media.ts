type EventMediaInput = {
  title?: string | null;
  locationName?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  category?: string | null;
};

const VENUE_COVER_RULES = [
  { terms: ["laroc", "laroc club"], imageUrl: "/venues/laroc.webp" },
  { terms: ["praio", "praiô", "praio lounge bar"], imageUrl: "/images/venues/praio.jpg" },
  { terms: ["praia verde beach club", "praia verde"], imageUrl: "/images/venues/praia-verde-beach-club.jpg" },
  { terms: ["curvao", "curvão", "surf house"], imageUrl: "/images/venues/curvao.jpg" },
  { terms: ["dolores"], imageUrl: "/venues/dolores.webp" },
  { terms: ["flamingo", "flamingos"], imageUrl: "/venues/flamingos.webp" },
  { terms: ["arena club"], imageUrl: "/venues/arena-club.webp" },
  { terms: ["yellow house"], imageUrl: "/images/venues/yellow-house.jpg" },
  { terms: ["meu lugar"], imageUrl: "/images/venues/meu-lugar.jpg" },
  { terms: ["goat"], imageUrl: "/venues/goat.webp" },
  { terms: ["vallum"], imageUrl: "/venues/vallum-garden.webp" },
  { terms: ["santos convention", "blue med"], imageUrl: "/venues/bluemed.webp" },
  { terms: ["lucky scope", "nosso after", "walter belian"], imageUrl: "/images/venues/lucky-scope.jpg" },
  { terms: ["o beco"], imageUrl: "/venues/obeco.webp" },
  { terms: ["guarujá golf", "guaruja golf"], imageUrl: "/venues/guaruja-golf-club.webp" },
] as const;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function resolveVenueCoverFallback(input: EventMediaInput) {
  const searchable = normalize([input.title, input.locationName, input.sourceUrl].filter(Boolean).join(" "));
  const matched = VENUE_COVER_RULES.find(rule => rule.terms.some(term => searchable.includes(normalize(term))));
  if (matched) return matched.imageUrl;
  return "/images/venues/venue-placeholder.svg";
}
