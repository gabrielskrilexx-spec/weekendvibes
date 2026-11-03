import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acceptLegalTerms, buildOAuthPortalAuthUrl, hasAcceptedLegalTerms, LEGAL_ACCEPTANCE_VERSION, normalizeOAuthPortalOrigin, startLogin } from "./const";

function installWindow(storageValue: string | null = null) {
  const storage = {
    value: storageValue,
    getItem: vi.fn(() => storage.value),
    setItem: vi.fn((_key: string, value: string) => { storage.value = value; }),
  };
  const dispatchEvent = vi.fn();
  vi.stubGlobal("window", { localStorage: storage, dispatchEvent, location: { origin: "https://weekendvibes.example", protocol: "https:", pathname: "/admin/health", search: "", hash: "" } });
  return { storage, dispatchEvent };
}

describe("legal login consent", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("considera aceito apenas o versionamento legal atual", () => {
    installWindow(LEGAL_ACCEPTANCE_VERSION);
    expect(hasAcceptedLegalTerms()).toBe(true);
    installWindow("old-version");
    expect(hasAcceptedLegalTerms()).toBe(false);
  });

  it("persiste somente a versão atual ao aceitar", () => {
    const { storage } = installWindow();
    acceptLegalTerms();
    expect(storage.setItem).toHaveBeenCalledWith("weekendvibes:legal-acceptance", LEGAL_ACCEPTANCE_VERSION);
    expect(hasAcceptedLegalTerms()).toBe(true);
  });

  it("bloqueia o início do OAuth e solicita o aceite quando não há consentimento", () => {
    const { dispatchEvent } = installWindow();
    startLogin("/admin");
    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0][0].type).toBe("weekendvibes:legal-consent-required");
  });

  it("aceita somente uma origem OAuth absoluta e segura para o protocolo da página", () => {
    expect(normalizeOAuthPortalOrigin(" https://auth.example.test/ ", "https:")).toBe("https://auth.example.test");
    expect(normalizeOAuthPortalOrigin(undefined, "https:")).toBeNull();
    expect(normalizeOAuthPortalOrigin("javascript:alert(1)", "https:")).toBeNull();
    expect(normalizeOAuthPortalOrigin("http://auth.example.test", "https:")).toBeNull();
    expect(normalizeOAuthPortalOrigin("https://auth.example.test/path", "https:")).toBeNull();
  });

  it("monta /app-auth no portal e preserva os parâmetros OAuth", () => {
    const result = buildOAuthPortalAuthUrl({ portalUrl: "https://auth.example.test", pageProtocol: "https:", appId: "wv-app", redirectUri: "https://weekendvibes.example/api/oauth/callback", state: "encoded-state" });
    const url = new URL(String(result));
    expect(url.origin + url.pathname).toBe("https://auth.example.test/app-auth");
    expect(url.searchParams.get("appId")).toBe("wv-app");
    expect(url.searchParams.get("redirectUri")).toBe("https://weekendvibes.example/api/oauth/callback");
    expect(url.searchParams.get("state")).toBe("encoded-state");
    expect(url.searchParams.get("type")).toBe("signIn");
    expect(buildOAuthPortalAuthUrl({ portalUrl: undefined, pageProtocol: "https:", appId: "wv-app", redirectUri: "/callback", state: "state" })).toBeNull();
  });

  it("não quebra o login nem grava nonce quando VITE_OAUTH_PORTAL_URL está ausente", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "");
    vi.stubEnv("VITE_APP_ID", "wv-app");
    const { dispatchEvent } = installWindow(LEGAL_ACCEPTANCE_VERSION);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => startLogin("/admin/health")).not.toThrow();
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "weekendvibes:oauth-configuration-error", detail: { missingEnv: "VITE_OAUTH_PORTAL_URL" } }));
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
