import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeOAuthState, OAUTH_STATE_COOKIE } from "@shared/const";

const mocks = vi.hoisted(() => ({
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
  createSessionToken: vi.fn(() => Promise.resolve("dev-session-token")),
  upsertUser: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    exchangeCodeForToken: mocks.exchangeCodeForToken,
    getUserInfo: mocks.getUserInfo,
    createSessionToken: mocks.createSessionToken,
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
    cookie(name: string, value: unknown) {
      response.cookieName = name;
      response.cookieValue = value;
      return response;
    },
    cookieName: undefined as unknown,
    cookieValue: undefined as unknown,
    redirect(statusOrLocation?: number | string, maybeLocation?: string) {
      if (typeof statusOrLocation === "number") response.statusCode = statusOrLocation;
      response.redirectLocation = typeof statusOrLocation === "string" ? statusOrLocation : maybeLocation;
      return response;
    },
    redirectLocation: undefined as unknown,
  };
  return response;
}

function register(path = "/api/oauth/callback") {
  let handler: ((req: any, res: any) => Promise<void>) | undefined;
  const app = { get: vi.fn((registeredPath: string, callback: any) => { if (registeredPath === path) handler = callback; }) };
  registerOAuthRoutes(app as any);
  return handler;
}

describe("OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria sessão administrativa no Dev Mode e aceita somente retorno interno", async () => {
    const handler = register("/api/auth/dev-login");
    const response = createResponse();

    await handler?.({ query: { redirect_to: "https://evil.example/phishing" }, headers: {} }, response);

    expect(response.statusCode).toBe(302);
    expect(response.redirectLocation).toBe("/admin");
    expect(response.cookieName).toBe("app_session_id");
    expect(mocks.upsertUser).toHaveBeenCalledWith(expect.objectContaining({ role: "admin", loginMethod: "dev-mode" }));
    expect(mocks.createSessionToken).toHaveBeenCalled();
  });

  it("recusa o login Dev Mode imediatamente em produção", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const handler = register("/api/auth/dev-login");
      const response = createResponse();
      await handler?.({ query: { redirect_to: "/admin" }, headers: {} }, response);
      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
      expect(mocks.upsertUser).not.toHaveBeenCalled();
      expect(mocks.createSessionToken).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
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
