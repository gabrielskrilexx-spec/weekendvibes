import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória para o seed local.");

const sql = postgres(databaseUrl, { prepare: false });
const events = [
  {
    title: "Fixture Santos · Noite Tropical",
    slug: "fixture-santos-noite-tropical",
    description: "Registro de teste local para validar a agenda pública e o carregamento de imagens.",
    eventDate: "2026-10-30T21:00:00-03:00",
    endDate: "2026-10-31T02:00:00-03:00",
    locationName: "Blue Med Convention Center",
    address: "Praça Almirante Gago Coutinho, Santos - SP",
    city: "Santos",
    category: "evento_musical",
    genre: "house_eletronica",
    priceCents: 8000,
    priceNote: "A partir de R$ 80,00",
    sourceUrl: "https://example.com/weekendvibes-fixture-santos",
    sourceType: "test:local-fixture",
    imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Fixture Santos · Música no Valongo",
    slug: "fixture-santos-musica-no-valongo",
    description: "Registro de teste local para validar filtros de venue e fallback visual.",
    eventDate: "2026-10-31T18:30:00-03:00",
    endDate: "2026-10-31T23:30:00-03:00",
    locationName: "Parque Valongo",
    address: "Largo Marquês de Monte Alegre, Santos - SP",
    city: "Santos",
    category: "show",
    genre: "samba_pagode",
    priceCents: 0,
    priceNote: "Gratuito",
    sourceUrl: "https://example.com/weekendvibes-fixture-valongo",
    sourceType: "test:local-fixture",
    imageUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Fixture Guarujá · Sunset na Praia",
    slug: "fixture-guaruja-sunset-na-praia",
    description: "Registro de teste local para validar a filtragem por cidade.",
    eventDate: "2026-11-01T16:00:00-03:00",
    endDate: "2026-11-01T22:00:00-03:00",
    locationName: "Praia da Enseada",
    address: "Praia da Enseada, Guarujá - SP",
    city: "Guarujá",
    category: "balada",
    genre: "funk",
    priceCents: 4500,
    priceNote: "A partir de R$ 45,00",
    sourceUrl: "https://example.com/weekendvibes-fixture-guaruja",
    sourceType: "test:local-fixture",
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80",
  },
];

try {
  for (const event of events) {
    await sql`
      INSERT INTO events (
        title, slug, description, "eventDate", "endDate", "locationName", address, city,
        category, genre, "priceCents", "priceNote", "ticketStatus", "sourceUrl", "sourceType",
        "imageUrl", "isPublished", "isArchived", "locationPrecision", "sourceHash"
      ) VALUES (
        ${event.title}, ${event.slug}, ${event.description}, ${event.eventDate}::timestamp, ${event.endDate}::timestamp,
        ${event.locationName}, ${event.address}, ${event.city}, ${event.category}, ${event.genre}, ${event.priceCents},
        ${event.priceNote}, 'available', ${event.sourceUrl}, ${event.sourceType}, ${event.imageUrl}, 1, 0, 'exact', ${event.slug}
      )
      ON CONFLICT ("sourceHash") DO UPDATE SET
        title = EXCLUDED.title, description = EXCLUDED.description, "eventDate" = EXCLUDED."eventDate",
        "endDate" = EXCLUDED."endDate", "locationName" = EXCLUDED."locationName", address = EXCLUDED.address,
        city = EXCLUDED.city, category = EXCLUDED.category, genre = EXCLUDED.genre, "priceCents" = EXCLUDED."priceCents",
        "priceNote" = EXCLUDED."priceNote", "sourceUrl" = EXCLUDED."sourceUrl", "imageUrl" = EXCLUDED."imageUrl",
        "isPublished" = 1, "isArchived" = 0, "updatedAt" = CURRENT_TIMESTAMP
    `;
  }
  console.log(JSON.stringify({ ok: true, seeded: events.length, sourceType: "test:local-fixture" }));
} finally {
  await sql.end();
}
