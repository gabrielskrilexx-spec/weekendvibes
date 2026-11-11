import { createServer, type Server } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getEventBySlug: vi.fn() }));
import { getEventBySlug } from "./db";
import { registerSocialRoutes } from "./social-routes";

const eventFixture = {
  id: 41,
  slug: "festa-teste",
  title: "Festa Teste",
  description: "Uma noite especial em Santos.",
  eventDate: new Date("2026-11-12T23:00:00.000Z"),
  locationName: "Casa Teste",
  city: "Santos",
} as Awaited<ReturnType<typeof getEventBySlug>>;

describe("rotas sociais públicas", () => {
  let server: Server | undefined;
  let tempDir: string;
  let origin: string;

  beforeEach(async () => {
    vi.stubEnv("PUBLIC_SITE_URL", "https://weekendvibes.example");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "weekendvibes.example");
    vi.stubEnv("VERCEL_URL", "preview-weekendvibes.example");
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "weekendvibes-social-"));
    const indexPath = path.join(tempDir, "index.html");
    fs.writeFileSync(indexPath, "<!doctype html><html><head><title>Old</title></head><body><div id=\"root\"></div></body></html>");
    vi.mocked(getEventBySlug).mockResolvedValue(eventFixture);
    const app = express();
    registerSocialRoutes(app, indexPath);
    server = createServer(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No ephemeral test address");
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
    server = undefined;
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("envia metadados do evento no HTML inicial e sem executar JavaScript", async () => {
    const response = await fetch(`${origin}/eventos/festa-teste`, { headers: { "user-agent": "facebookexternalhit/1.1" } });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("<title>Festa Teste — WeekendVibes</title>");
    expect(html).toContain('property="og:title" content="Festa Teste — WeekendVibes"');
    expect(html).toContain('property="og:url" content="https://weekendvibes.example/eventos/festa-teste"');
    expect(html).toContain('property="og:image" content="https://preview-weekendvibes.example/og/event/festa-teste.png"');
    expect(html).toContain('<noscript><main aria-label="Festa Teste">');
    expect(html).toContain("Uma noite especial em Santos.");
    expect(html).toContain('<div id="root"></div>');
    expect(getEventBySlug).toHaveBeenCalledWith("festa-teste");
  });

  it("publica metadados sociais da vitrine Palcos da Baixada no HTML inicial", async () => {
    const response = await fetch(`${origin}/`);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("<title>Palcos da Baixada — WeekendVibes</title>");
    expect(html).toContain('property="og:url" content="https://weekendvibes.example/"');
    expect(html).toContain('property="og:image" content="https://preview-weekendvibes.example/og/palcos-da-baixada.png"');
    expect(html).toContain("casas de shows de Santos e Guarujá");
    expect(html).toContain('<noscript><main aria-label="Palcos da Baixada — WeekendVibes">');
  });

  it("retorna HTTP 404 e noindex para slug não publicado", async () => {
    vi.mocked(getEventBySlug).mockResolvedValueOnce(undefined);
    const response = await fetch(`${origin}/eventos/inexistente`);
    const html = await response.text();
    expect(response.status).toBe(404);
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).toContain("Evento não encontrado");
  });

  it("serve imagem PNG social com dimensão 1200×630 e cache público", async () => {
    const response = await fetch(`${origin}/og/event/festa-teste.png`);
    const png = Buffer.from(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});
