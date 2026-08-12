import { ArrowUpRight, CalendarDays, MapPin, Ticket } from "lucide-react";
import { Link } from "wouter";
import type { Event } from "../../../drizzle/schema";

const genreLabels: Record<string, string> = { funk: "Funk", house_eletronica: "House/Eletrônica", samba_pagode: "Samba/Pagode", rap_trap: "Rap/Trap" };

const categoryColors: Record<string, string> = {
  show: "bg-orange-400/15 text-orange-200 border-orange-300/20",
  balada: "bg-fuchsia-400/15 text-fuchsia-200 border-fuchsia-300/20",
  evento_musical: "bg-yellow-300/15 text-yellow-100 border-yellow-200/20",
};

export default function EventCard({ event }: { event: Event }) {
  const date = new Date(event.eventDate);
  const image = event.imageUrl || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80";
  return (
    <article className="group overflow-hidden rounded-[24px] border border-white/10 bg-zinc-900/90 shadow-[0_20px_60px_-30px_rgba(168,85,247,.55)] transition duration-200 hover:-translate-y-1 hover:border-orange-300/40">
      <div className="relative h-48 overflow-hidden">
        <img src={image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/15 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-zinc-950/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-orange-100 backdrop-blur">{event.city}</span>
        <span className="absolute bottom-4 left-4 rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-zinc-950">{date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</span>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-xl font-black leading-tight tracking-tight text-white">{event.title}</h3>
          <ArrowUpRight className="mt-1 shrink-0 text-orange-300" size={20} />
        </div>
        <div className="space-y-2 text-sm text-zinc-300">
          <p className="flex items-center gap-2"><CalendarDays size={15} className="text-orange-300" />{date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
          <p className="flex items-center gap-2"><MapPin size={15} className="text-fuchsia-300" /><span className="line-clamp-1">{event.locationName}</span></p>
          <p className="flex items-center gap-2"><Ticket size={15} className="text-yellow-300" />{event.priceNote ?? (event.priceCents > 0 ? `A partir de R$ ${(event.priceCents / 100).toFixed(2).replace(".", ",")}` : "A partir de R$ 0,00")}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${categoryColors[event.category]}`}>{event.category === "evento_musical" ? "música" : event.category}</span>{event.genre && <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-300">{genreLabels[event.genre] ?? event.genre}</span>}</div>
          <Link href={`/eventos/${event.slug}`} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-400 to-fuchsia-500 px-4 py-2 text-xs font-black text-white transition hover:brightness-110"><Ticket size={14} /> Ver evento</Link>
        </div>
      </div>
    </article>
  );
}
