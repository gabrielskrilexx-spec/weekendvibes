import { afterEach, describe, expect, it, vi } from "vitest";

const graphBase = "https://graph.facebook.com/v26.0";
const mockFetch = (responses: Array<{ body: unknown; status?: number }>) => {
  const fetchMock = vi.fn().mockImplementation(async () => {
    const next = responses.shift();
    if (!next) throw new Error("Unexpected Graph API request");
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

async function validateCredentials(token: string, accountId: string) {
  const meResponse = await fetch(`${graphBase}/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
  const me = await meResponse.json() as { id?: string; name?: string; error?: { message?: string } };
  if (!meResponse.ok) throw new Error(me.error?.message ?? `/me returned HTTP ${meResponse.status}`);
  if (!me.id) throw new Error("/me response did not include an id");

  const accountResponse = await fetch(`${graphBase}/${accountId}?fields=id&access_token=${encodeURIComponent(token)}`);
  const account = await accountResponse.json() as { id?: string; error?: { message?: string } };
  if (!accountResponse.ok) throw new Error(account.error?.message ?? `Account lookup returned HTTP ${accountResponse.status}`);
  if (account.id !== accountId) throw new Error("Account identity did not match META_INSTAGRAM_ACCOUNT_ID");
}

describe("Official Meta Instagram credentials", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("valida /me e a identidade da conta com Graph API simulada", async () => {
    const fetchMock = mockFetch([
      { body: { id: "user-123", name: "Test user" } },
      { body: { id: "17841400000000001" } },
    ]);
    await expect(validateCredentials("unit-test-token", "17841400000000001")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/me?fields=id,name");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/17841400000000001?fields=id");
    for (const [request] of fetchMock.mock.calls) {
      expect(String(request)).toContain("access_token=unit-test-token");
    }
  });

  it("falha quando /me retorna erro Graph API", async () => {
    mockFetch([{ body: { error: { message: "Invalid OAuth access token" } }, status: 401 }]);
    await expect(validateCredentials("bad-token", "account-1")).rejects.toThrow("Invalid OAuth access token");
  });

  it("falha quando a resposta /me não contém identidade", async () => {
    mockFetch([{ body: { name: "No identifier" } }]);
    await expect(validateCredentials("unit-test-token", "account-1")).rejects.toThrow("did not include an id");
  });

  it("falha quando a consulta da conta retorna erro Graph API", async () => {
    mockFetch([
      { body: { id: "user-123" } },
      { body: { error: { message: "Unsupported get request" } }, status: 400 },
    ]);
    await expect(validateCredentials("unit-test-token", "account-1")).rejects.toThrow("Unsupported get request");
  });

  it("falha quando a identidade da conta não corresponde ao ID configurado", async () => {
    mockFetch([{ body: { id: "user-123" } }, { body: { id: "different-account" } }]);
    await expect(validateCredentials("unit-test-token", "account-1")).rejects.toThrow("did not match");
  });

  const externalEnabled = process.env.RUN_EXTERNAL_TESTS === "1"
    && Boolean(process.env.META_INSTAGRAM_TOKEN?.trim())
    && Boolean(process.env.META_INSTAGRAM_ACCOUNT_ID?.trim());
  it.skipIf(!externalEnabled)("valida credenciais reais no Facebook Graph API (RUN_EXTERNAL_TESTS=1)", async () => {
    await validateCredentials(process.env.META_INSTAGRAM_TOKEN!.trim(), process.env.META_INSTAGRAM_ACCOUNT_ID!.trim());
  }, 20_000);
});
