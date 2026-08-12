import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ExternalLink, MapPin, Share2, Ticket, TicketX } from "lucide-react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import EventShareCard from "@/components/EventShareCard";

export type EventShareData = { title: string; text: string; url: string };
export async function shareEventLink(data: EventShareData, capabilities: { share?: (data: EventShareData) => Promise<void>; writeText: (url: string) => Promise<void> }) {
  try {
    if (capabilities.share) { await capabilities.share(data); return "shared" as const; }
    await capabilities.writeText(data.url);
    return "copied" as const;
  } catch {
    return "cancelled" as const;
  }
}

export function buildSocialShareUrls(url: string, text: string) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  };
}

export default function EventDetail() {
  const [, params] = useRoute("/eventos/:slug");
  const query = trpc.events.bySlug.useQuery({ slug: params?.slug ?? "" });
  const event = query.data;
  const [shareMessage, setShareMessage] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const date = event ? new Date(event.eventDate) : new Date();
  const defaultWhatsappMessage = event ? `Confira ${event.title} no WeekendVibes — ${event.locationName}, ${event.city}.` : "Confira este evento no WeekendVibes.";
  const shareText = defaultWhatsappMessage;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const socialUrls = useMemo(() => buildSocialShareUrls(shareUrl, whatsappMessage || shareText), [shareUrl, whatsappMessage, shareText]);

  useEffect(() => {
    if (!event) return;
    document.title = `${event.title} — WeekendVibes`;
    setWhatsappMessage(defaultWhatsappMessage);
    const description = `${event.title} em ${event.locationName}, ${event.city}. ${date.toLocaleDateString("pt-BR")}.`;
    const setMeta = (property: string, content: string) => {
      let meta = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!meta) { meta = document.createElement("meta"); meta.setAttribute("property", property); document.head.appendChild(meta); }
      meta.setAttribute("content", content);
    };
    setMeta("og:title", event.title);
    setMeta("og:description", description);
    setMeta("og:url", window.location.href);
    setMeta("og:type", "event");
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", event.title);
    setMeta("twitter:description", description);
    if (event.imageUrl) {
      setMeta("og:image", event.imageUrl);
      setMeta("twitter:image", event.imageUrl);
    }
    return () => { document.title = "WeekendVibes"; };
  }, [event, date, defaultWhatsappMessage]);

  if (query.isLoading) return <main className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-400">Carregando evento...</main>;
  if (!event) return <main className="grid min-h-screen place-items-center bg-zinc-950 text-white"><div className="text-center"><h1 className="text-3xl font-black">Evento não encontrado</h1><Link href="/" className="mt-5 inline-block text-orange-300">Voltar para a agenda</Link></div></main>;

  const lat = Number(event.latitude); const lng = Number(event.longitude);
  const isSoldOut = event.ticketStatus === "sold_out" || (event.ticketStatus === undefined && (event.priceNote?.toLowerCase().includes("vendas encerradas") ?? false));
  const displayPrice = event.priceNote ?? (event.priceCents ? `R$ ${(event.priceCents / 100).toFixed(2).replace(".", ",")}` : "Grátis");
  const dateLabel = date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const timeLabel = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const cardData = { title: event.title, category: event.category, genre: event.genre, dateLabel, timeLabel, locationName: event.locationName, city: event.city, imageUrl: event.imageUrl, url: shareUrl };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setShareMessage("Link copiado"); } catch { setShareMessage("Não foi possível copiar o link"); }
  };
  const handleShare = async () => {
    const result = await shareEventLink({ title: event.title, text: shareText, url: shareUrl }, { share: navigator.share?.bind(navigator), writeText: text => navigator.clipboard.writeText(text) });
    setShareMessage(result === "copied" ? "Link copiado" : result === "cancelled" ? "Compartilhamento cancelado" : "Compartilhado");
  };
  const openSocial = (url: string) => { window.open(url, "_blank", "noopener,noreferrer"); setShareMessage("Janela de compartilhamento aberta"); };
  const openInstagram = async () => { await copyLink(); setShareMessage("Link copiado — cole no Instagram"); };

  return <main className="min-h-screen bg-zinc-950 text-zinc-100"><header className="border-b border-white/10 bg-zinc-950/85 px-4 py-4 backdrop-blur-xl"><div className="mx-auto max-w-5xl"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><ArrowLeft size={17} /> Voltar para eventos</Link></div></header><article className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12"><div className="overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900"><div className="relative h-64 sm:h-96"><img src={event.imageUrl || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80"} alt="" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />{isSoldOut && <span aria-label="Ingressos esgotados ou vendas encerradas" className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full border border-rose-200/50 bg-rose-500 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_10px_30px_-10px_rgba(244,63,94,.95)]"><TicketX size={15} strokeWidth={2.5} /> Esgotado</span>}<div className="absolute bottom-6 left-6 right-6"><span className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-black uppercase text-zinc-950">{event.category}</span><h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">{event.title}</h1></div></div><div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_320px]"><div><p className="max-w-2xl text-lg leading-relaxed text-zinc-300">{event.description || "Uma experiência especial para curtir o fim de semana na Baixada Santista."}</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><CalendarDays className="mb-3 text-orange-300" /><p className="font-bold text-white">{date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p><p className="text-sm text-zinc-400">às {timeLabel}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><MapPin className="mb-3 text-fuchsia-300" /><p className="font-bold text-white">{event.locationName}</p><p className="text-sm text-zinc-400">{event.address || event.city}</p></div></div><div className="mt-8 overflow-hidden rounded-2xl border border-white/10"><MapView className="h-72" initialCenter={{ lat: Number.isFinite(lat) ? lat : -23.96, lng: Number.isFinite(lng) ? lng : -46.33 }} initialZoom={15} onMapReady={map => { if (Number.isFinite(lat) && Number.isFinite(lng) && window.google?.maps?.marker) new window.google.maps.marker.AdvancedMarkerElement({ map, position: { lat, lng }, title: event.title }); }} /></div></div><aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><button type="button" onClick={handleShare} className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-300/30 bg-fuchsia-400/10 px-4 py-3 text-sm font-black text-fuchsia-100 transition hover:border-fuchsia-200/60 hover:bg-fuchsia-400/20 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><Share2 size={17} /> Compartilhar evento</button>{shareMessage && <p role="status" className="mb-1 text-center text-xs font-bold text-fuchsia-200">{shareMessage}</p>}<EventShareCard data={cardData} whatsappMessage={whatsappMessage} defaultWhatsappMessage={defaultWhatsappMessage} onWhatsappMessageChange={setWhatsappMessage} onResetWhatsappMessage={() => setWhatsappMessage(defaultWhatsappMessage)} onNativeShare={handleShare} onCopy={copyLink} onWhatsApp={() => openSocial(socialUrls.whatsapp)} onFacebook={() => openSocial(socialUrls.facebook)} onInstagram={openInstagram} /><p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Ingressos</p><p className={`mt-3 text-3xl font-black ${isSoldOut ? "text-rose-200" : "text-white"}`}>{displayPrice}</p>{event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-400 to-fuchsia-500 px-4 py-3 text-sm font-black text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><Ticket size={17} /> Ver ingressos <ExternalLink size={15} /></a>}<p className="mt-4 text-xs leading-relaxed text-zinc-500">Confira disponibilidade, classificação e condições diretamente na página oficial.</p></aside></div></div></article></main>;
}
