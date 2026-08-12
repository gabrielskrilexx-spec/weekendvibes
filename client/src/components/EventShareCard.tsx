import { Copy, Facebook, Instagram, MessageCircle, RotateCcw, Share2 } from "lucide-react";

export type EventShareCardData = {
  title: string;
  category: string;
  genre?: string | null;
  dateLabel: string;
  timeLabel: string;
  locationName: string;
  city: string;
  imageUrl?: string | null;
  url: string;
};

type Props = {
  data: EventShareCardData;
  whatsappMessage: string;
  defaultWhatsappMessage: string;
  onWhatsappMessageChange: (message: string) => void;
  onResetWhatsappMessage: () => void;
  onNativeShare: () => void;
  onCopy: () => void;
  onWhatsApp: () => void;
  onFacebook: () => void;
  onInstagram: () => void;
};

const WHATSAPP_MESSAGE_LIMIT = 280;

export default function EventShareCard({ data, whatsappMessage, defaultWhatsappMessage, onWhatsappMessageChange, onResetWhatsappMessage, onNativeShare, onCopy, onWhatsApp, onFacebook, onInstagram }: Props) {
  const messageId = "whatsapp-share-message";
  const remaining = WHATSAPP_MESSAGE_LIMIT - whatsappMessage.length;
  return (
    <section aria-labelledby="share-card-title" className="mt-7 rounded-2xl border border-fuchsia-300/20 bg-zinc-950/80 p-4 shadow-[0_20px_50px_-30px_rgba(217,70,239,.8)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-300">Compartilhe a vibe</p><h2 id="share-card-title" className="mt-1 text-lg font-black text-white">Card para redes sociais</h2></div>
        <Share2 aria-hidden="true" size={19} className="text-fuchsia-300" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-orange-400 via-fuchsia-600 to-purple-950 text-white">
        <div className="relative h-36"><img src={data.imageUrl || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80"} alt="" className="h-full w-full object-cover mix-blend-screen opacity-80" /><div className="absolute inset-0 bg-gradient-to-t from-purple-950 via-purple-950/20 to-transparent" /><span className="absolute left-3 top-3 rounded-full bg-yellow-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-950">{data.city}</span><p className="absolute bottom-3 left-3 right-3 text-2xl font-black leading-none tracking-tight">{data.title}</p></div>
        <div className="grid grid-cols-2 gap-3 bg-purple-950/90 p-3 text-xs"><div><p className="font-bold text-yellow-200">{data.dateLabel}</p><p className="text-white/75">às {data.timeLabel}</p></div><div><p className="font-bold text-orange-200">{data.locationName}</p><p className="text-white/75">{data.genre || data.category}</p></div></div>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center justify-between gap-2"><label htmlFor={messageId} className="text-xs font-black uppercase tracking-[0.12em] text-yellow-200">Mensagem do WhatsApp</label><span aria-live="polite" className={`text-[11px] font-bold ${remaining < 30 ? "text-orange-200" : "text-zinc-400"}`}>{whatsappMessage.length}/{WHATSAPP_MESSAGE_LIMIT}</span></div>
        <textarea id={messageId} value={whatsappMessage} maxLength={WHATSAPP_MESSAGE_LIMIT} onChange={event => onWhatsappMessageChange(event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-lg border border-white/15 bg-zinc-950/70 px-3 py-2 text-sm leading-relaxed text-white outline-none transition placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-yellow-300" aria-describedby={`${messageId}-hint`} />
        <div className="mt-2 flex items-center justify-between gap-2"><p id={`${messageId}-hint`} className="text-[11px] leading-relaxed text-zinc-500">O link do evento será incluído automaticamente.</p><button type="button" onClick={onResetWhatsappMessage} disabled={whatsappMessage === defaultWhatsappMessage} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-orange-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><RotateCcw size={13} /> Restaurar</button></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button type="button" onClick={onWhatsApp} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-black text-zinc-950 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><MessageCircle size={16} /> WhatsApp</button>
        <button type="button" onClick={onNativeShare} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-fuchsia-500 px-3 py-2 text-xs font-black text-white transition hover:bg-fuchsia-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><Share2 size={16} /> Compartilhar</button>
        <button type="button" onClick={onCopy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><Copy size={16} /> Copiar link</button>
        <button type="button" onClick={onFacebook} aria-label="Compartilhar no Facebook" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><Facebook size={16} /> Facebook</button>
        <button type="button" onClick={onInstagram} aria-label="Compartilhar no Instagram" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><Instagram size={16} /> Instagram</button>
      </div>
    </section>
  );
}
