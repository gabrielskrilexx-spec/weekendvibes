type EventMediaInput = {
  title?: string | null;
  locationName?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  category?: string | null;
};

const VENUE_COVER_RULES = [
  { terms: ["laroc", "laroc club"], imageUrl: "/venues/laroc.webp" },
  { terms: ["praio", "praiô", "praia verde"], imageUrl: "/venues/curvao.webp" },
  { terms: ["curvao", "curvão", "surf house"], imageUrl: "/venues/curvao.webp" },
  { terms: ["dolores"], imageUrl: "/venues/dolores.webp" },
  { terms: ["flamingo", "flamingos"], imageUrl: "/venues/flamingos.webp" },
  { terms: ["arena club"], imageUrl: "/venues/arena-club.webp" },
  { terms: ["yellow house"], imageUrl: "/venues/yellow-house.webp" },
  { terms: ["goat"], imageUrl: "/venues/goat.webp" },
  { terms: ["vallum"], imageUrl: "/venues/vallum-garden.webp" },
  { terms: ["santos convention", "blue med"], imageUrl: "/venues/bluemed.webp" },
  { terms: ["o beco", "nosso after"], imageUrl: "/venues/obeco.webp" },
  { terms: ["guarujá golf", "guaruja golf"], imageUrl: "/venues/guaruja-golf-club.webp" },
] as const;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function resolveVenueCoverFallback(input: EventMediaInput) {
  const searchable = normalize([input.title, input.locationName, input.sourceUrl].filter(Boolean).join(" "));
  const matched = VENUE_COVER_RULES.find(rule => rule.terms.some(term => searchable.includes(normalize(term))));
  if (matched) return matched.imageUrl;
  if (input.category === "show") return "/venues/mobydick.webp";
  if (input.category === "balada") return "/venues/curvao.webp";
  return "/venues/vallum-garden.webp";
}
