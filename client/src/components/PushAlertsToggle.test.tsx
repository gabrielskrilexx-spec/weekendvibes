import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import PushAlertsToggle from "./PushAlertsToggle";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PushAlertsToggle", () => {
  it("oculta o opt-in quando a chave pública VAPID não está configurada", () => {
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");

    expect(renderToStaticMarkup(<PushAlertsToggle />)).toBe("");
  });

  it("mantém o opt-in disponível quando a chave pública VAPID está configurada", () => {
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "public-vapid-key");

    const markup = renderToStaticMarkup(<PushAlertsToggle />);
    expect(markup).toContain("Alertas de eventos");
    expect(markup).toContain("Receber alertas dos eventos do fim de semana");
  });
});
