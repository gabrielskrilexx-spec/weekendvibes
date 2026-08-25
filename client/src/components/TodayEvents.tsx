import React from "react";
import { CalendarCheck2, ChevronRight, Compass } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import EventCard from "./EventCard";

export default function TodayEvents() {
  const query = trpc.events.today.useQuery({ size: 6 });
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());
  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6" aria-labelledby="today-title">
      <div className="mb-5 flex items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-yellow-200"><CalendarCheck2 size={15} /> Agora na Baixada</p><h2 id="today-title" className="mt-1 text-3xl font-black tracking-tight text-white">O que fazer hoje?</h2><p className="mt-1 text-sm capitalize text-zinc-500">{today}</p></div><Link href="/?date=today" aria-label="Ver todos os eventos de hoje" className="hidden items-center gap-1 text-xs font-black uppercase tracking-wider text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 sm:flex">Ver tudo <ChevronRight size={15} /></Link></div>
      {query.isLoading && <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-zinc-400">Buscando os rolês de hoje...</div>}
      {query.isError && <div className="rounded-3xl border border-rose-300/20 bg-rose-400/10 p-6 text-sm text-rose-100">Não foi possível carregar os eventos de hoje. Tente novamente em instantes.</div>}
      {!query.isLoading && !query.isError && !query.data?.length && <div className="rounded-3xl border border-orange-300/20 bg-gradient-to-br from-orange-300/[0.09] to-fuchsia-400/[0.06] p-6 text-center sm:p-8"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-200/20 bg-orange-300/10 text-orange-200"><Compass size={22} /></div><h3 className="mt-4 text-lg font-black text-white">Ainda não há eventos confirmados para hoje.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">A agenda pode mudar rápido. Explore sexta e sábado para encontrar o próximo rolê.</p><Link href="/#filtros" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-300 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"><Compass size={16} /> Ver os rolês do fim de semana <ChevronRight size={16} /></Link></div>}
      {!!query.data?.length && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{query.data.map(event => <EventCard key={event.id} event={event} />)}</div>}
    </section>
  );
}
