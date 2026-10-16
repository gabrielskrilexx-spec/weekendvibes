import React from "react";
import { Building2, CalendarDays, MapPin, X } from "lucide-react";
import type { Event } from "../../../drizzle/schema";

type VenueKey = "blue-med" | "parque-valongo";

type Venue = {
  key: VenueKey;
  name: string;
  aliases: string;
  city: "Santos";
  imageUrl: string;
  description: string;
  query: string;
};

export const FEATURED_VENUES: Venue[] = [
  {
    key: "blue-med",
    name: "Blue Med Convention Center",
    aliases: "Santos Convention Center · antigo Mendes",
    city: "Santos",
    imageUrl: "https://santosconventioncenter.com.br/wp-content/uploads/2026/09/SHOW-ROBERTO-CARLOS.png",
    description: "Shows, espetáculos e grandes encontros na Ponta da Praia.",
    query: "Santos Convention Center",
  },
  {
    key: "parque-valongo",
    name: "Parque Valongo",
    aliases: "Centro histórico de Santos",
    city: "Santos",
    imageUrl: "https://turismosantos.com.br/sites/default/files/files_turismosantos/styles/node_wide/public/2026-09/japan_francisco_arrais_7397.jpg?h=501e7db7",
    description: "Um novo polo aberto para música, cultura e experiências à beira do cais.",
    query: "Parque Valongo",
  },
];

type VenueSpotlightProps = {
  selectedVenue: VenueKey | "";
  onSelect: (venue: VenueKey | "") => void;
  events: Event[];
};

export default function VenueSpotlight({ selectedVenue, onSelect, events }: VenueSpotlightProps) {
  const activeVenue = FEATURED_VENUES.find(venue => venue.key === selectedVenue);
  return (
    <section aria-labelledby="venues-heading" className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Explore por espaço</p><h2 id="venues-heading" className="mt-1 text-2xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-3xl">Palcos da Baixada</h2></div>
        {selectedVenue && <button type="button" onClick={() => onSelect("")} className="text-xs font-black uppercase tracking-wider text-orange-300 hover:text-orange-200">Limpar local</button>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURED_VENUES.map(venue => {
          const active = selectedVenue === venue.key;
          return <button key={venue.key} type="button" aria-pressed={active} onClick={() => onSelect(active ? "" : venue.key)} className={`group relative min-h-40 overflow-hidden rounded-[24px] border text-left transition duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${active ? "border-orange-300 ring-2 ring-orange-300/30" : "border-white/10"}`}>
            <img src={venue.imageUrl} alt={`Foto de ${venue.name}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/55 to-transparent" />
            <div className="relative flex min-h-40 flex-col justify-end p-5 text-white"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-orange-200"><Building2 size={14} /> {venue.city}</div><h3 className="mt-2 text-xl font-black leading-tight">{venue.name}</h3><p className="mt-1 text-xs text-zinc-300">{venue.aliases}</p></div>
          </button>;
        })}
      </div>
      {activeVenue && <div role="dialog" aria-modal="true" aria-labelledby="venue-dialog-title" className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/80 p-4 backdrop-blur-sm" onClick={() => onSelect("")}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/10 bg-zinc-900 shadow-2xl" onClick={event => event.stopPropagation()}><div className="relative h-52 sm:h-64"><img src={activeVenue.imageUrl} alt={`Foto de ${activeVenue.name}`} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent" /><button type="button" onClick={() => onSelect("")} aria-label="Fechar detalhes do local" className="absolute right-4 top-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 bg-zinc-950/70 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><X size={18} /></button><div className="absolute bottom-5 left-5 right-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-200">Local em destaque</p><h3 id="venue-dialog-title" className="mt-1 text-3xl font-black text-white">{activeVenue.name}</h3></div></div><div className="p-5 sm:p-7"><p className="text-sm leading-relaxed text-zinc-300">{activeVenue.description}</p><div className="mt-5 flex items-center gap-2 text-xs font-bold text-zinc-400"><MapPin size={15} className="text-fuchsia-300" /> {activeVenue.city} · {activeVenue.aliases}</div><div className="mt-7 flex items-center gap-2"><CalendarDays size={17} className="text-orange-300" /><h4 className="font-black text-white">Próximos eventos confirmados</h4></div>{events.length > 0 ? <ul className="mt-3 space-y-3">{events.slice(0, 6).map(event => <li key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="font-black text-white">{event.title}</p><p className="mt-1 text-xs text-zinc-400">{new Date(event.eventDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · {event.locationName}</p></li>)}</ul> : <p className="mt-3 rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400">Nenhum evento futuro publicado neste local no momento.</p>}</div></div></div>}
    </section>
  );
}
