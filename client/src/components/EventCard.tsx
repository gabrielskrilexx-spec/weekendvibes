import React from "react";
import { ArrowUpRight, CalendarDays, MapPin, Ticket, TicketX } from "lucide-react";
import { Link } from "wouter";
import type { Event } from "../../../drizzle/schema";
import FavoriteReminderControls from "./FavoriteReminderControls";
import { responsiveImageProps, EVENT_CARD_IMAGE_SIZES } from "@/lib/responsiveImages";

const genreLabels: Record<string, string> = { funk: "Funk", house_eletronica: "House/Eletrônica", samba_pagode: "Samba/Pagode", rap_trap: "Rap/Trap" };

const categoryColors: Record<string, string> = {
  show: "bg-orange-400/15 text-orange-200 border-orange-300/20",
  balada: "bg-fuchsia-400/15 text-fuchsia-200 border-fuchsia-300/20",
  evento_musical: "bg-yellow-300/15 text-yellow-100 border-yellow-200/20",
};

export default function EventCard({ event }: { event: Event }) {
  const date = new Date(event.eventDate);
  const image = event.imageUrl || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80";
  const imageProps = responsiveImageProps(image, EVENT_CARD_IMAGE_SIZES);
  const isSoldOut = event.ticketStatus === "sold_out" || (event.ticketStatus === undefined && (event.priceNote?.toLowerCase().includes("vendas encerradas") ?? false));
  const qualitySignals = [Boolean(event.sourceUrl), Boolean(event.imageUrl), Boolean(event.address), Boolean(event.genre), Boolean(event.eventDate)].filter(Boolean).length;
  const confidenceLabel = qualitySignals >= 5 ? "Alta confiança" : qualitySignals >= 3 ? "Confiança moderada" : "Dados básicos";
  const confidenceStyle = qualitySignals >= 5 ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : qualitySignals >= 3 ? "border-yellow-300/20 bg-yellow-300/10 text-yellow-100" : "border-white/10 bg-white/[0.05] text-zinc-300";
  return (
    <article className="content-fade-in group overflow-hidden rounded-[24px] border border-white/10 bg-zinc-900/90 shadow-[0_16px_40px_-28px_rgba(168,85,247,.48)] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-1 hover:scale-[1.012] hover:border-orange-300/45 hover:bg-zinc-900 hover:shadow-[0_24px_54px_-24px_rgba(249,115,22,.48)] focus-within:-translate-y-1 focus-within:scale-[1.006] focus-within:border-orange-300/55 focus-within:ring-2 focus-within:ring-orange-300/25 motion-reduce:transform-none motion-reduce:transition-none">
      <div className="relative h-48 overflow-hidden bg-zinc-800/80">
        <img {...imageProps} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-[transform,filter] duration-500 ease-out group-hover:scale-105 group-hover:brightness-110 group-hover:saturate-125 motion-reduce:transition-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/15 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-orange-100 backdrop-blur">{event.city}</span>
        {isSoldOut && (
          <span aria-label="Ingressos esgotados ou vendas encerradas" className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-rose-200/50 bg-rose-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_8px_24px_-8px_rgba(244,63,94,.9)]">
            <TicketX size={13} strokeWidth={2.5} /> Esgotado
          </span>
        )}
        <span className="absolute bottom-4 left-4 rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-zinc-950">{date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</span>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-xl font-black leading-tight tracking-tight text-white transition-colors duration-200 group-hover:text-orange-100 motion-reduce:transition-none">{event.title}</h3>
          <ArrowUpRight className="mt-1 shrink-0 text-orange-300 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" size={20} />
        </div>
        <div className="space-y-2 text-sm text-zinc-300">
          <p className="flex items-center gap-2"><CalendarDays size={15} className="text-orange-300" />{date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
          <p className="flex items-center gap-2"><MapPin size={15} className="text-fuchsia-300" /><span className="line-clamp-1">{event.locationName}</span></p>
          <p className={`flex items-center gap-2 ${isSoldOut ? "text-rose-200" : ""}`}><Ticket size={15} className={isSoldOut ? "text-rose-300" : "text-yellow-300"} />{event.priceNote ?? (event.priceCents > 0 ? `A partir de R$ ${(event.priceCents / 100).toFixed(2).replace(".", ",")}` : "A partir de R$ 0,00")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Qualidade dos dados do evento"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${confidenceStyle}`} title="Indicador calculado a partir de fonte, imagem, endereço, gênero e data">{confidenceLabel}</span>{event.sourceUrl && <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">Fonte verificável</span>}</div>
        <FavoriteReminderControls eventId={event.id} />
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${categoryColors[event.category]}`}>{event.category === "evento_musical" ? "música" : event.category}</span>{event.genre && <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-300">{genreLabels[event.genre] ?? event.genre}</span>}</div>
          <Link href={`/eventos/${event.slug}`} className="inline-flex items-center gap-2 rounded-full bg-orange-300 px-4 py-2 text-xs font-black text-zinc-950 transition-[transform,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-orange-200 hover:shadow-[0_8px_20px_-10px_rgba(251,146,60,.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 motion-reduce:transform-none"><Ticket size={14} /> Ver evento</Link>
        </div>
      </div>
    </article>
  );
}
