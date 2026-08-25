import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Event } from "../../../drizzle/schema";

vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock("./FavoriteReminderControls", () => ({ default: () => <div data-testid="favorite-controls" /> }));

import EventCard, { getEventPriceLabel } from "./EventCard";

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

  it("aplica feedback visual de hover e foco sem remover a acessibilidade", () => {
    const markup = renderToStaticMarkup(<EventCard event={event} />);
    expect(markup).toContain("hover:-translate-y-1");
    expect(markup).toContain("hover:scale-[1.012]");
    expect(markup).toContain("group-hover:brightness-110");
    expect(markup).toContain("focus-within:ring-2");
    expect(markup).toContain("motion-reduce:transition-none");
    expect(markup).toContain('href="/eventos/rolê-santos"');
    expect(markup).toContain("line-clamp-2");
    expect(markup).toContain("min-h-[3.25rem]");
    expect(markup).toContain("A partir de R$ 50,00");
    expect(markup).not.toContain("Alta confiança");
    expect(markup).not.toContain("Confiança moderada");
    expect(markup).not.toContain("Fonte verificável");
  });
});
