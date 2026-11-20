import { CalendarDays, MapPin } from "lucide-react";
import { Link } from "wouter";
import type { Event } from "../../../drizzle/schema";
import { resolveVenueCoverFallback } from "../../../shared/event-media";
import { responsiveImageProps, EVENT_CARD_IMAGE_SIZES } from "@/lib/responsiveImages";

export default function RelatedEvents({ events }: { events: Event[] }) {
  if (events.length === 0) return null;
  return (
    <section aria-labelledby="related-events-heading" className="mt-10 border-t border-white/10 pt-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Para continuar o rolê</p>
          <h2 id="related-events-heading" className="mt-2 text-2xl font-black text-white">Também pode curtir</h2>
        </div>
        <span className="text-xs text-zinc-500">Mais eventos</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {events.map(event => {
          const image = event.imageUrl || resolveVenueCoverFallback(event);
          return (
            <Link
              key={event.id}
              href={`/evento/${event.id}`}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              data-testid="related-event-link"
              className="group flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-orange-300/50 hover:bg-orange-300/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            >
              <img {...responsiveImageProps(image, EVENT_CARD_IMAGE_SIZES)} alt="" loading="lazy" decoding="async" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
              <span className="min-w-0 py-1">
                <strong className="line-clamp-2 text-sm font-black leading-tight text-white group-hover:text-orange-200">{event.title}</strong>
                <span className="mt-2 flex items-center gap-1 text-xs text-zinc-400"><CalendarDays size={13} className="text-orange-300" />{new Date(event.eventDate).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</span>
                <span className="mt-1 flex items-center gap-1 truncate text-xs text-zinc-500"><MapPin size={13} className="text-fuchsia-300" />{event.locationName}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
