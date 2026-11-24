import { describe, expect, it } from "vitest";
import { normalizeDiscoveredSourceUrl, resolveDiscoveredSourceMatch } from "../shared/source-url";

describe("normalizeDiscoveredSourceUrl", () => {
  it("remove rastreadores, fragmentos, normaliza HTTPS/host e barra final", () => {
    expect(normalizeDiscoveredSourceUrl(
      "HTTP://ArTicket.COM.BR/e/7043/festival-dos-sonhos/?fbclid=abc&utm_source=instagram&igshid=xyz#agenda",
    )).toBe("https://articket.com.br/e/7043/festival-dos-sonhos");
  });

  it("remove todos os utm_* e preserva parâmetros funcionais como coupon", () => {
    expect(normalizeDiscoveredSourceUrl(
      "https://cart.ingresse.com/tickets?utm_campaign=stories&coupon=ISAVIEIRA&mc_cid=mail&foo=bar&utm_id=123",
    )).toBe("https://cart.ingresse.com/tickets?coupon=ISAVIEIRA&foo=bar");
  });

  it("trata a raiz com e sem barra final como a mesma fonte", () => {
    expect(normalizeDiscoveredSourceUrl("http://ARTICKET.COM.BR")).toBe("https://articket.com.br/");
    expect(normalizeDiscoveredSourceUrl("https://articket.com.br/")).toBe("https://articket.com.br/");
  });

  it("rejeita esquemas e credenciais inválidos", () => {
    expect(normalizeDiscoveredSourceUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeDiscoveredSourceUrl("https://user:password@example.com/event")).toBeNull();
  });
});

describe("resolveDiscoveredSourceMatch", () => {
  const sources = [
    { id: 12, sourceKey: "public:instagram-legacy", url: "https://articket.com.br/e/7402/show?fbclid=old" },
    { id: 7, sourceKey: "public:articket-7402", url: "https://ARTICKET.com.br/e/7402/show/?utm_source=instagram" },
    { id: 20, sourceKey: "public:ingresse", url: "https://www.ingresse.com/" },
  ];

  it("deduplica URLs que diferem apenas por rastreadores", () => {
    expect(resolveDiscoveredSourceMatch(sources, "http://articket.com.br/e/7402/show?gclid=new#ticket")).toMatchObject({ sourceKey: "public:articket-7402" });
  });

  it("prefere a fonte canônica de bilheteria a uma public:instagram-*", () => {
    expect(resolveDiscoveredSourceMatch(sources, "https://articket.com.br/e/7402/show")).toMatchObject({ sourceKey: "public:articket-7402" });
  });

  it("preserva parâmetros funcionais durante a deduplicação", () => {
    expect(resolveDiscoveredSourceMatch(
      [{ id: 1, sourceKey: "public:ingresse-coupon", url: "https://cart.ingresse.com/tickets?coupon=ISAVIEIRA" }],
      "http://cart.ingresse.com/tickets?coupon=ISAVIEIRA&utm_medium=story",
    )).toMatchObject({ sourceKey: "public:ingresse-coupon" });
  });
});
