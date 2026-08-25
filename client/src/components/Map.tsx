/// <reference types="@types/google.maps" />

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { trackResilienceEvent } from "@/lib/resilienceTelemetry";
import { getMapReconnectDelay, useGoogleMapsController } from "@/hooks/useGoogleMapsController";

export { getMapReconnectDelay };

declare global {
  interface Window {
    google?: typeof google;
    __weekendVibesMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

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

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
  lazy?: boolean;
  mapOptions?: google.maps.MapOptions;
  onViewAsList?: () => void;
}

export function MapView({ className, initialCenter = { lat: 37.7749, lng: -122.4194 }, initialZoom = 12, onMapReady, lazy = true, mapOptions, onViewAsList }: MapViewProps) {
  const controller = useGoogleMapsController({ initialCenter, initialZoom, lazy, mapOptions, onMapReady });
  const { mapContainer, mapHost, state, isVisible, isOffline, isReconnecting, showReconnected, retryLimitReached, maxRetryAttempts, clearRetryTimer, scheduleRetry, setIsOffline, setIsReconnecting, setIsVisible } = controller;
  const loadError = state === "error";
  const isMapReady = state === "success";

  useEffect(() => {
    if (isMapReady) return;
  }, [isMapReady]);

  const retryManually = () => {
    if (retryLimitReached) {
      trackResilienceEvent("map_retry_exhausted", { attempts: maxRetryAttempts });
      return;
    }
    trackResilienceEvent("map_retry_click", { attempt: maxRetryAttempts });
    clearRetryTimer();
    setIsReconnecting(false);
    setIsOffline(!window.navigator.onLine);
    setIsVisible(true);
    scheduleRetry(true);
  };

  return (
    <div ref={mapContainer} aria-busy={isVisible && !isMapReady && !loadError} className={cn("relative min-h-[460px] h-[500px] w-full overflow-hidden", className)}>
      <div ref={mapHost} className="absolute inset-0" aria-hidden="true" />
      {showReconnected && <div className="absolute right-4 top-4 z-20 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-4 py-2 text-xs font-bold text-emerald-100 shadow-lg" role="status" aria-live="polite">Conexão restabelecida</div>}
      {!isMapReady && !loadError && <div className="content-fade-in absolute inset-0 z-10 overflow-hidden bg-zinc-900" role="status" aria-live="polite" aria-label={isReconnecting ? "Reconectando ao mapa" : isVisible ? "Carregando mapa" : "Mapa aguardando entrada na tela"}><div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(217,70,239,0.14),transparent_34%),radial-gradient(circle_at_80%_80%,rgba(249,115,22,0.12),transparent_38%)]" /><div className="relative grid h-full place-items-center px-6"><div className="w-full max-w-sm space-y-4 text-center"><div className="mx-auto h-14 w-14 animate-pulse rounded-full border-2 border-orange-300/40 bg-orange-300/10 shadow-[0_0_36px_rgba(249,115,22,0.18)]" /><div className="mx-auto h-3 w-40 animate-pulse rounded-full bg-white/15" /><div className="mx-auto h-2 w-64 animate-pulse rounded-full bg-white/10" /><p className="text-xs font-bold tracking-wide text-zinc-400">{isReconnecting ? "Reconectando ao mapa…" : isVisible ? "Preparando o mapa dos rolês…" : "Carregando o mapa quando ele entrar na tela…"}</p></div></div></div>}
      {loadError && <div className="absolute inset-0 z-10 grid place-items-center bg-zinc-950 px-6 text-center" role="alert" aria-live="assertive"><div className="max-w-sm rounded-3xl border border-orange-300/20 bg-white/[0.04] p-6 shadow-2xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-200">Mapa temporariamente indisponível</p><h3 className="mt-2 text-lg font-black text-white">{retryLimitReached ? "Não foi possível conectar ao mapa." : isOffline ? "Parece que você está sem conexão." : "Não conseguimos carregar os mapas agora."}</h3><p className="mt-2 text-sm leading-relaxed text-zinc-400">{retryLimitReached ? `Atingimos o limite de ${maxRetryAttempts} tentativas. A agenda continua disponível em formato de lista.` : isOffline ? "Verifique sua internet e tente novamente. A agenda continua disponível em formato de lista enquanto a conexão não volta." : "A agenda continua disponível em formato de lista. Você pode tentar carregar o mapa novamente ou seguir explorando os eventos."}</p><button type="button" onClick={retryManually} disabled={retryLimitReached} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-orange-400 to-fuchsia-500 px-4 text-xs font-black text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60">{retryLimitReached ? "Tentativas esgotadas" : isOffline ? "Tentar novamente" : "Tentar carregar o mapa novamente"}</button>{onViewAsList && <button type="button" onClick={() => { trackResilienceEvent("map_fallback_list", { reason: isOffline ? "offline" : "load_error" }); onViewAsList(); }} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-xs font-black text-zinc-100 transition hover:border-yellow-200/50 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200">Ver em Lista</button>}</div></div>}
    </div>
  );
}
