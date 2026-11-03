import { getOAuthCallbackUri, getSafeReturnPath, OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS, getOAuthCallbackUri } from "@shared/const";

export const LEGAL_ACCEPTANCE_VERSION = "2026-08-17";
const LEGAL_ACCEPTANCE_KEY = "weekendvibes:legal-acceptance";
let pendingLoginReturnTo: string | undefined;

export function hasAcceptedLegalTerms() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LEGAL_ACCEPTANCE_KEY) === LEGAL_ACCEPTANCE_VERSION;
  } catch {
    return false;
  }
}

export function acceptLegalTerms() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEGAL_ACCEPTANCE_KEY, LEGAL_ACCEPTANCE_VERSION);
  } catch {
    // A privacy-restricted browser may deny storage; the current flow still completes once.
  }
}

export function getPendingLoginReturnTo() {
  return pendingLoginReturnTo;
}

export function completePendingLogin() {
  const returnTo = pendingLoginReturnTo;
  pendingLoginReturnTo = undefined;
  startLoginWithoutConsent(returnTo);
}

export function normalizeOAuthPortalOrigin(value: unknown, pageProtocol: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;
    if (pageProtocol === "https:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function buildOAuthPortalAuthUrl(input: { portalUrl: unknown; pageProtocol: string; appId: unknown; redirectUri: string; state: string }): string | null {
  const portalOrigin = normalizeOAuthPortalOrigin(input.portalUrl, input.pageProtocol);
  const appId = typeof input.appId === "string" ? input.appId.trim() : "";
  if (!portalOrigin || !appId) return null;
  try {
    const url = new URL("/app-auth", portalOrigin);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", input.redirectUri);
    url.searchParams.set("state", input.state);
    url.searchParams.set("type", "signIn");
    return url.toString();
  } catch {
    return null;
  }
}

function startLoginWithoutConsent(requestedReturnTo?: string) {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const portalOrigin = normalizeOAuthPortalOrigin(oauthPortalUrl, window.location.protocol);
  const normalizedAppId = typeof appId === "string" ? appId.trim() : "";
  if (!portalOrigin || !normalizedAppId) {
    const missingEnv = !portalOrigin ? "VITE_OAUTH_PORTAL_URL" : "VITE_APP_ID";
    console.error(`[OAuth] Login indisponível: configure ${missingEnv} no ambiente de build da aplicação.`);
    window.dispatchEvent(new CustomEvent("weekendvibes:oauth-configuration-error", { detail: { missingEnv } }));
    return;
  }
  const redirectUri = getOAuthCallbackUri(window.location.origin);

  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const returnTo = getSafeReturnPath(requestedReturnTo ?? currentPath);
  const state = encodeOAuthState({ redirectUri, nonce, returnTo });
  const url = buildOAuthPortalAuthUrl({ portalUrl: portalOrigin, pageProtocol: window.location.protocol, appId: normalizedAppId, redirectUri, state });
  if (!url) {
    console.error("[OAuth] Login indisponível: a configuração do portal OAuth não é válida.");
    window.dispatchEvent(new CustomEvent("weekendvibes:oauth-configuration-error", { detail: { missingEnv: "VITE_OAUTH_PORTAL_URL" } }));
    return;
  }
  window.location.href = url;
}

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const startLogin = (requestedReturnTo?: string) => {
  if (!hasAcceptedLegalTerms()) {
    pendingLoginReturnTo = requestedReturnTo;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("weekendvibes:legal-consent-required"));
    }
    return;
  }
  startLoginWithoutConsent(requestedReturnTo);
};
