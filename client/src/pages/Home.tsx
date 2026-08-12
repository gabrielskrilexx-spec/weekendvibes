import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, Sparkles, WifiOff } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import EventCard from "@/components/EventCard";

const days = [{ label: "Todos", value: "" }, { label: "Sexta", value: "sexta" }, { label: "Sábado", value: "sabado" }];
const cities = ["Todas", "Santos", "Guarujá"];
const categories = ["Todas", "show", "balada", "evento_musical"];
const genres = [{ label: "Todos os gêneros", value: "" }, { label: "Funk", value: "funk" }, { label: "House/Eletrônica", value: "house_eletronica" }, { label: "Samba/Pagode", value: "samba_pagode" }, { label: "Rap/Trap", value: "rap_trap" }];

export default function Home() {
  const [day, setDay] = useState("");
  const [city, setCity] = useState("Todas");
  const [category, setCategory] = useState("Todas");
  const [genre, setGenre] = useState("");
  const [query, setQuery] = useState("");
  const [venue, setVenue] = useState("");
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const eventsQuery = trpc.events.list.useQuery({ day, city, category, genre, venue: venue.trim() || undefined, size: 40 });
  const events = useMemo(() => (eventsQuery.data ?? []).filter(event => event.title.toLowerCase().includes(query.toLowerCase()) || event.locationName.toLowerCase().includes(query.toLowerCase())), [eventsQuery.data, query]);

  const setupMarkers = (map: google.maps.Map) => {
    mapRef.current = map;
  };

  useEffect(() => {
    markersRef.current.forEach(marker => { marker.map = null; });
    markersRef.current = [];
    if (!mapRef.current || !window.google?.maps?.marker) return;
    events.forEach(event => {
      const lat = Number(event.latitude);
      const lng = Number(event.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !window.google?.maps?.marker) return;
      const marker = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, position: { lat, lng }, title: event.title });
      marker.addListener("click", () => { window.location.href = `/eventos/${event.slug}`; });
      markersRef.current.push(marker);
    });
  }, [events]);

  return (
    <main className="min-h-screen bg-zinc-950 pb-16 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-2xl font-black tracking-[-0.06em] text-transparent bg-gradient-to-r from-orange-300 via-yellow-200 to-fuchsia-400 bg-clip-text">WeekendVibes<span className="text-white">.</span></Link>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400"><MapPin size={15} className="text-orange-300" /> Baixada Santista</div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10 px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" /><div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-yellow-200"><Sparkles size={16} /> Seu fim de semana começa aqui</div>
          <h1 className="max-w-4xl text-5xl font-black leading-[.95] tracking-[-0.07em] text-white sm:text-7xl">O que vai <span className="text-transparent bg-gradient-to-r from-orange-300 via-yellow-200 to-fuchsia-400 bg-clip-text">rolar?</span></h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400">Shows, baladas e música para viver Santos e Guarujá do jeito que o seu fim de semana merece.</p>
          <div className="mt-8 flex max-w-2xl items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 shadow-2xl shadow-fuchsia-950/20"><Search size={20} className="text-orange-300" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Busque por evento ou local..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500" /></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-7 sm:px-6">
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{days.map(item => <button key={item.label} onClick={() => setDay(item.value)} className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-black transition ${day === item.value ? "border-orange-300 bg-orange-300 text-zinc-950" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-orange-300/50"}`}>{item.label}</button>)}</div>
        <div className="mt-5 flex items-center gap-3"><p className="shrink-0 text-[11px] font-black uppercase tracking-[0.18em] text-fuchsia-300">Explorar por cidade</p><div className="flex min-w-0 gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{cities.map(item => <button key={item} aria-pressed={city === item} onClick={() => setCity(item)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${city === item ? "border-fuchsia-300/60 bg-fuchsia-400/20 text-fuchsia-100" : "border-white/10 text-zinc-500 hover:text-zinc-200"}`}>{item}</button>)}</div></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{categories.map(item => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${category === item ? "border-yellow-200/60 bg-yellow-300/15 text-yellow-100" : "border-white/10 text-zinc-500 hover:text-zinc-200"}`}>{item === "evento_musical" ? "Música" : item}</button>)}</div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{genres.map(item => <button key={item.value || "todos-generos"} onClick={() => setGenre(item.value)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${genre === item.value ? "border-fuchsia-300/60 bg-fuchsia-400/20 text-fuchsia-100" : "border-white/10 text-zinc-500 hover:text-zinc-200"}`}>{item.label}</button>)}</div>
        <label className="mt-4 flex max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-400 focus-within:border-orange-300/60"><MapPin size={17} className="shrink-0 text-orange-300" /><span className="sr-only">Filtrar por local ou estabelecimento</span><input value={venue} onChange={e => setVenue(e.target.value)} placeholder="Filtre por local ou estabelecimento..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500" /></label>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_.75fr]">
          <div>
            <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Agenda em destaque</p><h2 className="mt-1 text-3xl font-black tracking-tight text-white">Escolha sua vibe</h2></div><span className="text-sm text-zinc-500">{events.length} rolês</span></div>
            {eventsQuery.isLoading && <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-zinc-400">Carregando os rolês do fim de semana...</div>}
            {eventsQuery.isError && <div className="flex items-start gap-3 rounded-3xl border border-orange-300/20 bg-orange-300/10 p-6 text-orange-100"><WifiOff className="mt-1 shrink-0" /><div><p className="font-black">A agenda está temporariamente offline.</p><p className="mt-1 text-sm text-orange-100/70">O layout continua funcionando. Tente novamente em instantes ou confira os filtros.</p></div></div>}
            {!eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 && <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-zinc-400">Nenhum evento encontrado com esses filtros.</div>}
            <div className="grid gap-5 sm:grid-cols-2">{events.map(event => <EventCard key={event.id} event={event} />)}</div>
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start"><div className="mb-4"><p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Perto de você</p><h2 className="mt-1 text-3xl font-black tracking-tight text-white">Mapa dos rolês</h2></div><div className="overflow-hidden rounded-[24px] border border-white/10 bg-zinc-900"><MapView className="h-[460px]" initialCenter={{ lat: -23.96, lng: -46.33 }} initialZoom={11} onMapReady={setupMarkers} /></div></aside>
        </div>
      </section>
    </main>
  );
}
