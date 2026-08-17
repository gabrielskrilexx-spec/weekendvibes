import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CookieConsent from "./CookieConsent";

describe("CookieConsent", () => {
  it("renderiza uma escolha explícita entre cookies essenciais e métricas", () => {
    const markup = renderToStaticMarkup(<CookieConsent />);
    expect(markup).toContain("Preferências de cookies");
    expect(markup).toContain("Apenas essenciais");
    expect(markup).toContain("Aceitar métricas");
    expect(markup).not.toContain("<script");
  });
});
