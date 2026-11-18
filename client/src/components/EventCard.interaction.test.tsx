import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Event } from "../../../drizzle/schema";

vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock("./FavoriteReminderControls", () => ({ default: () => <div data-testid="favorite-controls" /> }));

import EventCard, { getEventPriceLabel, resolveEventCoverImage } from "./EventCard";
import { sanitizeEventText } from "../../../shared/event-text";

const event = {
  id: 1,
  slug: "rolê-santos",
  title: "Rolê em Santos",
  eventDate: new Date("2026-08-22T22:00:00.000Z"),
  locationName: "Ativa House",
  city: "Santos",
  category: "show",
  genre: "funk",
  priceCents: 5000,
  priceNote: null,
  imageUrl: "https://example.com/event.jpg",
  sourceUrl: "https://example.com/event",
  address: "Santos",
  ticketStatus: "available",
} as Event;

describe("EventCard interaction", () => {
  it("classifica preço zero como gratuito e preço não catalogado como consulta", () => {
    expect(getEventPriceLabel({ priceCents: 0, priceNote: "R$ 0,00", ticketStatus: "available" })).toBe("Gratuito");
    expect(getEventPriceLabel({ priceCents: 0, priceNote: null, ticketStatus: "unknown" })).toBe("Consultar valores");
  });

  it("usa a imagem oficial da venue quando um evento Instagram não tem capa persistida", () => {
    expect(resolveEventCoverImage({ imageUrl: null, title: "PAGONEJO", locationName: "Dolores bar & restaurante", sourceType: "instagram_story", category: "evento_musical", sourceUrl: null })).toBe("/venues/dolores.webp");
    expect(resolveEventCoverImage({ imageUrl: null, title: "WIU", locationName: "Flamingo MusicBar", sourceType: "instagram_story", category: "show", sourceUrl: null })).toBe("/venues/flamingos.webp");
    expect(resolveEventCoverImage({ imageUrl: null, title: "Sabadou", locationName: "Praiô", sourceType: "instagram_story", category: "evento_musical", sourceUrl: null })).toBe("/venues/curvao.webp");
  });

  it("aplica fallback de venue também a eventos de fontes públicas", () => {
    expect(resolveEventCoverImage({ imageUrl: null, title: "Evento", locationName: "Dolores bar & restaurante", sourceType: "public:ingresse", category: "balada", sourceUrl: null })).toBe("/venues/dolores.webp");
  });

  it("prioriza uma capa persistida sobre o fallback da venue", () => {
    expect(resolveEventCoverImage({ imageUrl: "/manus-storage/instagram-covers/event.webp", title: "Evento", locationName: "Dolores", sourceType: "instagram_feed", category: "balada", sourceUrl: null })).toBe("/manus-storage/instagram-covers/event.webp");
  });

  it("limpa Markdown bruto das descrições e usa fallback por categoria", () => {
    expect(sanitizeEventText("# ROTATIONS SESSIONS - **Quando:** sábado, 5 de dezembro `2026`"))
      .toBe("ROTATIONS SESSIONS - Quando: sábado, 5 de dezembro 2026");
    expect(resolveEventCoverImage({ imageUrl: null, title: "Evento", locationName: "Espaço sem cadastro", sourceType: "public:discovery", category: "balada", sourceUrl: null })).toBe("/venues/curvao.webp");
  });

  it("aplica feedback visual de hover e foco sem remover a acessibilidade", () => {
    const markup = renderToStaticMarkup(<EventCard event={event} />);
    expect(markup).toContain("hover:-translate-y-1");
    expect(markup).toContain("hover:scale-[1.012]");
    expect(markup).toContain("group-hover:brightness-110");
    expect(markup).toContain("focus-within:ring-2");
    expect(markup).toContain("motion-reduce:transition-none");
    expect(markup).toContain('href="/eventos/rolê-santos"');
    expect(markup).toContain("Garantir ingresso");
    expect(markup).toContain('href="https://example.com/event"');
    expect(markup).toContain("line-clamp-2");
    expect(markup).toContain("min-h-[3.25rem]");
    expect(markup).toContain("A partir de R$ 50,00");
    expect(markup).toContain('class="absolute bottom-4 left-4 rounded-full bg-[#EA580C] px-3 py-1 text-xs font-black text-white"');
    expect(markup).not.toContain("Alta confiança");
    expect(markup).not.toContain("Confiança moderada");
    expect(markup).not.toContain("Fonte verificável");
  });
});
