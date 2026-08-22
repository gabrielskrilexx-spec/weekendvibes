import React from "react";
import { CalendarDays, SlidersHorizontal } from "lucide-react";
import { Link } from "wouter";

export default function MobileBottomNav({ onFilters }: { onFilters: () => void }) {
  return <nav aria-label="Navegação principal mobile" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-zinc-950/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden">
    <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
      <Link href="/" className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-black uppercase tracking-wider text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><CalendarDays size={18} /> Agenda</Link>
      <button type="button" onClick={onFilters} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-black uppercase tracking-wider text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><SlidersHorizontal size={18} /> Filtros</button>
    </div>
  </nav>;
}
