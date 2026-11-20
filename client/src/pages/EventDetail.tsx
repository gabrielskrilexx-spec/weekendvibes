import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ExternalLink, Info, Instagram, MapPin, Share2, Ticket, TicketX } from "lucide-react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import RelatedEvents from "@/components/RelatedEvents";
import EventShareCard from "@/components/EventShareCard";
import FavoriteReminderControls from "@/components/FavoriteReminderControls";
import { buildGoogleCalendarUrl, buildIcsCalendar } from "@/lib/calendarLinks";
import { responsiveImageProps, EVENT_DETAIL_IMAGE_SIZES } from "@/lib/responsiveImages";
import { isInstagramEvent, resolveEventActionCta } from "@/lib/event-action";
import { buildEventShareUrl } from "../../../shared/related-events";
import { trackEngagement } from "@/lib/analytics";
import { canonicalVenueSlug } from "../../../shared/venue-slugs";

const EventDetailMap = lazy(() => import("@/components/EventDetailMap"));

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
  const [, idParams] = useRoute("/evento/:id");
  const slugQuery = trpc.events.bySlug.useQuery({ slug: params?.slug || "evento-invalido" }, { enabled: Boolean(params?.slug) });
  const numericId = idParams?.id && /^\d+$/.test(idParams.id) ? Number(idParams.id) : 0;
  const idQuery = trpc.events.byId.useQuery({ id: numericId || 1 }, { enabled: numericId > 0 });
  const event = idQuery.data ?? slugQuery.data;
  const relatedQuery = trpc.events.related.useQuery({ eventId: event?.id ?? 1, limit: 4 }, { enabled: Boolean(event?.id), staleTime: 60_000 });
  const isLoading = idQuery.isLoading || slugQuery.isLoading;
  const [shareMessage, setShareMessage] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const date = event ? new Date(event.eventDate) : new Date();
  const defaultWhatsappMessage = event ? `Confira ${event.title} no WeekendVibes — ${event.locationName}, ${event.city}.` : "Confira este evento no WeekendVibes.";
  const shareText = defaultWhatsappMessage;
  const shareUrl = useMemo(() => event ? buildEventShareUrl(event.id) : "", [event?.id]);
  const socialUrls = useMemo(() => buildSocialShareUrls(shareUrl, whatsappMessage || shareText), [shareUrl, whatsappMessage, shareText]);

  useEffect(() => {
    if (!event) return;
    const socialTitle = `${event.title} — WeekendVibes`;
    document.title = socialTitle;
    setWhatsappMessage(defaultWhatsappMessage);
    const socialDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(date);
    const description = [event.description?.trim(), [event.locationName, event.city].filter(Boolean).join(", "), socialDate].filter(Boolean).join(" · ").slice(0, 180);
    const setMeta = (attribute: "property" | "name", key: string, content: string) => {
      let meta = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
      if (!meta) { meta = document.createElement("meta"); meta.setAttribute(attribute, key); document.head.appendChild(meta); }
      meta.setAttribute("content", content);
    };
    setMeta("name", "description", description);
    setMeta("property", "og:title", socialTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", "event");
    setMeta("property", "og:site_name", "WeekendVibes");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", socialTitle);
    setMeta("name", "twitter:description", description);
    const canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const priorPublicUrl = canonical?.href || document.head.querySelector('meta[property="og:url"]')?.getAttribute("content") || "";
    let publicOrigin: string | undefined;
    try { publicOrigin = priorPublicUrl ? new URL(priorPublicUrl).origin : undefined; } catch { publicOrigin = undefined; }
    if (publicOrigin) {
      const canonicalUrl = idParams?.id && /^\d+$/.test(idParams.id)
        ? `${publicOrigin}/evento/${encodeURIComponent(idParams.id)}`
        : `${publicOrigin}/eventos/${encodeURIComponent(event.slug)}`;
      if (canonical) canonical.href = canonicalUrl;
      setMeta("property", "og:url", canonicalUrl);
      const imageUrl = `${publicOrigin}/og/event/${encodeURIComponent(event.slug)}.png`;
      setMeta("property", "og:image", imageUrl);
      setMeta("property", "og:image:type", "image/png");
      setMeta("property", "og:image:width", "1200");
      setMeta("property", "og:image:height", "630");
      setMeta("name", "twitter:image", imageUrl);
    }
    return () => { document.title = "WeekendVibes"; };
  }, [event, date, defaultWhatsappMessage, idParams?.id]);

  if (isLoading) return <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-400" role="status" aria-label="Carregando evento"><div className="content-fade-in mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900"><div className="h-64 animate-pulse bg-zinc-800 sm:h-96" /><div className="space-y-4 p-6 sm:p-10"><div className="h-8 w-3/4 animate-pulse rounded-full bg-white/10" /><div className="h-4 w-full animate-pulse rounded-full bg-white/10" /><div className="h-4 w-2/3 animate-pulse rounded-full bg-white/10" /></div></div></main>;
  if (!event) return <main className="grid min-h-screen place-items-center bg-zinc-950 text-white"><div className="text-center"><h1 className="text-3xl font-black">Evento não encontrado</h1><Link href="/" className="mt-5 inline-block text-orange-300">Voltar para a agenda</Link></div></main>;

  const isSoldOut = event.ticketStatus === "sold_out" || (event.ticketStatus === undefined && (event.priceNote?.toLowerCase().includes("vendas encerradas") ?? false));
  const action = resolveEventActionCta(event as typeof event & { ticketUrl?: string | null });
  const displayPrice = event.priceNote ?? (event.priceCents ? `R$ ${(event.priceCents / 100).toFixed(2).replace(".", ",")}` : isInstagramEvent(event) ? (action.kind === "instagram" ? "Consultar no Instagram" : "Consultar valores") : "Grátis");
  const dateLabel = date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const timeLabel = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const cardData = { title: event.title, category: event.category, genre: event.genre, dateLabel, timeLabel, locationName: event.locationName, city: event.city, imageUrl: event.imageUrl, url: shareUrl };
  const detailImage = event.imageUrl || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80";
  const detailImageProps = responsiveImageProps(detailImage, EVENT_DETAIL_IMAGE_SIZES);
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setShareMessage("Link copiado"); } catch { setShareMessage("Não foi possível copiar o link"); }
  };
  const handleShare = async () => {
    const result = await shareEventLink({ title: event.title, text: shareText, url: shareUrl }, { share: navigator.share?.bind(navigator), writeText: text => navigator.clipboard.writeText(text) });
    if (result !== "cancelled") trackEngagement({ eventType: "event_share_clicked", eventId: event.id, venueSlug: canonicalVenueSlug(event.locationName), channel: result === "copied" ? "clipboard" : "native", source: "detail" });
    setShareMessage(result === "copied" ? "Link copiado" : result === "cancelled" ? "Compartilhamento cancelado" : "Compartilhado");
  };
  const openSocial = (url: string) => { window.open(url, "_blank", "noopener,noreferrer"); setShareMessage("Janela de compartilhamento aberta"); };
  const trackCta = () => { if (action.url) trackEngagement({ eventType: "ticket_cta_clicked", eventId: event.id, venueSlug: canonicalVenueSlug(event.locationName), source: "detail" }); };
  const openInstagram = async () => { await copyLink(); setShareMessage("Link copiado — cole no Instagram"); };
  const calendarInput = { title: event.title, start: event.eventDate, end: event.endDate, description: event.description, location: [event.locationName, event.address, event.city].filter(Boolean).join(", "), url: shareUrl };
  const openGoogleCalendar = () => { window.open(buildGoogleCalendarUrl(calendarInput), "_blank", "noopener,noreferrer"); setShareMessage("Google Calendar aberto"); };
  const downloadAppleCalendar = () => { const blob = new Blob([buildIcsCalendar(calendarInput)], { type: "text/calendar;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${event.slug}.ics`; link.click(); URL.revokeObjectURL(link.href); setShareMessage("Arquivo do Apple Calendar baixado"); };

  return <main className="content-fade-in min-h-screen bg-zinc-950 pb-24 text-zinc-100 md:pb-0"><header className="border-b border-white/10 bg-zinc-950/85 px-4 py-4 backdrop-blur-xl"><div className="mx-auto max-w-5xl"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><ArrowLeft size={17} /> Voltar para eventos</Link></div></header><article className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12"><div className="overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900"><div className="relative h-64 sm:h-96"><img {...detailImageProps} alt={`Flyer do evento ${event.title} em ${event.locationName}`} width={1200} height={630} loading="eager" decoding="async" fetchPriority="high" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />{isSoldOut && <span aria-label="Ingressos esgotados ou vendas encerradas" className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full border border-rose-200/50 bg-rose-500 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_10px_30px_-10px_rgba(244,63,94,.95)]"><TicketX size={15} strokeWidth={2.5} /> Esgotado</span>}<div className="absolute bottom-6 left-6 right-6"><span className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-black uppercase text-zinc-950">{event.category}</span><h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">{event.title}</h1>{action.kind === "ticket" && <span data-testid="event-detail-source-badge-ticket" aria-label="Fonte: bilheteria externa" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-orange-300/40 bg-orange-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-orange-800 dark:border-orange-300/30 dark:bg-orange-400/15 dark:text-orange-200"><Ticket size={12} aria-hidden="true" /> Bilheteria externa</span>}{action.kind === "instagram" && <span data-testid="event-detail-source-badge-instagram" aria-label="Fonte: publicação do Instagram" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-fuchsia-300/40 bg-fuchsia-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-fuchsia-800 dark:border-fuchsia-300/30 dark:bg-fuchsia-400/15 dark:text-fuchsia-200"><Instagram size={12} aria-hidden="true" /> Publicado no Instagram</span>}</div></div><div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_320px]"><div><p className="max-w-2xl text-lg leading-relaxed text-zinc-300">{event.description || "Uma experiência especial para curtir o fim de semana na Baixada Santista."}</p><div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><CalendarDays className="mb-3 text-orange-300" /><p className="font-bold text-white">{date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p><p className="text-sm text-zinc-400">às {timeLabel}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><MapPin className="mb-3 text-fuchsia-300" /><Link href={`/palcos/${canonicalVenueSlug(event.locationName)}`} className="font-bold text-white hover:text-orange-200">{event.locationName}</Link><p className="text-sm text-zinc-400">{event.address || event.city}</p></div></div><Suspense fallback={<div className="mt-6 h-24 rounded-2xl border border-white/10 bg-white/[0.03]" />}><EventDetailMap event={{ title: event.title, locationName: event.locationName, address: event.address, city: event.city, eventDate: event.eventDate, latitude: event.latitude, longitude: event.longitude }} /></Suspense><RelatedEvents events={relatedQuery.data ?? []} /></div><aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><FavoriteReminderControls eventId={event.id} favoriteLabel="Acompanhar marca" /><button type="button" onClick={handleShare} className="mt-3 mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-300/30 bg-fuchsia-400/10 px-4 py-3 text-sm font-black text-fuchsia-100 transition hover:border-fuchsia-200/60 hover:bg-fuchsia-400/20 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><Share2 size={17} /> Compartilhar evento</button>{shareMessage && <p role="status" className="mb-1 text-center text-xs font-bold text-fuchsia-200">{shareMessage}</p>}<EventShareCard data={cardData} whatsappMessage={whatsappMessage} defaultWhatsappMessage={defaultWhatsappMessage} onWhatsappMessageChange={setWhatsappMessage} onResetWhatsappMessage={() => setWhatsappMessage(defaultWhatsappMessage)} onNativeShare={handleShare} onCopy={copyLink} onWhatsApp={() => openSocial(socialUrls.whatsapp)} onFacebook={() => openSocial(socialUrls.facebook)} onInstagram={openInstagram} onGoogleCalendar={openGoogleCalendar} onAppleCalendar={downloadAppleCalendar} /><p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Ingressos</p><p className={`mt-3 flex items-center gap-2 text-3xl font-black ${isSoldOut ? "text-rose-200" : "text-white"}`}>{isInstagramEvent(event) && !event.priceNote && !event.priceCents ? <Info size={22} className="shrink-0" /> : <Ticket size={22} className="shrink-0" />}{displayPrice}</p>{action.url && <a href={action.url} onClick={trackCta} target="_blank" rel="noreferrer" className={`mt-5 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${action.kind === "ticket" ? "bg-orange-400" : "bg-fuchsia-500"}`}>{action.kind === "ticket" ? <Ticket size={17} /> : <Instagram size={17} />} {action.label} <ExternalLink size={15} /></a>}<p className="mt-4 text-xs leading-relaxed text-zinc-500">Confira disponibilidade, classificação e condições diretamente na página oficial.</p></aside></div></div></article><div data-testid="mobile-event-action-bar" className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-white/10 bg-zinc-950/95 px-3 pt-2 shadow-[0_-12px_30px_-18px_rgba(0,0,0,.9)] backdrop-blur-xl md:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}><button type="button" onClick={handleShare} aria-label="Compartilhar evento" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-fuchsia-300/30 text-fuchsia-200"><Share2 size={18} /></button><FavoriteReminderControls eventId={event.id} compact /><a href={action.url || undefined} aria-disabled={!action.url} onClick={clickEvent => { if (!action.url) clickEvent.preventDefault(); else trackEngagement({ eventType: "ticket_cta_clicked", eventId: event.id, venueSlug: canonicalVenueSlug(event.locationName), source: "mobile_bar" }); }} target="_blank" rel="noreferrer" className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-black ${action.kind === "ticket" ? "bg-orange-300 text-zinc-950" : "bg-fuchsia-500 text-white"} ${!action.url ? "opacity-50" : ""}`}>{action.kind === "ticket" ? <Ticket size={15} /> : <Instagram size={15} />} {action.label}</a></div></main>;
}
