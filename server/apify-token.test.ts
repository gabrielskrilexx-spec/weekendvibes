import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function validateApifyToken(token: string): Promise<boolean> {
  const response = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json", "User-Agent": "WeekendVibes/1.0" },
  });
  return response.ok;
}

describe("APIFY_API_TOKEN", () => {
  it("aceita resposta 200 sem expor a credencial", async () => {
    const token = "unit-test-token";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { username: "tester" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await validateApifyToken(token)).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain(encodeURIComponent(token));
  });

  it("reconhece autenticação negada (401)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })));
    expect(await validateApifyToken("invalid-token")).toBe(false);
  });

  it("reconhece falha do serviço (500)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("error", { status: 500 })));
    expect(await validateApifyToken("unit-test-token")).toBe(false);
  });

  const runExternal = process.env.RUN_EXTERNAL_TESTS === "1";
  const hasCredential = Boolean(process.env.APIFY_API_TOKEN?.trim());
  const externalIt = runExternal && hasCredential ? it : it.skip;
  externalIt("valida a credencial real somente quando explicitamente habilitado e configurado", async () => {
    const token = process.env.APIFY_API_TOKEN!.trim();
    const response = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json", "User-Agent": "WeekendVibes/1.0" },
    });
    expect(response.status, "a validação externa da credencial Apify falhou").toBe(200);
    const body = (await response.json()) as { data?: { username?: unknown } };
    expect(typeof body.data?.username).toBe("string");
  }, 20_000);
});
