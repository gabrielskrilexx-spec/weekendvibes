import { Download, Share, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { trackWebAnalytics } from "@/lib/analytics";
import { clearBeforeInstallPrompt, subscribeToBeforeInstallPrompt, type BeforeInstallPromptEvent } from "@/lib/pwa-install";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
}

type IosInstallMode = "safari" | "in-app";

function detectIosInstallMode(): IosInstallMode | null {
  if (typeof navigator === "undefined" || isStandalone()) return null;
  const userAgent = navigator.userAgent;
  const isIosDevice = /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1);
  if (!isIosDevice) return null;
  return /instagram|fbav|fban|fb_iab|whatsapp|crios/i.test(userAgent) ? "in-app" : "safari";
}

function wasIosGuideDismissed() {
  try {
    return localStorage.getItem("weekendvibes:ios-install-guide-dismissed") === "1";
  } catch {
    return false;
  }
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [isDismissed, setIsDismissed] = useState(wasIosGuideDismissed);
  const [standalone, setStandalone] = useState(isStandalone);
  const [iosMode, setIosMode] = useState<IosInstallMode | null>(null);

  const markInstalled = () => {
    try {
      if (localStorage.getItem("weekendvibes:pwa-install-tracked") === "1") return;
      localStorage.setItem("weekendvibes:pwa-install-tracked", "1");
      trackWebAnalytics("pwa_install");
    } catch {
      trackWebAnalytics("pwa_install");
    }
  };

  useEffect(() => {
    const onAppInstalled = () => {
      clearBeforeInstallPrompt();
      setStandalone(true);
      markInstalled();
    };
    const onOnline = () => { setIsOffline(false); trackWebAnalytics("offline_exit"); };
    const onOffline = () => { setIsOffline(true); trackWebAnalytics("offline_enter"); };
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = () => setStandalone(isStandalone());

    setIosMode(detectIosInstallMode());
    if (isStandalone()) markInstalled();
    const unsubscribeInstallPrompt = subscribeToBeforeInstallPrompt(setInstallEvent);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    mediaQuery.addEventListener?.("change", onDisplayModeChange);
    return () => {
      unsubscribeInstallPrompt();
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      mediaQuery.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") markInstalled();
    clearBeforeInstallPrompt();
  };

  const isAdminPath = typeof window !== "undefined" && (window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/"));
  const isIos = iosMode !== null;
  const showInstall = !isAdminPath && !standalone && !isDismissed && (Boolean(installEvent) || isIos);
  const dismissInstallGuide = () => {
    setIsDismissed(true);
    try { localStorage.setItem("weekendvibes:ios-install-guide-dismissed", "1"); } catch { /* storage indisponível */ }
  };

  return (
    <>
      {isOffline && (
        <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-amber-300/30 bg-zinc-950/95 px-4 py-3 text-sm text-amber-100 shadow-2xl backdrop-blur" role="status" aria-live="polite">
          <WifiOff size={18} aria-hidden="true" className="shrink-0 text-amber-300" />
          <span>Sem conexão. Os eventos serão atualizados quando a internet voltar.</span>
        </div>
      )}
      {showInstall && (
        <aside className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-orange-300/25 bg-zinc-950/95 p-4 text-zinc-100 shadow-2xl backdrop-blur" aria-label="Instalar WeekendVibes" data-testid="ios-install-guide" data-ios-mode={iosMode ?? "android"}>
          <div className="mt-0.5 rounded-xl bg-orange-300/15 p-2 text-orange-200" aria-hidden="true">
            {isIos ? <Share size={18} /> : <Download size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Leve o WeekendVibes com você</p>
            {iosMode === "safari" ? (
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">No Safari, toque em Compartilhar (quadrado com seta para cima) ➔ Adicionar à Tela de Início.</p>
            ) : iosMode === "in-app" ? (
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">Você está em um navegador interno. Toque no menu e escolha Abrir no Safari; depois toque em Compartilhar ➔ Adicionar à Tela de Início.</p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">Instale o app para encontrar os próximos rolês com acesso rápido.</p>
            )}
            {!isIos && <button type="button" onClick={install} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-orange-300 px-3 py-2 text-xs font-black text-zinc-950 transition hover:bg-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200">Instalar o App <Download size={14} aria-hidden="true" /></button>}
          </div>
          <button type="button" onClick={dismissInstallGuide} className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200" aria-label="Fechar convite de instalação">
            <X size={16} aria-hidden="true" />
          </button>
        </aside>
      )}
    </>
  );
}
