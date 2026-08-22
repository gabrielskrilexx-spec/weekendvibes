import { describe, expect, it } from "vitest";
import { extractPublicEventLinks } from "./ingestion";

describe("Zig Tickets adapter", () => {
  it("discovers internal event routes from the catalog HTML", () => {
    const html = `
      <a href="/eventos/japa-faz-a-festa-cabelinho">Japa</a>
      <a href="https://zig.tickets/eventos/gaia-connection">Gaia</a>
      <a href="/categorias/funk">Funk</a>
      <a href="https://example.com/eventos/fora-da-fonte">External</a>
    `;

    expect(extractPublicEventLinks(html, "https://zig.tickets/pt-BR")).toEqual([
      "https://zig.tickets/eventos/japa-faz-a-festa-cabelinho",
      "https://zig.tickets/eventos/gaia-connection",
    ]);
  });
});
