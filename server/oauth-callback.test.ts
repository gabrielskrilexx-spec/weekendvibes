import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeOAuthState, OAUTH_STATE_COOKIE } from "@shared/const";

const mocks = vi.hoisted(() => ({
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    exchangeCodeForToken: mocks.exchangeCodeForToken,
    getUserInfo: mocks.getUserInfo,
  },
}));

vi.mock("./db", () => ({
  upsertUser: mocks.upsertUser,
}));

import { registerOAuthRoutes } from "./_core/oauth";

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    clearedCookie: undefined as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(value: unknown) {
      response.body = value;
      return response;
    },
    clearCookie(name: string) {
      response.clearedCookie = name;
      return response;
    },
    cookie() {
      return response;
    },
    redirect() {
      return response;
    },
  };
  return response;
}

function register() {
  let handler: ((req: any, res: any) => Promise<void>) | undefined;
  const app = { get: vi.fn((_path: string, callback: any) => { handler = callback; }) };
  registerOAuthRoutes(app as any);
  return handler;
}

describe("OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita state sem nonce correspondente antes de trocar o código", async () => {
    const handler = register();
    const response = createResponse();
    const state = encodeOAuthState({
      redirectUri: "https://weekendvib-jscaalye.manus.space/api/oauth/callback",
      nonce: "expected-nonce",
    });

    await handler?.({
      query: { code: "opaque-code", state },
      headers: { cookie: `${OAUTH_STATE_COOKIE}=different-nonce` },
    }, response);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: "invalid oauth state" });
    expect(mocks.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("mantém resposta pública genérica quando o provedor falha na troca", async () => {
    mocks.exchangeCodeForToken.mockRejectedValue({
      name: "AxiosError",
      code: "ERR_BAD_RESPONSE",
      response: { status: 502, data: { code: "upstream_unavailable", message: "provider unavailable" } },
    });
    const handler = register();
    const response = createResponse();
    const state = encodeOAuthState({
      redirectUri: "https://weekendvib-jscaalye.manus.space/api/oauth/callback",
      nonce: "expected-nonce",
    });

    await handler?.({
      query: { code: "opaque-code", state },
      headers: { cookie: `${OAUTH_STATE_COOKIE}=expected-nonce` },
    }, response);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: "oauth_callback_failed" });
    expect(mocks.getUserInfo).not.toHaveBeenCalled();
    expect(response.clearedCookie).toBe(OAUTH_STATE_COOKIE);
  });
});
