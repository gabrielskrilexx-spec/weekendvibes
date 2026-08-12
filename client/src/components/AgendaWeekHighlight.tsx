import React from "react";
import { CalendarDays } from "lucide-react";
import { Link } from "wouter";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import type { AgendaWeekState } from "@/lib/agendaState";

type AgendaEvent = {
  id: number;
  slug: string;
  title: string;
  city: string;
  eventDate: Date | string;
  locationName: string;
  imageUrl?: string | null;
};

export default function AgendaWeekHighlight({ state, events }: { state: AgendaWeekState; events: AgendaEvent[] }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-7 sm:px-6" aria-labelledby="agenda-semana-title">
      <div className="relative overflow-hidden rounded-[28px] border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-950/70 via-zinc-900 to-orange-950/50 p-5 shadow-2xl shadow-fuchsia-950/20 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-yellow-200"><CalendarDays size={15} /> Capturado recentemente</div>
            <h2 id="agenda-semana-title" className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Agenda da Semana</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-300">Os rolês publicados recentemente pelos espaços da Baixada Santista.</p>
          </div>
        </div>
        {state === "loading" && <div className="h-44 animate-pulse rounded-2xl bg-white/[0.08]" aria-label="Carregando Agenda da Semana" />}
        {state === "error" && <p className="rounded-2xl border border-orange-300/20 bg-orange-300/10 p-5 text-sm text-orange-100">A Agenda da Semana está sendo atualizada. Tente novamente em instantes.</p>}
        {state === "empty" && <p className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 text-sm text-zinc-300">Nenhum evento recente da Agenda da Semana por enquanto.</p>}
        {state === "ready" && <Carousel opts={{ align: "start", loop: events.length > 2 }}>
          {events.length > 1 && <div className="mb-4 hidden justify-end gap-2 sm:flex"><CarouselPrevious className="static translate-y-0 border-white/15 bg-white/10 text-white hover:bg-white/20" /><CarouselNext className="static translate-y-0 border-white/15 bg-white/10 text-white hover:bg-white/20" /></div>}
          <CarouselContent className="-ml-3 sm:-ml-4">
            {events.map(event => <CarouselItem key={event.id} className="pl-3 sm:basis-1/2 sm:pl-4 lg:basis-1/3">
              <Link href={`/eventos/${event.slug}`} className="group block h-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70 transition hover:-translate-y-1 hover:border-orange-300/50">
                <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-orange-400/30 via-fuchsia-500/20 to-zinc-900">{event.imageUrl ? <img src={event.imageUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-4xl font-black text-white/70">WV</div>}<span className="absolute left-3 top-3 rounded-full bg-zinc-950/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-yellow-100">{event.city}</span></div>
                <div className="p-4"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">{new Date(event.eventDate).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</p><h3 className="mt-2 line-clamp-2 text-lg font-black leading-tight text-white">{event.title}</h3><p className="mt-2 line-clamp-1 text-sm text-zinc-400">{event.locationName}</p></div>
              </Link>
            </CarouselItem>)}
          </CarouselContent>
          <div className="mt-4 flex justify-center gap-2 sm:hidden"><CarouselPrevious className="static translate-y-0 border-white/15 bg-white/10 text-white hover:bg-white/20" /><CarouselNext className="static translate-y-0 border-white/15 bg-white/10 text-white hover:bg-white/20" /></div>
        </Carousel>}
      </div>
    </section>
  );
}
