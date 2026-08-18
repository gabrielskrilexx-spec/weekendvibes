import React, { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Maximize2, Navigation, Route, Users, X } from "lucide-react";
import { MapView, WEEKENDVIBES_MAP_STYLE } from "@/components/Map";
import { BAIXADA_BOUNDS, clusterLabel, groupEventsByRegion, mapCoordinatesFor, type ClusterableEvent, type EventCluster } from "@/lib/eventClusters";
import { distanceInKm, estimateMinutes, formatDistance, formatDuration, TRAVEL_MODES, type Coordinates, type TravelMode } from "@/lib/mapTravel";
import { createDirectionsCache, type ShortLivedCache } from "@/lib/shortLivedCache";
import { MarkerClusterer } from "@googlemaps/markerclusterer";

interface RegionalEventMapProps { events: ClusterableEvent[]; onVisibleEventIdsChange?: (eventIds: number[]) => void; }

type MappableEvent = Pick<ClusterableEvent, "title" | "latitude" | "longitude"> & { city?: string; slug?: string; locationName?: string; locationPrecision?: string | null };
type RoutesApiLike = { computeRoutes: (request: Record<string, unknown>) => Promise<{ routes?: unknown[] }> };
export type MapFilterState = { Santos: boolean; "Guarujá": boolean; exact: boolean; approximate: boolean };
export function filterEventsForMap(events: ClusterableEvent[], filters: MapFilterState) {
  return events.filter(event => {
    const city = event.city === "Guarujá" ? "Guarujá" : "Santos";
    const approximate = event.locationPrecision === "approximate" || event.locationPrecision === "approximate_city";
    return filters[city] && filters[approximate ? "approximate" : "exact"];
  });
}

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

export interface LiveRouteDetails { distanceText: string; durationText: string; steps: string[]; }
type DirectionsResultLike = { routes?: Array<{ distanceMeters?: number | null; duration?: string | null; localizedValues?: { distance?: { text?: string | null }; duration?: { text?: string | null } }; legs?: Array<{ distance?: { text?: string | null }; duration?: { text?: string | null } | string | null; distanceMeters?: number | null; localizedValues?: { distance?: { text?: string | null }; duration?: { text?: string | null } }; steps?: Array<{ instructions?: string | null }> }> }> };

function formatRoutesDistance(meters: number) {
  if (!Number.isFinite(meters)) return "";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(meters)} m`;
}

function formatRoutesDuration(duration: string | null | undefined) {
  if (!duration) return "";
  const seconds = Number.parseFloat(duration.replace("s", ""));
  if (!Number.isFinite(seconds)) return duration;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function routeText(route: NonNullable<DirectionsResultLike["routes"]>[number]) {
  const leg = route.legs?.[0];
  const distanceText = route.localizedValues?.distance?.text ?? leg?.localizedValues?.distance?.text ?? leg?.distance?.text ?? formatRoutesDistance(route.distanceMeters ?? leg?.distanceMeters ?? Number.NaN);
  const durationText = route.localizedValues?.duration?.text ?? leg?.localizedValues?.duration?.text ?? (typeof leg?.duration === "string" ? leg.duration : leg?.duration?.text) ?? formatRoutesDuration(route.duration);
  return { leg, distanceText, durationText };
}

export function routeOptionsFromResult(result: DirectionsResultLike): LiveRouteDetails[] {
  return (result.routes ?? []).map(route => {
    const { leg, distanceText, durationText } = routeText(route);
    if (!distanceText || !durationText) return null;
    const steps = (leg?.steps ?? []).map(step => String(step.instructions ?? "").replace(/<[^>]*>/g, "").trim()).filter(Boolean).slice(0, 5);
    return { distanceText, durationText, steps };
  }).filter((route): route is LiveRouteDetails => route !== null);
}

export function routeDetailsFromResult(result: DirectionsResultLike): LiveRouteDetails | null {
  return routeOptionsFromResult(result)[0] ?? null;
}

function directionsCacheKey(origin: Coordinates, destination: Coordinates, mode: TravelMode) {
  return [origin.latitude.toFixed(4), origin.longitude.toFixed(4), destination.latitude.toFixed(4), destination.longitude.toFixed(4), mode].join(":");
}

function routeSelectorId(clusterId: string) {
  return `route-selector-${clusterId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

const CITY_BOUNDS: Record<"Santos" | "Guarujá", google.maps.LatLngBoundsLiteral> = {
  Santos: { north: -23.91, south: -23.99, east: -46.28, west: -46.45 },
  "Guarujá": { north: -23.94, south: -24.04, east: -46.14, west: -46.33 },
};

export const MAP_LEGEND_ITEMS = [
  { key: "santos", label: "Santos", color: "#f97316", description: "eventos em Santos" },
  { key: "guaruja", label: "Guarujá", color: "#d946ef", description: "eventos no Guarujá" },
  { key: "cluster", label: "Número", color: "#ffffff", description: "eventos agrupados no pin" },
  { key: "approximate", label: "Aproximado", color: "#facc15", description: "endereço sem coordenada exata" },
] as const;

export function shouldShowTouchTooltip(currentClusterId: string | null, nextClusterId: string) {
  return currentClusterId !== nextClusterId;
}

export function locationControlLabel(status: "idle" | "loading" | "ready" | "denied" | "unavailable") {
  if (status === "loading") return "Localizando…";
  if (status === "ready") return "Minha localização";
  return "Usar minha localização";
}

function markerContent(cluster: EventCluster) {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute("aria-label", `${clusterLabel(cluster)}${cluster.approximate ? ". Localização aproximada" : ""}`);
  element.style.cssText = `display:grid;place-items:center;min-width:46px;height:46px;padding:0 11px;border:2px solid white;border-radius:999px;background:${cluster.city === "Santos" ? "#f97316" : "#d946ef"};color:white;font:900 14px system-ui;box-shadow:0 6px 18px rgba(0,0,0,.4);cursor:pointer`;
  element.textContent = String(cluster.events.length);
  return element;
}

function eventMarkerContent(event: ClusterableEvent, approximate: boolean) {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute("aria-label", `${event.title} em ${event.locationName}${approximate ? ". Localização aproximada" : ""}`);
  element.style.cssText = `display:grid;place-items:center;width:30px;height:30px;padding:0;border:2px solid white;border-radius:999px;background:${approximate ? "#facc15" : event.city === "Guarujá" ? "#d946ef" : "#f97316"};color:${approximate ? "#422006" : "white"};font:900 11px system-ui;box-shadow:0 4px 12px rgba(0,0,0,.42);cursor:pointer`;
  element.textContent = "•";
  return element;
}

export function markerTooltipContent(cluster: EventCluster) {
  const venues = cluster.events.map(event => event.locationName).filter(Boolean).slice(0, 3).join(" · ");
  const more = cluster.events.length > 3 ? ` +${cluster.events.length - 3}` : "";
  const precision = cluster.approximate ? `<small style="display:block;margin-top:6px;color:#a16207">Endereço aproximado</small>` : "";
  return `<div role="tooltip" style="min-width:180px;max-width:240px;padding:2px;font-family:system-ui;color:#18181b"><strong style="display:block;font-size:13px">${escapeHtml(cluster.city)}</strong><span style="display:block;margin-top:4px;font-size:12px;color:#52525b">${cluster.events.length} ${cluster.events.length === 1 ? "rolê" : "rolês"}${more}</span>${venues ? `<span style="display:block;margin-top:4px;font-size:11px;color:#71717a">${escapeHtml(venues)}</span>` : ""}${precision}<span style="display:block;margin-top:7px;font-size:11px;color:#a21caf">Clique para ver detalhes</span></div>`;
}

export function popupContent(cluster: EventCluster, mode: TravelMode, origin: Coordinates | null, liveRoutes: LiveRouteDetails[] = [], selectedRouteIndex = 0, routeLoading = false, routeUnavailable = false) {
  const featured = cluster.events[0];
  const featuredImage = featured?.imageUrl ? `<img src="${escapeHtml(featured.imageUrl)}" alt="" style="width:100%;height:92px;object-fit:cover;border-radius:10px;margin:8px 0" loading="lazy" />` : "";
  const eventLinks = cluster.events.map(event => {
    const route = directionsUrl(event, mode, origin);
    const summary = travelSummary(event, origin, mode);
    return `<div style="border-top:1px solid #e4e4e7;padding:8px 0"><a href="/eventos/${encodeURIComponent(event.slug)}" style="display:block;color:#c026d3;font-weight:700;text-decoration:none">${escapeHtml(event.title)}<br><small style="color:#52525b;font-weight:500">${escapeHtml(event.locationName)}</small></a>${summary ? `<small style="display:block;margin-top:4px;color:#52525b">${formatDistance(summary.distance)} · ${formatDuration(summary.duration)} · ${TRAVEL_MODES[mode].label}</small>` : ""}${route ? `<a href="${route}" target="_blank" rel="noopener noreferrer" aria-label="Como chegar para ${escapeHtml(event.title)} no Google Maps" style="display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:7px 10px;border-radius:999px;background:#ea580c;color:#fff;font-size:12px;font-weight:800;text-decoration:none;box-shadow:0 3px 8px rgba(234,88,12,.22)">Como chegar ↗<small style="font-size:10px;font-weight:600;opacity:.9">${TRAVEL_MODES[mode].label.toLowerCase()}</small></a>` : ""}</div>`;
  }).join("");
  const approximate = cluster.approximate ? `<small style="display:block;color:#a16207;background:#fef3c7;padding:5px 7px;border-radius:6px">Endereço aproximado</small>` : "";
  const liveRoute = liveRoutes[Math.min(Math.max(selectedRouteIndex, 0), Math.max(liveRoutes.length - 1, 0))];
  const routeSelector = liveRoutes.length > 1 ? `<label for="${routeSelectorId(cluster.id)}" style="display:block;margin-top:8px;font-size:12px;font-weight:700;color:#52525b">Rotas disponíveis<select id="${routeSelectorId(cluster.id)}" style="display:block;width:100%;margin-top:4px;padding:6px;border:1px solid #d4d4d8;border-radius:6px;background:white;color:#18181b">${liveRoutes.map((route, index) => `<option value="${index}" ${index === selectedRouteIndex ? "selected" : ""}>Rota ${index + 1} · ${escapeHtml(route.distanceText)} · ${escapeHtml(route.durationText)}</option>`).join("")}</select></label>` : "";
  const liveRouteBlock = routeLoading ? `<div style="margin:8px 0;padding:8px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:12px">Calculando rota e trânsito em tempo real…</div>` : routeUnavailable ? `<div style="margin:8px 0;padding:8px;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:12px">A rota em tempo real está indisponível. Exibindo apenas a estimativa local.</div>` : liveRoute ? `<div style="margin:8px 0;padding:8px;border-radius:8px;background:#ecfdf5;color:#166534;font-size:12px"><strong>Rota em tempo real</strong>${routeSelector}<br>${escapeHtml(liveRoute.distanceText)} · ${escapeHtml(liveRoute.durationText)}<ol style="margin:6px 0 0 16px;padding:0">${liveRoute.steps.map(step => `<li style="margin-top:3px">${escapeHtml(step)}</li>`).join("")}</ol></div>` : "";
  return `<div style="max-width:260px;font-family:system-ui;color:#18181b"><strong>${escapeHtml(clusterLabel(cluster))}</strong>${featuredImage}${approximate}${liveRouteBlock}${eventLinks}</div>`;
}

export default function RegionalEventMap({ events, onVisibleEventIdsChange }: RegionalEventMapProps) {
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [cityFilters, setCityFilters] = useState<Record<"Santos" | "Guarujá", boolean>>({ Santos: true, "Guarujá": true });
  const [precisionFilters, setPrecisionFilters] = useState<Record<"exact" | "approximate", boolean>>({ exact: true, approximate: true });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ready" | "denied" | "unavailable">("idle");
  const [liveRoutes, setLiveRoutes] = useState<Record<string, LiveRouteDetails[]>>({});
  const [liveRouteStatus, setLiveRouteStatus] = useState<Record<string, "loading" | "ready" | "unavailable">>({});
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<Record<string, number>>({});
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const clusterMarkersRef = useRef(new Map<string, google.maps.marker.AdvancedMarkerElement>());
  const markerClustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const routesApiRef = useRef<RoutesApiLike | null>(null);
  const routesLibraryReadyRef = useRef<Promise<void> | null>(null);
  const travelModeRef = useRef(travelMode);
  const userLocationRef = useRef(userLocation);
  const eventsRef = useRef(events);
  const visibleCallbackRef = useRef(onVisibleEventIdsChange);
  const liveRoutesRef = useRef(liveRoutes);
  const liveRouteStatusRef = useRef(liveRouteStatus);
  const selectedRouteIndexRef = useRef(selectedRouteIndex);
  const selectedClusterRef = useRef(selectedCluster);
  const touchTooltipClusterRef = useRef<string | null>(null);
  const directionsCacheRef = useRef<ShortLivedCache<LiveRouteDetails[]>>(createDirectionsCache());
  const filteredEvents = useMemo(() => filterEventsForMap(events, { ...cityFilters, ...precisionFilters }), [events, cityFilters, precisionFilters]);
  const clusters = useMemo(() => groupEventsByRegion(filteredEvents), [filteredEvents]);

  useEffect(() => { travelModeRef.current = travelMode; }, [travelMode]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => { eventsRef.current = filteredEvents; visibleCallbackRef.current = onVisibleEventIdsChange; }, [filteredEvents, onVisibleEventIdsChange]);
  useEffect(() => { liveRoutesRef.current = liveRoutes; liveRouteStatusRef.current = liveRouteStatus; selectedRouteIndexRef.current = selectedRouteIndex; selectedClusterRef.current = selectedCluster; }, [liveRoutes, liveRouteStatus, selectedRouteIndex, selectedCluster]);
  const requestLiveRoute = async (cluster: EventCluster, origin: Coordinates | null, mode: TravelMode) => {
    const destination = coordinatesFor(cluster.events[0]);
    if (!origin || !destination) return;
    const cacheKey = directionsCacheKey(origin, destination, mode);
    const cached = directionsCacheRef.current.get(cacheKey);
    if (cached) {
      setLiveRoutes(current => ({ ...current, [cluster.id]: cached }));
      setSelectedRouteIndex(current => ({ ...current, [cluster.id]: 0 }));
      setLiveRouteStatus(current => ({ ...current, [cluster.id]: "ready" }));
      return;
    }
    setLiveRouteStatus(current => ({ ...current, [cluster.id]: "loading" }));
    try {
      await routesLibraryReadyRef.current;
      const routeApi = routesApiRef.current;
      if (!routeApi) throw new Error("Routes Library indisponível");
      const request: Record<string, unknown> = {
        origin: { lat: origin.latitude, lng: origin.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude },
        travelMode: TRAVEL_MODES[mode].mapsMode.toUpperCase(),
        computeAlternativeRoutes: true,
        fields: ["routes.distanceMeters", "routes.duration", "routes.localizedValues", "routes.legs.steps.instructions"],
      };
      if (mode === "driving") request.routingPreference = "TRAFFIC_AWARE";
      const result = await routeApi.computeRoutes(request);
      const routes = routeOptionsFromResult(result as DirectionsResultLike);
      if (routes.length > 0) directionsCacheRef.current.set(cacheKey, routes);
      setLiveRoutes(current => ({ ...current, [cluster.id]: routes }));
      setSelectedRouteIndex(current => ({ ...current, [cluster.id]: 0 }));
      setLiveRouteStatus(current => ({ ...current, [cluster.id]: routes.length > 0 ? "ready" : "unavailable" }));
    } catch (error) {
      console.warn("[Maps] Routes API indisponível; usando estimativa local", { reason: error instanceof Error ? error.message : "unknown" });
      setLiveRoutes(current => ({ ...current, [cluster.id]: [] }));
      setLiveRouteStatus(current => ({ ...current, [cluster.id]: "unavailable" }));
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationStatus("unavailable"); return; }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(position => {
      const location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUserLocation(location);
      setLocationStatus("ready");
      mapRef.current?.panTo({ lat: location.latitude, lng: location.longitude });
      mapRef.current?.setZoom(14);
    }, error => { setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"); }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
  };

  const centerOnUserLocation = () => {
    if (userLocation) {
      mapRef.current?.panTo({ lat: userLocation.latitude, lng: userLocation.longitude });
      mapRef.current?.setZoom(14);
      return;
    }
    requestLocation();
  };

  const setupMap = (map: google.maps.Map) => {
    mapRef.current = map;
    infoWindowRef.current = new window.google.maps.InfoWindow();
    infoWindowRef.current.addListener("domready", () => {
      const select = document.getElementById(routeSelectorId(selectedClusterRef.current ?? "")) as HTMLSelectElement | null;
      if (!select) return;
      select.onchange = () => {
        const clusterId = selectedClusterRef.current;
        if (!clusterId) return;
        setSelectedRouteIndex(current => ({ ...current, [clusterId]: Number(select.value) || 0 }));
      };
    });
    routesLibraryReadyRef.current = window.google.maps.importLibrary("routes").then(library => {
      routesApiRef.current = (library as { Route?: RoutesApiLike }).Route ?? null;
    });
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
    const map = mapRef.current;
    if (!map) return;
    const activeCities = (Object.keys(cityFilters) as Array<"Santos" | "Guarujá">).filter(city => cityFilters[city]);
    if (activeCities.length === 1) {
      map.fitBounds(CITY_BOUNDS[activeCities[0]], 32);
    } else if (activeCities.length === 2) {
      map.fitBounds(BAIXADA_BOUNDS, 24);
    }
  }, [cityFilters]);

  useEffect(() => {
    markersRef.current.forEach(marker => { marker.map = null; });
    markerClustererRef.current?.clearMarkers();
    markerClustererRef.current = null;
    markersRef.current = [];
    clusterMarkersRef.current.clear();
    if (!mapRef.current || !window.google?.maps?.marker) return;
    const markers = filteredEvents.map(event => {
      const coordinates = mapCoordinatesFor(event);
      const approximate = coordinates.approximate;
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        position: { lat: coordinates.latitude, lng: coordinates.longitude },
        title: `${event.title} · ${event.locationName}`,
        content: eventMarkerContent(event, approximate),
      });
      const cluster = clusters.find(item => item.events.some(clusterEvent => clusterEvent.id === event.id));
      if (!cluster) return marker;
      marker.addListener("mouseover", () => {
        if (selectedClusterRef.current === cluster.id) return;
        infoWindowRef.current?.setContent(markerTooltipContent(cluster));
        infoWindowRef.current?.open({ map: mapRef.current, anchor: marker });
      });
      marker.addListener("mouseout", () => {
        if (selectedClusterRef.current !== cluster.id && touchTooltipClusterRef.current !== cluster.id) infoWindowRef.current?.close();
      });
      marker.addListener("focus", () => {
        if (selectedClusterRef.current === cluster.id) return;
        infoWindowRef.current?.setContent(markerTooltipContent(cluster));
        infoWindowRef.current?.open({ map: mapRef.current, anchor: marker });
      });
      marker.addListener("click", (pointerEvent: unknown) => {
        const pointerType = (pointerEvent as { domEvent?: { pointerType?: string } } | null)?.domEvent?.pointerType;
        if (pointerType === "touch" && shouldShowTouchTooltip(touchTooltipClusterRef.current, cluster.id)) {
          touchTooltipClusterRef.current = cluster.id;
          setSelectedCluster(null);
          infoWindowRef.current?.setContent(markerTooltipContent(cluster));
          infoWindowRef.current?.open({ map: mapRef.current, anchor: marker });
          return;
        }
        touchTooltipClusterRef.current = null;
        setSelectedCluster(cluster.id);
        const selectedEventCluster: EventCluster = { ...cluster, id: `${cluster.id}-${event.id}`, events: [event], approximate };
        infoWindowRef.current?.setContent(popupContent(selectedEventCluster, travelModeRef.current, userLocationRef.current, liveRoutesRef.current[cluster.id] ?? [], selectedRouteIndexRef.current[cluster.id] ?? 0, liveRouteStatusRef.current[cluster.id] === "loading", liveRouteStatusRef.current[cluster.id] === "unavailable"));
        infoWindowRef.current?.open({ map: mapRef.current, anchor: marker });
      });
      markersRef.current.push(marker);
      clusterMarkersRef.current.set(event.id.toString(), marker);
      return marker;
    });
    markerClustererRef.current = new MarkerClusterer({ map: mapRef.current, markers });
    return () => { markersRef.current.forEach(marker => { marker.map = null; }); markerClustererRef.current?.clearMarkers(); markerClustererRef.current = null; markersRef.current = []; clusterMarkersRef.current.clear(); };
  }, [clusters, filteredEvents]);

  useEffect(() => {
    if (!selectedCluster || !mapRef.current || !infoWindowRef.current) return;
    const cluster = clusters.find(item => item.id === selectedCluster);
    const marker = clusterMarkersRef.current.get(selectedCluster);
    if (!cluster || !marker) return;
    infoWindowRef.current.setContent(popupContent(cluster, travelMode, userLocation, liveRoutes[selectedCluster] ?? [], selectedRouteIndex[selectedCluster] ?? 0, liveRouteStatus[selectedCluster] === "loading", liveRouteStatus[selectedCluster] === "unavailable"));
    infoWindowRef.current.open({ map: mapRef.current, anchor: marker });
  }, [clusters, selectedCluster, travelMode, userLocation, liveRoutes, liveRouteStatus]);

  useEffect(() => {
    if (!selectedCluster || !userLocation) return;
    const cluster = clusters.find(item => item.id === selectedCluster);
    if (!cluster || liveRouteStatus[selectedCluster] === "loading") return;
    requestLiveRoute(cluster, userLocation, travelMode);
  }, [selectedCluster, userLocation, travelMode, clusters]);

  const focusCluster = (cluster: EventCluster) => { setSelectedCluster(cluster.id); mapRef.current?.panTo({ lat: cluster.latitude, lng: cluster.longitude }); mapRef.current?.setZoom(14); };
  const locationMessage = locationStatus === "denied" ? "Permissão de localização negada. Você ainda pode iniciar a rota sem estimativa." : locationStatus === "unavailable" ? "Não foi possível acessar sua localização neste dispositivo." : locationStatus === "loading" ? "Buscando sua localização..." : "Ative sua localização para ver distância e tempo estimado.";

  const travelControls = <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-yellow-200">Deslocamento</p><p className="mt-1 text-xs text-zinc-500">{locationStatus === "ready" ? "Distâncias calculadas a partir da sua localização atual." : locationMessage}</p></div><button type="button" onClick={centerOnUserLocation} disabled={locationStatus === "loading"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-orange-300/40 px-3 text-xs font-black text-orange-200 transition hover:bg-orange-300/10 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><LocateFixed size={15} />{locationControlLabel(locationStatus)}</button></div><label className="mt-3 block text-xs font-bold text-zinc-400">Meio de transporte<select aria-label="Escolha o meio de transporte" value={travelMode} onChange={event => setTravelMode(event.target.value as TravelMode)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 sm:max-w-xs">{Object.entries(TRAVEL_MODES).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}</select></label></div>;

  const renderEventRoute = (event: ClusterableEvent) => {
    const route = directionsUrl(event, travelMode, userLocation);
    const summary = travelSummary(event, userLocation, travelMode);
    if (!route) return null;
    return <div key={event.id} className="mt-2 border-t border-white/10 pt-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs text-zinc-500">{event.title}</span>{summary && <span className="shrink-0 text-xs font-bold text-yellow-200">{formatDistance(summary.distance)} · {formatDuration(summary.duration)}</span>}</div><a href={route} target="_blank" rel="noopener noreferrer" aria-label={`Iniciar rota de ${TRAVEL_MODES[travelMode].label.toLowerCase()} até ${event.title}`} className="mt-1 inline-flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-xs font-bold text-orange-200 hover:bg-orange-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><Route size={14} /> Iniciar rota de {TRAVEL_MODES[travelMode].label.toLowerCase()}</a></div>;
  };

  const filterToggle = (key: "Santos" | "Guarujá" | "exact" | "approximate", label: string, color: string, checked: boolean, onChange: () => void, description: string) => <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-[11px] text-zinc-300 transition hover:border-white/20 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-yellow-200"><input type="checkbox" checked={checked} onChange={onChange} aria-label={`Filtrar ${label}`} className="sr-only" /><span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full border-2" style={{ backgroundColor: checked ? color : "transparent", borderColor: color }}><span className={checked ? "h-1.5 w-1.5 rounded-full bg-white" : "hidden"} /></span><span><strong className="font-black text-white">{label}</strong><span className="hidden text-zinc-500 sm:inline"> · {description}</span></span></label>;
  const mapLegend = <div aria-label="Filtros e legenda do mapa" className="mt-3 rounded-2xl border border-white/10 bg-zinc-950/90 px-3 py-3 backdrop-blur sm:px-4"><div className="mb-2 flex items-center justify-between gap-3"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-200">Como ler e filtrar</div><span className="text-[10px] font-bold text-zinc-500">{filteredEvents.length} eventos visíveis</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{filterToggle("Santos", "Santos", "#f97316", cityFilters.Santos, () => setCityFilters(current => ({ ...current, Santos: !current.Santos })), "eventos na cidade")}{filterToggle("Guarujá", "Guarujá", "#d946ef", cityFilters["Guarujá"], () => setCityFilters(current => ({ ...current, "Guarujá": !current["Guarujá"] })), "eventos na cidade")}{filterToggle("exact", "Exato", "#f97316", precisionFilters.exact, () => setPrecisionFilters(current => ({ ...current, exact: !current.exact })), "coordenada confirmada")}{filterToggle("approximate", "Aproximado", "#facc15", precisionFilters.approximate, () => setPrecisionFilters(current => ({ ...current, approximate: !current.approximate })), "centro da cidade")}</div><div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-zinc-500"><span><strong className="text-white">Número</strong> = eventos agrupados no pin</span><span>Toque uma vez para resumo; toque novamente para detalhes.</span></div></div>;
  const mapPanel = <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-zinc-900"><MapView key={isFullscreen ? "fullscreen" : "inline"} className={isFullscreen ? "h-[calc(100vh-7rem)]" : "h-[460px]"} initialCenter={{ lat: -23.96, lng: -46.33 }} initialZoom={11} onMapReady={setupMap} mapOptions={{ styles: WEEKENDVIBES_MAP_STYLE }} /><div className="absolute right-3 top-3 flex flex-col items-end gap-2"><button type="button" onClick={centerOnUserLocation} disabled={locationStatus === "loading"} aria-label="Centralizar mapa na minha localização" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-orange-300/50 bg-zinc-950/90 px-4 py-2 text-xs font-black text-orange-100 shadow-lg backdrop-blur transition hover:bg-orange-300/15 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><LocateFixed size={16} />{locationControlLabel(locationStatus)}</button><button type="button" onClick={() => setIsFullscreen(value => !value)} aria-label={isFullscreen ? "Fechar mapa em tela cheia" : "Abrir mapa em tela cheia"} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-zinc-950/85 px-4 py-2 text-xs font-black text-white shadow-lg backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300">{isFullscreen ? <X size={16} /> : <Maximize2 size={16} />}{isFullscreen ? "Fechar" : "Tela cheia"}</button></div></div>;

  return <section aria-labelledby="regional-map-title"><div className="mb-4 flex items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300"><Navigation size={15} /> Explorar por região</p><h2 id="regional-map-title" className="mt-1 text-3xl font-black tracking-tight text-white">Mapa dos rolês</h2><p className="mt-1 text-sm text-zinc-500">Pins agrupam eventos próximos em Santos e Guarujá.</p></div><span className="hidden items-center gap-1 text-xs font-bold text-zinc-500 sm:flex"><Users size={14} /> {clusters.length} regiões</span></div>{isFullscreen ? <div role="dialog" aria-modal="true" aria-labelledby="regional-map-title" className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950 p-3 sm:p-6"><div className="mx-auto flex min-h-full max-w-7xl flex-col"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-black text-white">Mapa regional</p><p className="text-xs text-zinc-500">Pressione Esc para fechar</p></div>{mapPanel}{mapLegend}{travelControls}</div></div> : <>{mapPanel}{mapLegend}{travelControls}</>}<div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Regiões com eventos no mapa">{clusters.map(cluster => <div key={cluster.id} className={`rounded-2xl border p-3 transition ${selectedCluster === cluster.id ? "border-orange-300/70 bg-orange-300/10" : "border-white/10 bg-white/[0.03]"}`}><button type="button" onClick={() => focusCluster(cluster)} aria-pressed={selectedCluster === cluster.id} className="flex w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"><span><span className="block text-sm font-black text-white">{cluster.city}</span><span className="block text-xs text-zinc-500">{cluster.events.map(event => event.locationName).join(" · ")}</span>{cluster.approximate && <span className="mt-1 block text-[11px] font-bold text-yellow-200">Endereço aproximado</span>}</span><span className="rounded-full bg-white/10 px-2 py-1 text-xs font-black text-yellow-200">{cluster.events.length}</span></button>{cluster.events.map(renderEventRoute)}</div>)}{!clusters.length && <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-500">Nenhum evento com localização disponível para exibir no mapa.</p>}</div><p className="sr-only" aria-live="polite">{selectedCluster ? `Região selecionada: ${clusters.find(cluster => cluster.id === selectedCluster)?.city ?? ""}` : "Selecione uma região para aproximar o mapa."}</p></section>;
}
