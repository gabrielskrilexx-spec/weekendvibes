/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime, google map itself is in charge of the re-rendering, not react state.
 * </MapView>
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * - Attaches to map using { map, position }
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 37.7749, lng: -122.4194 },
 *   title: "San Francisco",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * - Does not attach directly to map; use data with your map manually.
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 * new google.maps.marker.AdvancedMarkerElement({ map, position: place.location });
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * - Standalone service; manually apply results to map.
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *     new google.maps.marker.AdvancedMarkerElement({
 *       map,
 *       position: results[0].geometry.location,
 *     });
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * - Pure utility functions; not attached to map.
 * const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
 *
 * -------------------------------
 * 🛣️ ROUTES (from `routes` library)
 * - Combines DirectionsService (standalone) + DirectionsRenderer (map-attached)
 * const directionsService = new google.maps.DirectionsService();
 * const directionsRenderer = new google.maps.DirectionsRenderer({ map });
 * directionsService.route(
 *   { origin, destination, travelMode: "DRIVING" },
 *   (res, status) => status === "OK" && directionsRenderer.setDirections(res)
 * );
 *
 * -------------------------------
 * 🌦️ MAP LAYERS (attach directly to map)
 * - new google.maps.TrafficLayer().setMap(map);
 * - new google.maps.TransitLayer().setMap(map);
 * - new google.maps.BicyclingLayer().setMap(map);
 *
 * -------------------------------
 * ✅ SUMMARY
 * - “map-attached” → AdvancedMarkerElement, DirectionsRenderer, Layers.
 * - “standalone” → Geocoder, DirectionsService, DistanceMatrixService, ElevationService.
 * - “data-only” → Place, Geometry utilities.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
    __weekendVibesMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

const MAPS_READY_CALLBACK = "__weekendVibesMapsReady";
const MAPS_SCRIPT_BASE_URL = `/api/maps/javascript?callback=${encodeURIComponent(MAPS_READY_CALLBACK)}&libraries=marker,places,geocoding,geometry,routes&loader=2`;

export const WEEKENDVIBES_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#24242a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#24242a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#d4d4d8" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#3f3f46" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#e4e4e7" }] },
  { featureType: "water", stylers: [{ color: "#183047" }] },
];

let mapScriptPromise: Promise<void> | null = null;

function loadMapScript(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (mapScriptPromise) return mapScriptPromise;

  mapScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    let scriptUrl: string | null = null;
    const previousAuthFailure = window.gm_authFailure;
    const onWindowError = (event: Event) => {
      const target = event.target as HTMLScriptElement | null;
      if (target === script) {
        fail(new Error("Google Maps script resource error"));
      }
    };
    const cleanup = () => {
      window.removeEventListener("error", onWindowError, true);
      script.remove();
      if (scriptUrl) URL.revokeObjectURL(scriptUrl);
      delete window[MAPS_READY_CALLBACK];
      if (previousAuthFailure) window.gm_authFailure = previousAuthFailure;
      else delete window.gm_authFailure;
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      mapScriptPromise = null;
      console.error("[Maps] Google Maps initialization failed:", error.message);
      reject(error);
    };
    const succeed = () => {
      if (settled) return;
      if (!window.google?.maps?.Map) {
        fail(new Error("Google Maps loaded without the Maps API"));
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };
    window[MAPS_READY_CALLBACK] = succeed;
    window.gm_authFailure = () => fail(new Error("Google Maps authentication failure (gm_authFailure)"));
    window.addEventListener("error", onWindowError, true);
    script.async = true;
    script.onload = () => {
      // Poll briefly for browser/proxy variants that finish the bootstrap after onload.
      let attempts = 0;
      const poll = window.setInterval(() => {
        if (settled) {
          window.clearInterval(poll);
          return;
        }
        if (window.google?.maps?.Map) {
          window.clearInterval(poll);
          succeed();
          return;
        }
        attempts += 1;
        if (attempts >= 50) window.clearInterval(poll);
      }, 100);
    };
    window.setTimeout(() => {
      if (settled) return;
      fail(new Error("Google Maps initialization timeout"));
    }, 15000);
    script.onerror = () => fail(new Error("Google Maps script execution error"));
    void fetch(MAPS_SCRIPT_BASE_URL, { credentials: "same-origin" })
      .then(response => {
        if (!response.ok) throw new Error(`Google Maps relay HTTP ${response.status}`);
        return response.text();
      })
      .then(source => {
        if (settled) return;
        scriptUrl = URL.createObjectURL(new Blob([source], { type: "application/javascript" }));
        script.src = scriptUrl;
        document.head.appendChild(script);
      })
      .catch(error => fail(error instanceof Error ? error : new Error("Google Maps relay fetch error")));
  });

  return mapScriptPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
  lazy?: boolean;
  mapOptions?: google.maps.MapOptions;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
  lazy = true,
  mapOptions,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapHost = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [isVisible, setIsVisible] = useState(!lazy);
  const [isMapReady, setIsMapReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!lazy || !mapContainer.current || typeof IntersectionObserver === "undefined") {
      if (lazy) setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px 0px", threshold: 0.01 });
    observer.observe(mapContainer.current);
    return () => observer.disconnect();
  }, [lazy]);

  const init = usePersistFn(async () => {
    try {
      await loadMapScript();
    } catch (error) {
      setLoadError(true);
      console.error("[Maps] MapView fallback activated:", error instanceof Error ? error.message : "unknown initialization error");
      return;
    }
    if (!mapHost.current || !window.google?.maps) return;
    map.current = new window.google.maps.Map(mapHost.current, {
      zoom: initialZoom,
      center: initialCenter,
      mapTypeControl: false,
      fullscreenControl: false,
      zoomControl: true,
      streetViewControl: false,
      clickableIcons: false,
      gestureHandling: "greedy",
      backgroundColor: "#24242a",
      ...mapOptions,
    });
    setIsMapReady(true);
    if (onMapReady) {
      onMapReady(map.current);
    }
  });

  useEffect(() => {
    if (isVisible) init();
  }, [init, isVisible]);

  return (
    <div ref={mapContainer} aria-busy={isVisible && !isMapReady && !loadError} className={cn("relative min-h-[460px] h-[500px] w-full overflow-hidden", className)}>
      <div ref={mapHost} className="absolute inset-0" aria-hidden="true" />
      {!isMapReady && !loadError && <div className="content-fade-in absolute inset-0 z-10 overflow-hidden bg-zinc-900" role="status" aria-live="polite" aria-label={isVisible ? "Carregando mapa" : "Mapa aguardando entrada na tela"}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(217,70,239,0.14),transparent_34%),radial-gradient(circle_at_80%_80%,rgba(249,115,22,0.12),transparent_38%)]" />
        <div className="relative grid h-full place-items-center px-6">
          <div className="w-full max-w-sm space-y-4 text-center">
            <div className="mx-auto h-14 w-14 animate-pulse rounded-full border-2 border-orange-300/40 bg-orange-300/10 shadow-[0_0_36px_rgba(249,115,22,0.18)]" />
            <div className="mx-auto h-3 w-40 animate-pulse rounded-full bg-white/15" />
            <div className="mx-auto h-2 w-64 animate-pulse rounded-full bg-white/10" />
            <p className="text-xs font-bold tracking-wide text-zinc-400">{isVisible ? "Preparando o mapa dos rolês…" : "Carregando o mapa quando ele entrar na tela…"}</p>
          </div>
        </div>
      </div>}
      {loadError && <div className="absolute inset-0 z-10 grid place-items-center bg-zinc-900 px-6 text-center text-sm text-zinc-300" role="alert">Não foi possível carregar o mapa agora. Tente atualizar a página.</div>}
    </div>
  );
}
