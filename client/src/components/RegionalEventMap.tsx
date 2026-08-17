import React, { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Maximize2, Navigation, Route, Users, X } from "lucide-react";
import { MapView } from "@/components/Map";
import { BAIXADA_BOUNDS, clusterLabel, groupEventsByRegion, mapCoordinatesFor, type ClusterableEvent, type EventCluster } from "@/lib/eventClusters";
import { distanceInKm, estimateMinutes, formatDistance, formatDuration, TRAVEL_MODES, type Coordinates, type TravelMode } from "@/lib/mapTravel";

interface RegionalEventMapProps { events: ClusterableEvent[]; onVisibleEventIdsChange?: (eventIds: number[]) => void; }

type MappableEvent = Pick<ClusterableEvent, "title" | "latitude" | "longitude"> & { city?: string; slug?: string; locationName?: string; locationPrecision?: string | null };

function coordinatesFor(event: MappableEvent): Coordinates | null {
  const coordinates = mapCoordinatesFor({ ...event, city: event.city ?? "Santos" });
  return { latitude: coordinates.latitude, longitude: coordinates.longitude };
}

export function visibleEventIdsForBounds(events: ClusterableEvent[], bounds: { contains: (point: { lat: number; lng: number }) => boolean }) {
  return events.filter(event => {
    const coordinates = mapCoordinatesFor(event);
    return bounds.contains({ lat: coordinates.latitude, lng: coordinates.longitude });
  }).map(event => event.id).sort((a, b) => a - b);
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export function directionsUrl(event: MappableEvent, mode: TravelMode = "driving", origin?: Coordinates | null) {
  const destination = coordinatesFor(event);
  if (!destination) return null;
  const params = new URLSearchParams({ api: "1", destination: `${destination.latitude},${destination.longitude}`, travelmode: TRAVEL_MODES[mode].mapsMode });
  if (origin) params.set("origin", `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function travelSummary(event: MappableEvent, origin: Coordinates | null, mode: TravelMode) {
  const destination = coordinatesFor(event);
  if (!origin || !destination) return null;
  const distance = distanceInKm(origin, destination);
  return { distance, duration: estimateMinutes(distance, mode) };
}

function markerContent(cluster: EventCluster) {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute("aria-label", `${clusterLabel(cluster)}${cluster.approximate ? ". Localização aproximada" : ""}`);
  element.style.cssText = `display:grid;place-items:center;min-width:46px;height:46px;padding:0 11px;border:2px solid white;border-radius:999px;background:${cluster.city === "Santos" ? "#f97316" : "#d946ef"};color:white;font:900 14px system-ui;box-shadow:0 6px 18px rgba(0,0,0,.4);cursor:pointer`;
  element.textContent = String(cluster.events.length);
  return element;
}

function popupContent(cluster: EventCluster, mode: TravelMode, origin: Coordinates | null) {
  const featured = cluster.events[0];
  const featuredImage = featured?.imageUrl ? `<img src="${escapeHtml(featured.imageUrl)}" alt="" style="width:100%;height:92px;object-fit:cover;border-radius:10px;margin:8px 0" loading="lazy" />` : "";
  const eventLinks = cluster.events.map(event => {
    const route = directionsUrl(event, mode, origin);
    const summary = travelSummary(event, origin, mode);
    return `<div style="border-top:1px solid #e4e4e7;padding:8px 0"><a href="/eventos/${encodeURIComponent(event.slug)}" style="display:block;color:#c026d3;font-weight:700;text-decoration:none">${escapeHtml(event.title)}<br><small style="color:#52525b;font-weight:500">${escapeHtml(event.locationName)}</small></a>${summary ? `<small style="display:block;margin-top:4px;color:#52525b">${formatDistance(summary.distance)} · ${formatDuration(summary.duration)} · ${TRAVEL_MODES[mode].label}</small>` : ""}${route ? `<a href="${route}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:5px;color:#ea580c;font-size:12px;font-weight:700;text-decoration:none">Como chegar de ${TRAVEL_MODES[mode].label.toLowerCase()} ↗</a>` : ""}</div>`;
  }).join("");
  const approximate = cluster.approximate ? `<small style="display:block;color:#a16207;background:#fef3c7;padding:5px 7px;border-radius:6px">Endereço aproximado</small>` : "";
  return `<div style="max-width:260px;font-family:system-ui;color:#18181b"><strong>${escapeHtml(clusterLabel(cluster))}</strong>${featuredImage}${approximate}${eventLinks}</div>`;
}

export default function RegionalEventMap({ events, onVisibleEventIdsChange }: RegionalEventMapProps) {
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ready" | "denied" | "unavailable">("idle");
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const clusterMarkersRef = useRef(new Map<string, google.maps.marker.AdvancedMarkerElement>());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const travelModeRef = useRef(travelMode);
  const userLocationRef = useRef(userLocation);
  const eventsRef = useRef(events);
  const visibleCallbackRef = useRef(onVisibleEventIdsChange);
  const clusters = useMemo(() => groupEventsByRegion(events), [events]);

  useEffect(() => { travelModeRef.current = travelMode; }, [travelMode]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => { eventsRef.current = events; visibleCallbackRef.current = onVisibleEventIdsChange; }, [events, onVisibleEventIdsChange]);
  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationStatus("unavailable"); return; }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(position => { setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocationStatus("ready"); }, error => { setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"); }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
  };

  const setupMap = (map: google.maps.Map) => {
    mapRef.current = map;
    infoWindowRef.current = new window.google.maps.InfoWindow();
    map.setOptions({ restriction: { latLngBounds: BAIXADA_BOUNDS, strictBounds: false } });
    const publishVisibleEvents = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      visibleCallbackRef.current?.(visibleEventIdsForBounds(eventsRef.current, bounds));
    };
    map.addListener("idle", publishVisibleEvents);
    map.fitBounds(BAIXADA_BOUNDS, 24);
    window.setTimeout(publishVisibleEvents, 0);
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
      marker.addListener("click", () => { setSelectedCluster(cluster.id); infoWindowRef.current?.setContent(popupContent(cluster, travelModeRef.current, userLocationRef.current)); infoWindowRef.current?.open({ map: mapRef.current, anchor: marker }); });
      markersRef.current.push(marker);
      clusterMarkersRef.current.set(cluster.id, marker);
    });
    if (clusters.length > 1) { const bounds = new window.google.maps.LatLngBounds(); clusters.forEach(cluster => bounds.extend({ lat: cluster.latitude, lng: cluster.longitude })); mapRef.current.fitBounds(bounds, 56); }
    return () => { markersRef.current.forEach(marker => { marker.map = null; }); markersRef.current = []; clusterMarkersRef.current.clear(); };
  }, [clusters]);

  useEffect(() => {
    if (!selectedCluster || !mapRef.current || !infoWindowRef.current) return;
    const cluster = clusters.find(item => item.id === selectedCluster);
    const marker = clusterMarkersRef.current.get(selectedCluster);
    if (!cluster || !marker) return;
    infoWindowRef.current.setContent(popupContent(cluster, travelMode, userLocation));
    infoWindowRef.current.open({ map: mapRef.current, anchor: marker });
  }, [clusters, selectedCluster, travelMode, userLocation]);

  const focusCluster = (cluster: EventCluster) => { setSelectedCluster(cluster.id); mapRef.current?.panTo({ lat: cluster.latitude, lng: cluster.longitude }); mapRef.current?.setZoom(14); };
  const locationMessage = locationStatus === "denied" ? "Permissão de localização negada. Você ainda pode iniciar a rota sem estimativa." : locationStatus === "unavailable" ? "Não foi possível acessar sua localização neste dispositivo." : locationStatus === "loading" ? "Buscando sua localização..." : "Ative sua localização para ver distância e tempo estimado.";

  const travelControls = <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-yellow-200">Deslocamento</p><p className="mt-1 text-xs text-zinc-500">{locationStatus === "ready" ? "Distâncias calculadas a partir da sua localização atual." : locationMessage}</p></div><button type="button" onClick={requestLocation} disabled={locationStatus === "loading"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-orange-300/40 px-3 text-xs font-black text-orange-200 transition hover:bg-orange-300/10 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><LocateFixed size={15} />{locationStatus === "ready" ? "Atualizar localização" : "Usar minha localização"}</button></div><label className="mt-3 block text-xs font-bold text-zinc-400">Meio de transporte<select aria-label="Escolha o meio de transporte" value={travelMode} onChange={event => setTravelMode(event.target.value as TravelMode)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 sm:max-w-xs">{Object.entries(TRAVEL_MODES).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}</select></label></div>;

  const renderEventRoute = (event: ClusterableEvent) => {
    const route = directionsUrl(event, travelMode, userLocation);
    const summary = travelSummary(event, userLocation, travelMode);
    if (!route) return null;
    return <div key={event.id} className="mt-2 border-t border-white/10 pt-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs text-zinc-500">{event.title}</span>{summary && <span className="shrink-0 text-xs font-bold text-yellow-200">{formatDistance(summary.distance)} · {formatDuration(summary.duration)}</span>}</div><a href={route} target="_blank" rel="noopener noreferrer" aria-label={`Iniciar rota de ${TRAVEL_MODES[travelMode].label.toLowerCase()} até ${event.title}`} className="mt-1 inline-flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-xs font-bold text-orange-200 hover:bg-orange-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><Route size={14} /> Iniciar rota de {TRAVEL_MODES[travelMode].label.toLowerCase()}</a></div>;
  };

  const mapPanel = <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-zinc-900"><MapView key={isFullscreen ? "fullscreen" : "inline"} className={isFullscreen ? "h-[calc(100vh-7rem)]" : "h-[460px]"} initialCenter={{ lat: -23.96, lng: -46.33 }} initialZoom={11} onMapReady={setupMap} mapOptions={{ styles: [{ elementType: "geometry", stylers: [{ color: "#17151b" }] }, { elementType: "labels.text.stroke", stylers: [{ color: "#17151b" }] }, { elementType: "labels.text.fill", stylers: [{ color: "#a1a1aa" }] }, { featureType: "poi", stylers: [{ visibility: "off" }] }, { featureType: "transit", stylers: [{ visibility: "off" }] }, { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d2933" }] }, { featureType: "water", stylers: [{ color: "#101c2d" }] }] }} /><button type="button" onClick={() => setIsFullscreen(value => !value)} aria-label={isFullscreen ? "Fechar mapa em tela cheia" : "Abrir mapa em tela cheia"} className="absolute right-3 top-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-zinc-950/85 px-4 py-2 text-xs font-black text-white shadow-lg backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300">{isFullscreen ? <X size={16} /> : <Maximize2 size={16} />}{isFullscreen ? "Fechar" : "Tela cheia"}</button></div>;

  return <section aria-labelledby="regional-map-title"><div className="mb-4 flex items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300"><Navigation size={15} /> Explorar por região</p><h2 id="regional-map-title" className="mt-1 text-3xl font-black tracking-tight text-white">Mapa dos rolês</h2><p className="mt-1 text-sm text-zinc-500">Pins agrupam eventos próximos em Santos e Guarujá.</p></div><span className="hidden items-center gap-1 text-xs font-bold text-zinc-500 sm:flex"><Users size={14} /> {clusters.length} regiões</span></div>{isFullscreen ? <div role="dialog" aria-modal="true" aria-labelledby="regional-map-title" className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950 p-3 sm:p-6"><div className="mx-auto flex min-h-full max-w-7xl flex-col"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-black text-white">Mapa regional</p><p className="text-xs text-zinc-500">Pressione Esc para fechar</p></div>{mapPanel}{travelControls}</div></div> : <>{mapPanel}{travelControls}</>}<div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Regiões com eventos no mapa">{clusters.map(cluster => <div key={cluster.id} className={`rounded-2xl border p-3 transition ${selectedCluster === cluster.id ? "border-orange-300/70 bg-orange-300/10" : "border-white/10 bg-white/[0.03]"}`}><button type="button" onClick={() => focusCluster(cluster)} aria-pressed={selectedCluster === cluster.id} className="flex w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><span><span className="block text-sm font-black text-white">{cluster.city}</span><span className="block text-xs text-zinc-500">{cluster.events.map(event => event.locationName).join(" · ")}</span>{cluster.approximate && <span className="mt-1 block text-[11px] font-bold text-yellow-200">Endereço aproximado</span>}</span><span className="rounded-full bg-white/10 px-2 py-1 text-xs font-black text-yellow-200">{cluster.events.length}</span></button>{cluster.events.map(renderEventRoute)}</div>)}{!clusters.length && <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-500">Nenhum evento com localização disponível para exibir no mapa.</p>}</div><p className="sr-only" aria-live="polite">{selectedCluster ? `Região selecionada: ${clusters.find(cluster => cluster.id === selectedCluster)?.city ?? ""}` : "Selecione uma região para aproximar o mapa."}</p></section>;
}
