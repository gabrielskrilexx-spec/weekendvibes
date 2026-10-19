import { COOKIE_NAME, encodeOAuthState, getSafeReturnPath, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { redactError } from "./security";
import { ENV } from "./env";

const GITHUB_CALLBACK_URI = "https://weekendvibes-dh6w.vercel.app/api/oauth/callback";

type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  adminLogin: string;
  adminId: string;
  redirectUri: string;
};

/** Read OAuth secrets at request time; Vercel functions can reuse a warm module between requests. */
function getOAuthConfig(): OAuthConfig {
  return {
    clientId: (process.env.OAUTH_CLIENT_ID ?? "").trim(),
    clientSecret: (process.env.OAUTH_CLIENT_SECRET ?? "").trim(),
    adminLogin: (process.env.GITHUB_ADMIN_LOGIN ?? "").trim().toLowerCase(),
    adminId: (process.env.GITHUB_ADMIN_ID ?? "").trim(),
    redirectUri: (process.env.OAUTH_REDIRECT_URI ?? "").trim(),
  };
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function oauthFailureDetails(error: unknown, stage: "exchange" | "user_info" | "session") {
  const candidate = error as { code?: unknown; message?: unknown; response?: { status?: unknown; data?: unknown } };
  const data = candidate.response?.data as { code?: unknown; error?: unknown; message?: unknown } | undefined;
  return {
    stage,
    name: error instanceof Error && error.name ? error.name.slice(0, 80) : "Error",
    code: typeof candidate.code === "string" ? candidate.code.slice(0, 80) : "internal_error",
    upstreamStatus: typeof candidate.response?.status === "number" ? candidate.response.status : undefined,
    upstreamCode: typeof data?.code === "string" ? data.code.slice(0, 80) : undefined,
    message: typeof data?.message === "string" ? data.message.slice(0, 160) : typeof data?.error === "string" ? data.error.slice(0, 160) : undefined,
  };
}

type GithubTokenResponse = { access_token?: unknown; error?: unknown; error_description?: unknown };
type GithubUserResponse = { id?: unknown; login?: unknown; name?: unknown; email?: unknown };

class GithubOAuthError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly errorDescription?: string;

  constructor(status: number, errorCode: string, errorDescription?: string) {
    super(`GitHub OAuth request failed: ${errorCode}`);
    this.name = "GithubOAuthError";
    this.status = status;
    this.errorCode = errorCode;
    this.errorDescription = errorDescription;
  }
}

function boundedExternalMessage(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 160) : undefined;
}

async function fetchGithubJson<T>(url: string, init: RequestInit, stage: "exchange" | "user_info"): Promise<T> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/json",
        "User-Agent": "WeekendVibes-OAuth/1.0",
        ...(init.headers ?? {}),
      },
    });
    const payload = (await response.json().catch(() => ({}))) as T & { error?: unknown; error_description?: unknown };
    const upstreamError = boundedExternalMessage(payload.error);
    const upstreamDescription = boundedExternalMessage(payload.error_description);
    if (!response.ok || upstreamError) {
      console.error("[OAuth] GitHub upstream rejected OAuth request", {
        provider: "github",
        stage,
        status: response.status,
        error: upstreamError ?? "github_upstream_error",
        error_description: upstreamDescription,
      });
      throw new GithubOAuthError(response.status, upstreamError ?? "github_upstream_error", upstreamDescription);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("GitHub OAuth ")) throw error;
    console.error("[OAuth] GitHub upstream request failed", {
      provider: "github",
      stage,
      error: error instanceof Error ? error.name : "unknown_error",
    });
    throw error;
  }
}

async function completeGithubLogin(code: string, oauthState: ReturnType<typeof decodeOAuthState>, req: Request, res: Response) {
  const { clientId, clientSecret, adminLogin, adminId } = getOAuthConfig();
  if (!clientId || !clientSecret) {
    console.error("[OAuth] GitHub OAuth configuration incomplete", {
      provider: "github",
      stage: "configuration",
      clientIdConfigured: Boolean(clientId),
      clientSecretConfigured: Boolean(clientSecret),
    });
    res.status(503).json({ error: "github_oauth_not_configured" });
    return;
  }
  if (!adminLogin && !adminId) {
    console.error("[OAuth] GitHub admin allowlist missing", {
      provider: "github",
      stage: "configuration",
      adminLoginConfigured: false,
      adminIdConfigured: false,
    });
    res.status(503).json({ error: "github_admin_not_configured" });
    return;
  }

  const tokenResponse = await fetchGithubJson<GithubTokenResponse>("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: GITHUB_CALLBACK_URI,
    }),
  }, "exchange");
  const accessToken = typeof tokenResponse.access_token === "string" ? tokenResponse.access_token : "";
  if (!accessToken) {
    res.status(502).json({ error: "github_token_exchange_failed" });
    return;
  }

  const githubUser = await fetchGithubJson<GithubUserResponse>("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, "user_info");
  const githubId = typeof githubUser.id === "number" || typeof githubUser.id === "string" ? String(githubUser.id) : "";
  const githubLogin = typeof githubUser.login === "string" ? githubUser.login.trim() : "";
  if (!githubId || !githubLogin) {
    res.status(502).json({ error: "github_user_invalid" });
    return;
  }
  if ((adminId && githubId !== adminId) && (adminLogin && githubLogin.toLowerCase() !== adminLogin)) {
    console.warn("[OAuth] GitHub user rejected by admin allowlist", { githubId, githubLogin });
    res.status(403).json({ error: "github_user_not_authorized" });
    return;
  }

  const openId = `github:${githubId}`;
  const displayName = typeof githubUser.name === "string" && githubUser.name.trim() ? githubUser.name.trim() : githubLogin;
  await db.upsertUser({ openId, name: displayName, email: typeof githubUser.email === "string" ? githubUser.email : null, loginMethod: "github", lastSignedIn: new Date(), role: "admin" });
  const sessionToken = await sdk.createSessionToken(openId, { name: displayName, expiresInMs: ONE_YEAR_MS });
  res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
  res.redirect(302, getSafeReturnPath(oauthState.returnTo, "/admin"));
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/login", (req: Request, res: Response) => {
    const { clientId } = getOAuthConfig();
    if (!clientId) {
      res.status(503).json({ error: "oauth_not_configured" });
      return;
    }

    const nonce = randomUUID();
    const redirectUri = GITHUB_CALLBACK_URI;
    const returnTo = getSafeReturnPath(getQueryParam(req, "redirect_to"), "/admin");
    const state = encodeOAuthState({ redirectUri, nonce, returnTo, provider: "github" });
    res.cookie(OAUTH_STATE_COOKIE, nonce, {
      ...getSessionCookieOptions(req),
      maxAge: 10 * 60 * 1000,
    });

    const authorizationUrl = new URL("https://github.com/login/oauth/authorize");
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("scope", "read:user user:email");
    authorizationUrl.searchParams.set("state", state);
    return res.status(302).redirect(authorizationUrl.toString());
  });

  app.get("/api/auth/dev-login", async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === "production") {
      console.warn("[Security] Dev Mode access blocked in production", {
        event: "dev_login_blocked_production",
        ip: req.ip || "unknown",
        timestamp: new Date().toISOString(),
      });
      res.status(404).json({ error: "not_found" });
      return;
    }
    const openId = ENV.ownerOpenId;
    if (!openId) {
      res.status(503).json({ error: "dev_login_unavailable" });
      return;
    }
    try {
      await db.upsertUser({ openId, name: process.env.OWNER_NAME || "WeekendVibes Admin", loginMethod: "dev-mode", lastSignedIn: new Date(), role: "admin" });
      const sessionToken = await sdk.createSessionToken(openId, { name: process.env.OWNER_NAME || "WeekendVibes Admin", expiresInMs: ONE_YEAR_MS });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, getSafeReturnPath(getQueryParam(req, "redirect_to"), "/admin"));
    } catch (error) {
      console.error("[OAuth] Dev login failed", { stage: "dev_login", ...redactError(error) });
      res.status(500).json({ error: "dev_login_failed" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: the nonce in `state` must match the one-time cookie that
    // startLogin set in the browser that began this login. An attacker can
    // forge `state`, but cannot plant this cookie in the victim's browser.
    const oauthState = decodeOAuthState(state);
    const { nonce } = oauthState;
    const requestedReturnTo = getQueryParam(req, "redirect_to");
    const returnTo = getSafeReturnPath(requestedReturnTo ?? oauthState.returnTo);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

    try {
      if (oauthState.provider === "github") {
        await completeGithubLogin(code, oauthState, req, res);
        return;
      }

      let tokenResponse;
      try {
        tokenResponse = await sdk.exchangeCodeForToken(code, state);
      } catch (error) {
        console.error("[OAuth] Token exchange failed", oauthFailureDetails(error, "exchange"));
        throw error;
      }

      let userInfo;
      try {
        userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      } catch (error) {
        console.error("[OAuth] User info lookup failed", oauthFailureDetails(error, "user_info"));
        throw error;
      }

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      try {
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: new Date(),
        });
      } catch (error) {
        console.error("[OAuth] User persistence failed", oauthFailureDetails(error, "session"));
        throw error;
      }

      let sessionToken: string;
      try {
        sessionToken = await sdk.createSessionToken(userInfo.openId, {
          name: userInfo.name || "",
          expiresInMs: ONE_YEAR_MS,
        });
      } catch (error) {
        console.error("[OAuth] Session creation failed", oauthFailureDetails(error, "session"));
        throw error;
      }

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, returnTo);
    } catch (error) {
      if (error instanceof GithubOAuthError) {
        console.error("[OAuth] GitHub callback failed", {
          provider: "github",
          stage: "callback",
          status: error.status,
          error: error.errorCode,
          error_description: error.errorDescription,
        });
        res.status(502).json({
          error: "github_oauth_failed",
          error_description: error.errorDescription ?? error.errorCode,
        });
        return;
      }
      const errorCandidate = error as {
        name?: unknown;
        message?: unknown;
        stack?: unknown;
        response?: { data?: { message?: unknown; error?: unknown } };
      };
      const internalMessage = typeof errorCandidate?.message === "string"
        ? errorCandidate.message
        : typeof errorCandidate?.response?.data?.message === "string"
          ? errorCandidate.response.data.message
          : typeof errorCandidate?.response?.data?.error === "string"
            ? errorCandidate.response.data.error
            : String(error);
      const internalStack = typeof errorCandidate?.stack === "string"
        ? errorCandidate.stack
        : new Error(internalMessage).stack;
      console.error("[OAuth] Internal callback error:", {
        stage: "callback",
        name: typeof errorCandidate?.name === "string" ? errorCandidate.name : "Error",
        message: internalMessage,
        stack: internalStack,
      });
      console.error("[OAuth] Callback failed", { ...redactError(error), stage: "callback" });
      if (internalMessage === "JWT_SECRET is required" || internalMessage === "JWT_SECRET is required in environment variables") {
        res.status(500).json({
          error: "JWT_SECRET_MISSING",
          message: "JWT_SECRET is required in environment variables",
        });
        return;
      }
      res.status(500).json({ error: "oauth_callback_failed", details: internalMessage });
    }
  });
}
