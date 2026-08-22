import React, { lazy, Suspense } from "react";
import { ExternalLink, MapPinned, Navigation } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";

const LazyMapView = lazy(() => import("@/components/Map").then(({ MapView }) => ({ default: MapView })));

type EventMapData = {
  title: string;
  locationName: string;
  address?: string | null;
  city: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
};

export function hasValidCoordinates(latitude: EventMapData["latitude"], longitude: EventMapData["longitude"]) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined || (typeof latitude === "string" && latitude.trim() === "") || (typeof longitude === "string" && longitude.trim() === "")) return false;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function buildGoogleMapsRouteUrl(event: EventMapData) {
  const destination = hasValidCoordinates(event.latitude, event.longitude) ? `${event.latitude},${event.longitude}` : [event.locationName, event.address, event.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function buildGoogleMapsNearbyUrl(event: EventMapData) {
  const query = [event.locationName, event.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function MapFallback({ event, compact = false }: { event: EventMapData; compact?: boolean }) {
  return <div className={`grid min-h-72 place-items-center bg-zinc-950 px-6 py-8 text-center ${compact ? "min-h-56" : ""}`} role="alert">
    <div className="max-w-sm"><MapPinned className="mx-auto text-orange-300" size={28} /><h3 className="mt-3 font-black text-white">Mapa temporariamente indisponível</h3><p className="mt-2 text-sm leading-relaxed text-zinc-400">Você ainda pode abrir a rota diretamente no Google Maps.</p><a href={buildGoogleMapsRouteUrl(event)} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-300 px-4 text-xs font-black text-zinc-950 transition hover:bg-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"><Navigation size={15} /> Ver rota no Google Maps <ExternalLink size={14} /></a></div>
  </div>;
}

function MapSkeleton() {
  return <div className="grid min-h-72 place-items-center animate-pulse bg-zinc-900" role="status" aria-label="Carregando mapa"><div className="space-y-3 text-center"><div className="mx-auto h-12 w-12 rounded-full bg-white/10" /><div className="h-3 w-44 rounded-full bg-white/10" /><div className="h-2 w-64 rounded-full bg-white/[0.06]" /></div></div>;
}

export default function EventDetailMap({ event }: { event: EventMapData }) {
  const valid = hasValidCoordinates(event.latitude, event.longitude);
  const lat = Number(event.latitude);
  const lng = Number(event.longitude);
  return <section aria-labelledby="event-map-title" className="mt-8 overflow-hidden rounded-2xl border border-white/10">
    <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-orange-200">Como chegar</p><h2 id="event-map-title" className="mt-1 font-black text-white">{event.locationName}</h2></div><div className="flex flex-wrap gap-2"><a href={buildGoogleMapsRouteUrl(event)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-orange-300/30 bg-orange-300/10 px-3 text-xs font-black text-orange-100 transition hover:bg-orange-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"><Navigation size={14} /> Traçar rota</a><a href={buildGoogleMapsNearbyUrl(event)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-fuchsia-300/30 bg-fuchsia-300/10 px-3 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-200"><MapPinned size={14} /> Pontos próximos</a></div></div>
    {!valid ? <MapFallback event={event} compact /> : <ErrorBoundary fallback={<MapFallback event={event} />}><Suspense fallback={<MapSkeleton />}><LazyMapView className="h-72 min-h-72" initialCenter={{ lat, lng }} initialZoom={15} onMapReady={map => { if (window.google?.maps?.marker) new window.google.maps.marker.AdvancedMarkerElement({ map, position: { lat, lng }, title: event.title }); }} /></Suspense></ErrorBoundary>}
  </section>;
}
