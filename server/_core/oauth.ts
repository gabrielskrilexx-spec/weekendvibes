import { COOKIE_NAME, getSafeReturnPath, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { redactError } from "./security";

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

export function registerOAuthRoutes(app: Express) {
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
    const returnTo = getSafeReturnPath(oauthState.returnTo);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

    try {
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

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, returnTo);
    } catch (error) {
      console.error("[OAuth] Callback failed", { ...redactError(error), stage: "callback" });
      res.status(500).json({ error: "oauth_callback_failed" });
    }
  });
}
