import React from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { trackWebAnalytics } from "@/lib/analytics";

function decodeVapidKey(base64Url: string) {
  const normalized = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const decoded = window.atob(padded);
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}

function supportsPush() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export default function PushAlertsToggle() {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? "";
  const supported = supportsPush();
  const configured = supported && vapidPublicKey.length > 0;
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!vapidPublicKey) return;
    if (!supported) {
      setMessage("Notificações push não estão disponíveis neste navegador.");
      return;
    }
    let cancelled = false;
    void navigator.serviceWorker.ready
      .then(registration => registration.pushManager.getSubscription())
      .then(subscription => { if (!cancelled) setEnabled(Boolean(subscription)); })
      .catch(() => { if (!cancelled) setMessage("Não foi possível verificar a permissão neste dispositivo."); });
    return () => { cancelled = true; };
  }, [supported, vapidPublicKey]);

  const toggle = async () => {
    if (!configured || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        setEnabled(false);
        setMessage("Alertas desativados neste dispositivo.");
        trackWebAnalytics("push_disabled");
        return;
      }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(permission === "denied" ? "Permissão bloqueada nas configurações do navegador." : "Permissão de notificação não concedida.");
        return;
      }
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(vapidPublicKey) as unknown as BufferSource,
      });
      setEnabled(true);
      setMessage("Permissão ativada neste dispositivo. O envio de alertas depende da configuração do serviço push.");
      trackWebAnalytics("push_enabled");
    } catch {
      setMessage("Não foi possível ativar notificações. Tente novamente quando estiver online.");
    } finally {
      setBusy(false);
    }
  };

  if (!vapidPublicKey) return null;

  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4" aria-label="Alertas de eventos">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-orange-300/10 p-2 text-orange-200" aria-hidden="true">
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : enabled ? <Bell size={18} /> : <BellOff size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-zinc-200">Receber alertas dos eventos do fim de semana</p>
          <p className="mt-1 text-xs text-zinc-500">
            {!supported ? "Este navegador não oferece suporte a notificações push." : !vapidPublicKey ? "Notificações em preparação neste ambiente." : enabled ? "Permissão deste dispositivo ativada." : "Ative para autorizar notificações neste dispositivo."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Receber alertas dos eventos do fim de semana"
          disabled={!configured || busy}
          onClick={() => void toggle()}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-45 ${enabled ? "border-orange-200 bg-orange-300" : "border-white/15 bg-zinc-800"}`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>
      {message && <p className="mt-3 text-xs leading-relaxed text-zinc-400" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
