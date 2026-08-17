import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Legal from "./Legal";
import SiteFooter from "@/components/SiteFooter";

describe("Legal page", () => {
  it("apresenta as duas políticas e navegação por âncoras", () => {
    const markup = renderToStaticMarkup(<Legal />);
    expect(markup).toContain("Política de Privacidade");
    expect(markup).toContain("Termos de Uso");
    expect(markup).toContain('href="#privacidade"');
    expect(markup).toContain('href="#termos"');
    expect(markup).toContain('id="contato"');
  });

  it("oferece retorno para a agenda principal", () => {
    const markup = renderToStaticMarkup(<Legal />);
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Voltar para a agenda");
  });

  it("expõe os links legais no rodapé", () => {
    const markup = renderToStaticMarkup(<SiteFooter />);
    expect(markup).toContain('href="/legal#privacidade"');
    expect(markup).toContain('href="/legal#termos"');
    expect(markup).toContain('aria-label="Links legais"');
  });
});
