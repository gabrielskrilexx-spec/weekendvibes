import React, { useEffect, useState } from "react";

const CONSENT_KEY = "weekendvibes-cookie-consent";
const ANALYTICS_ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined;
const ANALYTICS_WEBSITE_ID = import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined;

function loadAnalytics() {
  if (!ANALYTICS_ENDPOINT || !ANALYTICS_WEBSITE_ID || document.querySelector("script[data-weekendvibes-analytics]") ) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = `${ANALYTICS_ENDPOINT.replace(/\/$/, "")}/umami`;
  script.dataset.websiteId = ANALYTICS_WEBSITE_ID;
  script.dataset.weekendvibesAnalytics = "true";
  document.body.appendChild(script);
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(CONSENT_KEY);
      if (consent === "accepted") loadAnalytics();
      setVisible(!consent);
    } catch {
      setVisible(true);
    }
  }, []);

  const choose = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // Consent remains session-only if storage is unavailable.
    }
    if (value === "accepted") loadAnalytics();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl"
      role="dialog"
      aria-label="Preferências de cookies"
      aria-describedby="cookie-consent-description"
    >
      <p id="cookie-consent-description" className="text-sm leading-6">
        Usamos apenas cookies essenciais para login e funcionamento. Com sua autorização, ativamos métricas anônimas de uso para melhorar o WeekendVibes.
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => choose("rejected")} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
          Apenas essenciais
        </button>
        <button type="button" onClick={() => choose("accepted")} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90">
          Aceitar métricas
        </button>
      </div>
    </aside>
  );
}
