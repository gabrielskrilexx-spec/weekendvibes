import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    headers: {} as Record<string, string>,
    clearedCookie: undefined as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(value: unknown) {
      response.body = value;
      return response;
    },
    setHeader(name: string, value: string) {
      response.headers[name] = value;
      return response;
    },
    end() {
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
    vi.stubEnv("OAUTH_CLIENT_ID", "github-client");
    vi.stubEnv("OAUTH_CLIENT_SECRET", "github-secret");
    vi.stubEnv("GITHUB_ADMIN_LOGIN", "admin-user");
    vi.stubEnv("GITHUB_ADMIN_ID", "123");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it.each([
    ["without an Accept header", undefined],
    ["with an application/json Accept header", "application/json"],
  ])("redirects GitHub login with HTTP 302 %s", async (_label, accept) => {
    const handler = register("/api/oauth/login");
    const response = createResponse();

    await handler?.({
      query: {},
      headers: accept ? { accept } : {},
      protocol: "https",
    }, response);

    expect(response.statusCode).toBe(302);
    expect(response.headers.Location).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize\?/);
    const location = new URL(String(response.headers.Location));
    expect(location.searchParams.get("client_id")).toBe("github-client");
    expect(location.searchParams.get("redirect_uri")).toBe("https://weekendvibes-dh6w.vercel.app/api/oauth/callback");
    expect(location.searchParams.get("state")).toBeTruthy();
  });

  it("recusa o login Dev Mode imediatamente em produção e registra IP e timestamp", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.NODE_ENV = "production";
    try {
      const handler = register("/api/auth/dev-login");
      const response = createResponse();
      await handler?.({ query: { redirect_to: "/admin", token: "secret" }, ip: "203.0.113.10", headers: {} }, response);
      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
      expect(mocks.upsertUser).not.toHaveBeenCalled();
      expect(mocks.createSessionToken).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith("[Security] Dev Mode access blocked in production", expect.objectContaining({
        event: "dev_login_blocked_production",
        ip: "203.0.113.10",
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }));
      const loggedPayload = warnSpy.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(loggedPayload).not.toHaveProperty("token");
      expect(loggedPayload).not.toHaveProperty("redirect_to");
    } finally {
      warnSpy.mockRestore();
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

  it("grava a sessão e redireciona para o painel após autenticação válida", async () => {
    mocks.exchangeCodeForToken.mockResolvedValue({ accessToken: "access-token" });
    mocks.getUserInfo.mockResolvedValue({ openId: "admin-open-id", name: "Admin Local", email: "admin@example.com" });
    const handler = register();
    const response = createResponse();
    const state = encodeOAuthState({
      redirectUri: "https://weekendvib-jscaalye.manus.space/api/oauth/callback",
      nonce: "expected-nonce",
      returnTo: "/admin",
    });

    await handler?.({
      query: { code: "opaque-code", state },
      headers: { cookie: `${OAUTH_STATE_COOKIE}=expected-nonce` },
      protocol: "https",
    }, response);

    expect(response.statusCode).toBe(302);
    expect(response.redirectLocation).toBe("/admin");
    expect(response.clearedCookie).toBe(OAUTH_STATE_COOKIE);
    expect(response.cookieName).toBe("app_session_id");
    expect(response.cookieValue).toBe("dev-session-token");
    expect(mocks.upsertUser).toHaveBeenCalledWith(expect.objectContaining({ openId: "admin-open-id" }));
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
    expect(response.body).toEqual({ error: "oauth_callback_failed", details: "provider unavailable" });
    expect(mocks.getUserInfo).not.toHaveBeenCalled();
    expect(response.clearedCookie).toBe(OAUTH_STATE_COOKIE);
  });

  it("troca o código GitHub, valida a allowlist e cria sessão admin", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "github-access-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 123, login: "admin-user", name: "Admin User", email: "" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const handler = register();
    const response = createResponse();
    const state = encodeOAuthState({
      redirectUri: "https://weekendvibes-dh6w.vercel.app/api/oauth/callback",
      nonce: "github-nonce",
      returnTo: "/admin",
      provider: "github",
    });

    await handler?.({
      query: { code: "github-code", state },
      headers: { cookie: `${OAUTH_STATE_COOKIE}=github-nonce` },
      protocol: "https",
    }, response);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://github.com/login/oauth/access_token");
    const tokenRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(tokenRequest.headers).toEqual(expect.objectContaining({ Accept: "application/json", "Content-Type": "application/json" }));
    expect(JSON.parse(String(tokenRequest.body))).toEqual({
      client_id: "github-client",
      client_secret: "github-secret",
      code: "github-code",
      redirect_uri: "https://weekendvibes-dh6w.vercel.app/api/oauth/callback",
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.github.com/user");
    expect(mocks.upsertUser).toHaveBeenCalledWith(expect.objectContaining({
      openId: "github:123",
      email: "admin-user@users.noreply.github.com",
      role: "admin",
      loginMethod: "github",
    }));
    expect(mocks.createSessionToken).toHaveBeenCalledWith("github:123", expect.any(Object));
    expect(response.cookieName).toBe("app_session_id");
    expect(response.statusCode).toBe(302);
    expect(response.redirectLocation).toBe("/admin");
    vi.unstubAllGlobals();
  });

  it("registra o código JSON retornado pelo GitHub sem expor o código OAuth", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: "bad_verification_code",
      error_description: "The code passed is incorrect or expired.",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const handler = register();
    const response = createResponse();
    const state = encodeOAuthState({
      redirectUri: "https://weekendvibes-dh6w.vercel.app/api/oauth/callback",
      nonce: "github-error-nonce",
      provider: "github",
    });

    await handler?.({
      query: { code: "sensitive-oauth-code", state },
      headers: { cookie: `${OAUTH_STATE_COOKIE}=github-error-nonce` },
    }, response);

    expect(response.statusCode).toBe(502);
    expect(response.body).toEqual({ error: "github_oauth_failed", error_description: "The code passed is incorrect or expired." });
    expect(errorSpy).toHaveBeenCalledWith("[OAuth] GitHub upstream rejected OAuth request", expect.objectContaining({
      stage: "exchange",
      status: 200,
      error: "bad_verification_code",
      error_description: "The code passed is incorrect or expired.",
    }));
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("sensitive-oauth-code");
    errorSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
