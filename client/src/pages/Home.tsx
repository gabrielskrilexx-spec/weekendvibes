import React, { useMemo, useState } from "react";
import { CalendarSearch, MapPin, Sparkles, WifiOff, Moon, Sun, Contrast } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import MobileBottomNav from "@/components/MobileBottomNav";
import EventCard from "@/components/EventCard";
import TodayEvents from "@/components/TodayEvents";
import { EventGridSkeleton } from "@/components/EventSkeletons";
import { useTheme } from "@/contexts/ThemeContext";
import SiteFooter from "@/components/SiteFooter";

const days = [{ label: "Todos", value: "" }, { label: "Sexta", value: "sexta" }, { label: "Sábado", value: "sabado" }];
const quickFilters = [{ label: "Todos", value: "todos" }, { label: "Hoje", value: "hoje" }, { label: "Fim de semana", value: "fim-de-semana" }, { label: "Santos", value: "santos" }, { label: "Guarujá", value: "guaruja" }] as const;
const cities = ["Todas", "Santos", "Guarujá"];
const categories = ["Todas", "show", "balada", "evento_musical"];
const genres = [{ label: "Todas as vibes", value: "" }, { label: "Funk", value: "funk" }, { label: "House/Eletrônica", value: "house_eletronica" }, { label: "Samba/Pagode", value: "samba_pagode" }, { label: "Rap/Trap", value: "rap_trap" }];

function saoPauloDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function addDays(dateKey: string, daysToAdd: number) {
  const date = new Date(`${dateKey}T12:00:00-03:00`);
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

export default function Home() {
  const { theme, toggleTheme, highContrast, toggleContrast } = useTheme();
  const { data: user } = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [day, setDay] = useState("");
  const [city, setCity] = useState("Todas");
  const [category, setCategory] = useState("Todas");
  const [genre, setGenre] = useState("");
  const [quickFilter, setQuickFilter] = useState<(typeof quickFilters)[number]["value"]>("todos");
  const todayKey = saoPauloDateKey();
  const quickRange = useMemo(() => {
    if (quickFilter === "hoje") return { date: todayKey };
    if (quickFilter !== "fim-de-semana") return {};
    const weekday = new Date(`${todayKey}T12:00:00-03:00`).getDay();
    const daysUntilFriday = (5 - weekday + 7) % 7;
    return { startDate: addDays(todayKey, daysUntilFriday), endDate: addDays(todayKey, daysUntilFriday + 3) };
  }, [quickFilter, todayKey]);
  const eventsQuery = trpc.events.list.useQuery({
    day: day || undefined,
    ...quickRange,
    city: quickFilter === "santos" ? "Santos" : quickFilter === "guaruja" ? "Guarujá" : city === "Santos" || city === "Guarujá" ? city : undefined,
    category: category === "show" || category === "balada" || category === "evento_musical" ? category : undefined,
    genre: genre === "funk" || genre === "house_eletronica" || genre === "samba_pagode" || genre === "rap_trap" ? genre : undefined,
    size: 40,
  });
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  const scrollToFilters = () => document.getElementById("filtros")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <main className="min-h-screen bg-white pb-28 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/95">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-[-0.06em] text-zinc-900 dark:text-white" aria-label="WeekendVibes"><span className="text-orange-700 dark:text-orange-200">W</span>eekend<span className="text-orange-700 dark:text-orange-200">V</span>ibes<span className="text-yellow-700 dark:text-yellow-200">.</span></Link>
          <div className="flex items-center gap-2">
            {user?.role === "admin" && <Link href="/admin/health" className="hidden min-h-11 items-center rounded-full border border-orange-300/30 bg-orange-300/10 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-orange-100 transition hover:border-orange-200/60 hover:bg-orange-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 sm:inline-flex">Painel Administrativo</Link>}
            <button type="button" onClick={() => toggleTheme?.()} aria-pressed={theme === "dark"} aria-label={theme === "dark" ? "Desativar modo escuro e ativar tema claro" : "Ativar modo escuro tropical"} className="theme-toggle inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-3 text-orange-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-yellow-200 transition hover:-translate-y-0.5 hover:border-yellow-200/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><span aria-hidden="true">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</span><span className="sr-only sm:not-sr-only sm:text-[10px] sm:font-black sm:uppercase sm:tracking-[0.14em]">{theme === "dark" ? "Escuro" : "Claro"}</span></button>
            <button type="button" onClick={() => toggleContrast?.()} aria-pressed={highContrast} aria-label={highContrast ? "Desativar alto contraste" : "Ativar alto contraste"} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-orange-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-yellow-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><Contrast size={17} /></button>
            <div className="hidden items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-700 sm:flex dark:text-zinc-400"><MapPin size={15} className="text-orange-300" /> Baixada Santista</div>
          </div>
          </div>
          <nav aria-label="Descobrir eventos" className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {quickFilters.map(filter => <button key={filter.value} type="button" aria-pressed={quickFilter === filter.value} onClick={() => { setQuickFilter(filter.value); if (filter.value === "santos" || filter.value === "guaruja") setCity(filter.value === "santos" ? "Santos" : "Guarujá"); else setCity("Todas"); }} className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${quickFilter === filter.value ? "border-orange-300 bg-orange-300 text-zinc-950 shadow-[0_8px_22px_-12px_rgba(251,146,60,.9)]" : "border-zinc-200 bg-zinc-100/80 text-zinc-600 hover:border-orange-300/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"}`}>{filter.label}</button>)}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-zinc-200 px-4 pb-10 pt-12 dark:border-white/10 sm:px-6 sm:pt-16">
        <div className="absolute left-0 top-0 h-px w-24 bg-orange-300" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-yellow-700 dark:text-yellow-200"><Sparkles size={14} /> Seu fim de semana começa aqui</div>
          <h1 className="max-w-4xl text-5xl font-black leading-[.95] tracking-[-0.07em] text-zinc-900 dark:text-white sm:text-7xl">O que vai <span className="text-orange-700 dark:text-orange-200">rolar?</span></h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">Shows, baladas e música para viver Santos e Guarujá do jeito que o seu fim de semana merece.</p>
        </div>
      </section>

      <TodayEvents />

      <section id="filtros" aria-labelledby="filtros-heading" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-8 sm:px-6">
        <div className="mb-5"><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700 dark:text-orange-300">Encontre seu rolê</p><h2 id="filtros-heading" className="mt-1 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Escolha a vibe</h2></div>
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Filtrar por dia">{days.map(item => <button type="button" key={item.label} aria-pressed={day === item.value} onClick={() => setDay(item.value)} className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${day === item.value ? "border-orange-300 bg-orange-300 text-zinc-950" : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-orange-300/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300"}`}>{item.label}</button>)}</div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Filtrar por cidade">{cities.map(item => <button type="button" key={item} aria-pressed={city === item} onClick={() => setCity(item)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 ${city === item ? "border-fuchsia-300/60 bg-fuchsia-400/20 text-fuchsia-100" : "border-zinc-200 text-zinc-600 hover:text-zinc-900 dark:border-white/10 dark:text-zinc-500 dark:hover:text-zinc-200"}`}>{item}</button>)}</div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Filtrar por categoria">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 ${category === item ? "border-yellow-200/60 bg-yellow-300/15 text-yellow-100" : "border-zinc-200 text-zinc-600 hover:text-zinc-900 dark:border-white/10 dark:text-zinc-500 dark:hover:text-zinc-200"}`}>{item === "evento_musical" ? "Música" : item}</button>)}</div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Filtrar por vibe">{genres.map(item => <button type="button" key={item.value || "todas-vibes"} aria-pressed={genre === item.value} onClick={() => setGenre(item.value)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 ${genre === item.value ? "border-fuchsia-300/60 bg-fuchsia-400/20 text-fuchsia-100" : "border-zinc-200 text-zinc-600 hover:text-zinc-900 dark:border-white/10 dark:text-zinc-500 dark:hover:text-zinc-200"}`}>{item.label}</button>)}</div>
        </div>

        <div className="mt-12 mb-6 flex items-end justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700 dark:text-orange-300">Agenda em destaque</p><h2 className="mt-1 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Rolês para você</h2></div><span className="text-sm text-zinc-600 dark:text-zinc-500">{events.length} eventos</span></div>
        {eventsQuery.isLoading && <EventGridSkeleton count={4} />}
        {eventsQuery.isError && <div className="flex items-start gap-3 rounded-3xl border border-orange-300/20 bg-orange-300/10 p-6 text-orange-100"><WifiOff className="mt-1 shrink-0" /><div><p className="font-black">A agenda está temporariamente offline.</p><p className="mt-1 text-sm text-orange-100/70">Tente novamente em instantes ou ajuste os filtros.</p></div></div>}
        {!eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 && <div className="rounded-3xl border border-orange-300/20 bg-gradient-to-br from-orange-300/[0.09] to-fuchsia-400/[0.06] p-7 text-center sm:p-10"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-200/20 bg-orange-300/10 text-orange-200"><CalendarSearch size={22} /></div><h3 className="mt-4 text-lg font-black text-white">Nenhum evento encontrado com esses filtros.</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">Tente explorar todos os dias ou abrir a agenda do fim de semana para descobrir novas opções.</p><Link href="/?day=&city=Todas&category=Todas&genre=#filtros" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-300 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"><CalendarSearch size={16} /> Ver os rolês do fim de semana</Link></div>}
        {!eventsQuery.isLoading && !eventsQuery.isError && events.length > 0 && <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{events.map(event => <EventCard key={event.id} event={event} />)}</div>}
      </section>
      <SiteFooter />
      <MobileBottomNav onFilters={scrollToFilters} />
    </main>
  );
}
