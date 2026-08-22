import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Event } from "../../../drizzle/schema";

vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock("./FavoriteReminderControls", () => ({ default: () => <div data-testid="favorite-controls" /> }));

import EventCard from "./EventCard";

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
  it("aplica feedback visual de hover e foco sem remover a acessibilidade", () => {
    const markup = renderToStaticMarkup(<EventCard event={event} />);
    expect(markup).toContain("hover:-translate-y-1");
    expect(markup).toContain("hover:scale-[1.012]");
    expect(markup).toContain("group-hover:brightness-110");
    expect(markup).toContain("focus-within:ring-2");
    expect(markup).toContain("motion-reduce:transition-none");
    expect(markup).toContain('href="/eventos/rolê-santos"');
  });
});
