import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, Sparkles, WifiOff, SlidersHorizontal, Moon, Sun, Contrast } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { getAgendaWeekState } from "@/lib/agendaState";
import RegionalEventMap from "@/components/RegionalEventMap";
import EventCard from "@/components/EventCard";
import AgendaWeekHighlight from "@/components/AgendaWeekHighlight";
import OperationalAlertCenter from "@/components/OperationalAlertCenter";
import TodayEvents from "@/components/TodayEvents";
import { useTheme } from "@/contexts/ThemeContext";

const days = [{ label: "Todos", value: "" }, { label: "Sexta", value: "sexta" }, { label: "Sábado", value: "sabado" }];
const cities = ["Todas", "Santos", "Guarujá"];
const categories = ["Todas", "show", "balada", "evento_musical"];
const genres = [{ label: "Todos os gêneros", value: "" }, { label: "Funk", value: "funk" }, { label: "House/Eletrônica", value: "house_eletronica" }, { label: "Samba/Pagode", value: "samba_pagode" }, { label: "Rap/Trap", value: "rap_trap" }];

export default function Home() {
  const { theme, toggleTheme, highContrast, toggleContrast } = useTheme();
  const [day, setDay] = useState("");
  const [city, setCity] = useState("Todas");
  const [category, setCategory] = useState("Todas");
  const [genre, setGenre] = useState("");
  const [query, setQuery] = useState("");
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const eventsQuery = trpc.events.list.useQuery({ day, city, category, genre, venue: venue.trim() || undefined, date: date || undefined, minPriceCents: minPrice ? Number(minPrice) * 100 : undefined, maxPriceCents: maxPrice ? Number(maxPrice) * 100 : undefined, timeFrom: timeFrom || undefined, timeTo: timeTo || undefined, size: 40 });
  const agendaQuery = trpc.events.recentInstagramAgenda.useQuery({ lookbackDays: 5, size: 8 });
  const agendaState = getAgendaWeekState({ isLoading: agendaQuery.isLoading, isError: agendaQuery.isError, events: agendaQuery.data });
  const agendaEvents = agendaQuery.data ?? [];
  const events = useMemo(() => (eventsQuery.data ?? []).filter(event => event.title.toLowerCase().includes(query.toLowerCase()) || event.locationName.toLowerCase().includes(query.toLowerCase())), [eventsQuery.data, query]);


  return (
    <main className="min-h-screen bg-zinc-950 pb-16 text-zinc-100">
      <OperationalAlertCenter />
      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-2xl font-black tracking-[-0.06em] text-transparent bg-gradient-to-r from-orange-300 via-yellow-200 to-fuchsia-400 bg-clip-text">WeekendVibes<span className="text-white">.</span></Link>
          <div className="flex items-center gap-2"><button type="button" onClick={() => toggleTheme?.()} aria-pressed={theme === "light"} aria-label={theme === "dark" ? "Ativar tema claro tropical" : "Ativar tema escuro"} title={theme === "dark" ? "Ativar tema claro tropical" : "Ativar tema escuro"} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-yellow-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button><button type="button" onClick={() => toggleContrast?.()} aria-pressed={highContrast} aria-label={highContrast ? "Desativar alto contraste" : "Ativar alto contraste"} title={highContrast ? "Desativar alto contraste" : "Ativar alto contraste"} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-yellow-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><Contrast size={17} /></button><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400"><MapPin size={15} className="text-orange-300" /> Baixada Santista</div></div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10 px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" /><div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-yellow-200"><Sparkles size={16} /> Seu fim de semana começa aqui</div>
          <h1 className="max-w-4xl text-5xl font-black leading-[.95] tracking-[-0.07em] text-white sm:text-7xl">O que vai <span className="text-transparent bg-gradient-to-r from-orange-300 via-yellow-200 to-fuchsia-400 bg-clip-text">rolar?</span></h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400">Shows, baladas e música para viver Santos e Guarujá do jeito que o seu fim de semana merece.</p>
          <div className="mt-8 flex max-w-2xl items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 shadow-2xl shadow-fuchsia-950/20"><Search size={20} className="text-orange-300" /><input aria-label="Buscar por evento ou local" value={query} onChange={e => setQuery(e.target.value)} placeholder="Busque por evento ou local..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-orange-300/70" /></div>
        </div>
      </section>

      <AgendaWeekHighlight state={agendaState} events={agendaEvents} />
      <TodayEvents />

      <section className="mx-auto max-w-7xl px-4 pt-7 sm:px-6">
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{days.map(item => <button type="button" key={item.label} aria-pressed={day === item.value} onClick={() => setDay(item.value)} className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${day === item.value ? "border-orange-300 bg-orange-300 text-zinc-950" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-orange-300/50"}`}>{item.label}</button>)}</div>
        <div className="mt-5 flex items-center gap-3"><p className="shrink-0 text-[11px] font-black uppercase tracking-[0.18em] text-fuchsia-300">Explorar por cidade</p><div className="flex min-w-0 gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{cities.map(item => <button type="button" key={item} aria-pressed={city === item} onClick={() => setCity(item)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 ${city === item ? "border-fuchsia-300/60 bg-fuchsia-400/20 text-fuchsia-100" : "border-white/10 text-zinc-500 hover:text-zinc-200"}`}>{item}</button>)}</div></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 ${category === item ? "border-yellow-200/60 bg-yellow-300/15 text-yellow-100" : "border-white/10 text-zinc-500 hover:text-zinc-200"}`}>{item === "evento_musical" ? "Música" : item}</button>)}</div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{genres.map(item => <button type="button" key={item.value || "todos-generos"} aria-pressed={genre === item.value} onClick={() => setGenre(item.value)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 ${genre === item.value ? "border-fuchsia-300/60 bg-fuchsia-400/20 text-fuchsia-100" : "border-white/10 text-zinc-500 hover:text-zinc-200"}`}>{item.label}</button>)}</div>
        <label className="mt-4 flex max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-400 focus-within:border-orange-300/60"><MapPin size={17} className="shrink-0 text-orange-300" /><span className="sr-only">Filtrar por local ou estabelecimento</span><input value={venue} onChange={e => setVenue(e.target.value)} placeholder="Filtre por local ou estabelecimento..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500" /></label>
        <button type="button" aria-expanded={showAdvanced} onClick={() => setShowAdvanced(value => !value)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-zinc-300 hover:border-orange-300/50 hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><SlidersHorizontal size={15} /> Filtros avançados</button>
        {showAdvanced && <div className="mt-3 grid max-w-4xl gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs font-bold text-zinc-400">Data<input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs font-bold text-zinc-400">Preço mínimo<input type="number" min="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="R$" className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs font-bold text-zinc-400">Preço máximo<input type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="R$" className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs font-bold text-zinc-400">A partir de<input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white" /></label><label className="text-xs font-bold text-zinc-400">Até<input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white" /></label></div>}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_.75fr]">
          <div>
            <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Agenda em destaque</p><h2 className="mt-1 text-3xl font-black tracking-tight text-white">Escolha sua vibe</h2></div><span className="text-sm text-zinc-500">{events.length} rolês</span></div>
            {eventsQuery.isLoading && <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-zinc-400">Carregando os rolês do fim de semana...</div>}
            {eventsQuery.isError && <div className="flex items-start gap-3 rounded-3xl border border-orange-300/20 bg-orange-300/10 p-6 text-orange-100"><WifiOff className="mt-1 shrink-0" /><div><p className="font-black">A agenda está temporariamente offline.</p><p className="mt-1 text-sm text-orange-100/70">O layout continua funcionando. Tente novamente em instantes ou confira os filtros.</p></div></div>}
            {!eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 && <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-zinc-400">Nenhum evento encontrado com esses filtros.</div>}
            <div className="grid gap-5 sm:grid-cols-2">{events.map(event => <EventCard key={event.id} event={event} />)}</div>
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start"><RegionalEventMap events={events} /></aside>
        </div>
      </section>
    </main>
  );
}
