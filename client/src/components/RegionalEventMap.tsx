import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Navigation, Users } from "lucide-react";
import { MapView } from "@/components/Map";
import { clusterLabel, groupEventsByRegion, type ClusterableEvent, type EventCluster } from "@/lib/eventClusters";

interface RegionalEventMapProps {
  events: ClusterableEvent[];
}

function markerContent(cluster: EventCluster) {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute("aria-label", clusterLabel(cluster));
  element.style.cssText = `display:grid;place-items:center;min-width:44px;height:44px;padding:0 10px;border:2px solid white;border-radius:999px;background:${cluster.city === "Santos" ? "#f97316" : "#d946ef"};color:white;font:900 14px system-ui;box-shadow:0 6px 18px rgba(0,0,0,.4);cursor:pointer`;
  element.textContent = String(cluster.events.length);
  return element;
}

export default function RegionalEventMap({ events }: RegionalEventMapProps) {
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const clusters = useMemo(() => groupEventsByRegion(events), [events]);

  const setupMap = (map: google.maps.Map) => {
    mapRef.current = map;
    infoWindowRef.current = new window.google.maps.InfoWindow();
  };

  useEffect(() => {
    markersRef.current.forEach(marker => { marker.map = null; });
    markersRef.current = [];
    if (!mapRef.current || !window.google?.maps?.marker) return;

    clusters.forEach(cluster => {
      const content = markerContent(cluster);
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: { lat: cluster.latitude, lng: cluster.longitude },
        title: clusterLabel(cluster),
        content,
      });
      marker.addListener("click", () => {
        setSelectedCluster(cluster.id);
        const eventLinks = cluster.events.map(event => `<a href="/eventos/${event.slug}" style="display:block;padding:8px 0;color:#c026d3;font-weight:700;text-decoration:none">${event.title}<br><small style="color:#52525b;font-weight:500">${event.locationName}</small></a>`).join("");
        infoWindowRef.current?.setContent(`<div style="max-width:240px;font-family:system-ui;color:#18181b"><strong>${clusterLabel(cluster)}</strong>${eventLinks}</div>`);
        infoWindowRef.current?.open({ map: mapRef.current, anchor: marker });
      });
      markersRef.current.push(marker);
    });

    if (clusters.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      clusters.forEach(cluster => bounds.extend({ lat: cluster.latitude, lng: cluster.longitude }));
      mapRef.current.fitBounds(bounds, 56);
    }

    return () => {
      markersRef.current.forEach(marker => { marker.map = null; });
      markersRef.current = [];
    };
  }, [clusters]);

  return (
    <section aria-labelledby="regional-map-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300"><Navigation size={15} /> Explorar por região</p><h2 id="regional-map-title" className="mt-1 text-3xl font-black tracking-tight text-white">Mapa dos rolês</h2><p className="mt-1 text-sm text-zinc-500">Pins agrupam eventos próximos em Santos e Guarujá.</p></div>
        <span className="hidden items-center gap-1 text-xs font-bold text-zinc-500 sm:flex"><Users size={14} /> {clusters.length} regiões</span>
      </div>
      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-zinc-900"><MapView className="h-[460px]" initialCenter={{ lat: -23.96, lng: -46.33 }} initialZoom={11} onMapReady={setupMap} /></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Regiões com eventos no mapa">
        {clusters.map(cluster => <button type="button" key={cluster.id} onClick={() => { setSelectedCluster(cluster.id); mapRef.current?.panTo({ lat: cluster.latitude, lng: cluster.longitude }); mapRef.current?.setZoom(14); }} aria-pressed={selectedCluster === cluster.id} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${selectedCluster === cluster.id ? "border-orange-300/70 bg-orange-300/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}><span><span className="block text-sm font-black text-white">{cluster.city}</span><span className="block text-xs text-zinc-500">{cluster.events.map(event => event.locationName).join(" · ")}</span></span><span className="rounded-full bg-white/10 px-2 py-1 text-xs font-black text-yellow-200">{cluster.events.length}</span></button>)}
        {!clusters.length && <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-500">Nenhum evento com localização disponível para exibir no mapa.</p>}
      </div>
      <p className="sr-only" aria-live="polite">{selectedCluster ? `Região selecionada: ${clusters.find(cluster => cluster.id === selectedCluster)?.city ?? ""}` : "Selecione uma região para aproximar o mapa."}</p>
    </section>
  );
}
