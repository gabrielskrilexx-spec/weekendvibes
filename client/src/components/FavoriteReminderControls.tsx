import React from "react";
import { Bell, Heart, LogIn } from "lucide-react";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export default function FavoriteReminderControls({ eventId }: { eventId: number }) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const favorites = trpc.events.favoriteIds.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const reminders = trpc.events.reminders.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const toggleFavorite = trpc.events.toggleFavorite.useMutation({ onSuccess: () => utils.events.favoriteIds.invalidate() });
  const setReminder = trpc.events.setReminder.useMutation({ onSuccess: () => utils.events.reminders.invalidate() });
  const isFavorite = Boolean(favorites.data?.includes(eventId));
  const reminder = reminders.data?.find(item => item.eventId === eventId);
  const [hoursBefore, setHoursBefore] = React.useState(String(reminder?.hoursBefore ?? 24));

  const requireLogin = () => { if (!isAuthenticated) startLogin(); };
  const onFavorite = () => {
    if (!isAuthenticated) return requireLogin();
    toggleFavorite.mutate({ eventId });
  };
  const onReminder = () => {
    if (!isAuthenticated) return requireLogin();
    setReminder.mutate({ eventId, active: !reminder, hoursBefore: Number(hoursBefore) as 3 | 24 | 72 });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Preferência do evento">
      <button type="button" onClick={onFavorite} disabled={toggleFavorite.isPending} aria-busy={toggleFavorite.isPending} aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${isFavorite ? "border-rose-300/60 bg-rose-400/15 text-rose-200" : "border-white/10 text-zinc-400 hover:border-rose-300/50 hover:text-rose-200"}`}>
        <Heart size={14} fill={isFavorite ? "currentColor" : "none"} /> {isFavorite ? "Favorito" : "Favoritar"}
      </button>
      {isAuthenticated ? (
        <>
          <select aria-label="Antecedência do lembrete" value={hoursBefore} onChange={event => setHoursBefore(event.target.value)} className="rounded-full border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300">
            <option value="3">3h antes</option><option value="24">24h antes</option><option value="72">3 dias antes</option>
          </select>
          <button type="button" onClick={onReminder} disabled={setReminder.isPending} aria-busy={setReminder.isPending} aria-label={reminder ? "Desativar lembrete do evento" : "Ativar lembrete do evento"} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${reminder ? "border-yellow-300/60 bg-yellow-300/15 text-yellow-100" : "border-white/10 text-zinc-400 hover:border-yellow-300/50 hover:text-yellow-100"}`}>
            <Bell size={14} /> {reminder ? "Lembrete ativo" : "Lembrar-me"}
          </button>
        </>
      ) : <button type="button" onClick={requireLogin} aria-label="Entrar para salvar favoritos e lembretes" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"><LogIn size={13} /> Entrar para salvar</button>}
    </div>
  );
}
