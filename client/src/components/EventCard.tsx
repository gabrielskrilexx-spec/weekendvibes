import React from "react";
import { ArrowUpRight, CalendarDays, MapPin, Ticket, TicketX } from "lucide-react";
import { Link } from "wouter";
import type { Event } from "../../../drizzle/schema";
import FavoriteReminderControls from "./FavoriteReminderControls";
import { responsiveImageProps, EVENT_CARD_IMAGE_SIZES } from "@/lib/responsiveImages";

const genreLabels: Record<string, string> = { funk: "Funk", house_eletronica: "House/Eletrônica", samba_pagode: "Samba/Pagode", rap_trap: "Rap/Trap" };
const categoryColors: Record<string, string> = { show: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-400/15 dark:text-orange-200 dark:border-orange-300/20", balada: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-400/15 dark:text-fuchsia-200 dark:border-fuchsia-300/20", evento_musical: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-300/15 dark:text-yellow-100 dark:border-yellow-200/20" };

export function getEventPriceLabel(event: Pick<Event, "priceCents" | "priceNote" | "ticketStatus">) {
  const note = event.priceNote?.trim() ?? "";
  if (/r\$\s*0(?:[,.]00)?|gr[aá]tis|gratuito|free/i.test(note) || (event.priceCents === 0 && event.ticketStatus !== "unknown")) return "Gratuito";
  if (!note && (event.ticketStatus === "unknown" || event.priceCents === undefined || event.priceCents === null)) return "Consultar valores";
  if (note) return note;
  if (event.priceCents > 0) return `A partir de R$ ${(event.priceCents / 100).toFixed(2).replace(".", ",")}`;
  return "Consultar valores";
}

export default function EventCard({ event }: { event: Event }) {
  const date = new Date(event.eventDate);
  const image = event.imageUrl || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80";
  const imageProps = responsiveImageProps(image, EVENT_CARD_IMAGE_SIZES);
  const isSoldOut = event.ticketStatus === "sold_out" || (event.ticketStatus === undefined && (event.priceNote?.toLowerCase().includes("vendas encerradas") ?? false));
  const priceLabel = getEventPriceLabel(event);
  return (
    <article className="content-fade-in group flex h-full flex-col overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_16px_40px_-28px_rgba(168,85,247,.24)] dark:border-white/10 dark:bg-zinc-900/90 dark:shadow-[0_16px_40px_-28px_rgba(168,85,247,.48)] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-1 hover:scale-[1.012] hover:border-orange-300/60 hover:bg-orange-50 hover:shadow-[0_24px_54px_-24px_rgba(249,115,22,.28)] dark:hover:border-orange-300/45 dark:hover:bg-zinc-900 dark:hover:shadow-[0_24px_54px_-24px_rgba(249,115,22,.48)] focus-within:-translate-y-1 focus-within:scale-[1.006] focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-300/30 dark:focus-within:border-orange-300/55 dark:focus-within:ring-orange-300/25 motion-reduce:transform-none motion-reduce:transition-none">
      <div className="relative h-48 shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800/80">
        <img {...imageProps} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-[transform,filter] duration-500 ease-out group-hover:scale-105 group-hover:brightness-110 group-hover:saturate-125 motion-reduce:transition-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-zinc-900/15 to-transparent dark:from-zinc-950 dark:via-zinc-950/15" />
        <span className="absolute left-4 top-4 rounded-full border border-white/25 bg-zinc-900/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-orange-100 dark:border-white/15 dark:bg-zinc-950/70 backdrop-blur">{event.city}</span>
        {isSoldOut && <span aria-label="Ingressos esgotados ou vendas encerradas" className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-rose-200/50 bg-rose-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_8px_24px_-8px_rgba(244,63,94,.9)]"><TicketX size={13} strokeWidth={2.5} /> Esgotado</span>}
        <span className="absolute bottom-4 left-4 rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-zinc-950">{date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</span>
      </div>
      <div className="flex flex-1 flex-col space-y-4 p-5">
        <div className="flex items-start justify-between gap-3"><h3 className="line-clamp-2 min-h-[3.25rem] text-xl font-black leading-tight tracking-tight text-zinc-900 dark:text-white transition-colors duration-200 group-hover:text-orange-700 dark:group-hover:text-orange-100 motion-reduce:transition-none">{event.title}</h3><ArrowUpRight className="mt-1 shrink-0 text-orange-300 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" size={20} /></div>
        <p className="line-clamp-2 min-h-[2.75rem] text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{event.description || "Descubra os detalhes deste rolê na página do evento."}</p>
        <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300"><p className="flex items-center gap-2"><CalendarDays size={15} className="text-orange-300" />{date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p><p className="flex items-center gap-2"><MapPin size={15} className="text-fuchsia-300" /><span className="line-clamp-1">{event.locationName}</span></p><p className={`flex items-center gap-2 ${isSoldOut ? "text-rose-200" : ""}`}><Ticket size={15} className={isSoldOut ? "text-rose-300" : "text-yellow-300"} />{priceLabel}</p></div>
        <FavoriteReminderControls eventId={event.id} />
        <div className="mt-auto flex flex-col gap-3"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${categoryColors[event.category]}`}>{event.category === "evento_musical" ? "música" : event.category}</span>{event.genre && <span className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:border-white/10 dark:text-zinc-300">{genreLabels[event.genre] ?? event.genre}</span>}</div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Link href={`/eventos/${event.slug}`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-xs font-black text-zinc-800 transition hover:border-orange-300/60 hover:bg-orange-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 motion-reduce:transition-none">Ver detalhes</Link>{event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-orange-300 px-4 py-2 text-xs font-black text-zinc-950 transition-[transform,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-orange-200 hover:shadow-[0_8px_20px_-10px_rgba(251,146,60,.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 motion-reduce:transform-none"><Ticket size={14} /> Garantir ingresso</a> : null}</div></div>
      </div>
    </article>
  );
}
