import { describe, expect, it } from "vitest";
import { formatSocialEventDate, injectSocialMetadata, renderSocialCardPng, renderSocialCardSvg, resolvePublicOrigins } from "./social-meta";

describe("metadados sociais públicos", () => {
  it("usa origens explícitas e não aceita URLs com caminho/credenciais/inseguras", () => {
    expect(resolvePublicOrigins({ PUBLIC_SITE_URL: "https://weekendvibes.example/", VERCEL_URL: "weekendvibes-pr-42.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "weekendvibes.example" } as NodeJS.ProcessEnv)).toEqual({
      canonicalOrigin: "https://weekendvibes.example",
      deploymentOrigin: "https://weekendvibes-pr-42.vercel.app",
    });
    expect(resolvePublicOrigins({ PUBLIC_SITE_URL: "http://attacker.example/path", VERCEL_URL: "" } as NodeJS.ProcessEnv)).toEqual({});
    expect(resolvePublicOrigins({ PUBLIC_SITE_URL: "https://user:pass@example.test", VERCEL_URL: "" } as NodeJS.ProcessEnv)).toEqual({});
  });

  it("injeta metadados específicos no HTML inicial e escapa texto/atributos", () => {
    const html = injectSocialMetadata("<!doctype html><html><head><title>antigo</title></head><body><div id=\"root\"></div></body></html>", {
      title: "Festa <Especial> & Amigos",
      description: "Santos \"noite\" & música",
      canonicalUrl: "https://weekendvibes.example/eventos/festa-especial",
      imageUrl: "https://preview.example/og/event/festa-especial.png",
      type: "event",
    });
    expect(html).toContain("<title>Festa &lt;Especial&gt; &amp; Amigos</title>");
    expect(html).toContain('property="og:title" content="Festa &lt;Especial&gt; &amp; Amigos"');
    expect(html).toContain('property="og:description" content="Santos &quot;noite&quot; &amp; música"');
    expect(html).toContain('property="og:image:type" content="image/png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).not.toContain("<title>antigo</title>");
  });

  it("gera um card SVG com escape XML para dados do evento", () => {
    const svg = renderSocialCardSvg({ title: "Noite A & B < especial", description: "Som & diversão", location: "Santos", date: "12 de novembro", kind: "event" });
    expect(svg).toContain("Noite A &amp; B &lt; especial");
    expect(svg).toContain("WEEKENDVIBES");
    expect(svg).toContain('width="1200" height="630"');
  });

  it("mantém datas sem timezone no dia civil de São Paulo", () => {
    expect(formatSocialEventDate("2026-11-12")).toBe("12 de novembro de 2026");
  });

  it("renderiza PNG legível em 1200×630 para crawlers de compartilhamento", () => {
    const png = renderSocialCardPng({ title: "Palcos da Baixada", description: "Explore os espaços de Santos e Guarujá.", kind: "venues" });
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.length).toBeGreaterThan(10_000);
  });
});
