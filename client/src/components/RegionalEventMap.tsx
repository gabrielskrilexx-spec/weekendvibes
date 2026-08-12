import React, { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Navigation, Route, Users, X } from "lucide-react";
import { MapView } from "@/components/Map";
import { clusterLabel, groupEventsByRegion, type ClusterableEvent, type EventCluster } from "@/lib/eventClusters";

interface RegionalEventMapProps {
  events: ClusterableEvent[];
}

export function directionsUrl(event: Pick<ClusterableEvent, "title" | "latitude" | "longitude">) {
  if (event.latitude === null || event.latitude === undefined || event.latitude === "" || event.longitude === null || event.longitude === undefined || event.longitude === "") return null;
  const latitude = Number(event.latitude);
  const longitude = Number(event.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitude},${longitude}`)}&travelmode=driving`;
}

function markerContent(cluster: EventCluster) {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute("aria-label", clusterLabel(cluster));
  element.style.cssText = `display:grid;place-items:center;min-width:44px;height:44px;padding:0 10px;border:2px solid white;border-radius:999px;background:${cluster.city === "Santos" ? "#f97316" : "#d946ef"};color:white;font:900 14px system-ui;box-shadow:0 6px 18px rgba(0,0,0,.4);cursor:pointer`;
  element.textContent = String(cluster.events.length);
  return element;
}

function popupContent(cluster: EventCluster) {
  const eventLinks = cluster.events.map(event => {
    const route = directionsUrl(event);
    return `<div style="border-top:1px solid #e4e4e7;padding:8px 0"><a href="/eventos/${event.slug}" style="display:block;color:#c026d3;font-weight:700;text-decoration:none">${event.title}<br><small style="color:#52525b;font-weight:500">${event.locationName}</small></a>${route ? `<a href="${route}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:5px;color:#ea580c;font-size:12px;font-weight:700;text-decoration:none">Iniciar rota ↗</a>` : ""}</div>`;
  }).join("");
  return `<div style="max-width:240px;font-family:system-ui;color:#18181b"><strong>${clusterLabel(cluster)}</strong>${eventLinks}</div>`;
}

export default function RegionalEventMap({ events }: RegionalEventMapProps) {
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const clusters = useMemo(() => groupEventsByRegion(events), [events]);

  const setupMap = (map: google.maps.Map) => {
    mapRef.current = map;
    infoWindowRef.current = new window.google.maps.InfoWindow();
  };

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setIsFullscreen(false); };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [isFullscreen]);

  useEffect(() => {
    markersRef.current.forEach(marker => { marker.map = null; });
    markersRef.current = [];
    if (!mapRef.current || !window.google?.maps?.marker) return;

    clusters.forEach(cluster => {
      const marker = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, position: { lat: cluster.latitude, lng: cluster.longitude }, title: clusterLabel(cluster), content: markerContent(cluster) });
      marker.addListener("click", () => {
        setSelectedCluster(cluster.id);
        infoWindowRef.current?.setContent(popupContent(cluster));
        infoWindowRef.current?.open({ map: mapRef.current, anchor: marker });
      });
      markersRef.current.push(marker);
    });

    if (clusters.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      clusters.forEach(cluster => bounds.extend({ lat: cluster.latitude, lng: cluster.longitude }));
      mapRef.current.fitBounds(bounds, 56);
    }

    return () => { markersRef.current.forEach(marker => { marker.map = null; }); markersRef.current = []; };
  }, [clusters, isFullscreen]);

  const focusCluster = (cluster: EventCluster) => {
    setSelectedCluster(cluster.id);
    mapRef.current?.panTo({ lat: cluster.latitude, lng: cluster.longitude });
    mapRef.current?.setZoom(14);
  };

  const mapPanel = <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-zinc-900"><MapView key={isFullscreen ? "fullscreen" : "inline"} className={isFullscreen ? "h-[calc(100vh-7rem)]" : "h-[460px]"} initialCenter={{ lat: -23.96, lng: -46.33 }} initialZoom={11} onMapReady={setupMap} /><button type="button" onClick={() => setIsFullscreen(value => !value)} aria-label={isFullscreen ? "Fechar mapa em tela cheia" : "Abrir mapa em tela cheia"} className="absolute right-3 top-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-zinc-950/85 px-4 py-2 text-xs font-black text-white shadow-lg backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300">{isFullscreen ? <X size={16} /> : <Maximize2 size={16} />}{isFullscreen ? "Fechar" : "Tela cheia"}</button></div>;

  return (
    <section aria-labelledby="regional-map-title">
      <div className="mb-4 flex items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300"><Navigation size={15} /> Explorar por região</p><h2 id="regional-map-title" className="mt-1 text-3xl font-black tracking-tight text-white">Mapa dos rolês</h2><p className="mt-1 text-sm text-zinc-500">Pins agrupam eventos próximos em Santos e Guarujá.</p></div><span className="hidden items-center gap-1 text-xs font-bold text-zinc-500 sm:flex"><Users size={14} /> {clusters.length} regiões</span></div>
      {isFullscreen ? <div role="dialog" aria-modal="true" aria-labelledby="regional-map-title" className="fixed inset-0 z-50 bg-zinc-950 p-3 sm:p-6"><div className="mx-auto flex h-full max-w-7xl flex-col"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-black text-white">Mapa regional</p><p className="text-xs text-zinc-500">Pressione Esc para fechar</p></div>{mapPanel}</div></div> : mapPanel}
      <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Regiões com eventos no mapa">{clusters.map(cluster => <div key={cluster.id} className={`rounded-2xl border p-3 transition ${selectedCluster === cluster.id ? "border-orange-300/70 bg-orange-300/10" : "border-white/10 bg-white/[0.03]"}`}><button type="button" onClick={() => focusCluster(cluster)} aria-pressed={selectedCluster === cluster.id} className="flex w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><span><span className="block text-sm font-black text-white">{cluster.city}</span><span className="block text-xs text-zinc-500">{cluster.events.map(event => event.locationName).join(" · ")}</span></span><span className="rounded-full bg-white/10 px-2 py-1 text-xs font-black text-yellow-200">{cluster.events.length}</span></button><div className="mt-2 space-y-1 border-t border-white/10 pt-2">{cluster.events.map(event => { const route = directionsUrl(event); return route ? <a key={event.id} href={route} target="_blank" rel="noopener noreferrer" aria-label={`Iniciar rota até ${event.title}`} className="inline-flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-xs font-bold text-orange-200 hover:bg-orange-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><Route size={14} /> Rota para {event.title}</a> : null; })}</div></div>)}{!clusters.length && <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-500">Nenhum evento com localização disponível para exibir no mapa.</p>}</div>
      <p className="sr-only" aria-live="polite">{selectedCluster ? `Região selecionada: ${clusters.find(cluster => cluster.id === selectedCluster)?.city ?? ""}` : "Selecione uma região para aproximar o mapa."}</p>
    </section>
  );
}
