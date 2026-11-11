import { Download, Share, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone();
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [isDismissed, setIsDismissed] = useState(false);
  const [standalone, setStandalone] = useState(isStandalone);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstallEvent(null);
      setStandalone(true);
    };
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = () => setStandalone(isStandalone());

    setIos(isIos());
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    mediaQuery.addEventListener?.("change", onDisplayModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      mediaQuery.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  const showInstall = !standalone && !isDismissed && (Boolean(installEvent) || ios);

  return (
    <>
      {isOffline && (
        <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-amber-300/30 bg-zinc-950/95 px-4 py-3 text-sm text-amber-100 shadow-2xl backdrop-blur" role="status" aria-live="polite">
          <WifiOff size={18} aria-hidden="true" className="shrink-0 text-amber-300" />
          <span>Sem conexão. Os eventos serão atualizados quando a internet voltar.</span>
        </div>
      )}
      {showInstall && (
        <aside className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-orange-300/25 bg-zinc-950/95 p-4 text-zinc-100 shadow-2xl backdrop-blur" aria-label="Instalar WeekendVibes">
          <div className="mt-0.5 rounded-xl bg-orange-300/15 p-2 text-orange-200" aria-hidden="true">
            {ios ? <Share size={18} /> : <Download size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Leve o WeekendVibes com você</p>
            {ios ? (
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">Para instalar no iPhone: toque em Compartilhar ➔ Adicionar à Tela de Início.</p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">Instale o app para encontrar os próximos rolês com acesso rápido.</p>
            )}
            {!ios && <button type="button" onClick={install} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-orange-300 px-3 py-2 text-xs font-black text-zinc-950 transition hover:bg-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200">Instalar o App <Download size={14} aria-hidden="true" /></button>}
          </div>
          <button type="button" onClick={() => setIsDismissed(true)} className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200" aria-label="Fechar convite de instalação">
            <X size={16} aria-hidden="true" />
          </button>
        </aside>
      )}
    </>
  );
}
