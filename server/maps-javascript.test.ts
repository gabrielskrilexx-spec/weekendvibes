import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: { forgeApiUrl: "https://forge.test", forgeApiKey: "test-forge-key" },
}));

import { registerMapsJavascriptRoute } from "./maps-javascript";

function createResponse() {
  const response = {
    statusCode: 200,
    headers: new Map<string, string>(),
    body: "",
    status(code: number) { response.statusCode = code; return response; },
    type(value: string) { response.headers.set("content-type", value); return response; },
    setHeader(name: string, value: string) { response.headers.set(name.toLowerCase(), value); return response; },
    send(value: string) { response.body = value; return response; },
  };
  return response;
}

describe("Google Maps JavaScript relay", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("encaminha callback e origem HTTPS ao Forge e devolve JavaScript", async () => {
    let handler: ((req: any, res: any) => Promise<void>) | undefined;
    const app = { get: vi.fn((_path: string, callback: any) => { handler = callback; }) };
    registerMapsJavascriptRoute(app as any);
    const upstream = vi.fn().mockResolvedValue(new Response("window.google = window.google || {};", {
      status: 200, headers: { "content-type": "application/javascript" },
    }));
    vi.stubGlobal("fetch", upstream);
    const response = createResponse();
    await handler?.({
      protocol: "http", secure: false, query: { callback: "__weekendVibesMapsReady" },
      get(name: string) { return { host: "weekendvib-jscaalye.manus.space", "x-forwarded-proto": "https" }[name]; },
    }, response);
    expect(response.statusCode).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/javascript");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(upstream).toHaveBeenCalledOnce();
    const [request] = upstream.mock.calls[0] ?? [];
    const url = new URL(String(request));
    expect(url.origin + url.pathname).toBe("https://forge.test/v1/maps/proxy/maps/api/js");
    expect(url.searchParams.get("key")).toBe("test-forge-key");
    expect(url.searchParams.get("callback")).toBe("__weekendVibesMapsReady");
    expect(url.searchParams.get("origin")).toBe("https://weekendvib-jscaalye.manus.space");
  });

  it("prioriza o host encaminhado quando o request chega por host interno", async () => {
    let handler: ((req: any, res: any) => Promise<void>) | undefined;
    const app = { get: vi.fn((_path: string, callback: any) => { handler = callback; }) };
    registerMapsJavascriptRoute(app as any);
    const upstream = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", upstream);
    await handler?.({
      protocol: "http", secure: false, query: { callback: "__weekendVibesMapsReady" },
      get(name: string) {
        return { host: "127.0.0.1:3000", "x-forwarded-host": "weekendvib-jscaalye.manus.space", "x-forwarded-proto": "https" }[name];
      },
    }, createResponse());
    const [request] = upstream.mock.calls[0] ?? [];
    expect(new URL(String(request)).searchParams.get("origin")).toBe("https://weekendvib-jscaalye.manus.space");
  });

  it("rejeita callback que não seja um identificador JavaScript simples sem chamar upstream", async () => {
    let handler: ((req: any, res: any) => Promise<void>) | undefined;
    const app = { get: vi.fn((_path: string, callback: any) => { handler = callback; }) };
    registerMapsJavascriptRoute(app as any);
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = createResponse();
    await handler?.({
      protocol: "https", secure: true, query: { callback: "alert(1)" },
      get(name: string) { return name === "host" ? "weekendvib-jscaalye.manus.space" : undefined; },
    }, response);
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("invalid_callback");
    expect(upstream).not.toHaveBeenCalled();
  });
});
