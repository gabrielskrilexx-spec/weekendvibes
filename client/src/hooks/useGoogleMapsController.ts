import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { trackResilienceEvent } from "@/lib/resilienceTelemetry";
import { parseMapsRelayJavascript } from "@/lib/mapContracts";

export type MapControllerState = "idle" | "loading" | "success" | "error";
export type MapControllerEvent = "INTERSECT" | "LOAD_START" | "LOAD_SUCCESS" | "LOAD_ERROR" | "RETRY";

export function transitionMapState(state: MapControllerState, event: MapControllerEvent): MapControllerState {
  if (event === "LOAD_START" || event === "RETRY") return "loading";
  if (event === "LOAD_SUCCESS") return "success";
  if (event === "LOAD_ERROR") return "error";
  if (event === "INTERSECT" && state === "idle") return "loading";
  return state;
}

export function getMapReconnectDelay(attempt: number): number {
  const normalizedAttempt = Math.max(0, Math.floor(attempt));
  return Math.min(30_000, 1_000 * (2 ** Math.min(normalizedAttempt, 5)));
}

export const MAP_SCRIPT_POLL_LIMIT = 50;

export function shouldFailMapScriptPoll(attempts: number): boolean {
  return Math.max(0, Math.floor(attempts)) >= MAP_SCRIPT_POLL_LIMIT;
}

const MAPS_READY_CALLBACK = "__weekendVibesMapsReady";
const MAPS_SCRIPT_BASE_URL = `/api/maps/javascript?callback=${encodeURIComponent(MAPS_READY_CALLBACK)}&libraries=marker,places,geocoding,geometry,routes&loader=2`;
let mapScriptPromise: Promise<void> | null = null;

function loadMapScript(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (mapScriptPromise) return mapScriptPromise;
  mapScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    let scriptUrl: string | null = null;
    let pollTimer: number | null = null;
    let timeoutTimer: number | null = null;
    const previousAuthFailure = window.gm_authFailure;
    const cleanup = () => {
      window.removeEventListener("error", onWindowError, true);
      if (pollTimer !== null) window.clearInterval(pollTimer);
      if (timeoutTimer !== null) window.clearTimeout(timeoutTimer);
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
      reject(error);
    };
    const succeed = () => {
      if (settled) return;
      if (!window.google?.maps?.Map) { fail(new Error("Google Maps loaded without the Maps API")); return; }
      settled = true;
      cleanup();
      resolve();
    };
    const onWindowError = (event: Event) => { if ((event.target as HTMLScriptElement | null) === script) fail(new Error("Google Maps script resource error")); };
    window[MAPS_READY_CALLBACK] = succeed;
    window.gm_authFailure = () => fail(new Error("Google Maps authentication failure (gm_authFailure)"));
    window.addEventListener("error", onWindowError, true);
    script.async = true;
    script.onload = () => {
      let attempts = 0;
      pollTimer = window.setInterval(() => {
        if (settled) return;
        if (window.google?.maps?.Map) { succeed(); return; }
        attempts += 1;
        if (shouldFailMapScriptPoll(attempts)) {
          if (pollTimer !== null) window.clearInterval(pollTimer);
          fail(new Error("Google Maps API did not become ready"));
        }
      }, 100);
    };
    timeoutTimer = window.setTimeout(() => fail(new Error("Google Maps initialization timeout")), 15_000);
    script.onerror = () => fail(new Error("Google Maps script execution error"));
    void fetch(MAPS_SCRIPT_BASE_URL, { credentials: "same-origin" })
      .then(response => { if (!response.ok) throw new Error(`Google Maps relay HTTP ${response.status}`); return response.text().then(source => parseMapsRelayJavascript(source)); })
      .then(source => { if (!settled) { scriptUrl = URL.createObjectURL(new Blob([source], { type: "application/javascript" })); script.src = scriptUrl; document.head.appendChild(script); } })
      .catch(error => fail(error instanceof Error ? error : new Error("Google Maps relay fetch error")));
  });
  return mapScriptPromise;
}

interface ControllerOptions {
  initialCenter: google.maps.LatLngLiteral;
  initialZoom: number;
  lazy: boolean;
  mapOptions?: google.maps.MapOptions;
  onMapReady?: (map: google.maps.Map) => void;
}

export function useGoogleMapsController({ initialCenter, initialZoom, lazy, mapOptions, onMapReady }: ControllerOptions) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapHost = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [state, setState] = useState<MapControllerState>(lazy ? "idle" : "loading");
  const [isVisible, setIsVisible] = useState(!lazy);
  const [isOffline, setIsOffline] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const retryTimer = useRef<number | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const attempt = useRef(0);
  const reconnecting = useRef(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const clearRetryTimer = usePersistFn(() => {
    if (retryTimer.current !== null) { window.clearTimeout(retryTimer.current); retryTimer.current = null; }
  });
  const scheduleRetry = usePersistFn((immediate = false) => {
    if (!window.navigator.onLine || retryTimer.current !== null || reconnecting.current) return;
    const delay = immediate ? 0 : getMapReconnectDelay(attempt.current);
    const retryAttempt = attempt.current;
    attempt.current += 1;
    reconnecting.current = true;
    setState("loading"); setIsReconnecting(true); setIsVisible(true);
    trackResilienceEvent("map_retry_scheduled", { attempt: retryAttempt, delayMs: delay });
    retryTimer.current = window.setTimeout(() => { retryTimer.current = null; setRetryNonce(value => value + 1); }, delay);
  });

  useEffect(() => {
    if (!lazy || !mapContainer.current || typeof IntersectionObserver === "undefined") { setIsVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } }, { rootMargin: "300px 0px", threshold: 0.01 });
    observer.observe(mapContainer.current);
    return () => observer.disconnect();
  }, [lazy]);

  useEffect(() => {
    const updateConnectivity = () => {
      const online = window.navigator.onLine;
      setIsOffline(!online);
      if (!online) { clearRetryTimer(); reconnecting.current = false; setIsReconnecting(false); return; }
      if (state === "error") scheduleRetry();
    };
    updateConnectivity(); window.addEventListener("online", updateConnectivity); window.addEventListener("offline", updateConnectivity);
    return () => { window.removeEventListener("online", updateConnectivity); window.removeEventListener("offline", updateConnectivity); };
  }, [clearRetryTimer, scheduleRetry, state]);

  const init = usePersistFn(async () => {
    const wasRetry = reconnecting.current;
    setState("loading");
    try { await loadMapScript(); }
    catch (error) {
      reconnecting.current = false; setIsReconnecting(false); setState("error");
      const message = error instanceof Error ? error.message : "unknown initialization error";
      const offline = !window.navigator.onLine || /relay|network|fetch|resource|timeout/i.test(message);
      setIsOffline(offline);
      trackResilienceEvent("map_retry_failure", { attempt: attempt.current, offline: offline ? 1 : 0 });
      console.error("[Maps] MapView fallback activated:", message);
      return;
    }
    if (!mapHost.current || !window.google?.maps) { reconnecting.current = false; setIsReconnecting(false); setState("error"); return; }
    map.current = new window.google.maps.Map(mapHost.current, { zoom: initialZoom, center: initialCenter, mapTypeControl: false, fullscreenControl: false, zoomControl: true, streetViewControl: false, clickableIcons: false, gestureHandling: "greedy", backgroundColor: "#24242a", ...mapOptions });
    setState("success"); reconnecting.current = false; setIsReconnecting(false);
    if (wasRetry) { attempt.current = 0; setShowReconnected(true); trackResilienceEvent("map_retry_success"); if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current); noticeTimer.current = window.setTimeout(() => setShowReconnected(false), 4_000); }
    onMapReady?.(map.current);
  });

  useEffect(() => { if (isVisible) void init(); }, [init, isVisible, retryNonce]);
  useEffect(() => () => { clearRetryTimer(); if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current); }, [clearRetryTimer]);

  return { mapContainer, mapHost, map, state, isVisible, isOffline, isReconnecting, showReconnected, clearRetryTimer, scheduleRetry, setIsOffline, setIsReconnecting, setIsVisible };
}
